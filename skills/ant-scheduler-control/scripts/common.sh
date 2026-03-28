#!/usr/bin/env bash

find_ant_scheduler_env_file() {
  local dir="${PWD}"

  while [[ "$dir" != "/" ]]; do
    if [[ -f "$dir/.ant-scheduler/env" ]]; then
      printf '%s\n' "$dir/.ant-scheduler/env"
      return 0
    fi
    dir="$(dirname "$dir")"
  done

  if [[ -f "/.ant-scheduler/env" ]]; then
    printf '%s\n' "/.ant-scheduler/env"
    return 0
  fi

  return 1
}

load_ant_scheduler_defaults() {
  local had_scheduler_url=0
  local had_runner_url=0
  local had_conda_env=0
  local had_conda_path=0
  local current_scheduler_url=""
  local current_runner_url=""
  local current_conda_env=""
  local current_conda_path=""
  local env_file=""

  if [[ -n "${ANT_SCHEDULER_URL+x}" ]]; then
    had_scheduler_url=1
    current_scheduler_url="$ANT_SCHEDULER_URL"
  fi
  if [[ -n "${RUNNER_URL+x}" ]]; then
    had_runner_url=1
    current_runner_url="$RUNNER_URL"
  fi
  if [[ -n "${ANT_CONDA_ENV+x}" ]]; then
    had_conda_env=1
    current_conda_env="$ANT_CONDA_ENV"
  fi
  if [[ -n "${ANT_CONDA_PATH+x}" ]]; then
    had_conda_path=1
    current_conda_path="$ANT_CONDA_PATH"
  fi

  if [[ "$had_scheduler_url" -eq 0 || "$had_conda_env" -eq 0 || "$had_conda_path" -eq 0 ]]; then
    if env_file="$(find_ant_scheduler_env_file)"; then
      # shellcheck disable=SC1090
      source "$env_file"
    fi
  fi

  if [[ "$had_scheduler_url" -eq 1 ]]; then
    ANT_SCHEDULER_URL="$current_scheduler_url"
  elif [[ "$had_runner_url" -eq 1 ]]; then
    ANT_SCHEDULER_URL="$current_runner_url"
  fi

  if [[ "$had_conda_env" -eq 1 ]]; then
    ANT_CONDA_ENV="$current_conda_env"
  fi

  if [[ "$had_conda_path" -eq 1 ]]; then
    ANT_CONDA_PATH="$current_conda_path"
  fi
}

require_ant_scheduler_defaults() {
  load_ant_scheduler_defaults

  if [[ -z "${ANT_SCHEDULER_URL+x}" || -z "${ANT_CONDA_ENV+x}" || -z "${ANT_CONDA_PATH+x}" ]]; then
    cat <<'EOF' >&2
Missing ANT project defaults.

Define project defaults in .ant-scheduler/env before using this skill:
  ANT_SCHEDULER_URL='http://localhost:5000'
  ANT_CONDA_ENV=''
  ANT_CONDA_PATH='conda'

If this project should use different defaults, ask the user and save them there.
EOF
    exit 1
  fi
}
