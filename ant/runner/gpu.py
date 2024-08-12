import os
import copy
import uuid
import time
import datetime
import subprocess
from typing import List, Dict, Any, Optional

from ant.utils.misc import list2str, parse_envar, INF, read_last_n_lines, wrap_text, format_timedelta
from ant.utils.sysinfo import get_system_info
from ant.runner import base_runner
from ant.loader import base_loader
from ant.logger import base_logger
from ant.handler import base_handler

def get_gpu_names():
    gpu_names = [i.strip() for i in subprocess.check_output("nvidia-smi -L", shell=True).decode().split("\n") if len(i) > 0]
    return gpu_names

class gpu_runner(base_runner):
    def __init__(self, 
                 gpu_ids : List[str], 
                 handler : base_handler, 
                 loader : Optional[base_loader] = None,
                 logger : Optional[base_logger] = None,) -> None:
        
        self.gpu_names = get_gpu_names()
        self.gpu_ids = gpu_ids
        
        # Sanity Check if the system support the specified gpu devices
        if max(self.gpu_ids) > len(self.gpu_names):
            raise ValueError("Number of GPU exceed the avialable devices")
        self.gpu_names = [self.gpu_names[i] for i in self.gpu_ids]
        self.gpu_availability : List = [1 for i in self.gpu_ids]
        
        self.handler = handler
        self.logger, self.original_logger = self.setup_logger(logger, return_original_logger = True)

        # get initial gpu stats
        current_system_stats = get_system_info(gpu_ids = self.gpu_ids, full=True)
        self.system_stats = {
                'gpu_id' : self.gpu_ids,
                'cpu_name' : current_system_stats['cpu_name'],
                'cpu_count': current_system_stats['cpu_count'],
                'cpu_usage': copy.deepcopy([current_system_stats['cpu_usage']]*300),
                'ram_total': current_system_stats['ram_total'],
                'ram_usage' : copy.deepcopy([current_system_stats['ram_usage']]*300),
                'gpu_uuid': current_system_stats['gpu_uuid'],
                'gpu_name': current_system_stats['gpu_name'],
                'gpu_usage': [copy.deepcopy([i]*300) for i in current_system_stats['gpu_usage']],
                'gpu_memory': [copy.deepcopy([i]*300) for i in current_system_stats['gpu_memory']],
                'gpu_total_memory': current_system_stats['gpu_total_memory'],
                'gpu_power_draw': [copy.deepcopy([i]*300) for i in current_system_stats['gpu_power_draw']],
                'gpu_power_limit' : current_system_stats['gpu_power_limit'],
                'gpu_task' : [],
            }

        if self.original_logger.log_file_name is not None:
            self.file_logger_enabled = True
            self.file_logger_filename = self.original_logger.log_file_name
        else:
            self.file_logger_enabled = False

        self._current_ongoing_task : List[Any] = []
        self._current_cmd = {'command': '',
                             'ant_n_gpus': INF,
                             'envar' : {}}
        
        if loader is not None:
            self.loader = loader
            self.loader_mode = True
        else:
            self.loader_mode = False
            self.task_list : List = []
            self._current_task_idx = 0
        
        self.completed_tasks = []
        
        self.logger.info(f"GPU Runner initiated. Configure to utilize GPU {list2str(gpu_ids)}. loader_mode={self.loader_mode}")
    
    def update_system_stats(self):
        current_system_stats = get_system_info(gpu_ids = self.gpu_ids, full=False)
        for idx in range(len(self.gpu_ids)):
            self.system_stats['gpu_usage'][idx] = self.system_stats['gpu_usage'][idx][1:] + [current_system_stats['gpu_usage'][idx]]
            self.system_stats['gpu_memory'][idx] = self.system_stats['gpu_memory'][idx][1:] + [current_system_stats['gpu_memory'][idx]]
            self.system_stats['gpu_power_draw'][idx] = self.system_stats['gpu_power_draw'][idx][1:] + [current_system_stats['gpu_power_draw'][idx]]
        self.system_stats['ram_usage'] = self.system_stats['ram_usage'][1:] + [current_system_stats['ram_usage']]
        self.system_stats['cpu_usage'] = self.system_stats['cpu_usage'][1:] + [current_system_stats['cpu_usage']]
        
    
    def block_gpu(self, x : str | int | List) -> None:
        if isinstance(x, str) and x == "all":
            for i in range(len(self.gpu_availability)):
                self.gpu_availability[i] = 0
        elif isinstance(x, int):
            self.gpu_availability[x] = 0
        elif isinstance(x, List):
            for i in x:
                self.gpu_availability[i] = 0
    
    def unblock_gpu(self, x : str | int | List) -> None:
        if isinstance(x, str) and x == "all":
            for i in range(len(self.gpu_availability)):
                self.gpu_availability[i] = 1
        elif isinstance(x, int):
            self.gpu_availability[x] = 1
        elif isinstance(x, List):
            for i in x:
                self.gpu_availability[i] = 1
    
    def update_task_list(self, x : List, mode : str = 'append', reset : bool = False):
        # only if self.loader_mode is False.
        # task list has to be in the format of:
        # {'command': str,
        #  'ant_n_gpus': int, [HAS TO BE PRESENT]
        #  'envar' : dict[str, str]}

        if not self.loader_mode:
            if mode == 'append':
                self.task_list += x
            elif mode == 'replace':
                self.task_list = x
            elif mode == 'remove':
                for _x in x:
                    self.task_list.remove(_x)
            if reset:
                self._current_task_idx = 0

    def step(self, visualizer_response : dict = {}, vis_prop : dict = {'max_width' : INF, 'max_height' : 20, 'text_wrap' : 'no-wrap', 'terminal_win_height' : 20, 'terminal_win_width' : INF}):
        
        if 'task_to_terminate' in visualizer_response.keys(): # terminate_job
            self.handler.terminate_command(visualizer_response['task_to_terminate'])
            self.unblock_gpu(visualizer_response['task_to_terminate']['gpu_idx'])
            total_time = format_timedelta(datetime.timedelta(seconds=round(time.time()-visualizer_response['task_to_terminate']['start_time'])))
            self._current_ongoing_task.remove(visualizer_response['task_to_terminate'])
            visualizer_response['task_to_terminate']['terminated'] = True
            visualizer_response['task_to_terminate']['total_time'] = total_time
            visualizer_response['task_to_terminate']['start_time_readable'] = datetime.datetime.fromtimestamp(visualizer_response['task_to_terminate']['start_time']).strftime("%Y-%m-%d %H:%M:%S")
            self.completed_tasks.append(visualizer_response['task_to_terminate'])
            self.logger.info(f"Task {visualizer_response['task_to_terminate']['task_id']} terminated. Took {total_time}")
            
        if 'queued_task_to_delete' in visualizer_response.keys(): # delete_queued_job
            if self.loader_mode:
                self.loader.remove([visualizer_response['queued_task_to_delete']])
            else:
                self.update_task_list([visualizer_response['queued_task_to_delete']], mode='remove')
        
        if 'task_to_queue' in visualizer_response.keys(): # add_queued_job
            if self.loader_mode:
                self.loader.append([visualizer_response['task_to_queue']])
            else:
                self.update_task_list([visualizer_response['task_to_queue']], mode='append') # input must be list
        
        if 'update_system_stats' in visualizer_response.keys() and visualizer_response['update_system_stats'] is True:
            self.update_system_stats()

        if self.loader_mode:
            self._current_cmd = self.loader.pop(delete_first_entry=False)

        else:
            if self._current_task_idx >= len(self.task_list):
                self._current_cmd = {'command': '',
                                     'ant_n_gpus': INF,
                                     'envar' : {}}
            else:
                self._current_cmd = self.task_list[self._current_task_idx]
        
        # check if any of the task is done.
        removed_task = []
        for idx, current_task in enumerate(self._current_ongoing_task):
            if self.handler.check(current_task):
                self.unblock_gpu(current_task['gpu_idx'])
                removed_task.append(current_task)
                total_time = format_timedelta(datetime.timedelta(seconds=round(time.time()-current_task['start_time'])))
                current_task['terminated'] = False
                current_task['start_time_readable'] = datetime.datetime.fromtimestamp(current_task['start_time']).strftime("%Y-%m-%d %H:%M:%S")
                current_task['total_time'] = total_time
                self.completed_tasks.append(current_task)
                self.logger.info(f"Task {current_task['task_id']} finished. Took {total_time}")
        
        for current_task in removed_task:
            self._current_ongoing_task.remove(current_task)
        
        # check if any task can be assigned to the gpu
        # if yes, then assign it to the specified required gpu number
        # future plans : support literal gpu_id specification.

        if sum(self.gpu_availability) >= self._current_cmd['ant_n_gpus']:
            assigned_gpus = 0
            gpu_ids = [] # this is system gpu id. will be passed to CUDA_VISIBLE_DEVICES
            gpu_idx = [] # this is internal gpu number, always <len((self.gpu_ids))
            for idx, status in enumerate(self.gpu_availability):
                if status == 1:
                    assigned_gpus += 1
                    gpu_idx.append(idx)
                    gpu_ids.append(self.gpu_ids[idx])
                
                if assigned_gpus >= self._current_cmd['ant_n_gpus']:
                    break
            self.block_gpu(gpu_idx)

            # get task_id if avaialble.
            task_id = str(self._current_cmd.get('ant_task_id', uuid.uuid4()))

            output = {
                'task_id' : task_id,
                'start_time' : time.time(),
                'gpu_idx' : gpu_idx,
                'gpu_ids' : gpu_ids,
                'command' : f'export CUDA_VISIBLE_DEVICES={list2str(gpu_ids)}{parse_envar(self._current_cmd["envar"])}; {self._current_cmd["command"]}'
            }

            self.handler.run_command(output)
            self._current_ongoing_task.append(output)

            if self.loader_mode:
                self.loader.pop(delete_first_entry=True)
            else:
                self._current_task_idx += 1
            
            self.logger.info(f"Task {output['task_id']} on GPU {list2str(output['gpu_ids'])} started.")

        return self.vis(vis_prop)
    
    def vis(self, vis_prop = {'max_width' : INF, 'max_height' : 20, 'text_wrap' : 'no-wrap', 'terminal_win_height' : 20, 'terminal_win_width' : INF}):
        current_vis = self.handler.vis(vis_prop)

        # runner_visualizer
        gpu_task = ["IDLE" for i in range(len(self.gpu_availability))]
        for task in self._current_ongoing_task:
            for _gpu_idx in task['gpu_idx']:
                gpu_task[_gpu_idx] = task['task_id']

        if self.loader_mode:
            task_queue = self.loader.get_queue()
        else:
            task_queue = self.task_list
        
        self.system_stats['gpu_task'] = gpu_task
                
        runner_visualization = {'status' : self.system_stats,
                                'task_status' : {'running_tasks' : self._current_ongoing_task,
                                                'queued_tasks' : task_queue,
                                                'completed_tasks' : self.completed_tasks,
                                                'terminal_logs' : [current_vis['handler_visualization']['terminal_logs'][task['task_id']] for task in self._current_ongoing_task]}}

        current_vis.update({'runner_visualization': runner_visualization})

        if self.file_logger_enabled:

            max_width = vis_prop['max_width']
            max_height = vis_prop['max_height']
            text_wrap = vis_prop['text_wrap']

            formatted_log_data = []

            try:
                content = [i.replace("\n", "") for i in read_last_n_lines(self.file_logger_filename, max_height-5)]  # Get last few lines
            except FileNotFoundError:
                self.original_logger.check_and_recreate_file_handler()
                content = []

            formatted_log_data = (self.file_logger_filename, wrap_text(content, max_width, max_height, text_wrap))
 
        else:
            formatted_log_data = ["", "[ WARNING ] FILE LOGGER IS NOT ENABLED"]

        current_vis.update({'log_visualizer' : formatted_log_data})
        
        return current_vis
