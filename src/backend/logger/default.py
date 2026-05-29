import os
import time
import logging

from typing import Optional
from . import base_logger

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
    def __init__(self, opt):
        self.opt = opt
        loader = self.opt.get('loader')
        handler = self.opt.get('handler')
        runner = self.opt.get('runner')
        visualizer = self.opt.get('visualizer')

        log_dir = self.opt.get('LOGGER_log_dir', os.path.join(os.getcwd(), "ant_runner_logs"))
        self.log_dir = os.path.join(log_dir, time.strftime("%d_%m_%Y_%H_%M_%S"))
        self.log_to_file = self.opt.get('LOGGER_log_to_file', True)
        self.log_to_stdout = self.opt.get('LOGGER_log_to_stdout', True)
        self.level = self.opt.get('LOGGER_level', True)

        logging.basicConfig(level = self.level)
        if self.log_to_file:
            os.makedirs(self.log_dir, exist_ok=True)
            self.log_file_name = os.path.join(self.log_dir, "runner.log")
        else:
            self.log_file_name = None

        max_length = max([len(loader), len(handler), len(runner), len(visualizer)])

        self.loader = setup_logger(name=loader + ((max_length-len(loader)))*" ", level=self.level, filename=self.log_file_name, stream=self.log_to_stdout)
        self.handler = setup_logger(name=handler + ((max_length-len(handler)))*" ", level=self.level, filename=self.log_file_name, stream=self.log_to_stdout)
        self.runner = setup_logger(name=runner + ((max_length-len(runner)))*" ", level=self.level, filename=self.log_file_name, stream=self.log_to_stdout)
        self.visualizer = setup_logger(name=visualizer + ((max_length-len(visualizer)))*" ", level=self.level, filename=self.log_file_name, stream=self.log_to_stdout)
    
    def check_and_recreate_file_handler(self):
        if self.log_to_file and not os.path.exists(self.log_file_name):
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
