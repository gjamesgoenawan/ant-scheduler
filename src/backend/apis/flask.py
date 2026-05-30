import eventlet

eventlet.monkey_patch()

import atexit
import os
import signal
import sys
import threading
import traceback

from flask import Flask, jsonify, request, send_from_directory
from flask_compress import Compress
from flask_cors import CORS
from flask_socketio import SocketIO
from utils.structures import AntTask
from utils.misc import ANT_GIT_HASH

# ---- Setup ----
app = Flask(__name__)
CORS(app)
Compress(app) 
socketio = SocketIO(app, cors_allowed_origins="*")

r = None
runner_lock = threading.Lock()
shutdown_started = False

def shutdown_runner(signum=None, frame=None):
    global shutdown_started
    if shutdown_started:
        return
    shutdown_started = True

    if r is None:
        return

    try:
        if hasattr(r, "persist_recovery_snapshot"):
            has_pending_recovery = getattr(r, "_has_pending_recovery", lambda: False)()
            r.persist_recovery_snapshot(force=not has_pending_recovery)
    except Exception:
        traceback.print_exc()

    try:
        r.handler.reset()
    except Exception:
        traceback.print_exc()

    if signum is not None:
        sys.exit(0)

# ---- Utility for thread-safe execution ----
def safe_runner_call(func, *args, **kwargs):
    with runner_lock:
        try:
            result = func(*args, **kwargs)
            return jsonify({"status": "success", "data": result})
        except Exception as e:
            traceback.print_exc()
            return jsonify({"status": "error", "message": str(e)}), 500

# ---- API Endpoints ----
@app.route("/", methods=["GET"])
def home():
    return jsonify({"status": "success", "message": f"Ant-Scheduler Backend (commit: {ANT_GIT_HASH})"}), 200

@app.route("/status", methods=["GET"])
def status():
    return jsonify({"status": "success", "message": f"Ant-Scheduler Backend (commit: {ANT_GIT_HASH})"}), 200

@app.route("/kill_task", methods=["POST"])
def kill_task():
    data = request.get_json(force=True)
    task_ids = data.get("task_ids")
    if not task_ids:
        return jsonify({"status": "error", "message": "task_ids is required"}), 400
    return safe_runner_call(r.kill_task, task_ids)

@app.route("/add_task_to_queue", methods=["POST"])
def add_task_to_queue():
    data = request.get_json(force=True)
    task_data = data.get("task")
    if not task_data:
        return jsonify({"status": "error", "message": "task is required"}), 400

    if isinstance(task_data, dict):
        task_obj = AntTask(**task_data)
    elif isinstance(task_data, list):
        task_obj = [AntTask(**td) for td in task_data]
    else:
        return jsonify({"status": "error", "message": "Invalid task format"}), 400

    return safe_runner_call(r.add_task_to_queue, task_obj)

@app.route("/remove_task_from_queue", methods=["POST"])
def remove_task_from_queue():
    data = request.get_json(force=True)
    task_ids = data.get("task_ids")
    if not task_ids:
        return jsonify({"status": "error", "message": "task_ids is required"}), 400
    return safe_runner_call(r.remove_task_from_queue, task_ids)

@app.route("/promote_task_in_queue", methods=["POST"])
def promote_task_in_queue():
    data = request.get_json(force=True)
    task_ids = data.get("task_ids")
    if not task_ids:
        return jsonify({"status": "error", "message": "task_ids is required"}), 400
    return safe_runner_call(r.promote_task_in_queue, task_ids)

@app.route("/remove_task_from_history", methods=["POST"])
def remove_task_from_history():
    data = request.get_json(force=True)
    task_ids = data.get("task_ids")
    if not task_ids:
        return jsonify({"status": "error", "message": "task_ids is required"}), 400
    return safe_runner_call(r.remove_task_from_history, task_ids)

@app.route("/vis", methods=["GET"])
def vis():
    return safe_runner_call(r.vis)

@app.route("/recovery_state", methods=["GET"])
def recovery_state():
    return safe_runner_call(r.get_recovery_state)

@app.route("/restore_recovery", methods=["POST"])
def restore_recovery():
    data = request.get_json(force=True)
    return safe_runner_call(r.restore_recovery, data)

@app.route("/dismiss_recovery", methods=["POST"])
def dismiss_recovery():
    return safe_runner_call(r.dismiss_recovery)

@app.route("/toggle_allowed_gpu", methods=["POST"])
def toggle_allowed_gpu():
    data = request.get_json(force=True)
    gpu_indices = data.get("gpu_indices")
    allowed = data.get('allowed', True)
    if gpu_indices is None:
        return jsonify({"status": "error", "message": "gpu_indices is required"}), 400

    def toggle_func():
        for idx in gpu_indices:
            if allowed:
                r.gpu_allowed[idx] = 1
                r.logger.info(f'GPU {idx} Enabled')
            else:
                r.gpu_allowed[idx] = 0
                r.logger.info(f'GPU {idx} Disabled')
            
        return {"gpu_allowed": r.gpu_allowed}
    return safe_runner_call(toggle_func)

@app.route("/get_allowed_gpu", methods=["POST"])
def get_allowed_gpu():
    data = request.get_json(force=True)
    gpu_indices = data.get("gpu_indices")
    if gpu_indices is None:
        return jsonify({"status": "error", "message": "gpu_indices is required"}), 400
    return jsonify(r.gpu_allowed)

@app.route("/create_task", methods=["POST"])
def create_task():
    data = request.get_json(force=True)
    with runner_lock:
        result = r.create_task(data)
    if result['status'] == 'success':
        return jsonify(result), 200
    else:
        return jsonify(result), 400

@app.route("/get_log", methods=["GET"])
def get_log():
    task_id = request.args.get("task_id")  # get from query string
    full_log_arg = request.args.get("full_log", "false")
    tail_lines_arg = request.args.get("tail_lines")
    if not task_id:
        return jsonify({"status": "error", "message": "task_id is required"}), 400

    full_log = str(full_log_arg).strip().lower() in {"1", "true", "yes", "on"}
    tail_lines = None
    if tail_lines_arg not in {None, ""}:
        try:
            tail_lines = int(tail_lines_arg)
        except (TypeError, ValueError):
            return jsonify({"status": "error", "message": "tail_lines must be an integer"}), 400

        if tail_lines < 1:
            return jsonify({"status": "error", "message": "tail_lines must be >= 1"}), 400

    success, logs = r.get_log(task_id, full_log=full_log, tail_lines=tail_lines)
    
    if success:
        return jsonify({"status": "success", "data": logs}), 200
    else:
        return jsonify({"status": "error", "message": logs or "Log file not found", "data": logs}), 404

@app.route("/get_log_file", methods=["GET"])
def get_log_file():
    task_id = request.args.get("task_id")  # get from query string
    if not task_id:
        return jsonify({"status": "error", "message": "task_id is required"}), 400

    filename = r.get_log_file(task_id)
    if filename is None:
        return jsonify({"status": "error", "message": "Log file not found"}), 400

    log_root = os.path.realpath(os.path.abspath(r.opt.get('LOGGER_log_dir', './ant_runner_logs')))
    requested_file = os.path.realpath(os.path.abspath(filename))
    requested_dir = os.path.dirname(requested_file)

    if os.path.commonpath([log_root, requested_file]) == log_root:
        return send_from_directory(
            requested_dir,
            os.path.basename(requested_file),
            as_attachment=True 
        )
    else:
        r.logger.error(f"logger log_dir isn't in the requested file. Might be a security concern. Requested: {filename}")
        return jsonify({"status": "error", "data": "logger log_dir isn't in the requested file."}), 400

@app.route("/restart_task", methods=["GET"])
def restart_task():
    task_id = request.args.get("task_id")  # get from query string
    if not task_id:
        return jsonify({"status": "error", "message": "task_id is required"}), 400

    result = r.restart_task(task_id)
    
    if result['status'] == 'success':
        return jsonify(result), 200
    else:
        return jsonify(result), 400

@app.route("/get_envar", methods=["GET"])
def get_env():
    return jsonify(r.loader.get_envar())

@app.route("/save_envar", methods=["POST"])
def save_env_route():
    body = request.json
    envar = body.get("envar", {})
    r.loader.update_envar(envar)
    return jsonify({"status": "success"})

def emit_vis_data():
    """Emit /vis data every 1 second to all connected clients"""
    while True:
        with runner_lock:
            r.step()
            vis_data = r.vis()
        socketio.emit("update_vis_data", vis_data)
        socketio.sleep(r.opt["step_interval"])

def run_api(runner, debug: bool = False):
    global r
    r = runner
    atexit.register(shutdown_runner)
    signal.signal(signal.SIGTERM, shutdown_runner)
    signal.signal(signal.SIGINT, shutdown_runner)
    threading.Thread(target=emit_vis_data, daemon=True).start()

    host = "0.0.0.0"
    http_port = runner.opt['backend_port']

    if debug:
        app.run(host=host, port=http_port, debug=True, use_reloader=False)
    else:
        listener = eventlet.listen((host, http_port))
        eventlet.wsgi.server(listener, app, log_output=False)
