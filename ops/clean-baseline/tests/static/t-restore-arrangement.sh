#!/bin/bash
# Static checks for the t4c deleted path, the t1.5-sha and t1.5-unprepared PREPARED handling, the fixture-builder call and its SQLite path, and the t4.2-uid order. Reads source only. Executes nothing.
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
T1="$ROOT/tests/operational/t1-prepare.sh"
T4C="$ROOT/tests/operational/t4c-deleted-tracked.sh"
T4M="$ROOT/tests/operational/t4-metadata.sh"
FB="$ROOT/tests/fixture-builder.sh"
fail() { printf '%s\n' "$*" >&2; exit 1; }
branch() {
  awk -v c="  $1)" '
    $0 == c {grab=1; next}
    grab && $0 == "    ;;" {exit}
    grab {print}
  ' "$2"
}
line_of() { printf '%s\n' "$body" | grep -n -F -- "$1" | cut -d: -f1 | tr '\n' ' ' || true; }
[[ "$(grep -c -x 'rel=database/README.md' "$T4C" || true)" -eq 1 ]] || fail "t4c must delete database/README.md"
! grep -q 'tracked-delete-me' "$T4C" || fail "t4c still names the fixture-only path"
body=$(branch t1.5-sha "$T1")
[[ -n "$body" ]] || fail "t1.5-sha branch is missing"
save=($(line_of 'cp -p -- /etc/aisandbox/PREPARED "$prepared_saved"'))
plant=($(line_of "printf 'sha=0000000000000000000000000000000000000000\n' > /etc/aisandbox/PREPARED"))
restore=($(line_of '"$sbin/aisandbox-restore" "$3" "$4"'))
back=($(line_of 'cp -p -- "$prepared_saved" /etc/aisandbox/PREPARED'))
rcchk=($(line_of '[[ "$rc" -eq 10 ]]'))
[[ "${#save[@]}" -eq 1 && "${#plant[@]}" -eq 1 && "${#restore[@]}" -eq 1 && "${#back[@]}" -eq 1 && "${#rcchk[@]}" -eq 1 ]] || fail "t1.5-sha save, plant, restore, put-back or rc check is missing"
(( save[0] < plant[0] && plant[0] < restore[0] && restore[0] < back[0] && back[0] < rcchk[0] )) || fail "t1.5-sha order must be: save PREPARED, plant, restore, put PREPARED back, assert"
last=$(printf '%s\n' "$body" | grep -v '^[[:space:]]*$' | tail -n 1)
[[ "$last" == "    require_prepared_idle" ]] || fail "t1.5-sha must end with require_prepared_idle"
body=$(branch t1.5-unprepared "$T1")
[[ -n "$body" ]] || fail "t1.5-unprepared branch is missing"
save=($(line_of 'cp -p -- /etc/aisandbox/PREPARED "$prepared_saved"'))
remove=($(line_of 'rm -f -- /etc/aisandbox/PREPARED'))
before=($(line_of 'prepare_snapshot "$evidence.before"'))
restore=($(line_of '"$sbin/aisandbox-restore" "$3" "$4"'))
after=($(line_of 'prepare_snapshot "$evidence.after"'))
back=($(line_of 'cp -p -- "$prepared_saved" /etc/aisandbox/PREPARED'))
rcchk=($(line_of '[[ "$rc" -eq 10 ]]'))
[[ "${#save[@]}" -eq 1 && "${#remove[@]}" -eq 1 && "${#before[@]}" -eq 1 && "${#restore[@]}" -eq 1 && "${#after[@]}" -eq 1 && "${#back[@]}" -eq 1 && "${#rcchk[@]}" -eq 1 ]] || fail "t1.5-unprepared save, remove, snapshots, restore, put-back or rc check is missing"
(( save[0] < remove[0] && remove[0] < before[0] && before[0] < restore[0] && restore[0] < after[0] && after[0] < back[0] && back[0] < rcchk[0] )) || fail "t1.5-unprepared order must be: save PREPARED, remove it, snapshot, restore, snapshot, put PREPARED back, assert"
last=$(printf '%s\n' "$body" | grep -v '^[[:space:]]*$' | tail -n 1)
[[ "$last" == "    require_prepared_idle" ]] || fail "t1.5-unprepared must end with require_prepared_idle"
[[ "$(grep -c -x -F '  bash "$HERE/../fixture-builder.sh" "$root"' "$T4M" || true)" -eq 1 ]] || fail "t4-metadata must run the fixture builder with bash"
! grep -q -x -F '  "$HERE/../fixture-builder.sh" "$root"' "$T4M" || fail "t4-metadata still runs the fixture builder directly"
[[ "$(grep -c -F 'sqlite3 "$root/database/fixture.db" ' "$FB" || true)" -eq 1 ]] || fail "the fixture SQLite file must be database/fixture.db"
! grep -q -F 'aisandbox.db' "$FB" || fail "the fixture builder must not write the application database"
body=$(branch t4.2-uid "$T4M")
[[ -n "$body" ]] || fail "t4.2-uid branch is missing"
idle=($(line_of 'require_prepared_idle'))
before=($(line_of 'prepare_snapshot "$evidence.before"'))
uidoff=($(line_of 'usermod -u 7301 aisandbox'))
plus=($(line_of 'set +e'))
restore=($(line_of '/usr/local/sbin/aisandbox-restore "$2" "$3"'))
saverc=($(line_of 'rc=$?'))
minus=($(line_of 'set -e'))
uidback=($(line_of 'usermod -u 7300 aisandbox'))
after=($(line_of 'prepare_snapshot "$evidence.after"'))
nothing=($(line_of 'assert_restore_wrote_nothing "$evidence.before" "$evidence.after"'))
rcchk=($(line_of '[[ "$rc" -eq 10 ]]'))
refuse=($(line_of 'refuse_with_snapshot'))
[[ "${#idle[@]}" -eq 1 && "${#before[@]}" -eq 1 && "${#uidoff[@]}" -eq 1 && "${#plus[@]}" -eq 1 && "${#restore[@]}" -eq 1 && "${#saverc[@]}" -eq 1 && "${#minus[@]}" -eq 1 && "${#uidback[@]}" -eq 1 && "${#after[@]}" -eq 1 && "${#nothing[@]}" -eq 1 && "${#rcchk[@]}" -eq 1 ]] || fail "t4.2-uid idle check, snapshots, uid changes, restore, rc capture or assertions are missing or repeated"
[[ "${#refuse[@]}" -eq 0 ]] || fail "t4.2-uid must not call refuse_with_snapshot"
(( idle[0] < before[0] && before[0] < uidoff[0] && uidoff[0] < plus[0] && plus[0] < restore[0] && restore[0] < saverc[0] && saverc[0] < minus[0] && minus[0] < uidback[0] && uidback[0] < after[0] && after[0] < nothing[0] && nothing[0] < rcchk[0] )) || fail "t4.2-uid order must be: idle check, snapshot, uid 7301, restore, uid 7300, snapshot, assert nothing written, rc check"
printf 'restore arrangement PASS\n'
