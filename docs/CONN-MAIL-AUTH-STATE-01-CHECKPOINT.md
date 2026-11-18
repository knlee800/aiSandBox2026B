# CONN-MAIL-AUTH-STATE-01 — Checkpoint

**Task:** CONN-MAIL-AUTH-STATE-01 — A distinct sign-in-refused state for the mailbox
**Status:** COMPLETE AND LOCKED — 2026-11-18. Built, not deployed.
**Workstream:** AGENT. **Lifecycle:** 4-STEP (was 3-step; the design added a column). **Evidence class:** LOCAL-TESTS.
**Mutexes:**
- S1: GATEWAY, AI-SERVICE, MIGRATION, and the HOTFILE leases `services/connectors-mcp/src/clients/imap-client.ts`, `limits.ts` and `__tests__/imap-verbs.spec.ts`;
- S2: FRONTEND, I18N.

**Source:** registered 2026-11-16 by the TRIGGER-MAIL-01 LOCK. Keith chose it on 2026-11-18:
- "You pick one";
- "Stop signing in";
- "Yes, refuse and say so";
- "Yes, admit".

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission (Step 2, stage-start only) | Lane 1, write set the stage-start | 8caaf91 |
| 2. Stage-start | `docs/CONN-MAIL-AUTH-STATE-01-STAGE-START.md`, drafted by the control plane; Keith approved it ("Yes, approve all") | 730ae82, 91d4d64 |
| 3a. Slice S1 (backend) | opus subagent (Opus 5.5: a migration and three services), 22 paths | dd65e81; landed 22ddc8b |
| 3b. Slice S2 (pages) | sonnet subagent (Sonnet 5.5: frontend UI and copy only), 9 of 10 paths | 13bad2b |
| 3c. Wording | the control plane: "press Verify", the real button label (Keith: "Yes, say Verify") | 15b390c |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

Both slices were fast-forwarded into main. Each worktree and branch was removed after landing.

## What was built

- **connectors-mcp (D1).** Each of the three IMAP reads turns an error that imapflow marks `authenticationFailed` into the fixed text "The mail server refused the sign-in."; every other error is redacted as before.
- **Storage (D2).**
  - Migration `1815000000000-AddConnectorSignInRefusedAt` adds `connector_connections.sign_in_refused_at` (timestamptz NULL); its down drops only that column.
  - The broker sets the column when the child returns the fixed text. The update is guarded by `id` and `date_trunc('milliseconds', updated_at)`, so a password saved while the read was in flight is never marked; `updated_at` is left unchanged.
  - Saving the mail connection, or a good Verify, clears it.
- **No sign-in while refused (D3).**
  - Agent calls and the timer's read are refused before the secret is decrypted, with a 409: "The mail server refused the saved password. The owner needs to reconnect the mailbox on the Connections page."
  - Verify still signs in. A refused Verify answers 502 "the mail server refused the app password".
  - Audit rows keep outcome `error`; the payload is unchanged.
- **Timer and list (D4).**
  - The timer reads only `id` and `sign_in_refused_at`. It skips a refused owner without a broker call, counts `signInRefused`, and does not count a failure.
  - `GET /api/mail-triggers` reports mail state `sign_in_refused` with the refusal time.
  - The mail_state CHECK and the entity's state list are unchanged.
- **Connection list (D5).** `signInRefusedAt` on the imap connection only.
- **AI worker (D6).** The exact 409 text is passed to the model for `mail_list_unread_metadata` and `mail_read_message`; every other failure is unchanged.
- **Pages (D7), in en, zh-TW and zh-CN.** The approved copy, with "Test" changed to "Verify" (the button's real label) on Keith's word.

| Key | en |
|---|---|
| `connections.mail.signInRefused` | The mail server refused your app password on {date}. Save a new app password, or press Verify once it is fixed. |
| `connections.errors.mailRefused` | The mail server refused the app password. |
| `schedules.mail.mailbox.sign_in_refused` | Your mail server refused the saved password. Mail triggers are paused until you reconnect the mailbox on the Connections page. |

zh-TW:
- 郵件伺服器已於 {date} 拒絕你的應用程式密碼。請儲存新的應用程式密碼，或在問題解決後按「驗證」。
- 郵件伺服器拒絕了這組應用程式密碼。
- 你的郵件伺服器拒絕了已儲存的密碼。在你到「連線」頁面重新連接信箱之前，郵件觸發器會暫停。

zh-CN:
- 邮件服务器已于 {date} 拒绝你的应用专用密码。请保存新的应用专用密码，或在问题解决后点击“验证”。
- 邮件服务器拒绝了这个应用专用密码。
- 你的邮件服务器拒绝了已保存的密码。在你到“连接”页面重新连接邮箱之前，邮件触发器会暂停。

**The warning line:**
- DESIGN.md's dark-surface Warning state (`border-amber-900/80 bg-amber-950/40`, `text-amber-200`);
- the page's existing Heroicons Outline `ExclamationTriangleIcon`;
- `role="status"`.

The Verify error uses the existing `ActionError` (Error state, `role="alert"`).

## Gates (rerun by the control plane on each branch)

| Service | Baseline | After |
|---|---|---|
| connectors-mcp `npx jest` | 145 of 145 | 165 of 165; build rc 0 |
| api-gateway | 6590 passed, 7 skipped, 14 failed | tsc rc 0; 6634 passed, 7 skipped, the 14 known `smoke.integration.spec.ts` failures (need a database); build rc 0 |
| ai-service | 1441 passed, 1 skipped | 1448 passed, 1 skipped; build rc 0 |
| frontend | 2234 of 2234 (run by the control plane on main) | tsc rc 0; 2241 of 2241; build rc 0 (rerun after the Verify wording); `tsconfig.tsbuildinfo` restored |

**Review:**
- The diffs were read in full.
- Each slice changed only its write set: S1 changed exactly its 22 paths; S2 changed 9 of its 10, and `mail-triggers-section.tsx` needed no change.
- The only credential-like text in the diff is the test fake `fake-app-password-4821`.

## Worker findings and deviations

- **S1, the millisecond guard.** Comparing `updated_at` to the millisecond is needed because a save writes microseconds while the loaded Date has milliseconds. Without it, a refusal after any good Verify would never be recorded. Checked and accepted.
- **S1, the POST response.** `POST /api/connectors/imap` also returns `signInRefusedAt` (always null after a save), because it shares the imap view.
- **S1, imapflow's flag.** imapflow also sets `authenticationFailed` on a few local refusals (login disabled, no password configured). These give the same fixed text, as the rule says.
- **S2, process.** The worker did not read the Impeccable and Emil Kowalski skills or DESIGN.md before changing the UI, and its first report counted that item as met. The control plane had it read them afterwards. It found nothing to change and corrected its checklist line.
- **S2, no baseline.** The worker ran no test baseline; the control plane ran it on main (2234).
- **S2, the entity test.** The frontend test that pins the mail states to the backend entity now expects the entity's states plus `sign_in_refused`, and checks that the mailbox code names it. This is by design: S1 derives the state, and the CHECK is unchanged.

## Limits (only a live check can prove)

- that Gmail's real refusal of a revoked or wrong app password carries imapflow's `authenticationFailed`;
- the guarded update in real PostgreSQL;
- migration 1815 up on staging;
- Verify while refused, then reconnecting;
- the timer skipping and resuming;
- the 409 text reaching the model in a real run;
- the warning line on a phone-width screen.

These are MAIL-AUTH-LIVE-01, after STAGING-DEPLOY-MAUTH-01.

CHECKLIST: EVERY 11/11 (worker-level shortfalls in S2 noted above; 7: the control plane ran the missing baseline and every gate), BACKEND 6/6 (S1), MIGRATION 4/4 (1: MIGRATION held, 4-step, opus as GOV-ROUTING-01 gives subagents; 2: 1815 after 1814; 3: up and down with tests; 4: down drops only the new column; not run anywhere yet), UI 8/9 (4: not met at the time of the change, the skills were read only afterwards and nothing changed; 9: the live check is MAIL-AUTH-LIVE-01)
FOLLOWUPS: 3 registered (STAGING-DEPLOY-MAUTH-01, MAIL-AUTH-LIVE-01, GOV-ARCH-MAIL-AUTH-01) / 0 superseded / 1 dropped (the stale test title "no connection count…" in mail-trigger-run.service.spec.ts; Keith 2026-11-18, "Drop it": cosmetic, the test passes) / 0 undisposed.

## Follow-ups

| Follow-up | Disposition |
|---|---|
| Deploy with migration 1815 | registered STAGING-DEPLOY-MAUTH-01 (Keith approves) |
| Live check of the refused state | registered MAIL-AUTH-LIVE-01 (Keith opens the window) |
| ARCHITECTURE.md wording | registered GOV-ARCH-MAIL-AUTH-01 (Keith approves the words) |
| Stale test title in `mail-trigger-run.service.spec.ts` | dropped by Keith 2026-11-18 (cosmetic) |
| Entity state list without `sign_in_refused` (S2 worker) | not a follow-up: by design (D4) |

## Lock

COMPLETE AND LOCKED on 2026-11-18 by the control plane:
- Lane 1 released EMPTY;
- FRONTEND and I18N released UNOWNED;
- GATEWAY, AI-SERVICE, MIGRATION and the three HOTFILE leases had been released at slice S1.

Staging is unchanged (355e6db).
