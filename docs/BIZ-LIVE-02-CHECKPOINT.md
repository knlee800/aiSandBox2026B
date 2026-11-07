# BIZ-LIVE-02 — Checkpoint

**Task:** BIZ-LIVE-02 — Advisors team live check on staging
**Status:** COMPLETE AND LOCKED — 2026-11-07
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME (the tester may be active). **saturationClass:** OPTIONAL. **productClass:** APPROVED_FUTURE (authorized by Keith with the plan on 2026-11-05).
**Source:** registered by BIZ-03; Keith said deploy now on 2026-11-07, accepting that runs pause for a few minutes.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; Cursor applied the hash-checked record (requested grok-4.7-high, resolved Grok 4.7 256K High); validator PASS | 8a723bf04f57f1f7779d92b6b6d6f99f2cc7efdb |
| 2. Deploy and live check | host blocks run by the control plane; Keith's two questions on the advisors team; host-side verification | no repository change |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator; COLLAB-START-ONCE-01 registered | this record |

## Deploy (bl2-deploy.sh)

Pre-check (read-only): staging at a690c21, migration hash cbd04277..., nothing active, open or running, env files at the tester-window hashes (gateway.env 5692ce35..., ai.env 132ebab3...), all units active. The deploy saved the window gateway.env, switched only GLOBAL_EXECUTION_ENABLED off, confirmed nothing had started, and deployed 8a723bf (10:03:32 to 10:05:46 UTC, exit 0), which holds BIZ-03 (bb48309), gateway and frontend together; no migration. After it: HEAD and DEPLOYED 8a723bf, migration hash unchanged, the window gateway.env restored byte for byte, runs back on, configuration unchanged, all eight units active, 401 through Caddy without login, gateway health 200, frontend pages 200 in all three languages, 20 guard checks 401 without a key, the static test key 403, CORS unchanged. After-check: advisors-lead and the advisors_reply guard in the gateway build, advisors-lead in the frontend build (8 files; the option test ID is built from a template, so the literal is not in the bundle), teamAdvisors in en.json, GET /api/system-agents 401 without a session, env files at the window hashes.

## Live check (host: v1.out, v2.out)

| Check | Market question | Technology question |
|---|---|---|
| Run | collab_6cc5b458..., completed | collab_a2cc7546..., completed |
| Steps | user to advisors-lead (completed), then advisors-lead to product-strategy (completed) | user to advisors-lead (completed), then advisors-lead to technology-advisor (completed) |
| Provenance | advisors-lead df773717..., product-strategy a53ef9dc..., model claude-opus-5-5 | advisors-lead df773717..., technology-advisor 4a555fe5..., model claude-opus-5-5 |
| Tools | lead: search_knowledge 8, read_knowledge 2; Product Strategy: search_knowledge 6, read_knowledge 2 | lead: search_knowledge 4; Technology Advisor: search_knowledge 2, read_knowledge 2, list_files 4, read_file 2, search_workspace 10; no write_file |
| Citations | the lead cited 6b6c8271...#Revenue and #Markets (Company reports); Product Strategy cited 8b2f8cb2... (market-data) #AI app builders, #AI coding assistants, #Our position; all real documents and headings; uncovered points written as No source | Technology Advisor cited f2b4d50b... (tech-landscape) #Options, #pgvector, #Hosted vector database, #Recommendation; project files named in prose (package.json and the scripts), never inside a source marker |
| Further hand-off | none | none |

Both leads first answered from their own six scopes, said those did not cover the question, and handed it to the right advisor, as the advisors-lead instructions say.

Finding: two extra advisors runs (collab_ffbde2a9... at 10:09:03 and collab_efbde025... at 10:09:18) were started by repeated clicks on Start while a start was in flight; each holds one hand-off waiting for approval and expires through the existing sweep. The Team page Start button does not block a second start, for every team. Registered as COLLAB-START-ONCE-01 (OPTIONAL, Keith 2026-11-07).


## Acceptance criteria

All five met. Not LOCKED by an implementer: locked by the control plane.

CHECKLIST: EVERY 11/11 (5 and 6: no code change; 7 and 9: no build in the repository), DEPLOY 7/7 (2: window hashes before and after, the tester may be active; 3 and 7: Keith told runs pause, runs off only for the deploy, window gateway.env restored byte for byte), LIVE 4/4 (1: n/a, Keith's questions are ordinary use inside the open tester window, whose task holds the provider and credit authorization, under its daily caps; 2: the key stays in the host file and was never shown; 3: success claimed only from host-side rows and logs and Keith's report; 4: n/a, no fix needed inside this task)

FOLLOWUPS: 1 registered / 0 superseded / 0 dropped / 0 undisposed (registered: COLLAB-START-ONCE-01, OPTIONAL, Keith 2026-11-07)

## Lock

COMPLETE AND LOCKED on 2026-11-07 by the control plane. Lane 1 released EMPTY; STAGING and ENV released UNOWNED; stagingAuthorized false; the tester window stays OPEN. Staging runs 8a723bf.

Evidence in `C:/Users/knlee/aisb-preflight/BIZ-LIVE-02/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-admit.txt` | 2336 | `bb2e87e058f5033079c28b80820a2b5971e79bdc8e530df29a09b2c468842b94` |
| `cursor-admit-result.json` | 3382 | `1cd8b7dc59c46d85b2bf3a7731fe01a5f0a91318cc12761ec8ebf67a3b883c23` |
| `bl2-pre.sh` | 1917 | `0b1389538442bdc69174fe756050e4ee8de15e99532da4a20bedebea93f1ff83` |
| `bl2-pre.out` | 1841 | `51bd00beaa0eb774307569a9f7b9ac197f7718dec8f900e8b599508c24a7dbb1` |
| `bl2-deploy.sh` | 11686 | `9f4bd6876308ff401df6dc9463e48f16893db99b9ae8d7fae3f372e4fdf6cf51` |
| `bl2-deploy.out` | 8347 | `6fa20035a235be8d160c08f421b0c00a86adf2454cd8665ad40a692ea25d51cb` |
| `bl2-after.sh` | 1217 | `8d73271d8ecbd17c86fb76d2d958ade384b6ba6f033559eddfa6516a4a85fd92` |
| `bl2-after.out` | 462 | `9ee339240a5666e9fda7453dd731a0dd796ccc13ee56ead35a86bac36c83e0a3` |
| `v1.sh` | 1756 | `9727776c1a4580f5aebdc1b80c932578b3387e8eb1c1cc402ed97c358ae8a5f9` |
| `v1.out` | 6529 | `d74a53ca859f19e1278e8807e6896caadfe059f8e40fa8f1ddcaf79ad410c4d9` |
| `v2.sh` | 1297 | `dd26517e39460fa1c70f5cdaa06c72a291759099ffb7f42bb7a11228f408af2d` |
| `v2.out` | 1469 | `be96c9c9ec953de5a3c5a8aa419107e25754564540993347f71c6bbdbd1f783c` |
