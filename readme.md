<center> <h1>ANT: GPU Scheduler</h1> </center>

![ANT Scheduler](./asset/screenshot.png)
Currently, ANT supports single-node multi-GPU settings, with multi-node support planned for future development.

The primary objective of ANT is to efficiently schedule jobs and allocate the requested GPU resources.

# Getting Started with ANT
ANT is built and tested with the following dependencies:
| Package | version |
| - | - |
| Python | >= 3.8 |
| Node.js | v24.4.1 | 
| npm | 11.4.2 | 
| OpenSSL | 3.0.17 |

### Installing
Assuming you have a conda installation, the necessary environment can be created by running:
```
conda create --name ant2 python=3.11 -y
conda activate ant2
pip install -r requirements.txt

# # Optional : development purposes
# conda install conda-forge::nodejs==20.19.4 -y
# cd src/frontend/ && npm install && cd ../../

# # Rebuild frontend after modification
# cd src/frontend/ && npm install && npm run build && cd ../../
```

Next, generate a certificate for HTTPS support:
```
mkdir cert  && cd cert && openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=ant-runner" && cd ..
```

### Launching
Finally, launch ANT using:
```
python run.sh [gpu_ids separated by comma]

# Example (Selecting the first 4 GPUs):
python run.py  0,1,2,3
```
By default, this will load the configuration from `config/default.json` and host a web interface at `https://0.0.0.0:6060`. The backend status can be checked by curling as follows:
```
curl --insecure https://0.0.0.0:6060/api
```

### Test Run 
Head over to the `Create New Task` tab and type the following in the `commands` box:
```
echo "Hello World from ANT!"
```
Hit the `SUBMIT` button and watch your commands got executed! ANT will also automatically save your stdout logs (similar to using `tee` or `>>`). Under default configurations, the logs will be saved at `./ant_runner_logs`.

Intuitively, you can view all ongoing and completed tasks in their respectives tabs. There, you can easily view terminal logs, download, copy-commands, etc.

# Usage Guide
## Basic

ANT supports any single-line command. For sequential execution of multiple commands, please use `&&`.

> If your conda environment is necessary for your job, please use `conda run` instead of `conda activate`. Example: 
```
cd /path/to/my/project && conda run --live-stream -n my_env python ...
```
Note that `--live-stream` is necessary for the `conda run` to live-stream the output to stdout. Otherwise, no output will be printed.

## Advanced
#### Built-in RNG
ANT features a built-in randomizer, particularly useful for distributed training that requires assigning a specific port.
```
# Randomizing integer
{rand int 4000 5000}

# Randomizing float
{rand float 1.45 5.65}

# Note that this syntax can be substituted like an f-string in your commands. Example:
PORT={rand int 4000 5000} python myscript.py
python myscript.py --seed {rand float 3.4 6.4}
```

#### Special environment variable
In previous versions of ant, commands can be very long and tedious to set up, hence we have integrated several special environment variables to improve QOL.

| Variable | Goal | What it actually does| Defaults |
| - | - | - | - |
| `ant_wd` | set the working directory of the script | invoke `cd` before your command | `./` |
| `ant_conda_env` | set / activate a conda environment | invoke `conda run` before your command | `None` |
| `ant_conda_path` | change conda executable path | invoke the specified conda executable.  Should point to `your/path/bin/conda`| `conda` |


Hence, instead of appending:
```
cd /my/work/dir && /home/anaconda/bin/conda run --live-stream -n my_env mycommand
```
You can simply use the following environment variable in the `Create New Task` page:
| Variable | Value |
| - | - |
| `ant_wd` | `/my/work/dir` |
| `ant_conda_env` | `my_env` |
| `ant_conda_path` | `/home/anaconda/bin/conda` |

Environment variables will be saved internally and applied to all commands if `Multi` Queue mode is selected.

#### Queue Multiple Commands
ANT also support queuing multiple commands. To achieve this, select the "Multi" queue mode in the `Create New Task` page. Multiple commands can be seperated using new lines & each command can be extended to the following lines by adding `\` at the end (just like you would on terminals).

To configure running parameters, there two arguments can be used:
`ant_n_gpus : int = 1` & `ant_task_id : str = uuid.uuid4()`

```
# Running three commands with partially-defined parameters:
ant_n_gpus=4 ant_task_id="first_task" python first_task_.py \
--dataset my_dataset \
--batch_size 4
ant_n_gpus=2 python second_task.py \
--batch_size 8
python thrid_task.py
```
>Note that if multiple ANT arguments present, the only the last one will take effect. If none is present, the default value (randomized task_id & 0 n_gpus) will be used

#### [HIGHLY EXPERIMENTAL] Auto Detect GPU Status (ADGS)
This feature monitors GPU usage and detects if a GPU is being utilized by processes outside of ANT. If the GPU's average usage or memory utilization exceeds 50% for a consecutive 20-second period, ANT will mark the GPU as BUSY.

Enable this behavior by setting `ADGS_enabled=true` in your config. This feature is not enabled by default.

## Future Update:
- Multi-node support

## Changelog:
| Version | Changelogs |
| -       | -          |
| 1.0.0 (Current) | a lot |
|0.3.1 | - Now host HTTP and HTTPS server with proper redirecting. <br> - Deprecated `port` argument & replaced it with `port_http` & `port_https` <br> - Implemented faster log truncation algorithm to prevent unresponsive webserver. |
|0.3| - Added Auto GPU Availability Detection<br>- Added Mutliple Command Support<br>- Added QOL features to Flask UI (better notification, copy commands, view logs in browser, etc.)<br>- Forced HTTPS |
|0.2| - Updated Flask Visualizer UI <br> - Added advanced sytem monitoring (graphs & statistics)<br>- Set `ant.handler.subprocess_handler` as default.<br>- Deprecated `ant.handler.tmux_handler`<br>- Deprecated `ant.visualizer.ncurse_visualizer`|
|0.1| - Initial release|


- Massive rewrite.
- Switched to react.js frontend.
- Reimplement backend as a REST API & improved stability.
- Added GPU Toggle to disable specific GPUs.
- Added Environment Variable editor & its custom functions.
- Added `monitor` component that polls hardware info & status in an async manner. Deprecated `sysinfo.py`
- Added `AntTask` structure for tasks to allow seamless and integrated properties tracking (time taken, envar, etc).
- Added launcher `run.py` to launch & restart frontend & backend.
- Redesigned `Completed Task` page. Its actually practical now.
- fixed random bugs & added more safeguards (removing illegal characters in `task_id`, rejecting duplicate `task_id`, etc)
- Bunch of new QoL (more detailed message in toasts, etc.)

## Acknowledgement
Web Template: [Creative Tim](https://www.creative-tim.com/product/material-dashboard).