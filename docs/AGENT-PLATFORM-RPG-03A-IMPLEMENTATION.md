# AGENT-PLATFORM-RPG-03A — Step 2 Implementation / Frontend UX/UI Validation

## 1) Task Identity

- Task ID: `AGENT-PLATFORM-RPG-03A`
- Task title: Platform Dashboard Visual Identity + Agent Detail Panel
- Step: 2 — Implementation / Frontend UX/UI Validation
- Scope type: Frontend-only bounded UX/UI slice for `/<locale>/platform`

## 2) Goal

Implement the first thin RPG command-center UX slice by refreshing `/[locale]/platform`, adding an agent detail panel for all agents, introducing Builder Agent detail CTA behavior, improving coming-soon agent detail messaging, and keeping the implementation multilingual, responsive, and bounded.

## 3) Files Inspected

Required governance/task context:

1. `C:\Users\knlee\aiSandBox2026B\TASKS.md` (targeted AGENT-PLATFORM-RPG-03A sections)
2. `C:\Users\knlee\aiSandBox2026B\TASKS_BACKLOG_FULL.md` (targeted AGENT-PLATFORM-RPG-03A sections)
3. `C:\Users\knlee\aiSandBox2026B\docs\AINOW-EXECUTION-ROADMAP.md`
4. `C:\Users\knlee\aiSandBox2026B\docs\AGENT-PLATFORM-RPG-MVP-RESET-CHECKPOINT.md`
5. `C:\Users\knlee\aiSandBox2026B\docs\AGENT-PLATFORM-RPG-MVP-RESET-PLAN.md`
6. `C:\Users\knlee\aiSandBox2026B\docs\AGENT-PLATFORM-RPG-MVP-RESET-DISCOVERY.md`
7. `C:\Users\knlee\aiSandBox2026B\docs\AGENT-PLATFORM-01-CHECKPOINT.md`
8. `C:\Users\knlee\aiSandBox2026B\docs\AGENT-PLATFORM-02A-CHECKPOINT.md`
9. `C:\Users\knlee\aiSandBox2026B\docs\AGENT-PLATFORM-02B-CHECKPOINT.md`
10. `C:\Users\knlee\aiSandBox2026B\docs\UX-IA-02-CHECKPOINT.md`

Frontend implementation context:

1. `C:\Users\knlee\aiSandBox2026B\frontend\app\[locale]\platform\page.tsx`
2. `C:\Users\knlee\aiSandBox2026B\frontend\components\platform\platform-dashboard.tsx`
3. `C:\Users\knlee\aiSandBox2026B\frontend\components\platform\agent-station-card.tsx`
4. `C:\Users\knlee\aiSandBox2026B\frontend\lib\agent-platform\agent-registry.ts`
5. `C:\Users\knlee\aiSandBox2026B\frontend\messages\en.json`
6. `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-TW.json`
7. `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-CN.json`
8. `C:\Users\knlee\aiSandBox2026B\frontend\components\platform\platform-dashboard.test.ts`
9. `C:\Users\knlee\aiSandBox2026B\frontend\package.json` (test/build script confirmation)

## 4) Files Changed

Changed:

1. `C:\Users\knlee\aiSandBox2026B\frontend\components\platform\platform-dashboard.tsx`
2. `C:\Users\knlee\aiSandBox2026B\frontend\components\platform\agent-station-card.tsx`
3. `C:\Users\knlee\aiSandBox2026B\frontend\components\platform\platform-dashboard.test.ts`
4. `C:\Users\knlee\aiSandBox2026B\frontend\messages\en.json`
5. `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-TW.json`
6. `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-CN.json`

Created:

1. `C:\Users\knlee\aiSandBox2026B\frontend\components\platform\agent-detail-panel.tsx`
2. `C:\Users\knlee\aiSandBox2026B\docs\AGENT-PLATFORM-RPG-03A-IMPLEMENTATION.md` (this file)

Unchanged but inspected:

- `C:\Users\knlee\aiSandBox2026B\frontend\app\[locale]\platform\page.tsx`
- `C:\Users\knlee\aiSandBox2026B\frontend\lib\agent-platform\agent-registry.ts`

## 5) UX/UI Changes

Implemented a bounded RPG command-center visual refresh for `/[locale]/platform`:

- Upgraded header hierarchy with command-center labeling and stronger visual identity.
- Added a command status block with active/reserve/selected station summaries.
- Reframed cards as selectable "agent stations" with explicit profile-open hints.
- Added a dedicated agent detail surface aligned beside/below station grid based on viewport.
- Preserved professional platform tone with restrained styling and no animation-heavy behavior.

## 6) Agent Detail Panel Behavior

`agent-detail-panel.tsx` is a new bounded component used by `platform-dashboard.tsx`.

- Selecting any station opens details for that agent.
- Detail content includes:
  - agent name
  - role
  - description
  - status badge
  - mission intent
  - capabilities list
- Close button clears selection and collapses detail back to empty state.
- Empty state guidance is shown when no station is selected.
- Coming-soon agents show explicit "coming soon" detail messaging in-panel (not fake routing).

## 7) Builder Agent CTA Behavior

- Builder station no longer navigates directly from the card.
- Builder details now include a clear `Start Building` CTA button.
- CTA destination is preserved via locale-prefixed workspace route (`/${locale}/app` when locale exists, equivalent to `/app` route pattern already used by registry).

## 8) Placeholder Agent Behavior

- Placeholder stations are selectable for details only.
- They do not route to functional agent pages.
- Panel shows clear non-functional status and launch-readiness messaging:
  - preview/profile visibility only
  - launch controls disabled
  - future activation notice

## 9) Multilingual / i18n Changes

Updated all three locale files:

- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`

Added/extended `platform.*` keys for:

- command-center header and status copy
- station labels/hints
- selection summary labels
- detail panel title/content/actions
- Builder and placeholder intent/capability text

No new hardcoded English UI strings were introduced in JSX for user-facing copy.

## 10) Heroicons Usage

All new icons use Heroicons v2 Outline only (`@heroicons/react/24/outline`):

- `BuildingOffice2Icon`
- `SignalIcon`
- `Squares2X2Icon`
- `UserCircleIcon`
- `SparklesIcon`
- `WrenchScrewdriverIcon`
- `RocketLaunchIcon`
- `ClockIcon`
- `ArrowLeftIcon`
- `ArrowRightIcon`
- `XMarkIcon`

No Lucide, Font Awesome, Material Icons, or emoji icons were added.

## 11) Accessibility / Responsive Notes

- Station cards are now actual buttons with keyboard focus and `aria-pressed` selected state.
- Detail panel provides a focusable close control with explicit `aria-label`.
- Layout uses responsive grid behavior:
  - station grid remains 1-column on narrow viewports, 2-column at `sm`
  - detail panel stacks below stations on smaller widths and sits alongside on wider layouts
- No horizontal overflow-prone fixed widths were introduced.
- Motion is restrained; only standard transition styling is used.

## 12) Tests / Validation Commands

Executed from PowerShell with full paths:

1. `Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\frontend"; npm test -- platform`
2. `Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsx --test components/platform/platform-dashboard.test.ts`
3. `Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\frontend"; npm run build`
4. `Set-Location -LiteralPath "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit`
5. ReadLints on changed platform/message files

## 13) Validation Results

1. `npm test -- platform`: PASS
   - `# tests 640`
   - `# pass 640`
   - `# fail 0`
2. `npx tsx --test components/platform/platform-dashboard.test.ts`: PASS
   - `# tests 11`
   - `# pass 11`
   - `# fail 0`
3. `npm run build`: PASS (exit code 0)
   - Next.js production build completed successfully
   - Non-blocking Browserslist staleness warning shown
4. `npx tsc --noEmit`: PASS (exit code 0)
5. ReadLints: no linter errors on touched files

## 14) Manual Visual Smoke Needs

Automated browser visual smoke was not run in this step.

Manual smoke is still required for Keith on:

1. `/en/platform`
2. `/zh-TW/platform`
3. `/zh-CN/platform`
4. desktop width
5. mobile width around 390px
6. open/close agent detail panel
7. Builder CTA routes to `/app` path behavior
8. placeholder agents show coming-soon detail and no functional routing
9. no hardcoded English on zh-TW/zh-CN views
10. no horizontal overflow

## 15) Non-Goals Preserved

Not implemented in this step:

- Create Agent UI/backend
- persistence/DB/migrations/entities/schema
- dynamic registry merge redesign
- backend/API service changes
- auth implementation changes
- workspace navigation redesign outside `/platform`
- package/dependency changes
- game engine / pixel-art map / walking character
- payment/provider/Stripe/webhook work

## 16) Safety Confirmations

- Frontend-only implementation scope preserved.
- No backend/DB/migration/entity/schema files changed.
- No package/dependency changes.
- No Docker/environment file changes.
- No git commit or push performed.
- No subagents used.
- No secret-bearing environment file opened.

## 17) Exact Next Action

Run the required manual visual smoke for `/[locale]/platform` (en, zh-TW, zh-CN; desktop + ~390px mobile) and confirm panel/CTA/placeholder behavior before Step 3 consolidation.
