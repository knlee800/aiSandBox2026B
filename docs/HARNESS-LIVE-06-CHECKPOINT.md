# HARNESS-LIVE-06 — Checkpoint

**Task:** HARNESS-LIVE-06 — Prove run status and reconnect after a refresh on ainow-staging-01
**Status:** COMPLETE AND LOCKED — 2026-11-02
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** PROVIDER-LIVE. **saturationClass:** OPTIONAL.
**Stage-start:** docs/HARNESS-LIVE-06-STAGE-START.md. **Deployed:** a481b9d, then 67c054a, then f37821cd33b9b705a7fb76b0b036d90cd767364b.

## Three windows

| Window | Deploy | Case | Execution | Result |
|---|---|---|---|---|
| 1 | a481b9d | Refresh during an Agent run | 21623ded | Passed: reconnected, answer once |
| 1 | a481b9d | Run list on real PostgreSQL | n/a | Passed: modes shown, no prompts or answers. durationMs was null on completed rows |
| 1 | a481b9d | Next run | n/a | Refused by the 100,000-token rolling limit. Fixed by HARNESS-QUOTA-01 |
| 2 | 67c054a | Close the page during an Agent run | 8f8b4985 | Failed: reconnected, but reopening restored the saved copy over the run's files at 09:15:14 UTC. Fixed by HARNESS-SAVE-01 |
| 2 | 67c054a | Interrupted Build | e4131c86 | Passed: answer and not-applied notice, no file, no credits |
| 3 | f37821c | Close the page during an Agent run | 60b47fac | Passed: the restore at 09:57:11 brought slug.js and the 14-line test.js back at 09:57:16; answer once, on Keith's report |

Runs b559c78b and 87da7ce3 proved nothing: the first reused a file that already existed, and the second went to xAI, which has no key on staging, because the selector had gone back after a reload.

## Acceptance criteria

| Criterion | Result |
|---|---|
| The run list answers on real PostgreSQL, with no prompts or answers | Met in window 1 |
| Refreshing during an Agent run reconnects, answer once | Met in window 1 |
| An Agent run ending with the page closed shows its answer once, and the workspace updates | Met in window 3 |
| An interrupted Build shows its answer and the notice, and applies no files | Met in window 2 |
| The guard still refuses with no key, and a normal run works | Met: 8 requests 401 after each deploy; normal runs completed |
| Credits and usage correct, model non-empty | Met: all Anthropic rows carry the model; balance 393 to 370 across windows 2 and 3 matches the Agent runs; Build runs without an apply charged nothing |
| Spend within the caps | Met by upper bound: each window stayed under about 22,000 tokens, at most about $0.44 even if all were output tokens. Keith gave no cost figure |
| Flags off, key removed, configuration hashes match | Met as amended: flags off and hashes checked at 08:23:11, 09:22:28 and 09:57:57 UTC. By Keith's decision one test key now stays on the host in /root/aisb-test-provider.key, root:root 600. It is out of the environment files whenever flags are off. Deletion of the first window's key was not confirmed |
| Keith reads the transcripts and records his judgement | Met: Keith confirmed the answer showed once and recorded "judgement ok" on 2026-11-02 |
| Not LOCKED by an implementer | Met: locked by the control plane |

## Findings

- Reopening a project while an Agent run is still working can overwrite files written so far.
- The model selector can return to a provider with no key after a reload, and the only message is "Execution ended with status: failed".
- The interrupted Build answer says "I've added" and the notice then says it was not applied.
- Keith raised other UI problems such as overlapping buttons. He has not listed them, so none is registered.

## Not proven

- A refusal for a real execution owned by another user; other providers; real projects.
- These features stay gated and on staging; this does not make them CURRENT for anyone but Keith. Charging and a real token limit are not settled.

## Evidence

In `C:/Users/knlee/aisb-preflight/HARNESS-LIVE-06/`. No key or secret value is recorded.

| File | Bytes | SHA-256 |
|---|---|---|
| `hl08-deploy.out` | 4284 | `705d8ce14f64f3975a66300336153898cfbbdb10e1725647711ff86e0c335ebc` |
| `hl08-evidence.out` | 28529 | `36fbff3cb665f7249ad26fde73f8125cc3fc8cef3a63a04b5bf0e8fe776f9f82` |
| `hl08-flags-off.out` | 555 | `ff8e0c87e8a3bba0bf00d68d18a0af10f4a0e358a43c9e4e6b46d4b5344fcf83` |
| `hl09-deploy.out` | 4283 | `ea1a8d990be6f93eeb0ddb990b5aead2e7aa0ffd4d913503700f9a4c7074ba8a` |
| `hl09-evidence.out` | 23941 | `0b2de832fcab4f948058d18ebb727328615c6df20192cf4e3a1040b82900ff8a` |
| `hl09-flags-off.out` | 555 | `be02956b363dbb11ade3f6767049e2ce6afbd773236dfa372e009e46a20ae591` |
| `hl09-watch.txt` | 445 | `d3af43e906cc00ba5cd57f615f57e426a78451f32888d7a4b5e5117465eb4ab9` |
| `hl10-deploy.out` | 4283 | `3dbc184474f50788a443c5c27786b36afb296dcf586ebf5c780a458bd5a305c6` |
| `hl10-evidence.out` | 26038 | `6617cd9b732df265c4033de4dcc659d398b4a7e3cc035fc9a1e7008630e07c1e` |
| `hl10-flags-off.out` | 555 | `a400cbff5a0f8136dc7e15300f5694f16348faf750568587d2c72c88b06e3ecb` |
| `hl10-watch.txt` | 1122 | `39aa3571a5d17ff6d48038405ea2c32e830087e4972770f47d028a2f870ba57c` |

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-02 by the control plane. Lane 1 released EMPTY; STAGING, PROVIDER-LIVE, CREDIT and ENV released UNOWNED; stagingAuthorized, providerLiveAuthorized and creditAuthorized false; GOVERNANCE UNOWNED.
