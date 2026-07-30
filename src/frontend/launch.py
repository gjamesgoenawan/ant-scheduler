import argparse
import asyncio
import json
import logging
import os

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

@app.route("/api/", defaults={'path': ''}, methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
@app.route("/api/<path:path>", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy(path):
    if request.headers.get("upgrade", "").lower() == "websocket":
        return Response("Upgrade handled on /socket.io/", status=426)

    async with httpx.AsyncClient() as client:
        forward_headers = {
            k: v
            for k, v in request.headers.items()
            if k.lower() not in {"host", "accept-encoding"}
        }
        # Force identity encoding so the proxy never forwards compressed log bytes as plain text.
        forward_headers["accept-encoding"] = "identity"
        backend_url = f"{BACKEND_URL}/{path}"
        resp = await client.request(
            request.method,
            backend_url,
            headers=forward_headers,
            content=await request.get_data(),
            params=request.args
        )

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