import os
import time
import psutil
import subprocess
from ant.utils.misc import list2str, read_last_n_lines, wrap_text
from ant.handler import base_handler
from ant.logger import base_logger
from ant.utils.misc import INF
from typing import List, Any, Optional


class subprocess_handler(base_handler):
    def __init__(self, 
                 pipe_to_file : bool = True,
                 logger: Optional[base_logger] = None) -> None:

        self.worker_processes = {}
        self.command_list = []
        
        self.pipe_to_file = pipe_to_file

        self.logger, self.log_dir = self.setup_logger(logger, return_log_dir = True)
        
        self.logger.info(f"Subprocess Handler Initiated. log_dir={self.log_dir}, pipe_to_file={self.pipe_to_file}")

    def create_worker(self, cid: str, command: str, log_file_name : str) -> None:
        # Create and open a log file for capturing output
        if self.pipe_to_file:
            with open(log_file_name, 'a') as log_file:
                # Create a subprocess to run the command
                process = subprocess.Popen(command, shell=True, stdout=log_file, stderr=log_file)
        else:
            process = subprocess.Popen(command, shell=True, stdout=None, stderr=None)
        
        self.worker_processes[cid] = process
        self.logger.info(f"Spawned new worker. Command: {command}, Log file: {log_file_name}")
        return process 

    def kill_worker(self, cid: str) -> None:
        if cid in self.worker_processes:
            process = self.worker_processes[cid]
            try:
                parent_pid = process.pid
                parent = psutil.Process(parent_pid)
                for child in parent.children(recursive=True):
                    child.terminate()
                parent.terminate()
            except Exception as e:
                process.terminate()
                process.wait()
            del self.worker_processes[cid]
            self.logger.info(f"Killed worker {cid}.")
        else:
            self.logger.warning(f"Worker {cid} not found.")
    
    def terminate_command(self, cmd : dict | str) -> bool:
        delete_list = []
        for i in self.command_list:
            if i[0] == cmd:
                self.kill_worker(i[1])
                delete_list.append(i)
        
        for i in delete_list:
            self.command_list.remove(i)

        if len(delete_list) > 0: 
            return True
        else:
            return False

    def run_command(self, cmd: dict | str) -> bool:
        if cmd is None:
            return False
        
        if isinstance(cmd, dict):
            command = cmd['command']
            cid = cmd['task_id']
            start_time = cmd['start_time']
            gpu_ids = cmd['gpu_ids']
        else:
            command = cmd
            cid = f"manual_{time.strftime('%d_%M_%Y_%H_%M_%S')}"
            start_time = time.time()
            gpu_ids = "Not Specified"
        
        
        log_file_name = os.path.join(self.log_dir, f"{cid}.log")

        with open(log_file_name, 'w') as f:
            f.writelines([f"""+==================================+
             ANT RUNNER             
+==================================+
ID           : {cid}
Commands     : {command}
Assigned GPU : {list2str(gpu_ids)}
Start Time   : {start_time}
Handler      : subprocess_handler
+==================================+


"""])

        self.create_worker(cid, command, log_file_name)
        self.command_list.append([cmd, cid])
        return True
    
    def check_worker_status(self, cid: str) -> bool:
        if cid in self.worker_processes:
            process = self.worker_processes[cid]
            return process.poll() is None  # Returns True if the process is still running
        return False
    
    def check(self, cmd: dict | str) -> bool:
        result = False

        for i in self.command_list:
            if i[0] == cmd:
                cid = i[1]
                if not self.check_worker_status(cid):
                    result = True
                    self.kill_worker(cid)
                    self.command_list.remove(i)
                break
        
        return result

    def vis(self, vis_prop = {'max_width' : INF, 'max_height' : 20, 'text_wrap' : 'no-wrap', 'terminal_win_height' : 20, 'terminal_win_width' : INF}) -> dict:
        # Main interface for visual representation
        win_height = vis_prop['terminal_win_height']
        win_width = vis_prop['terminal_win_width']
        text_wrap = vis_prop['text_wrap']
        
        formatted_window_data = {}
        
        for task in self.command_list:
            cid = task[1]
            log_file_name = os.path.join(self.log_dir, f"{cid}.log")
            if os.path.exists(log_file_name):
                content = [i.replace("\n", "") for i in read_last_n_lines(log_file_name, win_height)]  # Get last few lines
                formatted_window_data[cid] = wrap_text(content, win_width, win_height, text_wrap)
        
        return {'handler_visualization' : {'terminal_logs': formatted_window_data}}
    
    def reset(self) -> None:
        self.command_list = []
        for cid in list(self.worker_processes.keys()):
            self.kill_worker(cid)
