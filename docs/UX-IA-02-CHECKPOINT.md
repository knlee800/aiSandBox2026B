# UX-IA-02 Checkpoint

## Task Metadata

| Field | Value |
|---|---|
| Task ID | UX-IA-02 |
| Family | UX-IA — Product & UX/UI Redesign (Evolutionary) |
| Status | COMPLETE and LOCKED |
| Nature | FRONTEND CSS / TAILWIND CONFIG |
| Date | 2026-05-05 |
| Source | UX-IA-00 master plan (May 2026) — all subsequent visual phases must build on a shared token system to avoid palette drift |

---

## Objective

Establish frontend design tokens (Tailwind theme extensions and CSS custom properties) so that all later UX-IA visual phases use consistent brand colors, surfaces, borders, font, and radii from the start without introducing palette drift or hardcoded hex values.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/tailwind.config.js` | Added `theme.extend.colors` (brand, surface, border, text, muted token groups referencing CSS variables); added `theme.extend.fontFamily.sans` with Inter CSS variable + fallback stack |
| `frontend/app/globals.css` | Added 10 CSS custom properties to `:root` (light theme); added dark placeholder values in existing `@media (prefers-color-scheme: dark)` block; updated `body { font-family }` to use `var(--font-inter, ...)` |
| `frontend/app/[locale]/layout.tsx` | Added `import { Inter } from 'next/font/google'`; instantiated `const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })`; applied `className={inter.variable}` to `<html>` |

`frontend/tsconfig.tsbuildinfo` — modified by build validation; **restored** via `git restore` afterward.

---

## Implementation Summary

### Font Decision

Inter is loaded via `next/font/google` (a Next.js built-in — no new npm dependency). The font is configured with a CSS variable (`--font-inter`) and applied to `<html className={inter.variable}>`. The `body` font-family in `globals.css` is updated to `var(--font-inter, Arial, Helvetica, sans-serif)`. Tailwind `fontFamily.sans` references `var(--font-inter)` as the first entry with the same fallback stack.

This is the standard Next.js 15 CSS-variable font pattern. TranslationProvider, fallbackMessages, locale routing, and middleware are not touched.

### Token Naming Strategy

10 design tokens across 5 groups, all defined as CSS custom properties and referenced in Tailwind config via `var(--color-*)`:

| Token group | Tailwind path | CSS variable |
|---|---|---|
| Brand primary | `brand.DEFAULT` | `--color-brand` |
| Brand hover | `brand.hover` | `--color-brand-hover` |
| Surface base | `surface.base` | `--color-surface-base` |
| Surface raised | `surface.raised` | `--color-surface-raised` |
| Surface overlay | `surface.overlay` | `--color-surface-overlay` |
| Border default | `border.DEFAULT` | `--color-border` |
| Border strong | `border.strong` | `--color-border-strong` |
| Text primary | `text.primary` | `--color-text-primary` |
| Text secondary | `text.secondary` | `--color-text-secondary` |
| Muted | `muted.DEFAULT` | `--color-muted` |

All existing built-in Tailwind color classes (`gray-*`, `indigo-*`, etc.) remain available — additions are inside `theme.extend`, not overrides.

### CSS Variable Strategy

**Light theme (`:root`):**

```css
--color-brand: #6366f1;
--color-brand-hover: #4f46e5;
--color-surface-base: #ffffff;
--color-surface-raised: #f9fafb;
--color-surface-overlay: #f3f4f6;
--color-border: #e5e7eb;
--color-border-strong: #d1d5db;
--color-text-primary: #111827;
--color-text-secondary: #6b7280;
--color-muted: #9ca3af;
```

Existing `--background: #ffffff` and `--foreground: #171717` are preserved unchanged.

**Dark placeholders (inside existing `@media (prefers-color-scheme: dark)` block):**

```css
--color-brand: #818cf8;
--color-brand-hover: #6366f1;
--color-surface-base: #0a0a0a;
--color-surface-raised: #111111;
--color-surface-overlay: #1a1a1a;
--color-border: #27272a;
--color-border-strong: #3f3f46;
--color-text-primary: #f4f4f5;
--color-text-secondary: #a1a1aa;
--color-muted: #71717a;
```

Existing `--background: #0a0a0a` and `--foreground: #ededed` preserved unchanged.

### Dark Placeholder Decision

Dark placeholder values were added inside the **already-existing** `@media (prefers-color-scheme: dark)` block. No new media query or class was introduced. This is additive only — no component references any of the new token variables yet, so no visual change occurs in dark mode from this slice. This is token foundation only, not a functional dark mode implementation.

---

## Validation

| Command | Result |
|---|---|
| `npx tsc --noEmit` (from `frontend/`) | Passed — no type errors |
| `npm run test` (from `frontend/`) | Passed — exit code 0 |
| `npm run build` (from `frontend/`) | Passed — Next.js build successful, all 4 static pages generated, middleware 33.1 kB |
| `ReadLints` on all 3 touched files | No linter errors |
| `frontend/tsconfig.tsbuildinfo` | Modified by build — **restored** via `git restore` |

---

## Non-Goals Confirmed

- No workspace layout changes
- No public landing redesign
- No login/register redesign
- No component restructuring
- No full dark mode implementation (placeholders only)
- No new external npm dependencies (Next.js built-ins only)
- No i18n/middleware changes
- No AI-WS changes
- No removal of existing Tailwind config values
- No border-radius token extensions (Tailwind 3 built-ins are sufficient)

---

## Risks / Invariants Preserved

- Existing built-in Tailwind classes are unaffected (`theme.extend` only)
- `--background` and `--foreground` variables preserved in both light and dark blocks
- `TranslationProvider`, `fallbackMessages`, locale routing, and `middleware.ts` unchanged
- Font change from `Arial` to `Inter` is intentional and does not alter layout geometry
- All completed AI-WS capabilities unchanged
- All prior checkpoint invariants (UX-IA-01) remain intact

---

## Next Recommended Slice

**UX-IA-03 — Public Landing Redesign + Login/Register Polish**

Objective: Transform the public landing page into a "Build anything" surface with a chatbox. Polish login and register pages to match the new design token system. Add full i18n for all three pages. Risk: Low-Medium (landing is isolated from workspace). Note: confirm `LanguageSwitcher` visibility on all three pages as part of this slice.
