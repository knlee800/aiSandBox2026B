#!/bin/bash
# Addendum T2.6. Static only. Does not source entry points or start units.
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
LIB="$ROOT/lib/ops-lib.sh"
UNIT="$ROOT/systemd"

awk '
  function flush() {
    if (name != "") {
      bodies[name] = body
    }
  }
  /^[A-Za-z_][A-Za-z0-9_]*\(\) \{$/ {
    flush()
    name = $1
    sub(/\(\).*/, "", name)
    body = ""
    next
  }
  /^}$/ {
    flush()
    name = ""
    body = ""
    next
  }
  {
    if (name != "") {
      body = body $0 "\n"
    }
  }
  END {
    flush()
    if (!( "backup_write_set" in bodies)) {
      print "missing backup_write_set" > "/dev/stderr"
      exit 2
    }
    n = split("backup_write_set", queue, " ")
    seen["backup_write_set"] = 1
    for (qi = 1; qi <= n; qi++) {
      fn = queue[qi]
      split(bodies[fn], lines, "\n")
      for (i in lines) {
        line = lines[i]
        sub(/#.*/, "", line)
        m = split(line, words, /[^A-Za-z0-9_]+/)
        for (w = 1; w <= m; w++) {
          call = words[w]
          if (call in bodies && !(call in seen)) {
            seen[call] = 1
            queue[++n] = call
          }
        }
      }
    }
    for (s in seen) {
      split(bodies[s], lines, "\n")
      for (i in lines) {
        line = lines[i]
        sub(/#.*/, "", line)
        if (line ~ /(^|[[:space:]])flock([[:space:]]|$)/ ||
            line ~ /systemctl[[:space:]]+start/ ||
            line ~ /systemctl[[:space:]]+restart/ ||
            line ~ /docker[[:space:]]+start/) {
          printf "forbidden command in %s: %s\n", s, lines[i] > "/dev/stderr"
          bad = 1
        }
      }
    }
    if (bad) exit 1
  }
' "$LIB"

marker='AssertPathExists=!/var/lib/aisandbox-ops/maintenance'
for unit in aisandbox-gateway aisandbox-ai aisandbox-cm aisandbox-frontend; do
  if ! grep -F -q "$marker" "$UNIT/${unit}.service"; then
    printf 'missing marker assertion in %s\n' "$unit" >&2
    exit 1
  fi
done
if grep -F -q "$marker" "$UNIT/aisandbox-migrate.service"; then
  printf 'migrate unit must not assert the maintenance marker\n' >&2
  exit 1
fi
if grep -n -E 'systemctl[[:space:]]+restart|docker[[:space:]]+start' "$ROOT/bin"/* "$ROOT/lib"/*; then
  printf 'restart or docker start is present outside the backup graph\n' >&2
  exit 1
fi
printf 'T2.6 PASS\n'
