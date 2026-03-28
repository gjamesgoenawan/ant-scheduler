#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

if [[ "${1:-}" == "--help" || "$#" -lt 2 ]]; then
  cat <<'EOF'
Usage:
  gpu.sh enable <gpu_index> [gpu_index ...]
  gpu.sh disable <gpu_index> [gpu_index ...]
EOF
  exit 0
fi

require_ant_scheduler_defaults

COMMAND="$1"
shift

case "$COMMAND" in
  enable)
    ALLOWED=true
    ;;
  disable)
    ALLOWED=false
    ;;
  *)
    cat <<'EOF' >&2
Usage:
  gpu.sh enable <gpu_index> [gpu_index ...]
  gpu.sh disable <gpu_index> [gpu_index ...]
EOF
    exit 1
    ;;
esac

GPU_INDICES_JSON="$(jq -nc '$ARGS.positional | map(tonumber)' --args "$@")"

jq -nc \
  --argjson gpu_indices "$GPU_INDICES_JSON" \
  --argjson allowed "$ALLOWED" \
  '{gpu_indices: $gpu_indices, allowed: $allowed}' \
  | curl --silent --show-error \
      --header "Content-Type: application/json" \
      --request POST \
      --data @- \
      "${ANT_SCHEDULER_URL}/toggle_allowed_gpu"
echo
