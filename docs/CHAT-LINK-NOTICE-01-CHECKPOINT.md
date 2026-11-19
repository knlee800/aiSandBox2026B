# CHAT-LINK-NOTICE-01 — Checkpoint

**Task:** CHAT-LINK-NOTICE-01 — notices when a Discord account is linked or unlinked.
**Status:** COMPLETE AND LOCKED — 2026-11-19. FRONTEND and I18N released; GATEWAY passes to the next batch task.
**Loop:** 3-step (admission db77948; implementation b99b0a0 by an opus subagent, Opus 5.5, in worktree lane/CHAT-LINK-NOTICE-01, fast-forwarded; this LOCK). Part of Keith's Discord production batch ("Yes, all 9", 2026-11-19).

## What changed (19 files, 1038 insertions, 14 deletions; exactly the write set)
- **E-mails** (chat-link-mail.ts, new): after a committed confirm, page unlink or /unlink, one e-mail through EMAIL_PROVIDER in the link's language: "A Discord account (id ending XXXX) was linked to / unlinked from your account at <YYYY-MM-DD HH:MM UTC>", a link to `${APP_BASE_URL}/<locale>/connections`, and what to do if it was not the owner. Every value in the html is escaped; no display name, full id, code or token.
- **Discord confirmation**: after Confirm, "Linked. This Discord account now receives your agents' results. Type / and choose ask to start." through sendToUser; a refused direct message is logged once and ignored.
- **Containment**: each notice runs under a 5-second cap and never throws; failures are one log line with ids and a reason code (no address, Discord id, subject or body); nothing is sent when the confirm or unlink fails. ChatModule imports EmailModule (already used by AuthModule).
- **Page**: an amber notice (DESIGN.md warning tokens, ExclamationTriangleIcon, role status, test id chat-link-recent-notice) while the link is younger than 7 days. en, zh-TW, zh-CN.

## Gates
| Gate | Worker | Control plane (branch) |
|---|---|---|
| gateway tests | baseline 6936; after 6960 passed, 7 skipped, 14 failed (the known smoke.integration, identical list) | 6960 passed, 7 skipped, only the 14 known smoke.integration |
| gateway tsc / build | rc 0 / rc 0 | rc 0 / rc 0 |
| frontend tests | 2266 of 2266 | 2266 of 2266 |
| frontend tsc / build | rc 0 / rc 0 | rc 0 / rc 0 (tsconfig.tsbuildinfo restored) |

## Review
The control plane read the mail builder (escaping, last 4 digits only, UTC minutes) and the 5-second containment. Staging's EMAIL_PROVIDER is stub: the mails are built and a `chat link mail sent` line is logged, but nothing is delivered until a real provider is set (MAIL-PROVIDER-01).

CHECKLIST: EVERY 11/11, UI 8/9, BACKEND 6/6 — UI 9 (a live look at the notice) is in CHAT-LIVE-02.
FOLLOWUPS: 2 registered (MAIL-PROVIDER-01: a real e-mail provider on staging and before production, with a send timeout in ResendEmailProvider; AUTH-MAIL-I18N-01: the sign-up verification and password-reset e-mails are English-only hardcoded text) / 1 superseded (the green "Discord is linked." line and the amber notice both show right after Confirm, into CHAT-TIDY-01) / 0 dropped / 0 undisposed.
