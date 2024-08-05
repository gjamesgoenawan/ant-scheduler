from ant.handler import base_handler
from ant.logger import base_logger
from typing import List, Any, Optional

class dummy_handler(base_handler):
    def __init__(self, logger : Optional[base_logger], **kwargs) -> None:
        self.long = 2
        self.command_list : List = []
        
        
        self.logger = self.setup_logger(logger, return_log_dir = False)

        self.logger.info(f"Dummy Handler initiated. Stopping tasks after {self.long} step(s)")
    
    def run_command(self, x, **kwargs) -> Any:
        self.step()
        if x is not None:
            self.command_list.append([0, x])

    def step(self, **kwargs) -> Any:
        for i in self.command_list:
            i[0] += 1

    def check(self, x, **kwargs) -> Any:
        for i in self.command_list:
            if i[1] == x:
                if i[0] >= self.long:
                    return True
                else:
                    return False