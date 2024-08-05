import re
import os
import uuid
import random
import json
from typing import Optional, List, Dict, Any
from ant.utils.misc import INF
from ant.logger import base_logger
from ant.loader import base_loader

class json_loader(base_loader):
    def __init__(self, filename: str, logger: Optional[base_logger] = None):
        self.filename = filename
        self.logger = self.setup_logger(logger)
        self.logger.info(f"Json_loader initialized. filename={filename}")
        self.file_cache = None

        if not os.path.isfile(filename):
            with open(filename, 'w') as file:
                json.dump([], file)

    def pop(self, delete_first_entry: bool = True) -> Dict[str, Any]:
        if delete_first_entry:
            self.logger.info("Popping and deleting first entry from the input file.")

        with open(self.filename, 'r') as file:
            data: List[Dict[str, Any]] = json.load(file)
            
        # empty file
        if len(data) == 0:
            return {
                'command': '',
                'ant_n_gpus': INF,
                'ant_task_id': 'NULL',
                'envar': {}
            }

        result = data[0]
        if delete_first_entry:
            with open(self.filename, 'w') as file:
                json.dump(data[1:], file, indent=4)
            self.file_cache = data[1:]
        else:
            self.file_cache = data
        
        return self.parse_entry(result)
    
    def remove(self, entries_to_be_removed: List[Dict[str, Any]]) -> None:
        with open(self.filename, 'r') as file:
            data: List[Dict[str, Any]] = json.load(file)

        for entry in entries_to_be_removed:
            data.remove(entry)

        with open(self.filename, 'w') as file:
            json.dump(data, file, indent=4)
            self.file_cache = data

    def append(self, new_entries: List[Dict[str, Any]]) -> None:
        self.logger.info(f"Appending new entry to the input file: {new_entries}")

        with open(self.filename, 'r') as file:
            data: List[Dict[str, Any]] = json.load(file)

        data += new_entries

        with open(self.filename, 'w') as file:
            json.dump(data, file, indent=4)
            self.file_cache = data
    
    def get_queue(self):
        if self.file_cache is None:
            with open(self.filename, 'r') as file:
                data: List[Dict[str, Any]] = json.load(file)
                self.file_cache = data
        return self.file_cache

    def parse_entry(self, entry: Dict[str, Any]) -> Dict[str, Any]:
        # Handle random {rand int|float num1 num2}
        command = entry.get('command', '')
        random_entry = re.findall(r'{rand (int|float) ([+-]?[0-9]*\.?[0-9]+) ([+-]?[0-9]*\.?[0-9]+)}', command)
        _command = re.sub(r'{rand (int|float) ([+-]?[0-9]*\.?[0-9]+) ([+-]?[0-9]*\.?[0-9]+)}', '{}', command)
        random_results = []
        
        for i in random_entry:
            if i[0].lower() == 'int':
                random_results.append(random.randrange(int(i[1]), int(i[2])))
            elif i[0].lower() == 'float':
                random_results.append(random.uniform(float(i[1]), float(i[2])))
            else:
                raise NotImplementedError(f"Not understood: {i}")
        
        command = _command.format(*random_results).strip()
        
        # Extract ant_n_gpus
        ant_n_gpus = int(entry.get('ant_n_gpus', 1))
        if not isinstance(ant_n_gpus, int):
            self.logger.warn("Number of GPU isn't specified correctly, setting to default value : 1")
            ant_n_gpus = 1
        
        # Extract ant_task_id
        ant_task_id = str(entry.get('ant_task_id', ''))
        if not isinstance(ant_task_id, str):
            ant_task_id = uuid.uuid4()
            self.logger.warn(f"Task ID isn't specified, setting it to random uuid : {ant_task_id}")
        
        return {
            'command': command,
            'ant_n_gpus': ant_n_gpus,
            'ant_task_id': ant_task_id,
            'envar': entry.get('envar', {})
        }
