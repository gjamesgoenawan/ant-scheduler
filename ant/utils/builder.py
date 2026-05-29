import os
import ant
import importlib
import importlib.util as iutil

from typing import Any

def parse_config(file_path : str) -> dict:
    module_name = os.path.splitext(os.path.basename(file_path))[0]
    spec = iutil.spec_from_file_location(module_name, file_path)
    cfg = iutil.module_from_spec(spec)
    spec.loader.exec_module(cfg)

    assert "handler" in cfg.__dir__()
    assert "loader" in cfg.__dir__()
    assert "visualizer" in cfg.__dir__()
    assert "runner" in cfg.__dir__()
    assert "logger" in cfg.__dir__()

    return {'handler' : cfg.handler,
            'loader' : cfg.loader,
            'logger' : cfg.logger,
            'visualizer' : cfg.visualizer,
            'runner' : cfg.runner}

def parse_dict_args(current_dict : dict) -> dict:
    return {i:current_dict[i] for i in current_dict if i!='type'}   

def build_runner(cfg : dict) -> Any:
    handler_type = ant.handler.__getattribute__(cfg['handler']['type'])
    loader_type = ant.loader.__getattribute__(cfg['loader']['type'])
    visualizer_type = ant.visualizer.__getattribute__(cfg['visualizer']['type'])
    runner_type = ant.runner.__getattribute__(cfg['runner']['type'])
    logger_type = ant.logger.__getattribute__(cfg['logger']['type'])

    logger = logger_type(loader = loader_type,
                        handler = handler_type,
                        visualizer = visualizer_type,
                        runner = runner_type,
                        **parse_dict_args(cfg['logger']))

    handler = handler_type(**parse_dict_args(cfg['handler']), logger = logger)

    loader = loader_type(**parse_dict_args(cfg['loader']),
                                logger = logger)

    runner = runner_type(**parse_dict_args(cfg['runner']),
                                handler = handler,
                                loader = loader,
                                logger = logger)
                                
    visualizer = visualizer_type(runner=runner, 
                                 **parse_dict_args(cfg['visualizer']),
                                 logger = logger)

    return visualizer