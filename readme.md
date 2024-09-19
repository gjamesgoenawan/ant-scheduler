# ANT : Scalable GPU Job Scheduler
Currently, ANT supports single-node multi-GPU settings, with multi-node support planned for future development.

The primary objective of ANT is to efficiently schedule jobs and allocate the requested GPU resources.

# Installing and Running ANT
To set up ANT, ensure you have a conda installation, then create the necessary environment by running:
```
git clone ...
cd ant_scheduler
conda create --name ant_scheduler python=3.11 -y
conda activate ant_scheduler
pip install -r requirements.txt
```

Next generate a certificate for HTTPS support:
```
mkdir cert && cd cert
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
cd ..
```
Finally, launch ANT using:
```
python app.py [gpu_ids seperated by comma]

# Example (Selecting the first 4 GPUs):
python app.py 0,1,2,3
```
By default, this will load the configuration from `config/base.py` and host a web interface at `https:/0.0.0.0:5050`.

# Usage
## Basic
ANT supports any single-line command. For sequential execution of multiple commands, please use `&&`.

> If your conda environment is necessary for your job, please use `conda run` instead of `conda activate`. Example: 
```
cd /path/to/my/project && conda run --live-stream -n my_env python ...
```
Note that `--live-stream` is necessary for the `conda run` to live-stream the output to stdout. Otherwise, no output will be printed.

## Advance
#### Built in RNG
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

#### Queue Multiple Commands
ANT also support queuing multiple commands. To achieve this, select the "Multi" queue mode in the `Create New Task` tab. Multiple commands can be seperated using new lines & each command can be extended to the following lines by adding `\` at the end (just like you would on terminals).

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
>Note that if multiple ANT arguments present, the only the last one will take effect. If none is present, the default value will be used

#### Auto GPU Availability Detection
This feature monitors GPU usage and detects if a GPU is being utilized by processes outside of ANT. If the GPU's average usage or memory utilization exceeds 50% for a consecutive 20-second period, ANT will mark the GPU as BUSY.

Enable this behavior by setting `auto_detect_gpu_status=True` in your config. This feature is not enabled by default.

## Future Update:
- Support for GPU specification.
- Support for editing / rearranging queued commands.

## Changelog:
| Version | Changelogs |
| -       | -          |
|0.3 (Current)| - Added Auto GPU Availability Detection<br>- Added Mutliple Command Support<br>- Added QOL features to Flask UI (better notification, copy commands, view logs in browser, etc.)<br>- Forced HTTPS |
|0.2| - Updated Flask Visualizer UI <br> - Added advanced sytem monitoring (graphs & statistics)<br>- Set `ant.handler.subprocess_handler` as default.<br>- Deprecated `ant.handler.tmux_handler`<br>- Deprecated `ant.visualizer.ncurse_visualizer`|
|0.1| - Initial release|



