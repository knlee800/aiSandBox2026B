#!/bin/bash
# Executable T2.1-T2.5. T2.6 remains the static script.
set -euo pipefail
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
# shellcheck source=/dev/null
source "$HERE/../lib/operational-gate.sh"
operational_gate
# shellcheck source=/dev/null
source "${AISB_OPS_LIB:-/usr/local/lib/aisandbox/ops-lib.sh}"
# shellcheck source=/dev/null
source "$HERE/../lib/case-helpers.sh"
ops_paths
AISB_CASE_NAME=${1:-t2}
case_begin "$AISB_CASE_NAME"
sha=${2:-}
evidence="$(case_evidence "$(case_run_id "$1")")"
case ${1:?case} in
  t2.1)
    exec 9>/run/aisandbox/ops.lock
    flock -n 9
    declare -A before=()
    for unit in aisandbox-gateway aisandbox-ai aisandbox-cm aisandbox-frontend; do
      before[$unit]="$(writer_stamp "$unit")"
    done
    for spec in "aisandbox-prepare $sha --site localhost" "aisandbox-first-start" "aisandbox-backup" "aisandbox-deploy $sha" "aisandbox-restore /tmp/bundle.tar.age /tmp/age.key" "aisandbox-maint exit"; do
      start=$(date +%s)
      set +e
      # shellcheck disable=SC2086
      /usr/bin/timeout 2 /usr/local/sbin/$spec >/tmp/aisb-lock-out 2>/tmp/aisb-lock-err
      rc=$?
      set -e
      end=$(date +%s)
      [[ "$rc" -eq 10 ]]
      [[ $((end - start)) -le 2 ]]
    done
    for unit in aisandbox-gateway aisandbox-ai aisandbox-cm aisandbox-frontend; do
      [[ "$(writer_stamp "$unit")" == "${before[$unit]}" ]]
    done
    ;;
  t2.2)
    added="$(count_added_executable_migrations HEAD "$sha")"
    [[ "$added" -ge 1 ]]
    cursor="$(journalctl -n 0 -o cat --show-cursor | sed -n 's/^-- cursor: //p' | tail -n 1)"
    : > /run/aisandbox/lock-owner.trace
    find /var/backups/aisandbox -name COMPLETE -print | sort > "$evidence.complete-before"
    backup_before="$(writer_stamp aisandbox-backup.service)"
    declare -A before=()
    for unit in aisandbox-gateway aisandbox-ai aisandbox-cm aisandbox-frontend; do
      before[$unit]="$(writer_stamp "$unit")"
    done
    pre_head="$(git_as_owner rev-parse HEAD)"
    /usr/local/sbin/aisandbox-deploy "$sha"
    find /var/backups/aisandbox -name COMPLETE -print | sort > "$evidence.complete-after"
    comm -13 "$evidence.complete-before" "$evidence.complete-after" > "$evidence.complete-new"
    [[ "$(wc -l < "$evidence.complete-new")" -eq 1 ]]
    new_complete="$(cat "$evidence.complete-new")"
    grep -q "^sha=${pre_head}$" "$(dirname "$new_complete")/MANIFEST"
    grep -q "^sha=${sha}$" /etc/aisandbox/DEPLOYED
    [[ "$(sort -u /run/aisandbox/lock-owner.trace | wc -l)" -eq 1 ]]
    [[ "$(writer_stamp aisandbox-backup.service)" == "$backup_before" ]]
    [[ "$(systemctl is-active aisandbox-backup.service || true)" != "active" ]]
    for unit in aisandbox-gateway aisandbox-ai aisandbox-cm aisandbox-frontend; do
      stops="$(journalctl -u "$unit" --after-cursor "$cursor" -o cat --no-pager)"
      stop_line="$(printf '%s\n' "$stops" | grep -n 'Stopped ' | head -n 1 | cut -d: -f1)"
      start_line="$(printf '%s\n' "$stops" | grep -n 'Started ' | head -n 1 | cut -d: -f1)"
      stop_count="$(printf '%s\n' "$stops" | grep -c 'Stopped ' || true)"
      start_count="$(printf '%s\n' "$stops" | grep -c 'Started ' || true)"
      [[ "$stop_count" -eq 1 && "$start_count" -eq 1 ]]
      [[ -n "$stop_line" && -n "$start_line" && "$stop_line" -lt "$start_line" ]]
      [[ "$(writer_stamp "$unit")" != "${before[$unit]}" ]]
    done
    ;;
  t2.3)
    point=${3:?mutating|migrating|starting}
    printf 'FAULT=%s\nDISPOSABLE_NAMESPACE=1\n' "$point" > /etc/aisandbox/ops-test-mode
    chmod 0600 /etc/aisandbox/ops-test-mode
    pre="$(git_as_owner rev-parse HEAD)"
    printf 'point=%s\npre_sha=%s\nsha=%s\n' "$point" "$pre" "$sha" > "$evidence"
    set +e
    /usr/local/sbin/aisandbox-deploy "$sha"
    rc=$?
    set -e
    [[ "$rc" -eq 30 ]]
    grep -q "^phase=${point}-failed$" /var/lib/aisandbox-ops/maintenance
    assert_writers_not_active
    set +e
    /usr/local/sbin/aisandbox-backup
    backup_rc=$?
    /usr/local/sbin/aisandbox-maint exit
    exit_rc=$?
    set -e
    [[ "$backup_rc" -eq 10 && "$exit_rc" -eq 10 ]]
    printf 'reboot-required\n' >> "$evidence"
    case_reboot
    ;;
  t2.3-after-reboot)
    grep -q '^reboot-required$' "$evidence"
    assert_writers_not_active
    grep -q '^phase=.*-failed$' /var/lib/aisandbox-ops/maintenance
    ;;
  t2.3-rollback)
    point="$(awk -F= '/^point=/{print $2}' "$evidence")"
    pre="$(awk -F= '/^pre_sha=/{print $2}' "$evidence")"
    [[ "$point" == "mutating" ]]
    clear_injected_fault
    grep -qx 'DISPOSABLE_NAMESPACE=1' /etc/aisandbox/ops-test-mode
    if grep -q '^FAULT=' /etc/aisandbox/ops-test-mode; then
      printf '%s\n' 'injected fault was still armed' >&2
      exit 1
    fi
    /usr/local/sbin/aisandbox-deploy "$pre" --from-maintenance
    grep -q "^sha=${pre}$" /etc/aisandbox/DEPLOYED
    [[ "$(git_as_owner rev-parse HEAD)" == "$pre" ]]
    [[ ! -f /var/lib/aisandbox-ops/maintenance ]]
    ;;
  t2.4)
    printf 'FAULT=backup-postgres\nDISPOSABLE_NAMESPACE=1\n' > /etc/aisandbox/ops-test-mode
    chmod 0600 /etc/aisandbox/ops-test-mode
    find /var/backups/aisandbox -name COMPLETE -print | sort > "$evidence.complete-before"
    gateway_before="$(systemctl is-active aisandbox-gateway || true)"
    stamp_before="$(writer_stamp aisandbox-gateway)"
    set +e
    /usr/local/sbin/aisandbox-backup
    rc=$?
    set -e
    [[ "$rc" -eq 20 ]]
    find /var/backups/aisandbox -name COMPLETE -print | sort > "$evidence.complete-after"
    cmp -s "$evidence.complete-before" "$evidence.complete-after"
    [[ -n "$(find /var/backups/aisandbox -name '*.failed' -print -quit)" ]]
    [[ ! -f /var/lib/aisandbox-ops/maintenance ]]
    if [[ "$gateway_before" == "active" ]]; then
      [[ "$(systemctl is-active aisandbox-gateway || true)" == "active" ]]
      [[ "$(writer_stamp aisandbox-gateway)" != "$stamp_before" ]]
    else
      [[ "$(systemctl is-active aisandbox-gateway || true)" != "active" ]]
    fi
    clear_injected_fault
    ;;
  t2.4-deploy)
    printf 'FAULT=backup-postgres\nDISPOSABLE_NAMESPACE=1\n' > /etc/aisandbox/ops-test-mode
    chmod 0600 /etc/aisandbox/ops-test-mode
    pre="$(git_as_owner rev-parse HEAD)"
    : > /run/aisandbox/lock-owner.trace
    backup_before="$(writer_stamp aisandbox-backup.service)"
    set +e
    /usr/local/sbin/aisandbox-deploy "$sha"
    rc=$?
    set -e
    [[ "$rc" -eq 30 ]]
    [[ "$(git_as_owner rev-parse HEAD)" == "$pre" ]]
    [[ ! -f /var/lib/aisandbox-ops/maintenance ]]
    [[ "$(systemctl is-active aisandbox-gateway || true)" == "active" ]]
    [[ "$(sort -u /run/aisandbox/lock-owner.trace | wc -l)" -eq 1 ]]
    [[ "$(writer_stamp aisandbox-backup.service)" == "$backup_before" ]]
    ;;
  t2.5-source)
    printf 'FAULT=after-migrate\nDISPOSABLE_NAMESPACE=1\n' > /etc/aisandbox/ops-test-mode
    chmod 0600 /etc/aisandbox/ops-test-mode
    pre="$(git_as_owner rev-parse HEAD)"
    started="$(date -u +%Y%m%dT%H%M%SZ)"
    set +e
    /usr/local/sbin/aisandbox-deploy "$sha"
    rc=$?
    set -e
    [[ "$rc" -eq 30 ]]
    grep -q '^phase=migrating-failed$' /var/lib/aisandbox-ops/maintenance
    assert_writers_not_active
    bundle=""
    while IFS= read -r ident; do
      base="$(basename "$ident" .identity)"
      [[ "$base" < "$started" ]] && continue
      grep -q "^sha=${pre}$" "$ident" || continue
      candidate="/var/backups/aisandbox-offhost/${base}.tar.age"
      [[ -f "$candidate" ]] || continue
      sum="$(sha256sum "$candidate" | awk '{print $1}')"
      grep -q "bundle_sha256=${sum}" "$ident" || continue
      rows="/var/backups/aisandbox/${base}/row-counts.txt"
      [[ -f "$rows" ]] || continue
      bundle="$candidate"
      bundle_sha="$sum"
      row_file="$rows"
    done < <(find /var/backups/aisandbox-offhost -name '*.identity' -print)
    [[ -n "$bundle" && -f "$row_file" ]]
    marker_sha="$(sha256sum /var/lib/aisandbox-ops/maintenance | awk '{print $1}')"
    {
      printf 'source_host=%s\n' "$(hostname)"
      printf 'pre_sha=%s\n' "$pre"
      printf 'failed_sha=%s\n' "$sha"
      printf 'bundle=%s\n' "$bundle"
      printf 'bundle_sha256=%s\n' "$bundle_sha"
      printf 'marker_sha256=%s\n' "$marker_sha"
      for table in users projects sessions git_checkpoints credit_balances credit_deduction_records usage_records; do
        count="$(awk -F'|' -v t="$table" '$1==t {print $2; found=1} END { if (!found) exit 1 }' "$row_file")" || exit 1
        [[ "$count" =~ ^[0-9]+$ ]] || exit 1
        printf 'backup_count=%s|%s\n' "$table" "$count"
        live="$(runuser -u postgres -- psql -d aisandbox -Atc "SELECT count(*) FROM ${table}")" || exit 1
        [[ "$live" =~ ^[0-9]+$ ]] || exit 1
        printf 'source_count=%s|%s\n' "$table" "$live"
      done
    } > "$evidence"
    for table in users projects sessions git_checkpoints credit_balances credit_deduction_records usage_records; do
      grep -q "^backup_count=${table}|" "$evidence"
      grep -q "^source_count=${table}|" "$evidence"
    done
    printf '%s\n' "$evidence"
    ;;
  t2.5-target)
    ev=${2:?evidence}
    key=${3:?key}
    [[ -f "$ev" ]]
    source_host="$(awk -F= '/^source_host=/{print $2}' "$ev")"
    pre="$(awk -F= '/^pre_sha=/{print $2}' "$ev")"
    bundle="$(awk -F= '/^bundle=/{print $2}' "$ev")"
    bundle_sha="$(awk -F= '/^bundle_sha256=/{print $2}' "$ev")"
    [[ "$(hostname)" != "$source_host" ]]
    [[ "$(sha256sum "$bundle" | awk '{print $1}')" == "$bundle_sha" ]]
    /usr/local/sbin/aisandbox-prepare "$pre" --site localhost
    /usr/local/sbin/aisandbox-restore "$bundle" "$key"
    [[ -f /etc/aisandbox/DEPLOYED ]]
    compared=0
    for table in users projects sessions git_checkpoints credit_balances credit_deduction_records usage_records; do
      line="$(grep "^backup_count=${table}|" "$ev")"
      [[ -n "$line" ]]
      count="${line#*|}"
      [[ "$count" =~ ^[0-9]+$ ]]
      got="$(runuser -u postgres -- psql -d aisandbox -Atc "SELECT count(*) FROM ${table}")" || exit 1
      [[ "$got" == "$count" ]]
      compared=$((compared + 1))
    done
    [[ "$compared" -eq 7 ]]
    ;;
  t2.5-source-recheck)
    ev=${2:?evidence}
    [[ "$(hostname)" == "$(awk -F= '/^source_host=/{print $2}' "$ev")" ]]
    grep -q '^phase=migrating-failed$' /var/lib/aisandbox-ops/maintenance
    assert_writers_not_active
    [[ "$(sha256sum /var/lib/aisandbox-ops/maintenance | awk '{print $1}')" == "$(awk -F= '/^marker_sha256=/{print $2}' "$ev")" ]]
    bundle="$(awk -F= '/^bundle=/{print $2}' "$ev")"
    bundle_sha="$(awk -F= '/^bundle_sha256=/{print $2}' "$ev")"
    [[ "$(sha256sum "$bundle" | awk '{print $1}')" == "$bundle_sha" ]]
    compared=0
    for table in users projects sessions git_checkpoints credit_balances credit_deduction_records usage_records; do
      line="$(grep "^source_count=${table}|" "$ev")"
      [[ -n "$line" ]]
      count="${line#*|}"
      [[ "$count" =~ ^[0-9]+$ ]]
      got="$(runuser -u postgres -- psql -d aisandbox -Atc "SELECT count(*) FROM ${table}")" || exit 1
      [[ "$got" == "$count" ]]
      compared=$((compared + 1))
    done
    [[ "$compared" -eq 7 ]]
    ;;
  t2-commit)
    [[ $# -eq 1 ]]
    fixture="$HERE/t2-synthetic-migration.txt"
    path=services/api-gateway/src/migrations/1799000000000-OpsTestMarker.ts
    ref=refs/ops-test/t2-commit
    [[ -f "$fixture" && ! -e "$evidence" ]]
    parent="$(git_as_owner rev-parse HEAD)"
    if git_as_owner rev-parse -q --verify "$ref" >/dev/null; then
      printf '%s\n' "$ref already exists" >&2
      exit 1
    fi
    [[ -z "$(git_as_owner ls-tree "$parent" -- "$path")" ]]
    blob="$(git_as_owner hash-object -w --stdin < "$fixture")"
    work="$(runuser -u aisandbox -- mktemp -d)"
    runuser -u aisandbox -- env GIT_INDEX_FILE="$work/index" git -C "$AISB_ROOT" read-tree "$parent"
    runuser -u aisandbox -- env GIT_INDEX_FILE="$work/index" git -C "$AISB_ROOT" update-index --add --cacheinfo "100644,${blob},${path}"
    tree="$(runuser -u aisandbox -- env GIT_INDEX_FILE="$work/index" git -C "$AISB_ROOT" write-tree)"
    rm -rf -- "$work"
    commit="$(runuser -u aisandbox -- env GIT_AUTHOR_NAME='OPS-01 T2' GIT_AUTHOR_EMAIL=ops-test@aisandbox.invalid GIT_AUTHOR_DATE='1792627200 +0000' GIT_COMMITTER_NAME='OPS-01 T2' GIT_COMMITTER_EMAIL=ops-test@aisandbox.invalid GIT_COMMITTER_DATE='1792627200 +0000' git -C "$AISB_ROOT" commit-tree "$tree" -p "$parent" -m 'ops-test: T2 synthetic migration')"
    git_as_owner update-ref "$ref" "$commit" ""
    [[ "$(git_as_owner rev-parse HEAD)" == "$parent" ]]
    git_as_owner diff --quiet HEAD --
    git_as_owner diff --cached --quiet HEAD --
    [[ "$(git_as_owner diff --name-status "$parent" "$commit")" == $'A\t'"$path" ]]
    [[ "$(git_as_owner rev-parse "${commit}:${path}")" == "$blob" ]]
    [[ "$(count_added_executable_migrations "$parent" "$commit")" -eq 1 ]]
    {
      printf 'host=%s\n' "$(hostname)"
      printf 'parent=%s\n' "$parent"
      printf 'commit=%s\n' "$commit"
      printf 'tree=%s\n' "$tree"
      printf 'blob=%s\n' "$blob"
      printf 'path=%s\n' "$path"
    } > "$evidence"
    printf '%s\n' "$commit"
    ;;
  *)
    printf '%s\n' 'unknown T2 case' >&2
    exit 2
    ;;
esac
