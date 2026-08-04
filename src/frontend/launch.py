import argparse
import asyncio
import contextlib
import fcntl
import json
import logging
import os
import pty
import signal
import struct
import subprocess
import termios
from urllib.parse import urlparse

import httpx
import websockets
from hypercorn.asyncio import serve
from hypercorn.config import Config
from quart import Quart, Response, request, send_from_directory, websocket, redirect

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger("ws-proxy")
logging.basicConfig(level=logging.ERROR)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "./dist/")
app = Quart(__name__, static_folder=STATIC_DIR, static_url_path="")

@app.after_request
async def add_static_cache_headers(response):
    if request.path.startswith("/assets/"):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif response.content_type and "text/html" in response.content_type:
        response.headers["Cache-Control"] = "no-cache"
    return response

@app.route("/api/", defaults={'path': ''}, methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
@app.route("/api/<path:path>", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy(path):
    if request.headers.get("upgrade", "").lower() == "websocket":
        return Response("Upgrade handled on /socket.io/", status=426)

    timeout = httpx.Timeout(connect=5.0, read=30.0, write=30.0, pool=5.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        forward_headers = {
            k: v
            for k, v in request.headers.items()
            if k.lower() not in {"host", "accept-encoding"}
        }
        # Force identity encoding so the proxy never forwards compressed log bytes as plain text.
        forward_headers["accept-encoding"] = "identity"
        backend_url = f"{BACKEND_URL}/{path}"
        try:
            resp = await client.request(
                request.method,
                backend_url,
                headers=forward_headers,
                content=await request.get_data(),
                params=request.args
            )
        except httpx.TimeoutException:
            logger.warning("Backend request timed out: %s %s", request.method, backend_url)
            return {"status": "error", "message": "Backend request timed out. Please retry."}, 504
        except httpx.RequestError as error:
            logger.warning("Backend request failed: %s %s (%s)", request.method, backend_url, error)
            return {"status": "error", "message": "Backend is temporarily unavailable."}, 502

        excluded_headers = {
            "content-encoding", "transfer-encoding", "connection",
            "keep-alive", "proxy-authenticate", "proxy-authorization",
            "te", "trailer", "upgrade"
        }

        headers = {k: v for k, v in resp.headers.items() if k.lower() not in excluded_headers}
        return Response(
            resp.content,
            status=resp.status_code,
            headers=headers,
            content_type=resp.headers.get("content-type", "application/json")
        )

@app.route("/socket.io/", methods=["GET", "POST", "OPTIONS"])
async def socketio_http_proxy():
    timeout = httpx.Timeout(connect=5.0, read=30.0, write=30.0, pool=5.0)
    forward_headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in {"host", "accept-encoding", "content-length"}
    }
    forward_headers["accept-encoding"] = "identity"

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.request(
                request.method,
                f"{BACKEND_URL}/socket.io/",
                headers=forward_headers,
                content=await request.get_data(),
                params=request.args,
            )
    except httpx.TimeoutException:
        return Response("Socket.IO backend timed out", status=504, content_type="text/plain")
    except httpx.RequestError as error:
        logger.warning("Socket.IO HTTP proxy failed: %s", error)
        return Response("Socket.IO backend unavailable", status=502, content_type="text/plain")

    excluded_headers = {
        "content-encoding", "transfer-encoding", "connection", "content-length",
        "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "upgrade",
    }
    headers = {
        key: value
        for key, value in response.headers.items()
        if key.lower() not in excluded_headers
    }
    return Response(
        response.content,
        status=response.status_code,
        headers=headers,
        content_type=response.headers.get("content-type", "text/plain"),
    )

async def _forward_ws(client_ws, backend_ws):
    async def client_to_backend():
        try:
            while True:
                msg = await client_ws.receive()
                await backend_ws.send(msg)
        except (asyncio.CancelledError, websockets.exceptions.ConnectionClosed):
            try: await backend_ws.close()
            except Exception: pass

    async def backend_to_client():
        try:
            async for msg in backend_ws:
                await client_ws.send(msg)
        except (asyncio.CancelledError, websockets.exceptions.ConnectionClosed):
            try: await client_ws.close()
            except Exception: pass

    tasks = [
        asyncio.create_task(client_to_backend()),
        asyncio.create_task(backend_to_client())
    ]
    done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    for t in pending:
        t.cancel()

@app.websocket("/socket.io/")
@app.websocket("/socket.io/<path:rest>")
async def socketio_ws_proxy(rest=None):
    qs = ""
    try:
        qs = request.query_string.decode()
    except Exception:
        try:
            scope = getattr(websocket, "scope", None) or getattr(websocket, "environ", None)
            if scope:
                # scope['query_string'] is bytes
                qsb = scope.get("query_string", b"")
                if isinstance(qsb, (bytes, bytearray)):
                    qs = qsb.decode()
                else:
                    qs = str(qsb)
        except Exception:
            pass

    if not qs:
        try:
            hdrs = dict(websocket.headers)
            referer = hdrs.get("referer") or hdrs.get("referrer")
            if referer and "?" in referer:
                qs = referer.split("?", 1)[1]
        except Exception:
            pass

    backend_url = f"{BACKEND_URL.replace('http', 'ws')}/socket.io/"
    if qs:
        backend_url += f"?{qs}"

    fwd_headers = []
    try:
        headers_source = None
        try:
            headers_source = dict(request.headers)
        except Exception:
            headers_source = dict(websocket.headers) if hasattr(websocket, "headers") else {}

        for k, v in headers_source.items():
            lk = k.lower()
            if lk in ("host", "upgrade", "connection", "sec-websocket-key",
                      "sec-websocket-version", "sec-websocket-extensions"):
                continue
            fwd_headers.append((k, v))
    except Exception:
        logger.exception("failed to build forward headers; continuing with empty headers")

    logger.info("WS proxy incoming: path=%s qs=%s headers=%s", getattr(websocket, "path", "(no-path)"), qs, headers_source if 'headers_source' in locals() else {})

    try:
        async with websockets.connect(backend_url, additional_headers=fwd_headers, open_timeout=5, max_size=None) as backend_ws:
            logger.info("Connected to backend ws %s", backend_url)
            await _forward_ws(websocket, backend_ws)
            logger.info("WS proxy normal exit")
    except Exception:
        logger.exception("socket.io proxy error")
        try:
            await websocket.close()
        except Exception:
            pass


@app.route("/")
async def default():
    return await send_from_directory(app.static_folder, "index.html")

@app.route("/home")
@app.route("/home/")
async def home():
    return await send_from_directory(app.static_folder, "index.html")

@app.route("/create_task")
@app.route("/create_task/")
async def create_task_page():
    return await send_from_directory(app.static_folder, "index.html")

@app.route("/ongoing_task")
@app.route("/ongoing_task/")
async def ongoing_task_page():
    return await send_from_directory(app.static_folder, "index.html")

@app.route("/completed_task")
@app.route("/completed_task/")
async def completed_task_page():
    return await send_from_directory(app.static_folder, "index.html")

@app.route("/logs")
@app.route("/logs/")
async def logs():
    return await send_from_directory(app.static_folder, "index.html")

@app.route("/terminal")
@app.route("/terminal/")
async def terminal():
    return await send_from_directory(app.static_folder, "index.html")

@app.route("/terminal/config")
async def terminal_config():
    return {"enabled": TERMINAL_ENABLED}

def resize_terminal(master_fd, rows, cols):
    normalized_rows = max(1, min(int(rows), 1000))
    normalized_cols = max(1, min(int(cols), 1000))
    window_size = struct.pack("HHHH", normalized_rows, normalized_cols, 0, 0)
    fcntl.ioctl(master_fd, termios.TIOCSWINSZ, window_size)

@app.websocket("/terminal/ws")
async def terminal_ws():
    if not TERMINAL_ENABLED:
        await websocket.close(1008)
        return

    origin = websocket.headers.get("origin")
    request_host = websocket.headers.get("host")
    if origin and urlparse(origin).netloc != request_host:
        logger.warning("Rejected cross-origin terminal websocket from %s", origin)
        await websocket.close(1008)
        return

    master_fd, slave_fd = pty.openpty()
    process = None
    loop = asyncio.get_running_loop()
    output_queue = asyncio.Queue()

    try:
        terminal_env = os.environ.copy()
        terminal_env.update({"TERM": "xterm-256color", "COLORTERM": "truecolor"})
        process = subprocess.Popen(
            [TERMINAL_SHELL, "-l"],
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            cwd=TERMINAL_WORKING_DIRECTORY,
            env=terminal_env,
            start_new_session=True,
            close_fds=True,
        )
        os.close(slave_fd)
        slave_fd = -1

        def read_pty_output():
            try:
                data = os.read(master_fd, 65536)
                if data:
                    output_queue.put_nowait(data)
                else:
                    output_queue.put_nowait(None)
            except OSError:
                output_queue.put_nowait(None)

        loop.add_reader(master_fd, read_pty_output)

        async def send_output():
            while True:
                data = await output_queue.get()
                if data is None:
                    return
                await websocket.send(data)

        async def receive_input():
            while True:
                message = await websocket.receive()
                if isinstance(message, bytes):
                    os.write(master_fd, message)
                    continue

                payload = json.loads(message)
                message_type = payload.get("type")
                if message_type == "input":
                    os.write(master_fd, str(payload.get("data", "")).encode())
                elif message_type == "resize":
                    resize_terminal(master_fd, payload.get("rows", 24), payload.get("cols", 80))
                elif message_type == "heartbeat":
                    await websocket.send(b"")

        send_task = asyncio.create_task(send_output())
        receive_task = asyncio.create_task(receive_input())
        process_task = asyncio.create_task(asyncio.to_thread(process.wait))
        done, pending = await asyncio.wait(
            [send_task, receive_task, process_task],
            return_when=asyncio.FIRST_COMPLETED,
        )

        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)
        for task in done:
            with contextlib.suppress(asyncio.CancelledError, Exception):
                task.result()
    except Exception:
        logger.exception("terminal websocket error")
    finally:
        with contextlib.suppress(Exception):
            loop.remove_reader(master_fd)
        if slave_fd >= 0:
            with contextlib.suppress(OSError):
                os.close(slave_fd)
        with contextlib.suppress(OSError):
            os.close(master_fd)
        if process is not None and process.poll() is None:
            with contextlib.suppress(ProcessLookupError):
                os.killpg(process.pid, signal.SIGTERM)
            try:
                await asyncio.wait_for(asyncio.to_thread(process.wait), timeout=1.5)
            except asyncio.TimeoutError:
                with contextlib.suppress(ProcessLookupError):
                    os.killpg(process.pid, signal.SIGKILL)

@app.route("/404")
async def notfound():
    return await send_from_directory(app.static_folder, "index.html")

@app.errorhandler(404)
async def catch_all(path):
    return redirect("/404")

def suppress_ssl_shutdown_timeout(loop, context):
    exception = context.get("exception")
    if isinstance(exception, TimeoutError) and "SSL shutdown timed out" in str(exception):
        logger.debug("Suppressed benign SSL shutdown timeout from a closed client connection.")
        return
    loop.default_exception_handler(context)

async def run_frontend_server(config):
    loop = asyncio.get_running_loop()
    loop.set_exception_handler(suppress_ssl_shutdown_timeout)
    await serve(app, config)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Start ANT frontend")
    parser.add_argument("--config", type=str, default="config/default.json", help="JSON config for ANT")
    parser.add_argument("--cert_path", type=str, default="cert", help="SSL Certificate Path")
    args, unknown_args = parser.parse_known_args()

    with open(args.config, "r") as f:
        opt = json.load(f)

    BACKEND_URL = f"http://localhost:{opt['backend_port']}"
    TERMINAL_ENABLED = bool(opt.get("TERMINAL_enabled", True))
    TERMINAL_SHELL = os.path.expanduser(str(opt.get("TERMINAL_shell", os.environ.get("SHELL", "/bin/bash"))))
    TERMINAL_WORKING_DIRECTORY = os.path.abspath(
        os.path.expanduser(str(opt.get("TERMINAL_working_directory", "~")))
    )
    if TERMINAL_ENABLED and not os.path.isfile(TERMINAL_SHELL):
        raise ValueError(f"TERMINAL_shell does not exist: {TERMINAL_SHELL}")
    if TERMINAL_ENABLED and not os.path.isdir(TERMINAL_WORKING_DIRECTORY):
        raise ValueError(
            f"TERMINAL_working_directory does not exist: {TERMINAL_WORKING_DIRECTORY}"
        )
    frontend_protocol = str(opt.get("FRONTEND_protocol", "https")).strip().lower()
    if frontend_protocol not in {"http", "https"}:
        raise ValueError("FRONTEND_protocol must be either 'http' or 'https'")

    # Hypercorn config
    config = Config()
    config.accesslog = None 
    config.bind = [f"0.0.0.0:{opt['frontend_port']}"] 
    if frontend_protocol == "https":
        config.certfile = os.path.join(args.cert_path, "cert.pem")
        config.keyfile = os.path.join(args.cert_path, "key.pem")

    print(f"Running frontend at {frontend_protocol}://0.0.0.0:{opt['frontend_port']}")
    
    asyncio.run(run_frontend_server(config))