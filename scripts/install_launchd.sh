#!/usr/bin/env bash
# Install (or reinstall) the launchd agents:
#   com.methodic.brief   - weekly generation, Monday 06:00
#   com.methodic.watcher - polls the manual-trigger queue every 60s
# Idempotent: re-running updates the plists and reloads them.
#
#   scripts/install_launchd.sh            # install / reload both
#   scripts/install_launchd.sh --uninstall
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LA_DIR="${HOME}/Library/LaunchAgents"
UID_NUM="$(id -u)"

AGENTS=("com.methodic.brief" "com.methodic.watcher")

uninstall_one() {
  local label="$1"
  launchctl bootout "gui/${UID_NUM}/${label}" 2>/dev/null || true
  rm -f "${LA_DIR}/${label}.plist"
  echo "Removed ${label}"
}

if [ "${1:-}" = "--uninstall" ]; then
  for label in "${AGENTS[@]}"; do uninstall_one "${label}"; done
  exit 0
fi

mkdir -p "${LA_DIR}" "${REPO_ROOT}/logs"
chmod +x "${SCRIPT_DIR}/run_brief.sh" "${SCRIPT_DIR}/run_watcher.sh"

for label in "${AGENTS[@]}"; do
  template="${SCRIPT_DIR}/${label}.plist.template"
  dst="${LA_DIR}/${label}.plist"
  sed "s|__REPO_ROOT__|${REPO_ROOT}|g" "${template}" >"${dst}"
  launchctl bootout "gui/${UID_NUM}/${label}" 2>/dev/null || true
  launchctl bootstrap "gui/${UID_NUM}" "${dst}"
  launchctl enable "gui/${UID_NUM}/${label}"
  echo "Installed and loaded ${label} -> ${dst}"
done

echo
echo "Schedule: com.methodic.brief runs Monday 06:00 (missed runs fire on wake)."
echo "Trigger:  com.methodic.watcher polls the queue every 60s for dashboard requests."
echo
echo "Useful commands:"
echo "  launchctl list | grep com.methodic              # confirm both loaded"
echo "  launchctl kickstart -k gui/${UID_NUM}/com.methodic.brief    # generate now (local)"
echo "  launchctl kickstart -k gui/${UID_NUM}/com.methodic.watcher  # drain the queue now"
echo "  scripts/run_brief.sh --dry-run                  # test generation, no DB write"
echo "  tail -f ${REPO_ROOT}/logs/run_brief.log ${REPO_ROOT}/logs/watcher.log"
