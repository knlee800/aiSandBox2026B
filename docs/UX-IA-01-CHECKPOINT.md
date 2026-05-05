# UX-IA-01 Checkpoint

## Task Metadata

| Field | Value |
|---|---|
| Task ID | UX-IA-01 |
| Family | UX-IA — Product & UX/UI Redesign (Evolutionary) |
| Status | COMPLETE and LOCKED |
| Nature | FRONTEND I18N INFRASTRUCTURE |
| Date | 2026-05-05 |
| Source | UX-IA-00 master plan (May 2026) — multilingual is mandatory; all later UX phases must use translation keys from day one |

---

## Objective

Establish the complete i18n foundation so all subsequent UX-IA phases can introduce new UI strings via translation keys from the start, without accumulating hardcoded-English technical debt.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/middleware.ts` | **New** — locale middleware: redirect `/` → `/en`, locale-less paths → `/en/<path>`; skip `/api/*`, `/_next/*`, `favicon.ico`, and file-extension paths |
| `frontend/app/[locale]/layout.tsx` | Added static import of `en.json` as `fallbackMessages`; passed `fallbackMessages` to `TranslationProvider` |
| `frontend/components/TranslationProvider.tsx` | Extended context type and provider props to include `fallbackMessages: Messages` |
| `frontend/hooks/useTranslations.ts` | Added `resolveNestedValue` helper; changed lookup order to active locale → English fallback → raw fullKey string |
| `frontend/messages/en.json` | Expanded from 3 namespaces to 12 — added: `common`, `register`, `landing`, `workspace`, `project`, `tabs`, `account`, `ai`, `errors`; preserved `login`, `languages`, `sandbox` |
| `frontend/messages/zh-TW.json` | Same namespace expansion with Traditional Chinese translations |
| `frontend/messages/zh-CN.json` | Same namespace expansion with Simplified Chinese translations |

`frontend/components/LanguageSwitcher.tsx` — not changed (no polish needed in this slice).

`frontend/tsconfig.tsbuildinfo` — modified by build/typecheck validation; **restored** afterward.

---

## Implementation Summary

### English fallback wiring

`layout.tsx` now always imports `en.json` as `fallbackMessages` via a static import:

```typescript
import fallbackMessages from '../../messages/en.json';
```

`TranslationProvider` receives both `messages` (active locale) and `fallbackMessages` (always English).

### TranslationProvider

Extended context type:

```typescript
type TranslationContextType = {
  locale: string;
  messages: Messages;
  fallbackMessages: Messages;
};
```

Provider prop list extended to include `fallbackMessages`. Existing `locale` and `messages` behavior is unchanged.

### `useTranslations` fallback order

Added private `resolveNestedValue(source, fullKey)` helper that returns `string | null`. Lookup chain:

1. Active locale messages → return value if found
2. English `fallbackMessages` → return value if found
3. Return raw `fullKey` string (same as prior behavior when all else fails)

Current per-namespace call pattern is preserved: `const t = useTranslations('namespace')`.

### Message files

All three locale files now contain 12 top-level namespaces:

```
account, ai, common, errors, landing, languages, login, project, register, sandbox, tabs, workspace
```

`sandbox` keys are preserved as-is (legacy/deprecated for gradual migration). No keys were deleted.

### Locale middleware

```typescript
// frontend/middleware.ts
export function middleware(request: NextRequest) {
  // Skips: /api/*, /_next/*, favicon.ico, paths with file extensions
  // Redirects: / → /en
  // Redirects: locale-less paths → /en/<path>
  // Passes through: /en/*, /zh-TW/*, /zh-CN/*
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

---

## Decision Points Recorded

### 1. Namespace access pattern

**Decision: Keep current per-namespace call pattern.**

Components continue calling `useTranslations('namespace')` and receive a `t(key)` function scoped to that namespace. Cross-namespace dot-path access (e.g., `t('common.save')` from any call site) was **not** implemented in this slice.

Rationale: The existing pattern is simple, well-understood, and sufficient for all UX-IA phases. Cross-namespace support can be added in a future slice if needed, without breaking the current pattern.

### 2. `sandbox` namespace migration

**Decision: Keep `sandbox` keys; treat as legacy/deprecated; migrate gradually.**

The existing `sandbox` namespace keys are preserved in all three locale files. They remain as legacy/deprecated dead code. Future UX-IA slices that touch components still using `sandbox` strings should migrate those strings to the appropriate new namespace at that time. No bulk migration was done here.

---

## Validation

| Command | Result |
|---|---|
| `npx tsc --noEmit` (from `frontend/`) | Passed — no type errors |
| `npm run test` (from `frontend/`) | Passed — 253 tests, 0 failures |
| `npm run build` (from `frontend/`) | Passed — Next.js build successful, middleware compiled (33.1 kB) |
| `ReadLints` on all touched files | No linter errors |
| Locale JSON namespace consistency check | Passed — 12 namespaces consistent across all 3 locale files |
| `frontend/tsconfig.tsbuildinfo` | Modified by validation; restored after |

---

## Non-Goals Confirmed

- No visual redesign
- No workspace layout changes
- No AI-WS logic changes
- No route cleanup beyond locale middleware
- No `recoveryCopy.ts` rewrite
- No public landing redesign
- No deletion of existing `sandbox` namespace keys
- `frontend/components/LanguageSwitcher.tsx` not changed

---

## Risks / Invariants Preserved

- Next.js `/api/*` rewrite behavior: not interfered with (middleware skips `/api/*` paths)
- Existing locale routes (`/en/*`, `/zh-TW/*`, `/zh-CN/*`): preserved
- No new UX strings hardcoded in any touched file
- Workspace UI behavior unchanged
- All completed AI-WS capabilities unchanged
- All prior checkpoint invariants remain intact

---

## Next Recommended Slice

**UX-IA-02 — Design Token Foundation**

Objective: Establish Tailwind design tokens (brand colors, shadows, radii, font) that all subsequent visual phases build on. Low risk, no component changes, additive CSS/config only.
