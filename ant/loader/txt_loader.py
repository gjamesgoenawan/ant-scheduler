# UNDER DEVELOPMENT

import re
import uuid
import random
from typing import Optional, Dict, Any
from ant.utils.misc import INF
from ant.logger import base_logger
from ant.loader import base_loader

class txt_loader(base_loader):
    def __init__(self, filename, logger : Optional[base_logger] = None):
        self.filename = filename
        self.logger = self.setup_logger(logger)
        self.logger.info(f"Txt_logger initialized. filename={filename}")
    
    def pop(self, delete_first_entry=True):

        if delete_first_entry:
            self.logger.info("Popping and deleting first entry on the input file.")

        with open(self.filename, 'r') as file:
            lines = file.readlines()  # skip the first line

        # empty file
        if len(lines) == 0:
            return {'command' : '',
                    'ant_n_gpus' :  INF,
                    'ant_task_id': 'NULL',
                    'envar' : {}}
        result = lines[0]
        if delete_first_entry:
            with open(self.filename, 'w') as file:
                file.writelines(lines[1:])
        return self.parse_string(result.strip())
    
    def append(self, new_entry: Dict[str, Any]) -> None:
        self.logger.info(f"Appending new entry to the input file: {new_entry}")

        # Convert new_entry dictionary to a string format
        command = new_entry.get('command', '')
        ant_n_gpus = new_entry.get('ant_n_gpus', 1)
        ant_task_id = new_entry.get('ant_task_id', str(uuid.uuid4()))
        #envar = new_entry.get('envar', {}) # envar support is planned in txt_loader.

        entry_str = f"{command} ant_n_gpus={ant_n_gpus} ant_task_id={ant_task_id}"
        for key, value in envar.items():
            entry_str += f" {key}={value}"

        with open(self.filename, 'a') as file:
            file.write(entry_str + '\n')
    
    def parse_string(self, s):
        # random {rand int|float num1 num2}
        random_entry = re.findall('{rand (int|float) ([+-]?[0-9]*\.?[0-9]+) ([+-]?[0-9]*\.?[0-9]+)}', s)
        _s = re.sub('{rand (int|float) ([+-]?[0-9]*\.?[0-9]+) ([+-]?[0-9]*\.?[0-9]+)}', '{}', s)
        random_results = []
        for i in random_entry:
            if i[0].lower() == 'int':
                random_results.append(random.randrange(int(i[1]), int(i[2])))
                
            elif i[0].lower() == 'float':
                random_results.append(random.uniform(float(i[1]), float(i[2])))
            else:
                raise NotImplementedError(f"Not understood : {i}")
        s = _s.format(*random_results).strip()
    
        # ant arguments
        # gpu
        ant_n_gpus = re.findall('ant_n_gpus=([0-9]+)', s)
        if len(ant_n_gpus) < 1: 
            self.logger.warn("Number of GPU isn't specified, setting to default value")
            n_gpus = 1
        else:
            n_gpus = int(ant_n_gpus[0])
        _s = re.sub('ant_n_gpus=([0-9]+)', '', s)
        s = _s.strip()

        # task_id
        pattern = r'ant_task_id=([^\s"]+|"[^"]*")'
        match = re.search(pattern, s)

        if match:
            task_id = match.group(1)
            # Remove surrounding quotes if task_id is quoted
            if task_id.startswith('"') and task_id.endswith('"'):
                task_id = task_id[1:-1]
        else:
            task_id = str(uuid.uuid4())
        _s = re.sub(pattern, '', s)
        s = _s.strip()
        
        return {'command' : s,
                'ant_n_gpus' : n_gpus,
                'ant_task_id' : task_id,
                'envar' : {}}
        