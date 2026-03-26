#!/usr/bin/env bash
set -euo pipefail

RUNNER_URL="${RUNNER_URL:-http://localhost:5000}"
MODE="${1:-summary}"
TASK_ID="${2:-}"

VIS_JSON="$(curl -s "${RUNNER_URL}/vis")"

case "$MODE" in
  summary)
    printf '%s\n' "$VIS_JSON" | jq '{ongoing: .data.task_ongoing | length, queued: .data.task_queue | length, completed: .data.task_completed | length}'
    ;;
  gpus)
    printf '%s\n' "$VIS_JSON" | jq '.data.monitor | {gpu_allowed, gpu_availability, gpu_usage, gpu_memory, gpu_total_memory}'
    ;;
  ongoing)
    printf '%s\n' "$VIS_JSON" | jq '.data.task_ongoing'
    ;;
  queue)
    printf '%s\n' "$VIS_JSON" | jq '.data.task_queue'
    ;;
  completed)
    printf '%s\n' "$VIS_JSON" | jq '.data.task_completed'
    ;;
  task)
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
  status.sh [summary|gpus|ongoing|queue|completed]
  status.sh task <task_id>
EOF
    exit 1
    ;;
esac
