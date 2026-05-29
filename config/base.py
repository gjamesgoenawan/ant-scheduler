logger = dict(type="default_logger",
              log_dir = '../ant_runner_logs',
              save_log = True,
              stream = True,
              level = 20,)
handler = dict(type='subprocess_handler')
loader = dict(type='json_loader',
              filename='task_list.json',)
visualizer = dict(type='flask_visualizer',
                  https_port = 5050,
                  http_port = 6060,
                  delay=1,
                  displayed_logs_max_lines=1000,)
runner = dict(type='gpu_runner',
              gpu_ids = [0,1],
              auto_detect_gpu_status=False)
