import sys
sys.path.append('.')
import time

from utils.builder import build_runner
from utils.structures import create_task
from .test_opt import opt

def normal_test():
    # Result
    # 2025-08-13 19:20:50,210  json_loader        [INFO]: Memory_loader initialized.
    # 2025-08-13 19:20:50,210  subprocess_handler [INFO]: Subprocess Handler Initiated. log_dir=../13_20_2025_19_20_50, pipe_to_file=True
    # 2025-08-13 19:20:51,252  gpu_runner         [INFO]: GPURunner initialized: GPUs=0,1
    # 2025-08-13 19:20:51,253  json_loader        [INFO]: Appending new entries to the command queue: AntTask(command='sleep 3',task_id='wait3')
    # 2025-08-13 19:20:51,253  json_loader        [INFO]: Appending new entries to the command queue: AntTask(command='sleep 1',task_id='wait1')
    # 2025-08-13 19:20:51,253  json_loader        [INFO]: Appending new entries to the command queue: AntTask(command='sleep 2',task_id='wait2')
    # 2025-08-13 19:20:51,253  json_loader        [INFO]: Popping and deleting first entry from the command queue.
    # 2025-08-13 19:20:51,255  subprocess_handler [INFO]: Spawned new worker. Command: sleep 3, Log file: ../13_20_2025_19_20_50/wait3.log
    # 2025-08-13 19:20:51,255  gpu_runner         [INFO]: Task wait3 on GPU 0 started.
    # 2025-08-13 19:20:52,256  json_loader        [INFO]: Popping and deleting first entry from the command queue.
    # 2025-08-13 19:20:52,258  subprocess_handler [INFO]: Spawned new worker. Command: sleep 1, Log file: ../13_20_2025_19_20_50/wait1.log
    # 2025-08-13 19:20:52,258  gpu_runner         [INFO]: Task wait1 on GPU 1 started.
    # 2025-08-13 19:20:54,260  subprocess_handler [INFO]: Task wait3 completed! Removed from active process list.
    # 2025-08-13 19:20:54,260  subprocess_handler [INFO]: Task wait1 completed! Removed from active process list.
    # 2025-08-13 19:20:54,260  gpu_runner         [INFO]: Task wait3 finished. Took 3 seconds
    # 2025-08-13 19:20:54,261  gpu_runner         [INFO]: Task wait1 finished. Took 2 seconds
    # 2025-08-13 19:20:55,261  json_loader        [INFO]: Popping and deleting first entry from the command queue.
    # 2025-08-13 19:20:55,262  subprocess_handler [INFO]: Spawned new worker. Command: sleep 2, Log file: ../13_20_2025_19_20_50/wait2.log
    # 2025-08-13 19:20:55,263  gpu_runner         [INFO]: Task wait2 on GPU 0,1 started.
    # 2025-08-13 19:20:58,265  subprocess_handler [INFO]: Task wait2 completed! Removed from active process list.
    # 2025-08-13 19:20:58,265  gpu_runner         [INFO]: Task wait2 finished. Took 3 seconds

    r = build_runner(opt)
    cmds = [{'task_id' : 'wait3',
            'command' : 'sleep 3',
            'n_gpus' : 1,},
            {'task_id' : 'wait1',
            'command' : 'sleep 1',
            'n_gpus' : 1,},
            {'task_id' : 'wait2',
            'command' : 'sleep 2',
            'n_gpus' : 2,},
        ]
    task_list = [create_task(i) for i in cmds]
    r.add_task_to_queue(task_list)

    # supposed to finish in 5 sec
    for i in range(0, 6):
        r.step()
        time.sleep(1)


def manual_blocking():
    # 2025-08-13 19:24:04,398  json_loader        [INFO]: Memory_loader initialized.
    # 2025-08-13 19:24:04,398  subprocess_handler [INFO]: Subprocess Handler Initiated. log_dir=../13_24_2025_19_24_04, pipe_to_file=True
    # 2025-08-13 19:24:05,435  gpu_runner         [INFO]: GPURunner initialized: GPUs=0,1
    # 2025-08-13 19:24:05,436  json_loader        [INFO]: Appending new entries to the command queue: AntTask(command='sleep 3',task_id='wait3')
    # 2025-08-13 19:24:05,436  json_loader        [INFO]: Appending new entries to the command queue: AntTask(command='sleep 1',task_id='wait1')
    # 2025-08-13 19:24:05,436  json_loader        [INFO]: Popping and deleting first entry from the command queue.
    # 2025-08-13 19:24:05,437  subprocess_handler [INFO]: Spawned new worker. Command: sleep 3, Log file: ../13_24_2025_19_24_04/wait3.log
    # 2025-08-13 19:24:05,437  gpu_runner         [INFO]: Task wait3 on GPU 1 started.
    # 2025-08-13 19:24:09,438  subprocess_handler [INFO]: Task wait3 completed! Removed from active process list.
    # 2025-08-13 19:24:09,438  gpu_runner         [INFO]: Task wait3 finished. Took 4 seconds
    # 2025-08-13 19:24:10,438  json_loader        [INFO]: Popping and deleting first entry from the command queue.
    # 2025-08-13 19:24:10,439  subprocess_handler [INFO]: Spawned new worker. Command: sleep 1, Log file: ../13_24_2025_19_24_04/wait1.log
    # 2025-08-13 19:24:10,440  gpu_runner         [INFO]: Task wait1 on GPU 1 started.
    # 2025-08-13 19:24:12,441  subprocess_handler [INFO]: Task wait1 completed! Removed from active process list.
    # 2025-08-13 19:24:12,441  gpu_runner         [INFO]: Task wait1 finished. Took 2 seconds

    r = build_runner(opt)
    r.set_gpu_states(idx=0,
                     mode = 'block',
                     op_type = 'allowed')

    cmds = [{'task_id' : 'wait3',
            'command' : 'sleep 3',
            'n_gpus' : 1,},
            {'task_id' : 'wait1',
            'command' : 'sleep 1',
            'n_gpus' : 1,},
        ]
    task_list = [create_task(i) for i in cmds]
    r.add_task_to_queue(task_list)

    # supposed to finish in 4 sec
    for i in range(0, 5):
        r.step()
        time.sleep(1)

if __name__ == '__main__':
    # test for normal behvaior
    normal_test()
    
    # test for manual blockings
    manual_blocking()