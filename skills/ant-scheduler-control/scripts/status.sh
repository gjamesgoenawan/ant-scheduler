#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

if [[ "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  status.sh [health|version|summary|gpus|ongoing|queue|completed]
  status.sh task <task_id>
EOF
  exit 0
fi

MODE="${1:-summary}"
TASK_ID="${2:-}"

case "$MODE" in
  health)
    require_ant_scheduler_defaults
    curl --silent --show-error "${ANT_SCHEDULER_URL}"
    echo
    ;;
  version)
    require_ant_scheduler_defaults
    curl --silent --show-error "${ANT_SCHEDULER_URL}" \
      | jq -r '.message'
    ;;
  summary)
    require_ant_scheduler_defaults
    VIS_JSON="$(curl -s "${ANT_SCHEDULER_URL}/vis")"
    printf '%s\n' "$VIS_JSON" | jq '{ongoing: .data.task_ongoing | length, queued: .data.task_queue | length, completed: .data.task_completed | length}'
    ;;
  gpus)
    require_ant_scheduler_defaults
    VIS_JSON="$(curl -s "${ANT_SCHEDULER_URL}/vis")"
    printf '%s\n' "$VIS_JSON" | jq '.data.monitor | {gpu_allowed, gpu_availability, gpu_usage, gpu_memory, gpu_total_memory}'
    ;;
  ongoing)
    require_ant_scheduler_defaults
    VIS_JSON="$(curl -s "${ANT_SCHEDULER_URL}/vis")"
    printf '%s\n' "$VIS_JSON" | jq '.data.task_ongoing'
    ;;
  queue)
    require_ant_scheduler_defaults
    VIS_JSON="$(curl -s "${ANT_SCHEDULER_URL}/vis")"
    printf '%s\n' "$VIS_JSON" | jq '.data.task_queue'
    ;;
  completed)
    require_ant_scheduler_defaults
    VIS_JSON="$(curl -s "${ANT_SCHEDULER_URL}/vis")"
    printf '%s\n' "$VIS_JSON" | jq '.data.task_completed'
    ;;
  task)
    require_ant_scheduler_defaults
    VIS_JSON="$(curl -s "${ANT_SCHEDULER_URL}/vis")"
    if [[ -z "$TASK_ID" ]]; then
      echo "status.sh task <task_id>" >&2
      exit 1
    fi
    printf '%s\n' "$VIS_JSON" | jq --arg task_id "$TASK_ID" '
      if any(.data.task_ongoing[]?; .task_id == $task_id) then
        {state: "ongoing", task: (.data.task_ongoing[] | select(.task_id == $task_id))}
      elif any(.data.task_queue[]?; .task_id == $task_id) then
        {state: "queued", task: (.data.task_queue[] | select(.task_id == $task_id))}
      elif any(.data.task_completed[]?; .task_id == $task_id) then
        {state: "completed", task: (.data.task_completed[] | select(.task_id == $task_id))}
      else
        {state: "missing", task_id: $task_id}
      end'
    ;;
  *)
    cat <<'EOF' >&2
Usage:
  status.sh [health|version|summary|gpus|ongoing|queue|completed]
  status.sh task <task_id>
EOF
    exit 1
    ;;
esac
