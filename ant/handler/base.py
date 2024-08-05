from typing import Any, Union, Tuple

import logging
from ant.logger import base_logger

class base_handler():
    def __init__(self, *args, **kwargs) -> None:
        """Initializes the handler class"""
        pass
    
    def run_command(self, *args, **kwargs) -> Any:
        """Run Command Method.
        Runs a command. This method has to have mechanism to store the runnning commands.
        """
        pass

    def terminate_command(self, *args, **kwargs) -> Any:
        """Terminate Command Method.
        Terminates a running command. This method has to ensure the command is running before terminating
        """
        pass

    def check(self, *args, **kwargs) -> bool:
        """Check Command Method.
        Check if a command is still running. Return True if the process has finished. Returns False otherwise.
        """
        pass

    def vis(self, *args, **kwargs) -> dict:
        """Visualize Method.
           Visualizes the output of running commands. Returns dict.
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
