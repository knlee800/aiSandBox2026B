# CONN-UI-01 — Checkpoint

**Task:** CONN-UI-01 — Connections page
**Status:** COMPLETE AND LOCKED — 2026-11-09
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered by GOV-BIZ-AGENT-OPS-PLAN-01 (f00be08); admitted by Keith to Lane 1 in fb9b2665d8ecfb9d246f3e4b8a4ae7b22276e0b4. Plan: docs/AGENT-OPS-PLAN.md section 0 (item 6, now removed from the list).
**First task under the new way of working (GOV-OS-08, GOV-ROUTING-01):** implemented by a background Claude subagent on **opus** (the page takes an app password and a calendar link: credentials, per GOV-ROUTING-01) in worktree C:\Users\knlee\aisb-worktrees\CONN-UI-01 on branch lane/CONN-UI-01 cut from fb9b266, with node_modules linked from the main checkout. The worker committed 87e6366 on that branch only. The control plane reviewed the diff, reran the gates on the branch, and brought it into main with `git merge --ff-only` (main had not moved), so main now holds 87e6366 unchanged; then removed the node_modules links, the worktree and the branch.

## What changed (commit 87e6366, 8 files)

- frontend/app/[locale]/connections/page.tsx (new): the route, like the Knowledge page.
- frontend/components/connections/connections-api.ts (new): GET /api/connectors, POST /api/connectors/imap and /ical, POST /api/connectors/:kind/verify, DELETE /api/connectors/:kind through the existing knowledgeFetch (CSRF header, credentials); keeps public fields only; maps the backend's fixed messages to translation keys (raw server text never shown); 401, 403 and 503 each handled.
- frontend/components/connections/connections-screen.tsx (new): mail card (Gmail, Yahoo, iCloud presets with their own setup steps; notes on 2-step verification, Advanced Protection and company blocks, and that Outlook.com is not supported yet) and calendar card (private iCal link with its steps and the admin note); the data statement above both Connect buttons; connected cards with provider, address, dates, Verify and Disconnect (inline confirm); the app password and link fields are uncontrolled, cleared as soon as their value is read on submit, never held in state, logged or stored.
- frontend/components/connections/connections-screen.test.tsx (new): 31 tests.
- frontend/components/platform/platform-dashboard.tsx: one header link (LinkIcon, testid platform-open-connections) between Knowledge and Back to workspace.
- frontend/messages/en.json, zh-TW.json, zh-CN.json: platform.openConnections and a connections namespace, with real Traditional and Simplified Chinese.

The data statement shown to users: text an agent reads is sent to the AI model provider and leaves the platform; only headers and event titles and times are read, and message bodies are not read yet; nothing is sent, deleted or changed in the mailbox or calendar; saved run results can include the text; the password and link are stored encrypted. Not deployed.

## Gates (rerun by the control plane on the branch, Node 22.14.0)

npx tsc --noEmit exit 0; npm test 900 passed, 0 failed; connections tests 31 passed; office tests 83 passed; npm run build exit 0 with the /[locale]/connections route; tsconfig.tsbuildinfo restored. main after the fast-forward is the same commit, so these results stand for main.

## Design

The worker read the Impeccable and Emil Kowalski skills. Applied: the Knowledge page's slate and indigo vocabulary; inline confirm instead of a modal; hover, focus-visible and disabled styles on every control; forms disabled during a request (no double submit); each error with a retry or next step; input kept on error except the secret; Chinese text wraps; no motion beyond colour transitions.

## Live check (owed at STAGING-DEPLOY-CONN-01)

/en/connections shows the data statement above both cards; with the key set, a Gmail app password connects, Verify shows the checked time, a wrong password shows the mail-server failure, Disconnect asks first; without the key the calm not-available notice shows; an account without harness access sees the forbidden notice; zh-TW and zh-CN render; the header link sits beside Knowledge.

CHECKLIST: EVERY 11/11 (3: opus per GOV-ROUTING-01; 8: no runtime; 9: tsconfig.tsbuildinfo restored; 10: the worker committed only on lane/CONN-UI-01; the control plane fast-forwarded main), UI 9/9 (9: live check owed at STAGING-DEPLOY-CONN-01)
FOLLOWUPS: 0 registered / 4 superseded / 0 dropped / 0 undisposed (superseded: the deploy order and the live check, by STAGING-DEPLOY-CONN-01, which ships the routes and the page together; the header link shown to users without harness access, by ACCESS-READY-01; no "replace connection" button and no automatic Verify after connecting, by CONN-OAUTH-01, which reworks the Connections page; npm test not running the connections, knowledge and platform tests, by FE-TEST-COVERAGE-01)

## Lock

COMPLETE AND LOCKED on 2026-11-09 by the control plane. Lane 1 released EMPTY; FRONTEND and I18N released UNOWNED.
