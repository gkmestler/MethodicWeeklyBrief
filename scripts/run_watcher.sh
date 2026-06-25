#!/usr/bin/env bash
# Process the manual-trigger queue once and exit. launchd runs this every minute;
# you can also run it by hand to immediately pick up a dashboard request.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}" || exit 1

mkdir -p "${REPO_ROOT}/logs"
LOG="${REPO_ROOT}/logs/watcher.log"

if [ -x "${REPO_ROOT}/generator/.venv/bin/python" ]; then
  PY="${REPO_ROOT}/generator/.venv/bin/python"
elif [ -x "${REPO_ROOT}/.venv/bin/python" ]; then
  PY="${REPO_ROOT}/.venv/bin/python"
else
  PY="$(command -v python3 || command -v python)"
fi

"${PY}" -m generator.watch_triggers "$@" >>"${LOG}" 2>&1
exit $?
