#!/usr/bin/env bash
# Manual trigger + the command launchd runs every Monday.
# Runs the generator, retries once after a delay on failure, logs everything.
#
# Usage:
#   scripts/run_brief.sh                 # this week's Monday
#   scripts/run_brief.sh --week-of 2026-06-22
#   scripts/run_brief.sh --dry-run       # generate + print, no DB write
set -uo pipefail

# Resolve repo root (parent of this script's directory), regardless of cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}" || exit 1

mkdir -p "${REPO_ROOT}/logs"
LOG="${REPO_ROOT}/logs/run_brief.log"

# Use the project venv if present, else fall back to python3 on PATH.
if [ -x "${REPO_ROOT}/generator/.venv/bin/python" ]; then
  PY="${REPO_ROOT}/generator/.venv/bin/python"
elif [ -x "${REPO_ROOT}/.venv/bin/python" ]; then
  PY="${REPO_ROOT}/.venv/bin/python"
else
  PY="$(command -v python3 || command -v python)"
fi

run_once() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] starting generator: ${PY} -m generator.generate $*" >>"${LOG}"
  "${PY}" -m generator.generate "$@" >>"${LOG}" 2>&1
}

run_once "$@"
status=$?

if [ ${status} -ne 0 ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] run failed (exit ${status}); retrying once in 120s" >>"${LOG}"
  sleep 120
  run_once "$@"
  status=$?
  if [ ${status} -ne 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] retry also failed (exit ${status}). Giving up." >>"${LOG}"
  fi
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] done (exit ${status})" >>"${LOG}"
exit ${status}
