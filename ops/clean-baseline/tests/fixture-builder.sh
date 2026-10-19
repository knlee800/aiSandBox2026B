#!/bin/bash
# Builds the T4.1 synthetic tree. Runs only after operational_gate.
set -euo pipefail
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
# shellcheck source=/dev/null
source "$HERE/lib/operational-gate.sh"
# shellcheck source=/dev/null
source "$HERE/lib/case-helpers.sh"
trap 'case_finish' EXIT
operational_gate
root=${1:-}
[[ -n "$root" && "$root" != "/" && "$root" != "/opt/aisandbox" && "$root" != "/etc" && "$root" != "/usr" && "$root" != "/var" ]] || {
  printf '%s\n' 'refusing an unsafe fixture root' >&2
  exit 2
}
case "$root" in
  *..*) printf '%s\n' 'refusing fixture traversal' >&2; exit 2 ;;
  /var/tmp/aisb-ops-fixtures/*) ;;
  *)
    printf '%s\n' 'fixture root must be under /var/tmp/aisb-ops-fixtures/' >&2
    exit 2
    ;;
esac
if [[ -e "$root" ]] && [[ -L "$root" ]]; then
  printf '%s\n' 'refusing a symlink fixture root' >&2
  exit 2
fi
if [[ -e "$root" ]] && [[ -n "$(find "$root" -mindepth 1 -print -quit)" ]]; then
  printf '%s\n' 'refusing a non-empty fixture root' >&2
  exit 2
fi
case_begin fixture-builder
mkdir -p "$root/workspaces/app" "$root/database" "$root/projects/app" "$root/services/snapshot-store" "$root/snapshot-store"
resolved="$(cd "$root" && pwd -P)"
case "$resolved" in
  /var/tmp/aisb-ops-fixtures/*) ;;
  *)
    printf '%s\n' 'resolved fixture root escaped /var/tmp/aisb-ops-fixtures' >&2
    exit 2
    ;;
esac
printf 'tracked-delete-me\n' > "$root/database/tracked-delete-me.sql"
printf 'project-tracked\n' > "$root/projects/app/tracked.txt"
printf 'workspace-tracked\n' > "$root/workspaces/app/tracked.txt"
printf 'host-7300\n' > "$root/workspaces/app/from-host.txt"
printf 'uid-1000\n' > "$root/workspaces/app/uid1000.txt"
printf 'plain\n' > "$root/workspaces/app/plain.txt"
ln -s plain.txt "$root/workspaces/app/link.txt"
ln "$root/workspaces/app/plain.txt" "$root/workspaces/app/hard.txt"
sqlite3 "$root/database/fixture.db" 'PRAGMA journal_mode=PERSIST; CREATE TABLE t(id INTEGER); INSERT INTO t VALUES (1);'
python3 - "$root/workspaces/app/dev.sock" <<'PY'
import os
import socket
import sys
path = sys.argv[1]
if os.path.lexists(path):
    os.remove(path)
sock = socket.socket(socket.AF_UNIX)
sock.bind(path)
sock.close()
PY
container_git='git init /work/repo-in-container && printf container-root > /work/repo-in-container/from-container.txt && chown 0:0 /work/repo-in-container/from-container.txt && git -C /work/repo-in-container add from-container.txt && git -C /work/repo-in-container -c user.email=ops@example.invalid -c user.name=ops commit -m fixture'
if ! docker run --rm node:24-alpine git --version >/dev/null 2>&1; then
  printf '%s\n' 'node:24-alpine does not include git; the disposable fixture must install it before container git init' >&2
  docker run --rm -v "$root/workspaces/app:/work" node:24-alpine sh -c "apk add --no-cache git && ${container_git}"
else
  docker run --rm -v "$root/workspaces/app:/work" node:24-alpine sh -c "$container_git"
fi
setfacl -m u:1234:r "$root/workspaces/app/plain.txt"
setfattr -n user.test -v fixture "$root/workspaces/app/plain.txt"
chown 7300:7300 "$root/workspaces/app/from-host.txt"
chown 1000:1000 "$root/workspaces/app/uid1000.txt"
if [[ ! -d "$root/.git" ]]; then
  git -C "$root" init
  git -C "$root" add database/tracked-delete-me.sql projects/app/tracked.txt workspaces/app/tracked.txt
  git -C "$root" -c user.email=ops@example.invalid -c user.name=ops commit -m 'fixture tracked files'
fi
printf '%s\n' "$root"
