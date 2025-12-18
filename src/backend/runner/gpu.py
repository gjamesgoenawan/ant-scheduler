import re
import os
import ast
import copy
import uuid
from typing import Any, Dict, List, Optional, Tuple, Union

from handler import base_handler
from loader import base_loader
from logger import base_logger
from monitor import ThreadedMonitor
from utils.misc import (handle_singular_or_plural, list2str,
                        parse_and_truncate_file, split_commands,
                        sanitize_task_id, increment_task_id)
from utils.structures import AntTask

from . import base_runner


class gpu_runner(base_runner):
    """
    GPU-based task scheduler and runner.
    """

    def __init__(
        self,
        opt: dict,
        handler: base_handler,
        loader: Optional[base_loader] = None,
        logger: Optional[base_logger] = None,
    ) -> None:
        super().__init__()
        self.opt = opt
        self.gpu_ids = self.opt.get("gpu_ids", [])

        # Core components
        self.handler = handler
        self.logger = self.setup_logger(logger)
        self.loader = loader

        # Initialize GPU monitoring
        self.monitor = ThreadedMonitor(opt)
        # self.gpu_names = self.monitor.current_stats["gpu_name"]

        # Verify GPU indices
        max_id = max(self.gpu_ids)
        if max_id >= self.monitor.current_stats["gpu_count"]:
            raise ValueError("GPU index out of range of available devices")

        # GPU statuses
        self.gpu_allowed: List[int] = [1] * len(self.gpu_ids)  # manual flag.
        self.gpu_availability: List[int] = [1] * len(self.gpu_ids)
        self.gpu_status = {
            "gpu_task": [],
            "gpu_availability": [],
        }

        self.logger.info(f"GPURunner initialized: GPUs={list2str(self.gpu_ids)}")

    def _ADGS_check(self) -> None:
        """
        ADGS Detection Logic
        """
        if not self.opt.get("ADGS_enabled", False):
            return

        threshold_usage = self.opt.get("ADGS_thresh_usage", 0.5)
        threshold_mem = self.opt.get("ADGS_mem_usage", 0.5)

        for idx, hist in enumerate(self.system_stats["gpu_usage"]):
            recent_usage = sum(hist[-20:]) / 20
            recent_mem = (
                sum(self.system_stats["gpu_memory"][idx][-20:])
                / 20
                / self.system_stats["gpu_total_memory"][idx]
            )
            if recent_usage > threshold_usage or recent_mem > threshold_mem:
                self.gpu_availability[idx] = 0
            else:
                # only free if not in use by our tasks
                if not any(idx in t["gpu_idx"] for t in self._ongoing_tasks):
                    self.gpu_availability[idx] = 1

    def set_gpu_states(
        self,
        idx: Union[int, List[int], str],
        mode: str = "block",
        op_type: str = "availability",
    ) -> None:
        """Block / Unlbock specified GPUs."""

        if mode.lower() == "block":
            value = 0
        elif mode.lower() == "unblock":
            value = 1
        else:
            self.logger.error(
                f"Unrecognized mode in _block_gpu. Expected 'block' or 'unblock', got : '{mode}'"
            )
            return

        if op_type.lower() == "availability":
            var = self.gpu_availability
        elif op_type.lower() == "allowed":
            var = self.gpu_allowed
        else:
            self.logger.error(
                f"Unrecognized op_type in _block_gpu. Expected 'availability' or 'allowed', got : {op_type}"
            )
            return

        if idx == "all":
            var = [value] * len(var)
        else:
            for i in [idx] if isinstance(idx, int) else idx:
                var[i] = value

    def get_gpu_assignment(
        self,
        n: int,
    ) -> Tuple[bool, List[int]]:
        """
        Get n GPUs Assignment. Doesn't block / unblock.

        returns: Tuple[Bool, List[int]]
        """
        if n < 0:
            self.logger.error(f"n has to be a positive value. Got n={n}")
            return False, []
        if n == 0:
            return True, []  # 0 always can run

        gpu_status = [
            self.gpu_allowed[_i] * self.gpu_availability[_i]
            for _i in range(len(self.gpu_ids))
        ]

        cnt = 0
        gpu_idx = []
        for i in range(0, len(gpu_status)):
            if gpu_status[i] > 0:
                cnt += 1
                gpu_idx.append(i)
            if cnt == n:
                return True, gpu_idx
        return False, []

    #################
    # Queue stuff
    #################
    @handle_singular_or_plural
    def add_task_to_queue(self, 
                          task_to_queue: List[AntTask],
                          allow_partial: List[bool] = [True]):
        
        if isinstance(allow_partial, list):
            allow_partial = allow_partial[0]

        success = []
        message = []
        current_queue_list = set() 
        # unique task_id sanitation
        for _t in task_to_queue:
            if _t.task_id in self.task_id_history:
                self.logger.error(f"Task ID '{_t.task_id}' already exists in previously ran task(s).")
                message.append(f"Duplicate entry: Task ID '{_t.task_id}' already exists in previously ran tasks.")
                success.append(False)

            elif _t.task_id in self.task_ongoing:
                self.logger.error(f"Task ID '{_t.task_id}' already exists in currently running task(s).")
                message.append(f"Duplicate entry: Task ID '{_t.task_id}'' already exists in running tasks.")
                success.append(False)

            elif _t.task_id in [_k.task_id for _k in self.loader.get_queue()]:
                self.logger.error(f"Task ID '{_t.task_id}' already exists in queued task(s).")
                message.append(f"Duplicate entry: Task ID '{_t.task_id}' already exists in currently queued tasks.")
                success.append(False)
            
            elif _t.task_id in current_queue_list:
                self.logger.error(f"Duplicate Task ID '{_t.task_id}' detected in the submitted queue.")
                message.append(f"Duplicate entry: Detected duplicate Task ID '{_t.task_id}' in the submitted queue.")
                success.append(False)

            else:
                success.append(True)
                message.append(f'Task {_t.task_id} Created!')
            current_queue_list.add(_t.task_id)

        if allow_partial:
            for n, i in enumerate(success):
                if i:
                    self.loader.append(entry=task_to_queue[n])
        else:
            if all(success):
                for _t in task_to_queue:
                    self.loader.append(entry=_t)
                
        return list(zip(success, message))
    
    @handle_singular_or_plural
    def remove_task_from_queue(
        self, task_ids: List[AntTask | str]
    ):  
        success = []
        for task_id in task_ids:
            success.append(self.loader.remove(task_id=task_id))
        return success

    def modify_task_in_queue(
        self,
    ):
        # reserved for future update
        pass
    
    #################
    # History stuff
    #################
    @handle_singular_or_plural
    def add_task_to_history(self, 
                            tasks: List[AntTask] | AntTask) -> None:
        for task in tasks:
            if task.task_id in self.task_id_history:
                # if found, overwrite
                self.task_completed[self.task_id_history.index(task.task_id)] = task
            else:
                self.task_id_history.add(task.task_id)
                self.task_completed.append(task)
    
    @handle_singular_or_plural
    def remove_task_from_history(self,
                                 task_ids: List[AntTask] | AntTask):
        success = []
        # check if everything can be added before actually adding.
        for task_id in task_ids:
            if task_id not in self.task_id_history:
                success.append(False)
                continue
            self.task_id_history.remove(task_id)
            for _t in self.task_completed:
                if _t.task_id == task_id:
                    self.task_completed .remove(_t)
                    break
            success.append(True)
            self.logger.info(f'Removed task {task_id} from task history. Please remember to backup your logs before starting new task with the same ID.')
        return success
    
    def try_dispatch_task(self):
        # check if any task can be run
        current_task = self.loader.pop(delete_first_entry=False)
        try:
            required_gpus = current_task.n_gpus
        except Exception as e:
            self.logger.error(f"Got {e.__class__} in try_dispatch_task when getting n_gpus for a task, setting to 0. The following task doesn't have n_gpus key: {current_task.todict()}" )
            required_gpus = 0
        can, gpu_idx = self.get_gpu_assignment(required_gpus)

        if can:
            s_task = self.loader.pop(delete_first_entry=True)

            # shouldn't be triggered. but kept here for debugging for edge cases
            assert s_task == current_task
            assert s_task.task_id not in self.task_id_history 
            
            gpu_ids = [self.gpu_ids[_i] for _i in gpu_idx]
            s_task.gpu_idx = gpu_idx
            s_task.gpu_ids = gpu_ids

            s_task.runner_envar['CUDA_VISIBLE_DEVICES'] = list2str(gpu_ids)

            # run and block gpu
            new_s_task = self.handler.run_task(
                s_task
            )  # s_task should be updated in place, but just in case.
            self.task_ongoing[new_s_task.task_id] = new_s_task
            self.set_gpu_states(
                idx=gpu_idx, 
                mode="block", 
                op_type="availability"
            )

            self.logger.info(
                f"Task {s_task.task_id} on GPU {list2str(gpu_ids)} started."
            )

    def check_finished_task(self):
        # move finished task to self.task_completed
        task_id_status: Dict[str, AntTask] = self.handler.check_all()
        for f_task in task_id_status["completed_process"]:
            self.add_task_to_history(f_task)
            del self.task_ongoing[f_task.task_id]

            # unblock gpu
            self.set_gpu_states(
                idx=f_task.gpu_idx, 
                mode="unblock", 
                op_type="availability"
            )

            
            self.logger.info(
                f"Task {f_task.task_id} finished. Took {f_task.get_time(type='runtime', formatted=True)}"
            )
    
    @handle_singular_or_plural
    def kill_task(self, 
                  task_ids: List[str]):
        result = []
        for task_id in task_ids:
            task = self.handler.terminate_task_id(           # this function update task with stop timestamp.
                                    task_id=task_id,
                                    is_completed=False
                                ) 
            if task is None:
                result.append(False)
                continue
            
            # set terminated flag
            task.terminated = True

            self.add_task_to_history(task)
            del self.task_ongoing[task.task_id]
            # unblock gpu
            self.set_gpu_states(
                idx=task.gpu_idx, 
                mode="unblock", 
                op_type="availability"
            )
            
            self.logger.info(
                f"Task {task.task_id} Terminated. Took {task.get_time(type='runtime', formatted=True)}"
            )
            result.append(True)
        return result

    def step(self):
        
        self.check_finished_task()
        
        # handle ADGS function
        if self.opt["ADGS_enabled"]:
            self._ADGS_check()

        self.try_dispatch_task()

    def vis(self):
        result = {}

        # task queue
        result['task_queue'] = [_k.todict() for _k in self.loader.get_queue()]
        
        # task ongoing, put into dicts and inject console_out from handler.
        handler_vis = self.handler.vis()
        result['task_ongoing'] = []
        arg = dict(include_time=['start', 'runtime'],
                   formatted=True)
        for _k in self.task_ongoing.values():
            d = _k.todict(**arg)
            try:
                console_out = handler_vis['terminal_logs'][_k.task_id]
            except Exception as e:
                self.logger.error(f"Got {e.__class__} in vis(). Skipping parsing of console_out. Reason: {e}")
                console_out = []
            d['console_out'] = console_out
            result['task_ongoing'].append(d)
        
        # task finished
        arg = dict(include_time=['start', 'runtime'],
                   formatted=True)
        result['task_completed'] = [_k.todict(**arg) for _k in self.task_completed] 

        # monitors
        result['monitor'] = self.monitor.current_stats
        result['monitor']['gpu_allowed'] = self.gpu_allowed
        result['monitor']['gpu_availability'] = self.gpu_availability

        return result

        # {
        #     "task_queue": [
        #         {
        #             "gpu_ids": [],
        #             "command": "sleep 2",
        #             "task_id": "wait2",
        #             "n_gpus": 2,
        #             "envar": {},
        #         }
        #     ],
        #     "task_ongoing": [
        #         {
        #             "gpu_ids": [1],
        #             "command": "sleep 1",
        #             "task_id": "wait1",
        #             "n_gpus": 1,
        #             "envar": {},
        #             "time": {"start": "14:19:11 14-08-2025", "runtime": "3 seconds"},
        #             "console_out": ["line1", "line2", "line3"],
        #         }
        #     ],
        #     "task_completed": [
        #         {
        #             "gpu_ids": [0],
        #             "command": "sleep 3",
        #             "task_id": "wait3",
        #             "n_gpus": 1,
        #             "envar": {},
        #             "time": {"start": "14:19:04 14-08-2025", "runtime": "7 seconds"},
        #         }
        #     ],
        #     "monitor": {
        #         "cpu_name": "i2r-spd-0009917",
        #         "cpu_count": 24,
        #         "ram_total": 64077.80078125,
        #         "cpu_usage": [0.028999999999999998, 0.037000000000000005, 0.027999999999999997],
        #         "ram_usage": [15967.05078125, 15954.71875, 15955.4296875],
        #         "gpu_uuid": [
        #             "GPU-ccb2fd82-0b61-2257-d2af-a96486c9f59b",
        #             "GPU-8e009ed8-977f-4f92-19ac-e231928ff2d9",
        #         ],
        #         "gpu_name": ["NVIDIA RTX A5000", "NVIDIA RTX A5000"],
        #         "gpu_total_memory": [24564.0, 24564.0],
        #         "gpu_power_limit": [230.0, 230.0],
        #         "gpu_usage": [[0.29, 0.0], [0.26, 0.0], [0.26, 0.0]],
        #         "gpu_memory": [
        #             [13874.0625, 334.8125],
        #             [13875.875, 334.8125],
        #             [13875.875, 334.8125],
        #         ],
        #         "gpu_power_draw": [[23.278, 21.889], [23.522, 17.832], [23.425, 17.122]],
        #     },
        # }

    def get_log(self, 
                task_id: str) -> Tuple[bool, str]:
        task = None
        if task_id in self.task_ongoing:
            task = self.task_ongoing[task_id]
        elif task_id in self.task_id_history:
            for t in self.task_completed:
                if t.task_id == task_id:
                    task = t
                    break
            if task is None:
                self.logger.error(f"Task '{task_id}' found in task_id_history, but not in task_completed. Something is terribly wrong.")
                return False, "Process not found"
        else:
            self.logger.error(f"Task '{task_id}' is doesn't exists in running / completed process list. No log file to be fetched.")
            return False, "Process not found"

        try:
            filename = task.log_file_name
        except AttributeError:
            self.logger.error(f"No 'log_file_name' attribute for task {task_id}. This shouldn't happen lol.")
            return False, "Log file not found"

        try:
            rendered_file = parse_and_truncate_file(filename=filename, 
                                                    max_lines=self.opt.get('VISUALIZER_view_log_max_lines', self.opt.get("VISUALIZER_view_log_max_lines", 500)), 
                                                    line_break='\n')
        except FileNotFoundError:
            self.logger.error(f"Log file for task {task_id} at {filename} not found. Maybe its deleted?")
            return False, "Log file not found"

        return True, rendered_file

    def get_log_file(self, 
                task_id: str) -> str | None:
        task = None
        if task_id in self.task_ongoing:
            task = self.task_ongoing[task_id]
        elif task_id in self.task_id_history:
            for t in self.task_completed:
                if t.task_id == task_id:
                    task = t
                    break
            if task is None:
                self.logger.error(f"Task '{task_id}' found in task_id_history, but not in task_completed. Something is terribly wrong.")
                return None
        else:
            self.logger.error(f"Task '{task_id}' is doesn't exists in running / completed process list. No log file to be fetched.")
            return None

        filename = task.log_file_name
        if os.path.isfile(filename):
            return filename
        else:
            self.logger.error(f"Log file for task {task_id} at {filename} not found. Maybe its deleted?")
            return None
    
    @staticmethod
    def parse_args(s) -> Tuple[Any, Any]:
        # ant arguments
        # gpu
        ant_n_gpus = re.findall('ant_n_gpus=([0-9]+)', s)
        if len(ant_n_gpus) < 1: 
            n_gpus = None
        else:
            n_gpus = int(ant_n_gpus[-1])
        _s = re.sub('ant_n_gpus=([0-9]+)', '', s)
        s = _s.strip()

        # task_id
        pattern = r'ant_task_id=([^\s"]+|"[^"]*")'
        ant_task_id = re.findall(pattern, s)

        if len(ant_task_id) < 1: 
            task_id = None
        else:
            task_id = ant_task_id[-1]
            if task_id.startswith('"') and task_id.endswith('"'):
                task_id = task_id[1:-1]
        _s = re.sub(pattern, '', s)
        s = _s.strip()

        # envar
        match = re.search(r'ant_envar\s*=\s*(\{.*?\})', s)
        if match:
            raw_dict = match.group(1)
            try:
                envar = ast.literal_eval(raw_dict)
                if not isinstance(envar, dict):
                    raise ValueError
            except Exception as e:
                raise ValueError(f"Failed to parse ant_envar: {e}")

            s = s.replace(match.group(0), "").strip()
        else:
            envar = {}
        return n_gpus, task_id, envar, s

    def create_task(self,
                    data: Dict[str, Any]):
        # {'queue_mode' : str, # single | multi
        #  'command' : str,
        #  'task_id' : Optional[str],
        #  'n_gpus' : Optional[int],
        # }
        if 'command' not in data:
            self.logger.error(f"'command' key should be present when creating task. Got: {data}")
            return {'status' : 'error',
                    'message' : ["'command' key should be present when creating task"]}
        
        
        try:
            queue_mode = data.get('queue_mode', 'single').lower()
            del data['queue_mode']
        except KeyError:
            queue_mode = 'single'

        if 'envar' in data:
            if data['envar'] == '':
                data['envar'] = {}
        else:
            data['envar'] = {}

        try:
            if queue_mode == 'single':
                
                envar = data.get('envar', {})
                runner_envar = data.get('runner_envar', {})
                task_id = data.get('task_id', None)
                command = data.get('command', None) # this has to be present, if not AntTask can't initialize
                
                # try parsing gpu_runner-specific args from envar
                if 'ant_n_gpus' in envar:
                    n_gpus_from_envar = envar['ant_n_gpus']
                    del envar['ant_n_gpus']
                else:
                    n_gpus_from_envar = self.opt.get("RUNNER_default_n_gpus", 0)
                
                # try parsing gpu_runner-specific args from cmd
                n_gpus_from_cmd, task_id_from_cmd, envar_from_cmd, cleaned_c = self.parse_args(command)
                envar.update(envar_from_cmd)
                
                # if args from cmd present, prioritize it.
                data['n_gpus'] = n_gpus_from_cmd or n_gpus_from_envar or data.get('n_gpus', self.opt.get("RUNNER_default_n_gpus", 0))
                task_id = task_id_from_cmd or task_id

                # randomize uuid lmao
                if task_id is None:
                    task_id = str(uuid.uuid4())
                
                task_id = sanitize_task_id(task_id=task_id)

                data['runner_envar'] = runner_envar
                data['task_id'] = task_id
                data['command'] = cleaned_c
                data['envar'] = envar

                tasks = [AntTask(**{k:v for k, v in data.items()})]

            elif queue_mode == 'multi':
                tasks = []
                envar = data.get('envar', {})
                task_id = data.get('task_id', None)
            
                # try parsing gpu_runner-specific args from envar
                if 'ant_n_gpus' in envar:
                    n_gpus_from_envar = envar['ant_n_gpus']
                    del envar['ant_n_gpus']
                else:
                    n_gpus_from_envar = self.opt.get("RUNNER_default_n_gpus", 0)
            
                for c in split_commands(data['command']):
                    # try parsing gpu_runner-specific args from cmd
                    n_gpus_from_cmd, task_id_from_cmd, envar_from_cmd, cleaned_c = self.parse_args(c)

                    # if args from cmd present, prioritize it.
                    n_gpus = n_gpus_from_envar if n_gpus_from_cmd is None else n_gpus_from_cmd
                    envar.update(envar_from_cmd)

                    # randomize uuid lmao
                    if task_id_from_cmd is None:
                        task_id_from_cmd = str(uuid.uuid4())

                    task_id_from_cmd = sanitize_task_id(task_id=task_id_from_cmd)
                        
                    tasks.append(AntTask(command=cleaned_c,
                                         task_id=task_id_from_cmd,
                                         n_gpus=n_gpus,
                                         envar=envar))
            else:
                self.logger.error(f"queue_mode: '{queue_mode}' is not recognized. Expected value: 'single' / 'muilti'")
                return {'status' : 'error', 
                        'message' : f'Unrecognized queue mode. Got : {queue_mode}'}
        
            status = self.add_task_to_queue(tasks, allow_partial=[False] * len(tasks))
            result = {'status' : 'success' if all([_i[0] for _i in status]) else 'error',
                      'message': status[0][1] if len(status) == 1 else "Tasks Created!"}
            return result
    
        except Exception as e:
            return {'status' : 'error',
                    'message' : [f'{e.__class__.__name__}: {"".join(e.args)}']}

    def restart_task(self, task_id: str):
        if task_id in self.task_id_history:
            restarted_task = [copy.deepcopy(_t) for _t in self.task_completed if _t.task_id == task_id][0]
        elif task_id in self.task_ongoing:
            restarted_task = copy.deepcopy(self.task_ongoing[task_id])
        else:
            self.logger.error(f'Task ID {task_id} not found in either completed / ongoing tasks. Skipping')
            return {'status': 'error',
                    'message': f'Task ID {task_id} not found in either completed / ongoing tasks.'}

        try:
            # ensure the new task id is unique.
            new_task_id = task_id
            while True:
                new_task_id = increment_task_id(new_task_id)
                if new_task_id not in self.task_id_history and \
                    new_task_id not in self.task_ongoing and \
                    new_task_id not in [_k.task_id for _k in self.loader.get_queue()] :
                    break
            
            restarted_task.task_id = new_task_id
            restarted_task.reset()

            # guaranteed to be true.
            out = self.add_task_to_queue(task_to_queue=[restarted_task]) 
            return {'status': 'success',
                    'message': f'Task ID {new_task_id} Started!'}
        
        except Exception as e:
            self.logger.error(f'{e.__class__.__name__}: {"".join(e.args)}')
            return {'status': 'error',
                    'message' : [f'{e.__class__.__name__}: {"".join(e.args)}']}