#!/bin/bash
# Executable T4.1-T4.3. T4.4 remains the static script.
set -euo pipefail
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
# shellcheck source=/dev/null
source "$HERE/../lib/operational-gate.sh"
operational_gate
# shellcheck source=/dev/null
source "${AISB_OPS_LIB:-/usr/local/lib/aisandbox/ops-lib.sh}"
# shellcheck source=/dev/null
source "$HERE/../lib/case-helpers.sh"
# shellcheck source=/dev/null
source "$HERE/../lib/noacl-cleanup.sh"
ops_paths
evidence="$(case_evidence "t4-${1}")"
AISB_CASE_NAME="t4-${1:-}"
case_begin "$AISB_CASE_NAME"

bridge_fixture() {
  local root="$1" rel
  bash "$HERE/../fixture-builder.sh" "$root"
  for rel in workspaces database projects services/snapshot-store snapshot-store; do
    mkdir -p "/opt/aisandbox/$rel"
    cp -a "$root/$rel/." "/opt/aisandbox/$rel/"
  done
  rm -f -- /opt/aisandbox/workspaces/app/hard.txt
  ln /opt/aisandbox/workspaces/app/plain.txt /opt/aisandbox/workspaces/app/hard.txt
  python3 - /opt/aisandbox/workspaces/app/dev.sock <<'PY'
import os, socket, sys
path = sys.argv[1]
if os.path.lexists(path):
    os.remove(path)
sock = socket.socket(socket.AF_UNIX)
sock.bind(path)
sock.close()
PY
  setfacl -m u:1234:r /opt/aisandbox/workspaces/app/plain.txt
  setfattr -n user.test -v fixture /opt/aisandbox/workspaces/app/plain.txt
  chown 7300:7300 /opt/aisandbox/workspaces/app/from-host.txt
  chown 1000:1000 /opt/aisandbox/workspaces/app/uid1000.txt
  repo=/opt/aisandbox/workspaces/app/repo-in-container
  [[ -f "$repo/from-container.txt" ]]
  git_as_repo_owner "$repo" ls-files --error-unmatch from-container.txt
  git_as_repo_owner "$repo" rev-parse --verify HEAD >/dev/null
}

git_as_repo_owner() {
  local repo="$1" owner
  shift
  owner="$(stat -c '%u' "$repo/.git")"
  if [[ "$owner" == "0" ]]; then
    git -C "$repo" "$@"
  else
    runuser -u "#${owner}" -- git -C "$repo" "$@"
  fi
}

refuse_with_snapshot() {
  local bundle="$1" key="$2" rc
  prepare_snapshot "$evidence.before" || return 1
  set +e
  /usr/local/sbin/aisandbox-restore "$bundle" "$key"
  rc=$?
  set -e
  prepare_snapshot "$evidence.after" || return 1
  assert_restore_wrote_nothing "$evidence.before" "$evidence.after"
  [[ "$rc" -eq 10 ]]
}

case ${1:?case} in
  t4.1-source)
    root=/var/tmp/aisb-ops-fixtures/t4-source
    rm -rf -- "$root"
    bridge_fixture "$root"
    tracked="$(git_as_owner ls-files -- projects | head -n 1)"
    [[ -n "$tracked" ]]
    printf 'fixture-modified\n' >> "/opt/aisandbox/$tracked"
    head_blob="$(git_as_owner rev-parse "HEAD:${tracked}")"
    work_blob="$(git_as_owner hash-object "/opt/aisandbox/$tracked")"
    [[ "$head_blob" != "$work_blob" ]]
    before="$(date -u +%Y%m%dT%H%M%SZ)"
    /usr/local/sbin/aisandbox-backup
    bundle=""
    while IFS= read -r ident; do
      base="$(basename "$ident" .identity)"
      [[ "$base" < "$before" ]] && continue
      candidate="/var/backups/aisandbox-offhost/${base}.tar.age"
      [[ -f "$candidate" ]] || continue
      sum="$(sha256sum "$candidate" | awk '{print $1}')"
      grep -q "bundle_sha256=${sum}" "$ident" || continue
      bundle="$candidate"
      bundle_sha="$sum"
    done < <(find /var/backups/aisandbox-offhost -name '*.identity' -print)
    [[ -n "$bundle" ]]
    plain_inode="$(stat -c '%i' /opt/aisandbox/workspaces/app/plain.txt)"
    hard_inode="$(stat -c '%i' /opt/aisandbox/workspaces/app/hard.txt)"
    [[ "$plain_inode" == "$hard_inode" ]]
    {
      printf 'source_host=%s\n' "$(hostname)"
      printf 'bundle=%s\n' "$bundle"
      printf 'bundle_sha256=%s\n' "$bundle_sha"
      printf 'sha=%s\n' "$(git_as_owner rev-parse HEAD)"
      printf 'tracked=%s\n' "$tracked"
      printf 'work_blob=%s\n' "$work_blob"
      printf 'plain_inode=%s\n' "$plain_inode"
    } > "$evidence"
    printf '%s\n' "$evidence"
    ;;
  t4.1-target)
    ev=${2:?evidence}
    key=${3:?key}
    [[ -f "$ev" ]]
    source_host="$(awk -F= '/^source_host=/{print $2}' "$ev")"
    bundle="$(awk -F= '/^bundle=/{print $2}' "$ev")"
    bundle_sha="$(awk -F= '/^bundle_sha256=/{print $2}' "$ev")"
    sha="$(awk -F= '/^sha=/{print $2}' "$ev")"
    tracked="$(awk -F= '/^tracked=/{print $2}' "$ev")"
    work_blob="$(awk -F= '/^work_blob=/{print $2}' "$ev")"
    [[ "$(hostname)" != "$source_host" ]]
    [[ "$(sha256sum "$bundle" | awk '{print $1}')" == "$bundle_sha" ]]
    /usr/local/sbin/aisandbox-prepare "$sha" --site localhost
    /usr/local/sbin/aisandbox-restore "$bundle" "$key"
    work="$(mktemp -d)"
    age -d -i "$key" "$bundle" | tar -C "$work" -xf -
    grep -q '^sockets_skipped=1$' "$work/MANIFEST"
    [[ "$(stat -c '%i' /opt/aisandbox/workspaces/app/plain.txt)" == "$(stat -c '%i' /opt/aisandbox/workspaces/app/hard.txt)" ]]
    [[ "$(stat -c '%u:%g' /opt/aisandbox/workspaces/app/from-host.txt)" == "7300:7300" ]]
    [[ "$(stat -c '%u:%g' /opt/aisandbox/workspaces/app/uid1000.txt)" == "1000:1000" ]]
    getfacl /opt/aisandbox/workspaces/app/plain.txt | grep -q 'user:1234:r'
    getfattr -n user.test /opt/aisandbox/workspaces/app/plain.txt
    [[ "$(git_as_owner hash-object "/opt/aisandbox/$tracked")" == "$work_blob" ]]
    repo=/opt/aisandbox/workspaces/app/repo-in-container
    git_as_repo_owner "$repo" ls-files --error-unmatch from-container.txt
    printf 'changed\n' >> "$repo/from-container.txt"
    git_as_repo_owner "$repo" checkout -- from-container.txt
    git_as_repo_owner "$repo" diff --exit-code
    rm -rf -- "$work"
    ;;
  t4.2-untracked)
    require_prepared_idle
    printf 'x\n' > /opt/aisandbox/workspaces/untracked.txt
    AISB_SNAPSHOT_FILES=/opt/aisandbox/workspaces/untracked.txt
    refuse_with_snapshot "$2" "$3"
    unset AISB_SNAPSHOT_FILES
    rm -f -- /opt/aisandbox/workspaces/untracked.txt
    ;;
  t4.2-sqlite)
    require_prepared_idle
    printf 'x\n' > /opt/aisandbox/database/aisandbox.db
    AISB_SNAPSHOT_FILES=/opt/aisandbox/database/aisandbox.db
    refuse_with_snapshot "$2" "$3"
    unset AISB_SNAPSHOT_FILES
    rm -f -- /opt/aisandbox/database/aisandbox.db
    ;;
  t4.2-ignored)
    require_prepared_idle
    printf 'x\n' > /opt/aisandbox/projects/ignored.tmp
    AISB_SNAPSHOT_FILES=/opt/aisandbox/projects/ignored.tmp
    refuse_with_snapshot "$2" "$3"
    unset AISB_SNAPSHOT_FILES
    rm -f -- /opt/aisandbox/projects/ignored.tmp
    ;;
  t4.2-snapshot)
    require_prepared_idle
    made=0
    if [[ ! -d /opt/aisandbox/services/snapshot-store ]]; then
      mkdir /opt/aisandbox/services/snapshot-store
      made=1
    fi
    printf 'x\n' > /opt/aisandbox/services/snapshot-store/extra
    AISB_SNAPSHOT_FILES=/opt/aisandbox/services/snapshot-store/extra
    refuse_with_snapshot "$2" "$3"
    unset AISB_SNAPSHOT_FILES
    rm -f -- /opt/aisandbox/services/snapshot-store/extra
    if [[ "$made" -eq 1 ]]; then
      rmdir /opt/aisandbox/services/snapshot-store
    fi
    ;;
  t4.2-snapshot-root)
    require_prepared_idle
    made=0
    if [[ ! -d /opt/aisandbox/snapshot-store ]]; then
      mkdir /opt/aisandbox/snapshot-store
      made=1
    fi
    printf 'x\n' > /opt/aisandbox/snapshot-store/extra
    AISB_SNAPSHOT_FILES=/opt/aisandbox/snapshot-store/extra
    refuse_with_snapshot "$2" "$3"
    unset AISB_SNAPSHOT_FILES
    rm -f -- /opt/aisandbox/snapshot-store/extra
    if [[ "$made" -eq 1 ]]; then
      rmdir /opt/aisandbox/snapshot-store
    fi
    ;;
  t4.2-database)
    require_prepared_idle
    runuser -u postgres -- psql -d postgres -c 'CREATE DATABASE aisandbox;'
    refuse_with_snapshot "$2" "$3"
    runuser -u postgres -- psql -d postgres -c 'DROP DATABASE aisandbox;'
    ;;
  t4.2-role)
    require_prepared_idle
    runuser -u postgres -- psql -d postgres -c 'CREATE ROLE aisandbox LOGIN;'
    refuse_with_snapshot "$2" "$3"
    runuser -u postgres -- psql -d postgres -c 'DROP ROLE aisandbox;'
    ;;
  t4.2-redis)
    require_prepared_idle
    redis_auth_env
    redis-cli -h 127.0.0.1 --no-auth-warning SET ops-test 1
    AISB_SNAPSHOT_REDIS_KEYS=ops-test
    refuse_with_snapshot "$2" "$3"
    unset AISB_SNAPSHOT_REDIS_KEYS
    redis-cli -h 127.0.0.1 --no-auth-warning DEL ops-test
    unset REDISCLI_AUTH
    ;;
  t4.2-uid)
    require_prepared_idle
    prepare_snapshot "$evidence.before"
    usermod -u 7301 aisandbox
    set +e
    /usr/local/sbin/aisandbox-restore "$2" "$3"
    rc=$?
    set -e
    usermod -u 7300 aisandbox
    prepare_snapshot "$evidence.after"
    assert_restore_wrote_nothing "$evidence.before" "$evidence.after"
    [[ "$rc" -eq 10 ]]
    grep -q '^phase=prepared$' /var/lib/aisandbox-ops/maintenance
    ;;
  t4.2-noacl)
    require_prepared_idle
    state_before="$(mktemp)"
    sha256sum /etc/aisandbox/PREPARED /var/lib/aisandbox-ops/maintenance > "$state_before"
    grep -qx 'DISPOSABLE_NAMESPACE=1' /etc/aisandbox/ops-test-mode
    img=/var/tmp/aisb-ops-fixtures/noacl.img
    stage=/mnt/aisb-noacl-stage
    mkdir -p /var/tmp/aisb-ops-fixtures "$stage"
    case_cleanup() { restore_noacl_mount "$stage"; }
    bytes="$(du -sb /opt/aisandbox | awk '{print $1}')"
    truncate -s "$((bytes + bytes / 5 + 67108864))" "$img"
    mkfs.ext4 -F "$img"
    mount -o loop "$img" "$stage"
    cp -a /opt/aisandbox/. "$stage/"
    umount "$stage"
    mount -o loop,noacl "$img" /opt/aisandbox
    findmnt -T /opt/aisandbox -no SOURCE | grep -q loop
    findmnt -T /opt/aisandbox -no OPTIONS | grep -q noacl
    set +e
    /usr/local/sbin/aisandbox-restore "$2" "$3" >"$evidence.out" 2>"$evidence.err"
    rc=$?
    restore_noacl_mount "$stage"
    cleanup_rc=$?
    set -e
    AISB_CASE_CLEANUP_RC=$cleanup_rc
    if [[ "$cleanup_rc" -ne 0 ]]; then
      printf '%s\n' "aisandbox-ops: noacl cleanup failed rc=${cleanup_rc}" >&2
    fi
    if [[ "$rc" -ne 0 && "$rc" -ne 10 ]]; then
      exit "$rc"
    fi
    if [[ "$cleanup_rc" -ne 0 ]]; then
      exit "$cleanup_rc"
    fi
    rm -f -- "$img"
    state_after="$(mktemp)"
    sha256sum /etc/aisandbox/PREPARED /var/lib/aisandbox-ops/maintenance > "$state_after"
    cmp -s "$state_before" "$state_after"
    [[ "$rc" -eq 10 ]]
    grep -q 'filesystem has noacl' "$evidence.err"
    [[ ! -f /etc/aisandbox/DEPLOYED ]]
    grep -q '^phase=prepared$' /var/lib/aisandbox-ops/maintenance
    ;;
  t4.3)
    require_prepared_idle
    declare -A before=()
    for unit in aisandbox-gateway aisandbox-ai aisandbox-cm aisandbox-frontend; do
      before[$unit]="$(writer_stamp "$unit")"
    done
    cursor="$(journalctl -n 0 -o cat --show-cursor | sed -n 's/^-- cursor: //p' | tail -n 1)"
    work="$(mktemp -d)"
    age -d -i "$3" "$2" | tar -C "$work" -xf -
    sed -i '0,/^user::/s/^user::rw/user::r/' "$work/acls.txt"
    (
      cd "$work"
      find . -type f ! -name SHA256SUMS -printf '%P\n' | sort | while IFS= read -r member; do
        sha256sum -- "$member"
      done > SHA256SUMS
    )
    recipient="$(tr -d '[:space:]' < /etc/aisandbox/age-recipient.txt)"
    tar -C "$work" -cf - . | age -r "$recipient" > /tmp/aisb-corrupt-acl.tar.age
    set +e
    /usr/local/sbin/aisandbox-restore /tmp/aisb-corrupt-acl.tar.age "$3"
    rc=$?
    set -e
    rm -rf -- "$work" /tmp/aisb-corrupt-acl.tar.age
    [[ "$rc" -eq 40 ]]
    grep -q '^phase=restore-failed$' /var/lib/aisandbox-ops/maintenance
    [[ ! -f /etc/aisandbox/DEPLOYED ]]
    for unit in aisandbox-gateway aisandbox-ai aisandbox-cm aisandbox-frontend; do
      [[ "$(writer_stamp "$unit")" == "${before[$unit]}" ]]
      [[ "$(systemctl is-active "$unit" || true)" != "active" ]]
      [[ -z "$(journalctl -u "$unit" --after-cursor "$cursor" -o cat --no-pager | grep 'Started ' || true)" ]]
    done
    ;;
  *)
    printf '%s\n' 'unknown T4 case' >&2
    exit 2
    ;;
esac
