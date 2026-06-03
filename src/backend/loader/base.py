import logging
from typing import Any, Tuple, Union

from logger import base_logger


class base_loader():
    def __init__(self, *args, **kwargs) -> None:
        """Initializes the loader class"""
        pass

    def pop(self, delete_first_entry : bool = False, *args, **kwargs) -> Any:
        """Pop Method. 
        Returns the first item on the queue.
        delete_first_entry : bool = whether to delete the first entry of the queue.
        """
        pass
    
    def remove(self, *args, **kwargs) -> Any:
        """Remove Method.
        Removes a specific entry from the queue.
        """
        pass

    def append(self, *args, **kwargs) -> Any:
        """Append method.
        Add an entry from the queue.
        """
        pass

    def promote_to_front(self, *args, **kwargs) -> Any:
        """Move a queued entry to the front of the queue."""
        pass
    
    def get_queue(self, *args, **kwargs) -> Any:
        """Get Queue Method.
        Returns the whole queue. Usually for visualization process.
        """
        pass

    def get_envar(self):
        """Get Envar Method.
        Get the environment variable.
        """
        pass

    def update_envar(self, *args, **kwargs):
        """Get Envar Method.
        Set the environment variable.
        """
        pass

    @staticmethod
    def setup_logger(logger, return_log_dir : bool = False) -> Union[logging.Logger, Tuple[logging.Logger, str]]:
        if logger is None:
            log_dir = "ant_runner"
            logger = base_logger().loader
        else:
            log_dir = logger.log_dir
            logger = logger.loader
        
        if return_log_dir:
            return logger, log_dir # type: Tuple[logging.Logger, str]
        else:
            return logger # type: logging.Logger
