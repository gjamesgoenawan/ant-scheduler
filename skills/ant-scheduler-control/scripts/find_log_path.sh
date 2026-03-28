#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

if [[ "${1:-}" == "--help" || "$#" -lt 1 ]]; then
  echo "Usage: find_log_path.sh <task_id>" >&2
  exit 0
fi

TASK_ID="$1"
require_ant_scheduler_defaults

curl -s "${ANT_SCHEDULER_URL}/vis" | jq -r --arg task_id "$TASK_ID" '
  (.data.task_ongoing[]? | select(.task_id == $task_id) | .log_file_name),
  (.data.task_completed[]? | select(.task_id == $task_id) | .log_file_name)
' | sed '/^$/d'
