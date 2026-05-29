import logging
from typing import Any, Union, Tuple
from ant.logger import base_logger

class base_runner():
    def __init__(self, *args, **kwargs) -> None:
        """Initializes the runner class"""
        pass
    
    def step(self, *args, **kwargs) -> Any:
        """Step Method.
        
        This method contains the main logic behind the scheduler.
        Input:
            visualizer_response : dict = Details the command sent by the user from the visualizer.
            vis_prop : dict = Details the properties of the visualization. e.g. window height, width, etc.
        Output:
            vis_data : dict = Dictionary that contains all the relevant infromation to be rendered / displayed by the visualizer.
            
        """
        pass

    @staticmethod
    def setup_logger(logger, return_original_logger : bool = False, return_log_dir : bool = False) -> Union[logging.Logger, Tuple[logging.Logger, str]]:
        if logger is None:
            log_dir = "ant_runner"
            logger = base_logger()
            current_logger = logger.runner
        else:
            log_dir = logger.log_dir
            current_logger = logger.runner

        if return_original_logger:
            if return_log_dir:
                return current_logger, logger, log_dir
            else:
                return current_logger, logger
        else:
            if return_log_dir:
                return current_logger, log_dir # type: Tuple[logging.Logger, str]
            else:
                return current_logger # type: logging.Logger
