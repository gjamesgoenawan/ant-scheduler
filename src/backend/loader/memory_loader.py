from typing import Any, Dict, List, Optional

from loader import base_loader
from logger import base_logger
from utils.misc import INF
from utils.structures import AntTask


class memory_loader(base_loader):
    def __init__(self, opt, logger: Optional[base_logger] = None):
        """Initialize the memory loader with an empty command list."""
        self.opt = opt
        self.logger = self.setup_logger(logger)
        self.logger.info("Memory_loader initialized.")
        self.command_queue = []  # In-memory list to store commands
        self.envar = {}

    def pop(self, delete_first_entry: bool = True) -> Dict[str, Any]:
        """Pop the first command from the queue."""

        # Empty queue
        if len(self.command_queue) == 0:
            return AntTask(command='',
                           n_gpus=INF,
                           task_id='NULL',
                           envar={})
        
        if delete_first_entry:
            self.logger.info("Popping and deleting first entry from the command queue.")

        result = self.command_queue[0]
        if delete_first_entry:
            self.command_queue = self.command_queue[1:]
        return result

    def remove(self, task_id: AntTask | str) -> bool:
        """Remove specific entry from the queue."""
        # remove by task_id
        task_id = task_id if isinstance(task_id, str) else task_id.task_id
        
        # loop through existing entry, remove them from list
        for e_entry in self.command_queue:
            if e_entry.task_id == task_id:
                self.command_queue.remove(e_entry)
                self.logger.info(f"Removed task {task_id} from the command queue. New queue length: {len(self.command_queue)}")
                return True
        return False
    
    def append(self, entry: AntTask) -> None:
        """Append new entries to the queue."""
        # do some input checks (?), but no need for now.
        self.logger.info(f"Appending new entries to the command queue: {entry}")
        self.command_queue.extend([entry])

    def promote_to_front(self, task_id: AntTask | str) -> bool:
        task_id = task_id if isinstance(task_id, str) else task_id.task_id

        for idx, entry in enumerate(self.command_queue):
            if entry.task_id == task_id:
                self.command_queue.insert(0, self.command_queue.pop(idx))
                self.logger.info(f"Promoted task {task_id} to the front of the queue.")
                return True
        return False

    def get_queue(self) -> List[AntTask]:
        """Return the entire command queue."""
        return self.command_queue

    def get_envar(self):
        return self.envar

    def update_envar(self, envar):
        self.envar = envar