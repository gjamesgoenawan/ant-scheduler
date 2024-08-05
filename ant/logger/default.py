import os
import time
import logging

from typing import Optional
from ant.logger import base_logger

def setup_logger(name : str, level : int = 20, filename : Optional[str] = None, stream : bool = True):
    logger = logging.getLogger(name)
    formatter = logging.Formatter('%(asctime)s  %(name)s [%(levelname)s]: %(message)s')

    if stream:
        consoleHandler = logging.StreamHandler()
        consoleHandler.setLevel(level)
        consoleHandler.setFormatter(formatter)
        logger.addHandler(consoleHandler)
    
    if filename is not None:
        fileHandler = logging.FileHandler(filename)
        fileHandler.setLevel(level)
        fileHandler.setFormatter(formatter)
        logger.addHandler(fileHandler)

    logger.propagate = False
    return logger

class default_logger(base_logger):
    def __init__(self, loader, handler, runner, visualizer, log_dir: Optional = None, save_log : bool = False, stream : bool = True, level : int = 0):

        logging.basicConfig(level = level)
        
        if log_dir is None:
            log_dir = os.path.join(os.getcwd(), "ant_runner")

        self.log_dir = os.path.join(log_dir, time.strftime("%d_%M_%Y_%H_%M_%S"))
        os.makedirs(self.log_dir, exist_ok=True) # exist_ok=False

        self.save_log = save_log

        if self.save_log:
            self.log_file_name = os.path.join(self.log_dir, "runner.log")
        else:
            self.log_file_name = None

        max_length = max([len(loader.__name__), len(handler.__name__), len(runner.__name__), len(visualizer.__name__)])

        self.loader = setup_logger(name=loader.__name__ + ((max_length-len(loader.__name__)))*" ", level=level, filename=self.log_file_name, stream=stream)
        self.handler = setup_logger(name=handler.__name__ + ((max_length-len(handler.__name__)))*" ", level=level, filename=self.log_file_name, stream=stream)
        self.runner = setup_logger(name=runner.__name__ + ((max_length-len(runner.__name__)))*" ", level=level, filename=self.log_file_name, stream=stream)
        self.visualizer = setup_logger(name=visualizer.__name__ + ((max_length-len(visualizer.__name__)))*" ", level=level, filename=self.log_file_name, stream=stream)
    
    def check_and_recreate_file_handler(self):
        if self.save_log and not os.path.exists(self.log_file_name):
            self._recreate_handler(self.loader)
            self._recreate_handler(self.handler)
            self._recreate_handler(self.runner)
            self._recreate_handler(self.visualizer)

    def _recreate_handler(self, logger):
        for handler in logger.handlers:
            if isinstance(handler, logging.FileHandler):
                logger.removeHandler(handler)
                os.makedirs(os.path.dirname(self.log_file_name), exist_ok=True)
                new_file_handler = logging.FileHandler(self.log_file_name)
                new_file_handler.setLevel(handler.level)
                new_file_handler.setFormatter(handler.formatter)
                logger.addHandler(new_file_handler)
                logger.info('Log file has been recreated.')
                break