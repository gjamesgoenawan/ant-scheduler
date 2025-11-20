import logging
from typing import Any, Dict, List, Tuple, Union

from logger import base_logger


class base_runner():
    def __init__(self, *args, **kwargs) -> None:
        """Initializes the runner class"""
        self.task_ongoing: Dict[str, Any] = {}
        self.task_completed: List[dict] = []
        self.task_id_history = set()

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

    def vis(self):
        """Vis Method.
        
        This method can be called to get the latest visualization data.
        Output: dict = Dictionary that contains all necessary visualization data.

        Example:
        {
            "task_queue": [
                {
                    "gpu_ids": [],
                    "command": "sleep 2",
                    "task_id": "wait2",
                    "n_gpus": 2,
                    "envar": {},
                }
            ],
            "task_ongoing": [
                {
                    "gpu_ids": [1],
                    "command": "sleep 1",
                    "task_id": "wait1",
                    "n_gpus": 1,
                    "envar": {},
                    "time": {"start": "14:19:11 14-08-2025", "runtime": "3 seconds"},
                    "console_out": ["line1", "line2", "line3"],
                }
            ],
            "task_completed": [
                {
                    "gpu_ids": [0],
                    "command": "sleep 3",
                    "task_id": "wait3",
                    "n_gpus": 1,
                    "envar": {},
                    "time": {"start": "14:19:04 14-08-2025", "runtime": "7 seconds"},
                }
            ],
            "monitor": {
                "cpu_name": "i2r-spd-0009917",
                "cpu_count": 24,
                "ram_total": 64077.80078125,
                "cpu_usage": [0.028999999999999998, 0.037000000000000005, 0.027999999999999997],
                "ram_usage": [15967.05078125, 15954.71875, 15955.4296875],
                "gpu_uuid": [
                    "GPU-ccb2fd82-0b61-2257-d2af-a96486c9f59b",
                    "GPU-8e009ed8-977f-4f92-19ac-e231928ff2d9",
                ],
                "gpu_name": ["NVIDIA RTX A5000", "NVIDIA RTX A5000"],
                "gpu_total_memory": [24564.0, 24564.0],
                "gpu_power_limit": [230.0, 230.0],
                "gpu_usage": [[0.29, 0.0], [0.26, 0.0], [0.26, 0.0]],
                "gpu_memory": [
                    [13874.0625, 334.8125],
                    [13875.875, 334.8125],
                    [13875.875, 334.8125],
                ],
                "gpu_power_draw": [[23.278, 21.889], [23.522, 17.832], [23.425, 17.122]],
            },
        }
        """
        pass
        

    @staticmethod
    def setup_logger(logger, 
                     return_original_logger : bool = False, 
                     return_log_dir : bool = False) -> Union[logging.Logger, Tuple[logging.Logger, str]]:
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
