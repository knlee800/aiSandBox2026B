# CONN-COPY-01 — Checkpoint

**Task:** CONN-COPY-01 — Connections page says a short body excerpt is read
**Status:** COMPLETE AND LOCKED — 2026-11-10. Built and tested; **not deployed**.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered by the CONN-03 LOCK (c36872c), as named in the approved CONN-03 stage-start. Keith admitted it on 2026-11-10 ("Start CONN-COPY-01").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with FRONTEND and I18N | 56dccf1 |
| 2. Implementation | sonnet subagent in worktree lane/CONN-COPY-01 (49e7f15), cherry-picked onto main | 0cdf614 |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change (5 files)

`connections.dataStatement.headersOnly` was renamed `connections.dataStatement.mailAndCalendarRead`. The key was used only in connections-screen.tsx and its test, and the rename keeps the existing test IDs. Both strings are rewritten:

| Key | en |
|---|---|
| dataStatement.mailAndCalendarRead | For unread mail, the sender, subject, date and a short excerpt of the message body are read. Mail is not marked as read. Calendar event titles and times are read. |
| mail.intro | Agents can read the sender, subject, date and a short excerpt of each unread message. They do not mark mail as read, and they cannot send, reply or change anything. |

zh-TW:
- **mailAndCalendarRead:** 對於未讀郵件，會讀取寄件者、主旨、日期以及郵件內文的簡短摘錄，且不會將郵件標示為已讀。也會讀取行事曆活動的標題與時間。
- **intro:** 代理可以讀取每封未讀郵件的寄件者、主旨、日期與內文的簡短摘錄。不會將郵件標示為已讀，也無法寄信、回覆或變更任何內容。

zh-CN:
- **mailAndCalendarRead:** 对于未读邮件，会读取发件人、主题、日期以及邮件正文的简短摘录，且不会将邮件标记为已读。也会读取日历活动的标题和时间。
- **intro:** 代理可以读取每封未读邮件的发件人、主题、日期和正文的简短摘录。不会将邮件标记为已读，也无法发送、回复或更改任何内容。

The control plane checked the translations:
- they are real zh-TW and zh-CN, not English;
- they use the existing terms in those files (郵件 and 邮件, 行事曆 and 日历, 代理);
- they say the same as the en text.

`dataStatement.sentToProvider` ("Mail and calendar text that an agent reads is sent to the AI model provider") is still true with excerpts, so it is unchanged.

The screen test checks the renamed key in all three files, and that both en strings contain "excerpt".

## Gates (control-plane rerun on the branch)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm test` | 1041 tests, 1041 pass, 0 fail (baseline 1041) |
| `npm run build` | exit 0 (tsconfig.tsbuildinfo restored) |

After the cherry-pick:
- the frontend on main is identical to the branch;
- the changed files are LF.

## Limits

Not deployed. Staging still runs 8e0bc55 with the old copy and headers-only mail. BODIES-LIVE-01 deploys this together with CONN-03, and Keith reads the page in all three languages there.

CHECKLIST: EVERY 11/11 (3: sonnet, passed explicitly; 9: tsbuildinfo restored), UI 8/9:
- 3: no icon change;
- 4: the skills were opened, and only their copy practice applies to a copy change;
- 5: copy only, no visual change;
- 6: n/a, static statements with no empty, loading, failed or success states;
- 9: the live read is in BODIES-LIVE-01, not done yet.

FOLLOWUPS: 0 registered / 1 superseded / 0 dropped / 0 undisposed (Keith's reading of all three languages is in BODIES-LIVE-01's scope; sentToProvider checked and still true)

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 1 released EMPTY; FRONTEND and I18N released UNOWNED. BODIES-LIVE-01 now waits only for Keith.
