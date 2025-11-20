opt = {
        'gpu_ids' : [0, 1],
        'step_interval' : 1.0,
        'logger' : 'default_logger',
        'loader' : 'memory_loader', 
        'handler' : 'subprocess_handler', 
        'runner' : 'gpu_runner', 
        'visualizer' : 'flask_visualizer', 
        
        # Logger
        'LOGGER_log_dir' : '../ant_runner_test', 
        'LOGGER_log_to_file' : False, 
        'LOGGER_log_to_stdout' : True, 
        'LOGGER_level' : 0,
        
        # Auto Detect GPU Status
        'ADGS_enabled' : False,
        'ADGS_usage_threshold' : 0.5,
        'ADGS_mem_threshold' : 0.5,

        # Monitoring
        'MONITORING_history_size' : 300,
        'MONITORING_refresh_interval' : 1,

        # Handler
        'HANDLER_pipe_to_file' : True,

        # Visualizer
        'VISUALIZER_log_max_height' : 20, 
        'VISUALIZER_log_max_width' : 'inf', 
        'VISUALIZER_terminal_win_height' : 20, 
        'VISUALIZER_terminal_win_width' : 'inf',
        'VISUALIZER_terminal_text_wrap' : 'no-wrap', 
        'VISUALIZER_view_log_max_lines' : 5000,
    }