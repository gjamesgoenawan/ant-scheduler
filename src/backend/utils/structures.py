import random
import re
import copy
import time
import uuid
from typing import Dict, List, Optional

from utils.misc import format_timedelta, format_timestamp


class AntTask():
    def __init__(self,
                 command,
                 task_id: Optional[str] = None,
                 envar: Optional[Dict[str, str]] = None,
                 runner_envar: Optional[Dict[str, str]] = None, # similar to envar, but hidden.
                 **kwargs):
        self.task_id = task_id if (task_id is not None and task_id != '') else str(uuid.uuid4())
        self.envar = envar if envar is not None else {}
        self.runner_envar = runner_envar if runner_envar is not None else {}
        self.terminated = False 
        
        # validation and sanitation
        self.command = self.parse_random(self.sanitize(command))
        for _i in self.envar.values():
            self.parse_random(str(_i))
        for _i in self.runner_envar.values():
            self.parse_random(str(_i))

        self._keys = set(['command', 'task_id', 'envar', 'runner_envar'])
        for k, v in kwargs.items():
            self._keys.add(k)
            self.__setattr__(k, v)

        self._start_time = None
        self._stop_time = None
        self._is_running = False
        self._is_stopped = False
    
    def start(self):
        self._start_time = time.time()
        self._is_running = True
        self._is_stopped = False
    
    def stop(self):
        if self._start_time is None:
            return
        self._stop_time = time.time()
        self._is_running = False
        self._is_stopped = True

    def get_time(self, 
                 type = 'runtime', # start, stop, runtime
                 formatted = True):
        
        match type:
            case 'runtime':
                if self._start_time is None:
                    if formatted:
                        return 'This task has not been run yet'
                    else:
                        return -1
                elif self._stop_time is None:
                    val = time.time() - self._start_time
                else:
                    val = self._stop_time - self._start_time
                
                if formatted:
                    return format_timedelta(val)
                else:
                    return val
            case 'start':
                if self._start_time is None:
                    return None
                if formatted:
                    return format_timestamp(self._start_time)
                else:
                    return self._start_time
            case 'stop' :
                if self._stop_time is None:
                    return None
                if formatted:
                    return format_timestamp(self._stop_time)
                else:
                    return self._stop_time

    # can be used for dict(AntTask) / AntTask.todict()
    def keys(self):
        return self._keys
    def __getitem__(self, x):
        return self.__getattribute__(x)
    def __setattr__(self, name, value):
        super().__setattr__(name, value)
        if name != '_keys':
            try: 
                self._keys.add(name)
            except AttributeError:
                super().__setattr__('_keys', set())
    def todict(self,
               include_time: List[str] = [], # start | stop | runtime
               formatted: bool = False,
               ):
        d = dict(self)
        if len(include_time) > 0:
            d['time'] = {}
            for t in include_time:
                d['time'][t] = self.get_time(type=t, formatted=formatted)
        return d
            
    def __repr__(self):
        f = f"""AntTask(command='{self.command}',task_id='{self.task_id}')"""
        return f

    @staticmethod
    def sanitize(command):
        """
        Remove line breaks and trailing backslashes from a shell command,
        joining it into a single line.
        """
        # Split lines, strip whitespace
        lines = command.splitlines()
        sanitized_lines = []

        for line in lines:
            # remove comment
            if line.find('#') != -1:
                line = line[:line.find('#')]
            line = line.strip()
            
            # Remove trailing backslash
            if line.endswith("\\"):
                line = line[:-1].strip()
            sanitized_lines.append(line)

        # Join all lines with a space
        return " ".join(sanitized_lines)
    
    @staticmethod
    def parse_random(command: str) -> str:
        # Function to generate random values
        def repl(match):
            dtype, start, end = match.groups()
            if dtype.lower() == "int":
                return str(random.randint(int(start), int(end)))
            elif dtype.lower() == "float":
                return str(random.uniform(float(start), float(end)))
            else:
                raise NotImplementedError(f"Unknown type: {dtype}")

        # Replace only {rand ...} blocks
        command = re.sub(
            r"{rand (int|float) ([+-]?[0-9]*\.?[0-9]+) ([+-]?[0-9]*\.?[0-9]+)}",
            repl,
            command,
        )

        return command


    def get_final_command(self, 
                          with_envar: bool = True) -> str:
        wd = None
        conda_env = None

        if with_envar:
            envar = copy.deepcopy(self.envar)
            envar_text = ''

            if 'ant_wd' in envar:
                wd = envar['ant_wd']
                del envar['ant_wd']

            if 'ant_conda_env' in envar:
                conda_env = envar['ant_conda_env']
                del envar['ant_conda_env']
            
            if 'ant_conda_path' in envar:
                # use custom conda path
                cp = envar['ant_conda_path']
                del envar['ant_conda_path']
            else:
                # use default conda
                cp = 'conda'

            if len(envar) > 0:
                for k, v in envar.items():
                    envar_text += f'{k}={v} '
            
            if len(self.runner_envar) > 0:
                for k, v in self.runner_envar.items():
                    envar_text += f'{k}={v} '
            envar_text = envar_text.strip()

            if envar_text != '':
                envar_text = 'export ' + self.parse_random(envar_text) + '; '
            
            final_c = envar_text
            if wd is not None:
                final_c += f'cd {wd} && '
            if conda_env is not None:
                final_c += f'{cp} run -n {conda_env} --live-stream '
            final_c += self.command
            return final_c

        else:
            return self.command

        
        
def create_task(cmd):
    # create task interface, accept strings or dict.

    # cmd : dict = {'command' : str,
    #               'envar' : Dict[str, str],
    #               'task_id' : str,
    #               'gpu_ids' : List[int],}
    
    if isinstance(cmd, str):
        task = AntTask(command=cmd,
                    task_id=f"manual_{time.strftime('%d_%M_%Y_%H_%M_%S')}",
                    n_gpus=cmd.get('n_gpus', 1),
                    gpu_ids=[],
                    envar={})

    elif isinstance(cmd, dict):
        try:
            command = cmd['command']
        except KeyError:
            raise KeyError(f'"command" key cannot be empty. cmd : {cmd}')
            return -1
        task = AntTask(command=command,
                        task_id=cmd.get('task_id', f"manual_{time.strftime('%d_%M_%Y_%H_%M_%S')}"),
                        n_gpus=cmd.get('n_gpus', 0),
                        gpu_ids=cmd.get('gpu_ids', []),
                        envar=cmd.get('envar', {}))
    else:
        task = cmd

    return task
