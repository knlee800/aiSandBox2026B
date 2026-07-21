# BETA-READY-MIGRATION-CLI-01 — Step 2 Diagnosis + Implementation

## 1) Task Identity

- Task ID: `BETA-READY-MIGRATION-CLI-01`
- Title: TypeORM Migration CLI Path Fix
- Step: 2 — Diagnosis + Implementation
- Date: 2026-07-21
- Scope: Tiny tooling follow-up only

## 2) Problem Summary

During B3 smoke, `typeorm-ts-node-commonjs` failed with:

`Cannot find module 'ts-node'`

This blocked the ts-node migration CLI path and required a tiny follow-up to restore local CLI usability without executing migrations.

## 3) B3 Evidence

Evidence was reviewed from:

- `docs/BETA-READY-SMOKE-EXECUTION.md` (records the `Cannot find module 'ts-node'` failure and compiled TypeORM fallback)
- `docs/BETA-READY-SMOKE-CHECKPOINT.md` (records the same limitation as a remaining tooling item)
- `TASKS.md`, `TASKS_BACKLOG_FULL.md`, and `docs/AINOW-EXECUTION-ROADMAP.md` (active stage and Step 2 acceptance scope)

## 4) Files Inspected

Required reads completed:

1. `C:\Users\knlee\aiSandBox2026B\TASKS.md` (targeted `BETA-READY-MIGRATION-CLI-01` sections)
2. `C:\Users\knlee\aiSandBox2026B\TASKS_BACKLOG_FULL.md` (targeted `BETA-READY-MIGRATION-CLI-01` sections)
3. `C:\Users\knlee\aiSandBox2026B\docs\AINOW-EXECUTION-ROADMAP.md` (targeted `BETA-READY-MIGRATION-CLI-01` section)
4. `C:\Users\knlee\aiSandBox2026B\docs\BETA-READY-SMOKE-CHECKPOINT.md`
5. `C:\Users\knlee\aiSandBox2026B\docs\BETA-READY-SMOKE-EXECUTION.md`
6. `C:\Users\knlee\aiSandBox2026B\services\api-gateway\package.json`
7. `C:\Users\knlee\aiSandBox2026B\package.json`
8. `C:\Users\knlee\aiSandBox2026B\package-lock.json`
9. `C:\Users\knlee\aiSandBox2026B\services\api-gateway\package-lock.json`
10. `C:\Users\knlee\aiSandBox2026B\services\api-gateway\data-source.ts`

No `.env` or secret-bearing files were opened.

## 5) Diagnosis Findings

1. **`ts-node` at root:** not resolvable before fix (`Cannot find module 'ts-node'`).
2. **`ts-node` in `services/api-gateway`:** not resolvable before fix.
3. **`typeorm-ts-node-commonjs` resolution path:** initially resolved via workspace/root install path during diagnosis; after scoped install it resolves from `services/api-gateway/node_modules/typeorm/cli-ts-node-commonjs.js`.
4. **Script expectations:** `services/api-gateway/package.json` migration scripts (`migration:run`, `migration:show`, `migration:revert`) explicitly use `typeorm-ts-node-commonjs`, which requires `ts-node`.
5. **Compiled-path alternative exists:** `migration:run:prod` already uses compiled path (`typeorm migration:run -d dist/data-source.js`), matching B3 fallback behavior.
6. **Smallest safe fix selected:** add `ts-node` as a dev dependency in `services/api-gateway` so existing migration scripts remain valid without script refactor.

## 6) Selected Fix

Added:

- `ts-node` to `devDependencies` in `services/api-gateway/package.json`

Reason:

- Preserves existing migration script contract.
- Minimal one-line manifest change.
- Avoids migration script behavior change and avoids touching feature source.

## 7) Files Changed

1. `C:\Users\knlee\aiSandBox2026B\services\api-gateway\package.json`
2. `C:\Users\knlee\aiSandBox2026B\docs\BETA-READY-MIGRATION-CLI-01-IMPLEMENTATION.md` (this file)

No source, test, migration, entity, frontend, translation, Docker, or environment files were changed.

## 8) Validation Commands

Diagnosis commands run:

```powershell
Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; node -e "try { console.log(require.resolve('ts-node')) } catch (error) { console.error(error.message); process.exit(1) }"
Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B"; node -e "try { console.log(require.resolve('ts-node')) } catch (error) { console.error(error.message); process.exit(1) }"
Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm ls ts-node --depth=0
Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B"; npm ls ts-node --depth=0
```

Fix application command:

```powershell
npm install --prefix "C:\Users\knlee\aiSandBox2026B\services\api-gateway" --save-dev ts-node
```

Required post-fix validation commands:

```powershell
Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; node -e "console.log(require.resolve('ts-node'))"
Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx typeorm-ts-node-commonjs --help
Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build
```

## 9) Validation Results

- `require.resolve('ts-node')` (post-fix): **PASS**, resolves to `C:\Users\knlee\aiSandBox2026B\services\api-gateway\node_modules\ts-node\dist\index.js`
- `npx typeorm-ts-node-commonjs --help`: **PASS**, CLI usage/help printed successfully
- `npm run build` (`api-gateway`): **PASS** (`tsc` exited successfully)

No migration command was run.

## 10) Migration Execution Note

No migration execution was performed in this step.

Specifically, none of these were run:

- `npm run migration:run`
- `npm run migration:show`
- `typeorm migration:run`
- `typeorm migration:show`

## 11) Docker / PostgreSQL / Redis Note

No Docker, PostgreSQL, or Redis commands/services were started or used in this step.

## 12) Secrets Safety Note

- No `.env`, `.env.local`, `.env.staging`, `.env.production`, credentials, keys, or token files were opened.
- No secrets were printed.

## 13) Non-Goals Preserved

- No feature/backend/frontend source changes
- No test changes
- No migration/entity edits
- No API calls and no DB connection operations
- No deployment activity
- No governance updates (`TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/AINOW-EXECUTION-ROADMAP.md`) in this step

## 14) Exact Next Action

Proceed to `BETA-READY-MIGRATION-CLI-01` Step 3 — Consolidation / Checkpoint / Beta handoff continuation.
