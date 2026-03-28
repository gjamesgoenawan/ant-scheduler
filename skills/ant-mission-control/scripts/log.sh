#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

if [[ "${1:-}" == "--help" || "$#" -lt 1 ]]; then
  cat <<'EOF' >&2
Usage:
  log.sh <task_id>
  log.sh --full <task_id>
EOF
  exit 0
fi

FULL_LOG="false"

if [[ "${1:-}" == "--full" ]]; then
  FULL_LOG="true"
  shift
fi

if [[ "$#" -lt 1 ]]; then
  echo "Usage: log.sh [--full] <task_id>" >&2
  exit 1
fi

TASK_ID="$1"
require_ant_scheduler_defaults

RESPONSE="$(
  curl --silent --show-error --get \
    --data-urlencode "task_id=${TASK_ID}" \
    --data-urlencode "full_log=${FULL_LOG}" \
    "${ANT_SCHEDULER_URL}/get_log"
)"

STATUS="$(printf '%s\n' "$RESPONSE" | jq -r '.status // empty')"
if [[ "$STATUS" == "success" ]]; then
  printf '%s' "$RESPONSE" | jq -r '.data'
  if [[ "${FULL_LOG}" == "false" ]]; then
    echo
  fi
else
  printf '%s\n' "$RESPONSE" | jq .
  exit 1
fi
