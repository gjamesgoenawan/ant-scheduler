---
name: ant-mission-control
description: Use when the user wants Codex to interact with ANT Scheduler, the GPU job scheduler at github.com/gjamesgoenawan/ant-scheduler, to launch, monitor, and inspect research ML or deep-learning runs. Use it for GPU training jobs, no-GPU jobs, project default runner setup in .ant-scheduler/env, queue or running status checks, limited log reads, and full log path lookup through the bundled helper scripts.
---

# ANT Mission Control

Use this skill to interact with ANT Scheduler, the GPU job scheduler at `github.com/gjamesgoenawan/ant-scheduler`.

ANT is primarily used to schedule research experiments and deep-learning or ML training runs that need GPUs, but it also supports jobs with no GPU assignment.

Use this skill for:
- project-level ANT default setup
- launching ANT tasks
- monitoring queued, ongoing, and completed tasks
- task control operations such as queue removal, restart, and termination
- worker control operations such as enabling or disabling GPUs
- runner health and version checks
- fetching limited logs
- locating full log files

## Project defaults

Before using this skill on a project, define these defaults in `.ant-scheduler/env`:
- `ANT_SCHEDULER_URL='http://localhost:5000'`
- `ANT_CONDA_ENV=''`
- `ANT_CONDA_PATH='conda'`

This file is the project default source of truth unless the user explicitly overrides values for a specific task. If the user asks to change the project defaults, update `.ant-scheduler/env`.

Load behavior:
- if `ANT_SCHEDULER_URL`, `ANT_CONDA_ENV`, or `ANT_CONDA_PATH` are already defined in the environment, use those values
- otherwise, load them from `.ant-scheduler/env`
- if `.ant-scheduler/env` does not exist yet, ask the user for all three project defaults first, then create the file
- if the user has no project-specific preference, initialize the file with:
  - `ANT_SCHEDULER_URL='http://localhost:5000'`
  - `ANT_CONDA_ENV=''`
  - `ANT_CONDA_PATH='conda'`

`ANT_WD` should not be stored in `.ant-scheduler/env`. Infer it from the repository context and the user request whenever possible.

When setting up or changing project defaults:
- always ask the user about all three values first:
  - `ANT_SCHEDULER_URL`
  - `ANT_CONDA_ENV`
  - `ANT_CONDA_PATH`
- after the user confirms them, write the file with `scripts/init_project_env.sh`
- do not silently create `.ant-scheduler/env` without user confirmation
- if the user says to use the standard defaults, still write those explicit values into `.ant-scheduler/env`

Other assumptions:
- `queue_mode` is always `"single"`
- For randomized ports or seeds inside a runner command, prefer ANT's built-in RNG syntax such as `{rand int 20000 40000}` instead of shell `$RANDOM`.

## Workflow

1. Check runner state before launching:
   - `bash skills/ant-mission-control/scripts/status.sh health`
   - `bash skills/ant-mission-control/scripts/status.sh gpus`
   - `bash skills/ant-mission-control/scripts/status.sh ongoing`
   - `bash skills/ant-mission-control/scripts/status.sh queue`
2. If enough GPUs are allowed and available, submit the task with `scripts/create_task.sh`.
3. Monitor the task with `scripts/status.sh` and `scripts/log.sh`.
4. Use `scripts/task.sh` or `scripts/gpu.sh` for runner control operations.
5. When needed, resolve the full log file with `scripts/find_log_path.sh`.

## JSON shape

The `/vis` endpoint returns:
- `.data.monitor`
- `.data.task_completed`
- `.data.task_ongoing`
- `.data.task_queue`

Useful task fields:
- `task_id`
- `command`
- `n_gpus`
- `gpu_ids`
- `gpu_idx`
- `log_file_name`
- `envar.ant_conda_env`
- `envar.ant_conda_path`
- `envar.ant_wd`
- `time.start`
- `time.runtime`

## Scripts

Use these bundled scripts instead of rewriting curl payloads:
- `scripts/common.sh`
- `scripts/init_project_env.sh`
- `scripts/create_task.sh`
- `scripts/status.sh`
- `scripts/task.sh`
- `scripts/gpu.sh`
- `scripts/log.sh`
- `scripts/find_log_path.sh`

Run `--help` on a script first if the exact arguments are not obvious.

## Submission rules

- Always use a unique `task_id`.
- Keep the full training command inside the runner `command` field.
- Do not prepend `cd` when `ant_wd` is set through runner environment variables.
- Prefer `torchrun` commands exactly as used in this repo.
- If the user specifies GPUs, pass that count as `n_gpus`.
- If the user specifies `ANT_SCHEDULER_URL`, `ANT_CONDA_ENV`, `ANT_CONDA_PATH`, or `ANT_WD`, pass them through the helper script via environment variables.
- When a command needs a randomized rendezvous port, use ANT interpolation directly inside the command, for example:
  - `--rdzv-endpoint=localhost:{rand int 20000 40000}`
  - `PORT={rand int 20000 40000}`
- Do not use shell randomization like `$((20000 + RANDOM % 40000))` inside runner-submitted commands unless the user explicitly asks for shell-side randomness.

## Monitoring rules

- Use `status.sh health` before first use when you need to confirm the runner is alive.
- A healthy runner root response looks like:
  - `{"message":"Ant-Scheduler Backend (commit: commit_id)","status":"success"}`
- Use `status.sh version` if you only need the runner version string.
- For status, prefer summarizing whether the task is queued, running, or completed.
- For logs, use the limited `/get_log` endpoint first.
- If the user wants to read the complete log contents, use `log.sh --full <task_id>`.
- Only resolve the full log path when the user explicitly asks for it or the limited log is insufficient.

## Examples

Check GPUs:

```bash
bash skills/ant-mission-control/scripts/status.sh gpus
```

Check runner health:

```bash
bash skills/ant-mission-control/scripts/status.sh health
```

Check runner version:

```bash
bash skills/ant-mission-control/scripts/status.sh version
```

Initialize project defaults:

```bash
bash skills/ant-mission-control/scripts/init_project_env.sh \
  'http://localhost:5000' \
  '' \
  'conda' \
  .
```

Create a task:

```bash
ANT_CONDA_ENV=my_env ANT_CONDA_PATH=/home/anaconda/bin/conda \
bash skills/ant-mission-control/scripts/create_task.sh \
  relu_vit-tiny_imagenet_mymethod_rc6 \
  2 \
  'torchrun --nproc_per_node=2 --rdzv-endpoint=localhost:{rand int 20000 40000} tasks/setting_1.py --model_type vit_tiny --dataset imagenet --attn_type parallel_relu --load_strat force --ckpt pretrained --teacher_ckpt pretrained --save_last --train_v --conversion_steps 20000 --conversion_strat mymethod_rc6 --comment mymethod_rc6'
```

Check one task:

```bash
bash skills/ant-mission-control/scripts/status.sh task relu_vit-tiny_imagenet_mymethod_rc6
```

Fetch limited log:

```bash
bash skills/ant-mission-control/scripts/log.sh relu_vit-tiny_imagenet_mymethod_rc6
```

Fetch full log text:

```bash
bash skills/ant-mission-control/scripts/log.sh --full relu_vit-tiny_imagenet_mymethod_rc6
```

Get full log path:

```bash
bash skills/ant-mission-control/scripts/find_log_path.sh relu_vit-tiny_imagenet_mymethod_rc6
```

Remove queued task:

```bash
bash skills/ant-mission-control/scripts/task.sh remove-queue relu_vit-tiny_imagenet_mymethod_rc6
```

Terminate running task:

```bash
bash skills/ant-mission-control/scripts/task.sh kill relu_vit-tiny_imagenet_mymethod_rc6
```

Restart task:

```bash
bash skills/ant-mission-control/scripts/task.sh restart relu_vit-tiny_imagenet_mymethod_rc6
```

Disable GPU 0:

```bash
bash skills/ant-mission-control/scripts/gpu.sh disable 0
```

Enable GPU 0:

```bash
bash skills/ant-mission-control/scripts/gpu.sh enable 0
```
