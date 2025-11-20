import logging
from typing import Any, List, Tuple, Union

from logger import base_logger


class base_handler():
    def __init__(self, *args, **kwargs) -> None:
        """Initializes the handler class"""
        pass
    
    def run_task(self, *args, **kwargs) -> Any:
        """Run Task Method.
        Runs a task. This method has to have mechanism to store the runnning commands.
        """
        pass

    def terminate_task_id(self, *args, **kwargs) -> Any:
        """Terminate Task Method.
        Terminates a running task. This method has to ensure the command is running before terminating
        """
        pass

    def check_all(self, *args, **kwargs) -> List[bool]:
        """Check Task Method.
        Check all running tasks if they're still active. Return True if the process has finished. Returns False otherwise.
        """
        pass

    def vis(self, *args, **kwargs) -> dict:
        """Visualize Method.
           Visualizes the output of running tasks. Returns dict.
        """
        pass

    def reset(self, *args, **kwargs) -> Any:
        """Reset Method.
        Resets all the internal states in the class.
        """
        pass

    @staticmethod
    def setup_logger(logger, return_log_dir : bool = False) -> Union[logging.Logger, Tuple[logging.Logger, str]]:
        if logger is None:
            log_dir = "ant_runner"
            logger = base_logger().handler
        else:
            log_dir = logger.log_dir
            logger = logger.handler
            
        if return_log_dir:
            return logger, log_dir # type: Tuple[logging.Logger, str]

        else:
            return logger # type: logging.Logger
