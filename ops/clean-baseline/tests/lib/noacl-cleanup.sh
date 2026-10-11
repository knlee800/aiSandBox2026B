# No-ACL loop cleanup for the T4.2 disposable case. Not an entry point.
# A failed unmount is retained while later cleanup steps still run.
restore_noacl_mount() {
  local stage="${1:-}"
  local rc=0 step=0 ere=0 opts=""
  [[ -n "$stage" ]] || return 2
  case $- in *e*) ere=1 ;; esac
  set +e
  if findmnt /opt/aisandbox >/dev/null 2>&1; then
    opts="$(findmnt -T /opt/aisandbox -no OPTIONS 2>/dev/null)"
    if printf '%s\n' "$opts" | grep -q noacl; then
      umount /opt/aisandbox
      step=$?
      if [[ "$step" -ne 0 ]]; then
        umount -l /opt/aisandbox
        step=$?
      fi
      if [[ "$step" -ne 0 && "$rc" -eq 0 ]]; then
        rc=$step
      fi
    fi
  fi
  if mountpoint -q "$stage"; then
    umount "$stage"
    step=$?
    if [[ "$step" -ne 0 ]]; then
      umount -l "$stage"
      step=$?
    fi
    if [[ "$step" -ne 0 && "$rc" -eq 0 ]]; then
      rc=$step
    fi
  fi
  if [[ "$ere" -eq 1 ]]; then set -e; else set +e; fi
  return "$rc"
}
