# CONN-MAIL-AUTH-STATE-01 — Stage-start (Step 2)

**Task:** CONN-MAIL-AUTH-STATE-01: a distinct state for a refused mail sign-in.
**Status:** APPROVED by Keith on 2026-11-18 ("Yes, approve all"). Drafted by the control plane. The S1 path count was corrected from 24 to 22 at the S1 admission (a counting slip; the list is unchanged).
**Lifecycle:** 4-STEP. It was 3-step until the design added a column, which needs a migration.
**Source:** registered by the TRIGGER-MAIL-01 LOCK (stage-start P6, F4).

**Keith's choices (2026-11-18):**
- **Q1, "Stop signing in":** after the server refuses the saved password, the mail-trigger timer stops signing in. It starts again only when the owner saves a new password or a Test succeeds.
- **Q2, "Yes, refuse and say so":** while the mailbox is marked refused, agent mail tools are turned away before any sign-in, with a fixed text telling the owner to reconnect.
- **Q3, "Yes, admit":** the task runs as 4-step with this stage-start, and an opus subagent implements it.

## 1. The problem today

Every failure from the connector child reaches the gateway as one generic error.

**Agent runs:**
- the agent route answers 503 "The connector service is unavailable.";
- the AI worker turns that into its own generic failure text.

**Test button:**
- the Connections page's Test answers "could not reach the mail server".

**Mail-trigger timer:**
- after 3 failed reads in a row, the mail state becomes `read_failed` and reads slow to one an hour;
- even then, it keeps signing in with a password the server has already refused.

The trouble with that:
- the owner is never told the password is the problem;
- Google sees repeated failed sign-ins on the account.

**What the code already gives us:** imapflow 2.9.1 (in the root `node_modules`) marks a refused sign-in on the error it throws. It sets `authenticationFailed = true` in `commands/login.js` and `commands/authenticate.js`.

## 2. Design

### D1. connectors-mcp: one fixed text for a refused sign-in

`limits.ts` gains a fixed text:

```ts
MAIL_SIGN_IN_REFUSED_MESSAGE = 'The mail server refused the sign-in.'
```

**Where it's thrown:** each of the three IMAP reads in `clients/imap-client.ts` (the unread list, the one-message read and the recent read) has its own catch.
- When the caught error has `authenticationFailed === true`, each catch throws exactly this text.
- Every other error is redacted as today.

**No other change in the child:**
- `server.ts` already returns an error's text as the tool's error result;
- the text holds no address or password;
- no other tool changes.

### D2. Gateway: where the refusal is stored

**New column:** migration `1815000000000-AddConnectorSignInRefusedAt` adds `connector_connections.sign_in_refused_at` (timestamptz NULL, default NULL).
- The migration is additive and its `down` drops the column.
- The entity gains `signInRefusedAt: Date | null`.

**When it's set:**
- Trigger: any mail call from the broker whose child result is an error with exactly the D1 text. That covers `callConnectorTool` (agent calls and the Test button) and `readRecentMail` (the timer).
- Write: one guarded `UPDATE ... SET sign_in_refused_at = now() WHERE id = :id AND updated_at = :updatedAtOfTheRowUsed`. If the owner saved a new password while the read was in flight, the update matches no row, so a stale refusal never marks the new password.
- The secret column is never read for this.

**When it's cleared (set to NULL):**
- when the owner saves the mail connection (`writeConnection`; a new password);
- when a Test succeeds (`markVerified`).

### D3. Gateway: no sign-in while refused

**Before any sign-in:** the broker refuses an `imap` call while `signInRefusedAt` is set, before it enters the child. One case is let through:
- **Let through:** `action: 'connector_verify'`, the Test button. It still signs in, because Test is one of the two ways to reconnect.
- **Refused:** agent calls (`connector_call`) and the timer's `readRecentMail`.

**The fixed refusals:**

| Who asked | Answer |
|---|---|
| An agent mail tool | **409** with the fixed message `The mail server refused the saved password. The owner needs to reconnect the mailbox on the Connections page.` (`MAIL_SIGN_IN_REFUSED_MESSAGE` in `connector-servers.ts`, added to the fixed-failure list) |
| A call that reaches the child and gets the D1 text | the same 409, after the column is set |
| The Test button | **502** with the fixed message `the mail server refused the app password` in place of "could not reach the mail server". The column is set or left set |

**Audit:** rows keep the outcome `error`, as today. No new audit field and no mail content.

**Logs:** the existing scrubbed warn line. The fixed messages are quiet, as the other fixed failures are.

### D4. Gateway: the mail-trigger timer

`mail-trigger-mailbox.ts` today counts the connection row. It changes to read only `id` and `sign_in_refused_at`, never the secret.
- **When the column is set:**
  - the owner is skipped with no sign-in;
  - the summary gains `signInRefused`;
  - the pace entry is not counted as a failure.
- **When it is null:** reads go on as today.
- **The broker's own 409 from D3:** counted as `signInRefused`, not as a failure.

The next tick after the owner reconnects reads at the normal 10-minute pace, measured from the last attempt.

The mail-trigger list (`GET /api/mail-triggers`, the `mail` block) reports a new public state `sign_in_refused`, with `stateAt` set to the column, whenever the connection's column is set. It takes precedence over the rows' own state.
- The table's `mail_state` CHECK and `AGENT_MAIL_TRIGGER_MAIL_STATES` stay unchanged.
- The public type becomes `AgentMailTriggerMailState | 'sign_in_refused'`.

### D5. Gateway: the connection list

`GET /api/connections` gains one field on the mail connection only: `signInRefusedAt: string | null`. The calendar connection is unchanged.

### D6. AI worker

`connector-tool-handlers.ts` passes on a 409 whose message is exactly the D3 text, for the mail tools (`mail_list_unread_metadata`, `mail_read_message`). The model sees that fixed text and can tell the owner to reconnect.
- Every other failure keeps the generic text.
- The 403 and 404 rules are unchanged.

### D7. Frontend (translated in en, zh-TW and zh-CN; the UI rules apply)

**Connections page, mail card:** when `signInRefusedAt` is set, one warning line:

> The mail server refused your app password on {date}. Save a new app password, or press Test once it is fixed.

The Test error for the D3 502 maps to its own key:

> The mail server refused the app password.

**Schedules page, mail-trigger section:** the state `sign_in_refused` shows:

> Your mail server refused the saved password. Mail triggers are paused until you reconnect the mailbox on the Connections page.

### D8. Unchanged

- calendar connectors;
- the agent catalog, grants and token;
- the Chief of Staff's instructions and the eval baselines;
- the audit payload;
- the frozen contract HARNESS_ENTITLEMENT_PROOF_V1 and its files;
- env and switches;
- the mail_state CHECK;
- every other migration.

## 3. Slices

| Slice | What | Worker | Mutexes and leases |
|---|---|---|---|
| S1 | D1 to D6, with specs: connectors-mcp, migration 1815, entity, broker, connection list, mail timer and list state, AI worker handler | opus (a migration and three services) | GATEWAY, AI-SERVICE, MIGRATION; HOTFILE `services/connectors-mcp/src/clients/imap-client.ts`, `services/connectors-mcp/src/limits.ts`, `services/connectors-mcp/src/__tests__/imap-verbs.spec.ts` |
| S2 | D7: the Connections and Schedules pages and the three message files | sonnet (UI and copy in the frontend only) | FRONTEND, I18N |

**Order:** S2 starts after S1 lands. S1's route shapes (D4 state, D5 field, D3 Test message) are frozen at S1's landing for S2.

**S1 write set (exact):**

connectors-mcp:
- `services/connectors-mcp/src/clients/imap-client.ts`
- `services/connectors-mcp/src/limits.ts`
- `services/connectors-mcp/src/__tests__/imap-verbs.spec.ts`
- `services/connectors-mcp/src/__tests__/mail-sign-in.spec.ts` (new)

Gateway:
- `services/api-gateway/src/migrations/1815000000000-AddConnectorSignInRefusedAt.ts` (new)
- `services/api-gateway/src/migrations/__tests__/1815000000000-AddConnectorSignInRefusedAt.spec.ts` (new)
- `services/api-gateway/src/entities/connector-connection.entity.ts`
- `services/api-gateway/src/connectors/connector-servers.ts` and `.spec.ts`
- `services/api-gateway/src/connectors/connector-broker.ts` and `.spec.ts`
- `services/api-gateway/src/connectors/connectors.service.ts`
- `services/api-gateway/src/connectors/connectors.controller.ts` and `.spec.ts`
- `services/api-gateway/src/triggers/mail-trigger-mailbox.ts` and `.spec.ts`
- `services/api-gateway/src/triggers/mail-trigger-reasons.ts` and `.spec.ts`
- `services/api-gateway/src/triggers/mail-trigger.service.ts` and `.spec.ts`

AI worker:
- `services/ai-service/src/agent-harness/tools/handlers/connector-tool-handlers.ts` and `.spec.ts`

That's 22 paths.

**S2 write set (exact):**

- `frontend/components/connections/connections-api.ts`
- `frontend/components/connections/connections-screen.tsx`
- `frontend/components/connections/connections-screen.test.tsx`
- `frontend/components/schedules/mail-triggers.logic.ts`
- `frontend/components/schedules/mail-triggers.logic.test.ts`
- `frontend/components/schedules/mail-triggers-section.tsx`
- `frontend/components/schedules/mail-triggers-section.test.tsx`
- the three message files

That's 10 paths.

## 4. Gates

**S1:**
- connectors-mcp: `npm test` and `npm run build`;
- gateway: `npx tsc --noEmit`, `npm test` (only the 14 known smoke.integration failures allowed) and `npm run build`;
- ai-service: `npm test` and `npm run build`.

**S2:** frontend `npx tsc --noEmit`, `npm test` and `npm run build`, then restore `tsconfig.tsbuildinfo`.

The control plane reruns every gate on the branch before landing.

## 5. Proof and follow-ups

**Evidence class:** LOCAL-TESTS. There is no runtime in this task.

**Follow-ups:**
- A live proof needs a deploy and a refused password on staging. It will be registered at LOCK as STAGING-DEPLOY-MAUTH-01 and MAIL-AUTH-LIVE-01, which Keith approves.
- The ARCHITECTURE.md wording will be registered then too.

## 6. For Keith's approval

1. D1 to D8 as written, including:
   - the Test button still signs in while refused;
   - the 409 for agents;
   - the guarded update.
2. The two slices, workers and write sets above.
3. The copy in D7. Translations follow in S2 and come back to you in the S2 checkpoint.
