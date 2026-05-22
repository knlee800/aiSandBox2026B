# I18N-PAGE-01 Checkpoint — Wire Auth Module Chat Message i18n Keys

**Status:** COMPLETE and LOCKED
**Task ID:** I18N-PAGE-01
**Family:** I18N
**Completed:** 2026-05-22
**Checkpoint doc:** `docs/I18N-PAGE-01-CHECKPOINT.md`
**Depends on:** AUTH-MODULE-03 (COMPLETE and LOCKED), I18N-SHELL-01 (COMPLETE and LOCKED)

---

## Objective

Replace two hardcoded English auth-module chat messages in `frontend/app/[locale]/app/page.tsx` with locale-backed strings across all three supported locales (en, zh-TW, zh-CN), following the same manual locale-switch pattern established in `workspace-shell.tsx`.

---

## Exact Files Changed

### Production source files
- `frontend/app/[locale]/app/page.tsx`
- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`

### Test files
- `frontend/components/workspace/workspace-shell.test.tsx`

---

## Implementation Detail

### Locale imports added — `page.tsx`

```ts
import enMessages from '@/messages/en.json';
import zhTwMessages from '@/messages/zh-TW.json';
import zhCnMessages from '@/messages/zh-CN.json';
```

### Helper added — `page.tsx`

Added `getAuthModuleMessages(locale)` at module scope, following the identical locale-switch pattern used by `getTabMessages`, `getProjectPanelMessages`, `getCommonMessages`, and `getAiMessages` in `workspace-shell.tsx`:

```ts
function getAuthModuleMessages(locale: string): typeof enMessages.authModule {
  if (locale === 'zh-TW') return zhTwMessages.authModule;
  if (locale === 'zh-CN') return zhCnMessages.authModule;
  return enMessages.authModule;
}
```

Selected current locale messages inside `AppPage`:

```ts
const authModuleMessages = getAuthModuleMessages(locale);
```

### Hardcoded strings replaced — `handleInstallAuthModule`

| Old hardcoded string | Replaced with |
|---|---|
| `'Installing auth module — preparing your workspace...'` | `authModuleMessages.installing` |
| `"This workspace doesn't look like a Next.js project yet. Create or open a Next.js project first, then try adding authentication again."` | `authModuleMessages.notNextJsProject` |

Auth-module install logic was not changed.

---

## Keys Added Per Locale File

2 new keys added under a new top-level `authModule` namespace in all three locale files:

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `authModule.installing` | `"Installing auth module — preparing your workspace..."` | `"正在安裝驗證模組 — 正在準備你的工作區..."` | `"正在安装认证模块 — 正在准备你的工作区..."` |
| `authModule.notNextJsProject` | `"This workspace doesn't look like a Next.js project yet. Create or open a Next.js project first, then try adding authentication again."` | `"這個工作區看起來還不是 Next.js 專案。請先建立或開啟 Next.js 專案，然後再嘗試新增驗證功能。"` | `"这个工作区看起来还不是 Next.js 项目。请先创建或打开 Next.js 项目，然后再尝试添加认证功能。"` |

---

## Tests Added/Updated

In `frontend/components/workspace/workspace-shell.test.tsx`:

### New describe block added: `auth module i18n wiring — I18N-PAGE-01`

4 source-assertion tests added:

1. **`authModule` keys exist in all 3 locale files** — reads `en.json`, `zh-TW.json`, `zh-CN.json` and asserts `authModule.installing` and `authModule.notNextJsProject` are present and non-empty strings in all three.
2. **`page.tsx` imports locale files and defines `getAuthModuleMessages` helper** — verifies all three `import` statements and the full function signature with all three locale branches.
3. **Hardcoded English auth-module strings removed from `page.tsx`** — `doesNotMatch` assertions confirm neither target string appears verbatim in `page.tsx`.
4. **`handleInstallAuthModule` uses locale-backed values** — `match` assertions confirm `authModuleMessages.installing` and `authModuleMessages.notNextJsProject` are used in the relevant branches.

### Existing tests updated in prior describe blocks

Two existing AUTH-MODULE-01D/E tests that previously asserted the exact hardcoded English strings were updated to assert locale-backed usage instead:

- `handleInstallAuthModule uses locale-backed unsupported-project message for missing package.json` — now asserts `authModuleMessages.notNextJsProject`
- `handleInstallAuthModule posts locale-backed installing status message` — now asserts `appendAssistantMessage(authModuleMessages.installing)`

---

## Validation Results

All run from `C:\Users\knlee\aiSandBox2026B\frontend`:

| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 451 tests, 0 failed, 0 skipped |
| `ReadLints` on touched files | PASS — no linter errors |
| `npm run build` | FAILED — environmental only (see caveat below) |

### Known Environmental Caveat — Google Fonts TLS

`npm run build` fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` when fetching `Inter` from Google Fonts via `next/font`. This is a local TLS/certificate environment issue unrelated to i18n changes. The same failure was present before this slice.

`frontend/tsconfig.tsbuildinfo` was restored after the build attempt:

```powershell
git -C "C:\Users\knlee\aiSandBox2026B" restore -- frontend/tsconfig.tsbuildinfo
```

---

## Non-Goals Confirmed

- No `workspace-shell.tsx` production changes — confirmed. Only `workspace-shell.test.tsx` source assertions were updated to reflect locale-backed usage.
- No auth module logic changes — confirmed.
- No backend changes — confirmed.
- No route changes — confirmed.
- No checkpoint-description translation — confirmed.
- No broad `page.tsx` i18n migration — confirmed. Only the two target strings in `handleInstallAuthModule` were replaced.
- No `recoveryCopy.ts` work — confirmed.
- No new dependencies — confirmed.
- No UI redesign — confirmed.
- No TASK-73C-1 work — confirmed.

---

## Invariants Preserved

- Existing `data-testid` values unchanged.
- Auth-module install logic and flow unchanged.
- Locale-switch helper pattern followed exactly as established by prior tasks.
- No hardcoded English user-facing strings remain for the two targeted auth-module chat messages.
- All prior checkpoint invariants from I18N-SHELL-01 and AUTH-MODULE-03 preserved.

---

## Next Recommended Task

The I18N family has additional hardcoded English strings identified in the read-only audit that preceded this work. Register and implement subsequent I18N cleanup slices per the same pattern, targeting the next highest-impact group of hardcoded user-facing strings in `page.tsx` or `workspace-shell.tsx`.
