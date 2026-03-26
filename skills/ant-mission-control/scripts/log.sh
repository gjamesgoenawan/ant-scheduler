#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--help" || "$#" -lt 1 ]]; then
  echo "Usage: log.sh <task_id>" >&2
  exit 0
fi

TASK_ID="$1"
RUNNER_URL="${RUNNER_URL:-http://localhost:5000}"

curl --silent --show-error "${RUNNER_URL}/get_log?task_id=${TASK_ID}"
echo
