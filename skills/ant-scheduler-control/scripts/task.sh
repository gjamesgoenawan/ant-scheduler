#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

if [[ "${1:-}" == "--help" || "$#" -lt 2 ]]; then
  cat <<'EOF'
Usage:
  task.sh remove-queue <task_id> [task_id ...]
  task.sh kill <task_id> [task_id ...]
  task.sh restart <task_id> [task_id ...]

Commands:
  remove-queue   Remove queued task(s)
  kill           Terminate ongoing task(s)
  restart        Restart task(s) from ongoing or completed history
EOF
  exit 0
fi

require_ant_scheduler_defaults

COMMAND="$1"
shift

build_task_ids_json() {
  jq -nc '$ARGS.positional' --args "$@"
}

case "$COMMAND" in
  remove-queue)
    TASK_IDS_JSON="$(build_task_ids_json "$@")"
    jq -nc --argjson task_ids "$TASK_IDS_JSON" '{task_ids: $task_ids}' \
      | curl --silent --show-error \
          --header "Content-Type: application/json" \
          --request POST \
          --data @- \
          "${ANT_SCHEDULER_URL}/remove_task_from_queue"
    echo
    ;;
  kill)
    TASK_IDS_JSON="$(build_task_ids_json "$@")"
    jq -nc --argjson task_ids "$TASK_IDS_JSON" '{task_ids: $task_ids}' \
      | curl --silent --show-error \
          --header "Content-Type: application/json" \
          --request POST \
          --data @- \
          "${ANT_SCHEDULER_URL}/kill_task"
    echo
    ;;
  restart)
    for task_id in "$@"; do
      curl --silent --show-error --get \
        --data-urlencode "task_id=${task_id}" \
        "${ANT_SCHEDULER_URL}/restart_task"
      echo
    done
    ;;
  *)
    cat <<'EOF' >&2
Usage:
  task.sh remove-queue <task_id> [task_id ...]
  task.sh kill <task_id> [task_id ...]
  task.sh restart <task_id> [task_id ...]
EOF
    exit 1
    ;;
esac
