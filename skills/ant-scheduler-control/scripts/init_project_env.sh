#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--help" || "$#" -lt 3 || "$#" -gt 4 ]]; then
  cat <<'EOF'
Usage:
  init_project_env.sh <ant_scheduler_url> <ant_conda_env> <ant_conda_path> [project_dir]

Writes project defaults to:
  <project_dir>/.ant-scheduler/env

Notes:
  - Pass all values explicitly.
  - Use '' for an empty ANT_CONDA_ENV.
  - Ask the user for these values before running this script.

Example:
  bash skills/ant-mission-control/scripts/init_project_env.sh \
    'http://localhost:5000' \
    '' \
    'conda' \
    .
EOF
  exit 0
fi

ANT_SCHEDULER_URL_VALUE="$1"
ANT_CONDA_ENV_VALUE="$2"
ANT_CONDA_PATH_VALUE="$3"
PROJECT_DIR="${4:-.}"
ENV_DIR="${PROJECT_DIR}/.ant-scheduler"
ENV_FILE="${ENV_DIR}/env"

shell_quote() {
  local value="$1"
  value=${value//\'/\'\\\'\'}
  printf "'%s'" "$value"
}

mkdir -p "$ENV_DIR"

cat > "$ENV_FILE" <<EOF
ANT_SCHEDULER_URL=$(shell_quote "$ANT_SCHEDULER_URL_VALUE")
ANT_CONDA_ENV=$(shell_quote "$ANT_CONDA_ENV_VALUE")
ANT_CONDA_PATH=$(shell_quote "$ANT_CONDA_PATH_VALUE")
EOF

printf 'Wrote project defaults to %s\n' "$ENV_FILE"
