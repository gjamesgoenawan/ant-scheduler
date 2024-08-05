# ANT : Scalable GPU Job Scheduler
Currently, ANT supports single-node multi-GPU settings, with multi-node support planned for future development.

The primary objective of ANT is to efficiently schedule jobs and allocate the requested GPU resources.

# Installing and Running ANT
To set up ANT, ensure you have a conda installation, then create the necessary environment by running:
```
conda create --name ant_scheduler python=3.11 -y
conda activate ant_scheduler
pip install -r requirements.txt
```
Next, launch ANT using:
```
python app.py [gpu_ids seperated by comma]

# Example (Selecting the first 4 GPUs):
python app.py 0,1,2,3
```
By default, this will load the configuration from `config/base.py` and host a web interface at `0.0.0.0:5050`.

# Usage
## Basic
ANT supports any single-line command. For sequential execution of multiple commands, please use `&&`.

> If your conda environment is necessary for your job, please use `conda run` instead of `conda activate`. Example: 
```
cd /path/to/my/project && conda run --live-stream -n my_env python ...
```
Note that `--live-stream` is necessary for the `conda run` to live-stream the output to stdout. Otherwise, no output will be printed.

## Advance
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

