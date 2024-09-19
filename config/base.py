logger = dict(type="default_logger",
              log_dir = '../ant_runner_logs',
              save_log = True,
              stream = True,
              level = 20,)
handler = dict(type='subprocess_handler')
loader = dict(type='json_loader',
              filename='task_list.json',)
visualizer = dict(type='flask_visualizer',
                  port = 5050,
                  delay=1)
runner = dict(type='gpu_runner',
              gpu_ids = [0,1],
              auto_detect_gpu_status=False)
