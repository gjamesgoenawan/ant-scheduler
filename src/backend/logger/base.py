import logging

def setup_basic_logger() -> logging.Logger:
    logger = logging.Logger("dummy")
    logger.setLevel(10000)
    logger.propagate = False
    return logger

class base_logger():
    def __init__(self, *args, **kwargs) -> None:
        self.loader = setup_basic_logger()
        self.handler = setup_basic_logger()
        self.runner = setup_basic_logger()
        self.visualizer = setup_basic_logger()
        self.save_log = False
