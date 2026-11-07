# BIZ-LIVE-01 — Checkpoint

**Task:** BIZ-LIVE-01 — Chief of Staff live check on staging
**Status:** COMPLETE AND LOCKED — 2026-11-07
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME (the tester may be active). **saturationClass:** OPTIONAL. **productClass:** APPROVED_FUTURE (authorized by Keith with the plan on 2026-11-05).
**Source:** docs/AGENT-BIZ-KNOWLEDGE-PLAN.md section 6, row BIZ-LIVE-01; Keith chose on 2026-11-07 to deploy while the tester window stays open and approved the scope.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; Cursor applied the hash-checked record (requested grok-4.7-high, resolved Grok 4.7 256K High, session 65035acc-4420-4b0d-b2bc-6a05021954af); validator PASS | 595f2798479da9c9affcf713d82763c5e0c78d67 |
| 2. Deploy and live check | host blocks run by the control plane; Keith's documents and questions in his browser; host-side verification | no repository change |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this record |

## Deploy (bl1-deploy.sh)

Pre-check (read-only): staging at 05539f7, migration hash cbd04277..., nothing active, open or running, env files at the tester-window hashes (gateway.env 5692ce35..., ai.env 132ebab3...), ops library at the expected version, all units active.

The deploy script checked the host id, the previous commit, a clean tracked tree, all configuration files against the tester-window state, the flags (anthropic, email stub, execution on), nothing running and the ops library. It saved the window gateway.env, changed only GLOBAL_EXECUTION_ENABLED to false, restarted the gateway (ready 200), confirmed nothing had started, and deployed e5cc286 (01:07:52 to 01:10:26 UTC, exit 0). e5cc286 carries KNOW-02 (Knowledge tools in ai-service, internal knowledge routes) and BIZ-01 (Chief of Staff team, Team page picker); no migration. After it: HEAD and DEPLOYED are e5cc286, migration hash unchanged, the saved window gateway.env restored byte for byte (5692ce35...), gateway ready, runs back on, every configuration file unchanged, all eight units active, 401 without login through Caddy, gateway health 200, frontend pages 200 (including /en, /zh-TW and /zh-CN collaboration), 19 guard checks 401 without a key (the internal knowledge search and read routes included), the static test key refused with 403, CORS unchanged. Runs were off about three minutes; Keith was told first.

After-check (read-only): chief-of-staff in the gateway build (5 files), the internal knowledge controller (1 file), search_knowledge in the AI service build (10 files), the team picker in the frontend build (4 files), teamChiefOfStaff in en.json, nothing running, env files at the window hashes.

## Live check

Keith added three documents on the Knowledge page (Three-year goals 2027-2029, Travel policy, Supplier agreement template). All three were saved in the Company monthly reports scope, the page's first scope, which is one of the Chief of Staff's six; per-scope filtering is covered by the KNOW-02 and KNOW-03 tests.

The first three runs (01:59, 02:00 and 02:02 UTC) failed on the first model call with 0 tokens: Anthropic answered 400 invalid_request_error, the account's spend limit was reached. The platform showed the generic Invalid request to Anthropic API. Keith raised the limit; nothing on staging changed. Follow-up PROVIDER-LIMIT-MSG-01.

From the host (ai-service log, collaboration_referrals, knowledge_documents; bl1-v1.out, bl1-v2.out):

| Check | Question A (2029 revenue goal and a 3,000 USD trip) | Question B (parental leave policy) |
|---|---|---|
| Run | execution 8efa8303..., completed, 7.9 s, 9297 tokens | execution e6eb0ca0..., completed, 10.0 s, 10318 tokens |
| Profile and scopes | target chief-of-staff, read-only, no write tools; search_knowledge and read_knowledge registered, which happens only for the signed read profile with a non-empty knowledgeScopes list | same |
| Tools | search_knowledge 7, read_knowledge 2 | search_knowledge 7, read_knowledge 1 |
| Citations | [source: 6b6c8271...#Revenue], [source: 7306aa13...#Approval], [source: 7306aa13...#Hotels]; each id is one of Keith's documents and each heading exists in it | [source: 7306aa13...#Approval], [source: 7306aa13...#Hotels]; valid |
| Content | 5 million USD by the end of 2029; a 3,000 USD trip needs the CFO's written approval | says it found no parental leave policy and writes No source twice |
| Hand-offs and actions | one referral in the run, none attempted; no external action | same |

The generic hand-off sentence in the shared job wrapper caused no hand-off attempt and no confusion in either answer; no fix is needed.

Evidence in `C:/Users/knlee/aisb-preflight/BIZ-LIVE-01/` (the only key-text match is the grep filter pattern inside bl1-v1.sh, not a key):

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-admit.txt` | 2336 | `4708a91848c415bfceb7777bd8ff416af8ffbcbfd416666eb8a49eb4411ef7ee` |
| `cursor-admit-result.json` | 3206 | `accca4bd3da2fda1994d671dd9816d827931fb48f69d771e6e3779e477af1d9c` |
| `bl1-pre.sh` | 1917 | `8f9017d4065be799f33f91667fdf95dea1a448316803d95123bc7a99a1987b3c` |
| `bl1-pre.out` | 1897 | `90e4cc93b5c797f9dc2a9da31f9bd83b43be504ffbe68c37aba4a64b0177cc75` |
| `bl1-deploy.sh` | 11657 | `c3d38029341626d91bd49296d2e72d5112f84fffaecb6c00b5942d7640a0f5c8` |
| `bl1-deploy.out` | 8269 | `0c179a766fbb48a772eb44cee085492e53287338b2a9eecd09adb7632cb83eb9` |
| `bl1-after.sh` | 1213 | `e8a566aadff8ca1c9c1892fa62e9871a8222aed4110029da14acd2b1e25589f5` |
| `bl1-after.out` | 478 | `faaf4efd124c25f760eecdf7a6efcf3ad1a973eb265f05bdb1b603aea369d5bd` |
| `bl1-diag.out` | 5981 | `415f676f75cc6400e144f57982596d3ae9416403192d45e695db5d1268173ce1` |
| `bl1-v1.sh` | 779 | `646be8a9affc2711235457db99ca18336d131bef69ee927cf26493117512a03a` |
| `bl1-v1.out` | 17306 | `a4f1810b130214a9eb70be98f0f54af8c76903a44506e27d71a2d749ed5039df` |
| `bl1-v2.sh` | 1583 | `1d3b407c39da29aaa204eb391c59cac84df2bc82584f8965c96168a4c9051958` |
| `bl1-v2.out` | 2643 | `acbff6657fdc2063b648cd93b647704fa6ef294e75f943b2bb432ef1414200f1` |

## Acceptance criteria

All seven met. Not LOCKED by an implementer: locked by the control plane.

CHECKLIST: EVERY 11/11 (5 and 6: no code change; 7 and 9: no build in the repository), DEPLOY 7/7 (2: window hashes before and after, the tester may be active; 3 and 7: Keith told runs pause, runs off only for the deploy, window gateway.env restored byte for byte), LIVE 4/4 (1: n/a, Keith's two questions are ordinary use inside the open tester window, whose task holds the provider and credit authorization, under its daily caps; 2: the key stays in the host file and was never shown; 3: success claimed only from host-side logs and rows and Keith's report; 4: n/a, no fix needed inside this task)

FOLLOWUPS: 1 registered / 0 superseded / 0 dropped / 0 undisposed (registered: PROVIDER-LIMIT-MSG-01, OPTIONAL, Keith 2026-11-07)

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-07 by the control plane. Lane 1 released EMPTY; STAGING and ENV released UNOWNED; stagingAuthorized false; the tester window stays OPEN. Staging runs e5cc286. BIZ-USER-01's first condition (BIZ-LIVE-01 LOCKED with useful, cited answers) is met; it still needs Keith's PRD change.
