# STAGING-DEPLOY-05 — Checkpoint

**Task:** STAGING-DEPLOY-05 — Deploy knowledge, citations, the validation gate and Socket.IO auth
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** Keith approved the draft (free option) on 2026-11-05.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Lane 1 with STAGING | 4f2db620fee347a90fd4566a614ff8e7c322a33a |
| 2. Backup copy, deploy and Keith's check | host blocks run by the control plane; Keith in the browser | no repository change |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this record |

## Backup copy

Weekly backup 20261105T033025Z copied to `C:\Users\knlee\aisb-backups\`: `.tar.age` SHA-256 a7bf84fc0abae1ebdffc7971422d349c8bb6f98177d40ce85b4080bc97194645 and `.identity` SHA-256 52552d8d9831bd148997a632b0fc0f4ca06b59adcd0d1fe69527c8975bbb7695, both matching the host. The staged host copy was removed.

## Deploy

ainow-staging-01 went from 1aee7ed to 4f2db62 (SD5 DEPLOY PASSED, rc 0, 05:55:32 UTC). Migration hash changed as expected to 5aa2c487…; migration CreateKnowledgeDocumentsTable1799000000000 recorded; knowledge_documents exists with knowledge_documents_pkey, idx_knowledge_documents_user_id_scope_id and uq_knowledge_documents_user_scope_title_active; 0 rows. Configuration files unchanged; all units active; gateway health 200; Caddy 401 without basic auth; frontend /en, /en/office, /en/knowledge, /zh-TW/knowledge and /zh-CN/knowledge 200; 15 guard checks 401 without a key, including GET /api/knowledge/documents. No key text in any output.

## Keith's check

Knowledge needs harness entitlement (`AGENT_HARNESS_BROWSER_SESSION_USER_IDS`), which is empty on the staging baseline, so Keith first saw "Knowledge is not available for this account." This is the intended gate. Keith approved a knowledge-only window that set only that line to his account; GLOBAL_EXECUTION_ENABLED and PROVIDER_ANTHROPIC_ENABLED stayed false, so no run or spend was possible.

| Window | Open (UTC) | Closed (UTC) | Result |
|---|---|---|---|
| 1 | 06:03:16 | 06:07:52 | Upload into company-monthly-reports at 06:05:30, replace at 06:06:44; Keith reported "Knowledge works"; 1 active row at close |
| 2 | 06:13:49 | 06:14:48 | Keith's delete in window 1 was missed and a later delete was refused after close; in window 2 the delete landed at 06:14:23 (soft delete); 0 active, 1 deleted at close |

Both off scripts restored gateway.env to the baseline hash bf6864f9…, health 200, all units active. Keith was asked to check the page in en, zh-TW and zh-CN and reported "Knowledge works"; /zh-TW/knowledge and /zh-CN/knowledge also returned 200 in the deploy probe.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-05/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `sd5-pre.sh` | 813 | `2ff46d3ce7ba6aa1dfcc93c472439c08cf579b2539a9dbfb28e6fe4f913616f9` |
| `sd5-pre.out` | 693 | `5315fab6362cbe1be7d92c794317cd18c79ff311b8a5efd2e20304d32ade8dd6` |
| `sd5-bk-look.sh` | 243 | `65f3fdb53d863f792607844d53cca8325f9a0378b5afd4b34545b755be37a5ea` |
| `sd5-bk-copy.sh` | 674 | `6dcd410e285fe0a1c9484db0447dd26b44c077f770026050c8a8791048ce5874` |
| `sd5-bk-copy.out` | 385 | `0c53d5bdde4479830a30ca9ea3c2c1c41f355a8ad282f82b6b35c101f2f05b3d` |
| `sd5-bk-clean.sh` | 362 | `71dab742164506d9b19632d4449efd9d484b7deea0cbb67b4da4afc845d79914` |
| `sd5-bk-clean.out` | 20 | `a302aab198baa6999086cf2cfb05fc002f7ffe46bed7c96ffb671ddef69bd778` |
| `sd5-deploy.sh` | 7150 | `5ad0228607c27acf8879409fd9ecb0b601d4eeedea8a136cdaade22fc9192598` |
| `sd5-deploy.out` | 7518 | `2415612ff0e74d0f1acdd4be04513f576dc3bc00465b17d3deb0fbbe02e6db55` |
| `sd5-know-on.sh` | 2816 | `cd2b21f183e951814e26e39f38972bcdf53b817a74ccbc814068720b585b0494` |
| `sd5-know-on.out` | 312 | `72187fecdc43f015cebe074c38b6ee359a1c80417b42aa9957b8abc5b4772743` |
| `sd5-know-off.sh` | 1843 | `2104c47a323b47d443513e942535cce60138a9b3999731d29fb4e4872a124269` |
| `sd5-know-off.out` | 311 | `5d57a6d99a6bdf1bf155a69690c4db65455b647adbdc4c38638af10c0657b158` |
| `sd5-know2-on.sh` | 2836 | `dd888affcc7c0322babf62ee077abad435b7b0596329b9dad69f97af24bf2fda` |
| `sd5-know2-on.out` | 314 | `59e6d0ed01d219eb6e3786a4d526b2ab4e08175c97e2f45c1e4c310a2eafda7e` |
| `sd5-know2-off.sh` | 1850 | `bb032e9b21634d6131812ba8910a965d90a1731e4b33033a3eb7967a161f7105` |
| `sd5-know2-off.out` | 455 | `699edb5ff7d9020eeb527d7b7156b78e95df6f2b48b4b36daaa4b3440f6e1e9f` |

## Acceptance criteria

All seven met. Keith's judgement: "Knowledge works", then "Deleted" in window 2. Not LOCKED by an implementer: locked by the control plane.

## Limits

One account, one document, one scope. Knowledge citations (KNOW-03), the validation gate (COLLAB-GATE-TESTS-01) and Socket.IO auth (ACCESS-01A) are deployed and covered by their own tests; no collaboration run ran on staging in this task. One test document remains on staging as a soft-deleted row. Knowledge, Agent mode and the collaboration page share one entitlement switch (ACCESS-READY-01 item 3).

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-05 by the control plane. Lane 1 released EMPTY; STAGING released UNOWNED; stagingAuthorized false. Staging runs 4f2db62 with flags off.
