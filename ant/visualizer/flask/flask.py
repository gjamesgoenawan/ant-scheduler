import os
import sys
import time
import uuid
import threading
import eventlet
from flask import Flask, render_template, request, redirect, url_for, g, flash
from flask_minify  import Minify
from flask_socketio import SocketIO
from typing import Optional, Any

from ant.visualizer import base_visualizer
from ant.runner import base_runner
from ant.logger import base_logger
from ant.utils.misc import INF, join_command_list, parse_string

# configure flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = '901283901289089304859034890'
socketio = SocketIO(app)
Minify(app=app, html=True, js=True, cssless=True)
data_lock = threading.Lock()

# Shared data structure
vis_data = {'runner_visualization' : {'status' : {'gpu_name' : [str]  * 4,
                                                  'gpu_usage' : [[float] * 4],
                                                  'gpu_memory' : [[float] * 4],
                                                  'gpu_power_draw' : [[float] * 4]},
                                      'task_status' : {'running_tasks' : [dict],
                                                       'completed_tasks' : [dict],
                                                       'queued_tasks' : [dict],
                                                       'terminal_logs' : [dict]}}}

def find_task_by_task_id(dictionary, x, key='task_id'):
    global vis_data
    for i in dictionary:
        if i[key] == x:
            return i
    return None

# force https
@app.before_request
def redirect_to_https():
    if request.scheme == 'http':
        return redirect(request.url.replace("http://", "https://"))


@app.route('/')
def stats():
    return render_template('home/stats.html', segment='dashboard')

@socketio.on('connect')
def handle_connect():
    emit_vis_data()

def emit_vis_data():
    global vis_data
    socketio.emit('update_vis_data', vis_data)

def background_task():
    while True:
        emit_vis_data()
        socketio.sleep(1)

@app.route('/ongoing_task')
def ongoing_task():
        global vis_data
        return render_template('home/ongoing_task.html', segment='ongoing')
        
@app.route('/completed_task')
def completed_task():
        global vis_data
        return render_template('home/completed_task.html', segment='completed')

@app.route('/create_task', methods=['GET', 'POST'])
def create_task():
    if request.method == 'POST':
        global vis_data
        queue_mode = request.form['queue_mode']
        if queue_mode == 'Single':
            task_id = request.form['task_id']
            gpu_ids = request.form['n_gpus']
            command = request.form['command']
            new_task = [{'ant_task_id': task_id, 'ant_n_gpus': gpu_ids, 'command': command, 'envar' : {}}]
        
        else:
            command = request.form['command']
            new_task = [parse_string(i) for i in join_command_list(command.strip().split('\n'))]

        runner_instruction = {'task_to_queue' : new_task}
        vis_data = g.runner.step(runner_instruction)

        flash(['success', 'Task created successfully!'])        
        return redirect(url_for('create_task'))
    new_task_id = str(uuid.uuid4())
    return render_template('home/create_task.html', new_task_id=new_task_id, segment='create_task')

@app.route('/delete_queued_task/<task_id>') # change this to a redirect strategy
def delete_queued_task(task_id):
    global vis_data
    queued_task_to_delete = find_task_by_task_id(vis_data['runner_visualization']['task_status']['queued_tasks'], task_id, key='ant_task_id')
    
    if queued_task_to_delete is None:
        flash(['alert', f'Queued Task {task_id} is not found!'])
    else:
        runner_instruction = {'queued_task_to_delete' : queued_task_to_delete}
        vis_data = g.runner.step(runner_instruction)
        flash(['info', f'Queued Task {task_id} deleted successfully!'])

    return redirect(url_for('create_task'))

@app.route('/terminate_task/<task_id>')
def terminate_task(task_id):
    global vis_data
    task_to_terminate = find_task_by_task_id(vis_data['runner_visualization']['task_status']['running_tasks'], task_id, key='task_id')
    
    if task_to_terminate is None:
        flash(['alert', f'Task {task_id} is not found!'])
    else:
        runner_instruction = {'task_to_terminate' : task_to_terminate}
        vis_data = g.runner.step(runner_instruction)
        flash(['info', f'Task {task_id} terminated successfully!'])
    return redirect(url_for('ongoing_task'))

@app.route('/view_log/<task_id>')
def view_log(task_id):
    log_dir = g.runner.handler.log_dir
    if os.path.isfile(os.path.join(log_dir, f'{task_id}.log')) and '//' not in task_id:
        with open(os.path.join(log_dir, f'{task_id}.log')) as f:
            log_content = ''.join(f.readlines())
        log_content = log_content.replace('\n', '<br>')
    else:
        log_content = 'file not found'
    return(f'<pre>{log_content}</pre>')

def run_flask_app(host='0.0.0.0', port=5000):
    threading.Thread(target=background_task, daemon=True).start()

    # https start
    listener = eventlet.listen((host, port))
    ssl_args = {
        'certfile': 'cert/cert.pem',
        'keyfile': 'cert/key.pem'
    }
    listener = eventlet.wrap_ssl(listener, server_side=True, **ssl_args)
    eventlet.wsgi.server(listener, app)

    # http start - unused due to lacking copy to clipboard function
    #socketio.run(app, debug=False, host=host, port=port, ssl_context=('cert/cert.pem', 'cert/key.pem'))

class flask_visualizer(base_visualizer):
    def __init__(self, 
                 runner : base_runner, 
                 logger : Optional[base_logger] = None,
                 delay : int = 1,
                 host : str = '0.0.0.0',
                 port : int = 5000,
                 ongoing_command_max_output_lines : int = 20,
                 *args,
                 **kwargs):
        self.runner = runner
        self.delay = delay
        self.host = host
        self.port = port
        self.ongoing_command_max_output_lines = ongoing_command_max_output_lines
        self.logger = self.setup_logger(logger)

        app.before_request(self._set_g_variables)
        self.flask_thread = threading.Thread(target=run_flask_app, daemon=True, args=[self.host, self.port])
        self.flask_thread.start()
        self.is_initialized = True
        self.logger.info(f"Flask_visualizer started! Running on {host}:{port}. Delay={self.delay}")
    
    def _set_g_variables(self):
        g.runner = self.runner
        g.visualizer = self
    
    def get_vis_prop(self):
        return {'max_width' : INF, 
                'max_height' : self.ongoing_command_max_output_lines, 
                'text_wrap' : 'no-wrap', 
                'terminal_win_height' : self.ongoing_command_max_output_lines, 
                'terminal_win_width' : INF}

    def terminate(self):
        self.logger.info("Shutting down flask server.")
        sys.exit()

    def step(self, visualizer_response):
        global vis_data
        visualizer_response.update({"update_system_stats" : True})
        vis_data = self.runner.step(visualizer_response = visualizer_response, vis_prop = self.get_vis_prop())

    def run(self):
        try:
            while True:
                self.step(visualizer_response = {})
                time.sleep(self.delay)

        except KeyboardInterrupt:
            self.terminate()
