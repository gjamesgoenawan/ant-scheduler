import os
import subprocess
from typing import Optional

import psutil
from handler import base_handler
from logger import base_logger
from utils.misc import INF, list2str, read_last_n_lines, wrap_text
from utils.structures import AntTask


class subprocess_handler(base_handler):
    def __init__(self, 
                 opt,
                 logger: Optional[base_logger] = None) -> None:

        self.opt = opt
        self.pipe_to_file = self.opt.get('HANDLER_pipe_to_file', True)
        self.logger, self.log_dir = self.setup_logger(logger, return_log_dir = True)
        self.logger.info(f"Subprocess Handler Initiated. log_dir={self.log_dir}, pipe_to_file={self.pipe_to_file}")

        if self.pipe_to_file:
            os.makedirs(self.log_dir, exist_ok=True)

        self.worker_processes = {}

    def create_worker(self, 
                      task) -> None:
        # Create and open a log file for capturing output

        final_command = task.get_final_command(with_envar=True)
        if self.pipe_to_file:
            log_file_name = task.log_file_name
            with open(log_file_name, 'a') as log_file:
                # Create a subprocess to run the command
                process = subprocess.Popen(final_command , shell=True, stdout=log_file, stderr=log_file)
        else:
            process = subprocess.Popen(final_command , shell=True, stdout=None, stderr=None)
        
        self.logger.info(f"Spawned new worker. Command: {final_command}, Log file: {log_file_name}")
        return process 

    def _kill_worker(self, process: subprocess.Popen) -> None:
        try:
            parent_pid = process.pid
            parent = psutil.Process(parent_pid)
            for child in parent.children(recursive=True):
                child.terminate()
            parent.terminate()
        except Exception as e:
            process.terminate()
            process.wait()
    
    def terminate_task_id(self, 
                          task_id: str, 
                          is_completed: bool = False) -> bool:
        try:
            process_dict = self.worker_processes[task_id]
            del self.worker_processes[task_id]
        except KeyError:
            self.logger.error(f"Task ID {task_id} not found in running processes. Active processes: {list(self.worker_processes.keys())}")
            return None
        
        process = process_dict['process']
        task = process_dict['task']
        task_id = task.task_id

        # kill it.
        self._kill_worker(process=process)
        task.stop()
        
        # write details to logged file.
        try:
            log_file_name = task.log_file_name
        except AttributeError:
            log_file_name = os.path.join(self.log_dir, f"{task_id}.log")
        
        with open(log_file_name, 'a') as f:
            f.writelines([f"""
+==================================+
             {'TERMINATED' if not is_completed else 'COMPLETED'}             
+==================================+
Stop Time  : {task.get_time(type='stop', formatted=True)} ({task.get_time(type='stop', formatted=False):.2f})
Time Taken : {task.get_time(type='runtime', formatted=True)}
+==================================+
            """])

        if is_completed:
            self.logger.info(f'Task {task_id} completed! Removed from active process list.')
        else:
            self.logger.info(f'Task {task_id} terminated! Removed from active process list.')
        return task

    def run_task(self, task: AntTask) -> bool:        
        task_id = task.task_id
        task.log_file_name = os.path.join(self.log_dir, f"{task_id}.log")
            
        # start the task
        task.start()

        with open(task.log_file_name, 'w') as f:
            f.writelines([f"""
+==================================+
             ANT RUNNER             
+==================================+
ID           : {task.task_id}
Commands     : {task.get_final_command(with_envar=False)}
Final. C.    : {task.get_final_command(with_envar=True)}
Envar        : {task.envar}
Assigned GPU : {list2str(task.gpu_ids) if len(task.gpu_ids) > 0 else 'No GPU Assigned'}
Start Time   : {task.get_time(type='start', formatted=True)} ({task.get_time(type='start', formatted=False):.2f})
Handler      : subprocess_handler
+==================================+


"""])
            
        process = self.create_worker(task=task)
        self.worker_processes[task_id] = {'task' : task,
                                          'process' : process}

        # self.ongoing_task.append([cmd, task_id, start_time])
        return task
    
    def check_worker_status(self, process: str) -> bool:
        return process.poll() is None  # Returns True if the process is still running
    
    def check(self, task_id : str) -> bool:
        # True if the process is still running
        try:
            process_dict = self.worker_processes[task_id]
        except KeyError:
            self.logger.error(f"Task ID {task_id} not found in running processes. Active processes: {list(self.worker_processes.keys())}")
            return False

        status = self.check_worker_status(process=process_dict['process']) # True if process is still running
        
        if status:
            return True, None # process still running
        else:
            task = self.terminate_task_id(task_id=task_id, is_completed=True)
            return False, task # process is stopped
    
    def check_all(self):
        result = {'running_process' : [],
                  'completed_process' : []} 
        for task_id in list(self.worker_processes.keys()):
            process_dict = self.worker_processes[task_id]
            
            status = self.check_worker_status(process=process_dict['process'])
            if status:
                result['running_process'].append(process_dict['task'])
            else:
                task = self.terminate_task_id(task_id=task_id, is_completed=True)
                result['completed_process'].append(task)
        return result
    
    def reset(self) -> None:
        self.ongoing_task = []
        for task_id in list(self.worker_processes.keys()):
            self.terminate_task_id(task_id, is_completed=False)
        self.worker_processes = {}

    def vis(self) -> dict:
        # Main interface for visual representation
        win_height = self.opt.get('VISUALIZER_terminal_win_height', 20)
        win_width = self.opt.get('VISUALIZER_terminal_win_width', INF)
        text_wrap = self.opt.get('VISUALIZER_terminal_text_wrap', 'no-wrap')
        
        formatted_window_data = {}

        for task_id, process_dict in self.worker_processes.items():
            log_file_name = process_dict['task'].log_file_name
            if os.path.exists(log_file_name):
                content = [i.replace("\n", "") for i in read_last_n_lines(log_file_name, win_height)]  # Get last few lines
                formatted_window_data[task_id] = wrap_text(content, win_width, win_height, text_wrap)
            else:
                formatted_window_data[task_id] = ''
        return {'terminal_logs' : formatted_window_data}
            
            
    
    
