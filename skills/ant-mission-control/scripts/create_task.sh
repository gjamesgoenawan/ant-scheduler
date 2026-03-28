#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

if [[ "${1:-}" == "--help" || "$#" -lt 3 ]]; then
  cat <<'EOF'
Usage:
  create_task.sh <task_id> <n_gpus> <command>

Environment overrides:
  ANT_SCHEDULER_URL  Project default from .ant-scheduler/env
  ANT_CONDA_ENV      Project default from .ant-scheduler/env
  ANT_CONDA_PATH     Project default from .ant-scheduler/env
  ANT_WD           Optional: set runner ant_wd
  QUEUE_MODE       Default: single

Example:
  bash create_task.sh mytask 2 'echo hello'
EOF
  exit 0
fi

TASK_ID="$1"
N_GPUS="$2"
COMMAND="$3"
ANT_WD="${ANT_WD:-}"
QUEUE_MODE="${QUEUE_MODE:-single}"

require_ant_scheduler_defaults

jq -n \
  --arg task_id "$TASK_ID" \
  --arg queue_mode "$QUEUE_MODE" \
  --arg command "$COMMAND" \
  --arg ant_conda_env "$ANT_CONDA_ENV" \
  --arg ant_conda_path "$ANT_CONDA_PATH" \
  --arg ant_wd "$ANT_WD" \
  --argjson n_gpus "$N_GPUS" \
  '{
    task_id: $task_id,
    queue_mode: $queue_mode,
    n_gpus: $n_gpus,
    command: $command
  } + if ($ant_conda_env != "" or $ant_conda_path != "" or $ant_wd != "") then {
    envar: (
      {}
      + if $ant_conda_env != "" then {ant_conda_env: $ant_conda_env} else {} end
      + if $ant_conda_path != "" then {ant_conda_path: $ant_conda_path} else {} end
      + if $ant_wd != "" then {ant_wd: $ant_wd} else {} end
    )
  } else {} end' \
  | curl --silent --show-error \
      --header "Content-Type: application/json" \
      --request POST \
      --data @- \
      "${ANT_SCHEDULER_URL}/create_task"
echo
