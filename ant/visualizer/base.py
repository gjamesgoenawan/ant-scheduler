import time
import logging
from typing import Any, Union, Tuple
from ant.logger import base_logger
class base_visualizer():
    def __init__(self, *args, **kwargs) -> None:
        """Initializes the visualizer class"""
        pass

    def get_vis_prop(self, *args, **kwargs) -> Any:
        """Get vis_prop Method.
        Returns the vis_prop of the current visualizer state.
        """
        return {'max_width' : 100,
                'max_height' : 100,
                'terminal_win_height' : 5,
                'terminal_win_width' : 5,
                'text_wrap' : 'wrap'}

    def terminate(self, *args, **kwargs) -> Any:
        """Terminate Method.
        Terminates the initialized visualizer"""
        pass
    
    def run(self, *args, **kwargs) -> Any:
        """Run Method.
        
        Main interface of the visualizer class. 
        This method should contains loop that calls runner.step() and feed it with the appropriate visualizer_response and vis_prop"""
        pass
    
    @staticmethod
    def setup_logger(logger, return_original_logger : bool = False, return_log_dir : bool = False) -> Union[logging.Logger, Tuple[logging.Logger, str]]:
        if logger is None:
            log_dir = "ant_runner"
            logger = base_logger()
            current_logger = logger.visualizer
        else:
            log_dir = logger.log_dir
            current_logger = logger.visualizer

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
