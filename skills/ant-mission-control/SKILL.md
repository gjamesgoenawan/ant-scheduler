---
name: ant-mission-control
description: Use when the user wants Codex to launch, monitor, or inspect jobs on a local ANT runner using curl and jq. Handles GPU availability checks, task submission, queue/running/completed status checks, limited log fetches, and full log path lookup through the bundled helper scripts.
---

# ANT Mission Control

Use this skill for experiment operations on the local task runner exposed at `http://localhost:5000`.

Default runner assumptions:
- `queue_mode` is always `"single"`
- `RUNNER_URL` defaults to `http://localhost:5000` unless the user says otherwise
- `ant_conda_env` is optional and should only be set when the user asks for a specific environment
- `ant_conda_path` is optional and should only be set when the user's conda binary is not on the default path
- `ant_wd` should usually be inferred from the current repository context instead of asked up front
- For randomized ports or seeds inside a runner command, prefer ANT's built-in RNG syntax such as `{rand int 20000 40000}` instead of shell `$RANDOM`.

## First-run guidance

Before launching a task for the first time in a conversation, ask the user a short setup question if these values are still unknown:
- whether the runner URL should stay at `http://localhost:5000`
- whether a default `ant_conda_env` should be used
- whether a default `ant_conda_path` should be used

Do not ask for `ant_wd` by default. Infer it from the repository and the user request whenever possible. Only ask about `ant_wd` if the working directory is genuinely ambiguous or the user indicates a different project root.

If the user gives defaults, reuse them for later task launches in the same conversation. If the user does not provide overrides, proceed with:
- `RUNNER_URL=http://localhost:5000`
- no `ant_conda_env`
- no `ant_conda_path`

## Workflow

1. Check runner state before launching:
   - `curl -s http://localhost:5000/vis | jq .data.monitor.gpu_allowed`
   - `curl -s http://localhost:5000/vis | jq .data.monitor.gpu_availability`
   - `curl -s http://localhost:5000/vis | jq .data.task_ongoing`
   - `curl -s http://localhost:5000/vis | jq .data.task_queue`
2. If enough GPUs are allowed and available, submit the task with `scripts/create_task.sh`.
3. Monitor the task with `scripts/status.sh` and `scripts/log.sh`.
4. When needed, resolve the full log file with `scripts/find_log_path.sh`.

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
- `scripts/create_task.sh`
- `scripts/status.sh`
- `scripts/log.sh`
- `scripts/find_log_path.sh`

Run `--help` on a script first if the exact arguments are not obvious.

## Submission rules

- Always use a unique `task_id`.
- Keep the full training command inside the runner `command` field.
- Do not prepend `cd` when `ant_wd` is set through runner environment variables.
- Prefer `torchrun` commands exactly as used in this repo.
- If the user specifies GPUs, pass that count as `n_gpus`.
- If the user specifies `ant_conda_env`, `ant_conda_path`, or `ant_wd`, pass them through the helper script via environment variables.
- When a command needs a randomized rendezvous port, use ANT interpolation directly inside the command, for example:
  - `--rdzv-endpoint=localhost:{rand int 20000 40000}`
  - `PORT={rand int 20000 40000}`
- Do not use shell randomization like `$((20000 + RANDOM % 40000))` inside runner-submitted commands unless the user explicitly asks for shell-side randomness.

## Monitoring rules

- For status, prefer summarizing whether the task is queued, running, or completed.
- For logs, use the limited `/get_log` endpoint first.
- Only resolve the full log path when the user explicitly asks for it or the limited log is insufficient.

## Examples

Check GPUs:

```bash
bash skills/codex/ant-mission-control/scripts/status.sh gpus
```

Create a task:

```bash
ANT_CONDA_ENV=my_env ANT_CONDA_PATH=/home/anaconda/bin/conda \
bash skills/codex/ant-mission-control/scripts/create_task.sh \
  relu_vit-tiny_imagenet_mymethod_rc6 \
  2 \
  'torchrun --nproc_per_node=2 --rdzv-endpoint=localhost:{rand int 20000 40000} tasks/setting_1.py --model_type vit_tiny --dataset imagenet --attn_type parallel_relu --load_strat force --ckpt pretrained --teacher_ckpt pretrained --save_last --train_v --conversion_steps 20000 --conversion_strat mymethod_rc6 --comment mymethod_rc6'
```

Check one task:

```bash
bash skills/codex/ant-mission-control/scripts/status.sh task relu_vit-tiny_imagenet_mymethod_rc6
```

Fetch limited log:

```bash
bash skills/codex/ant-mission-control/scripts/log.sh relu_vit-tiny_imagenet_mymethod_rc6
```

Get full log path:

```bash
bash skills/codex/ant-mission-control/scripts/find_log_path.sh relu_vit-tiny_imagenet_mymethod_rc6
```
