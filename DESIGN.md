---
name: ainow.biz
description: Command center and Builder workspace for durable AI-assisted projects.
colors:
  background: "#ffffff"
  foreground: "#171717"
  brand: "#6366f1"
  brand-hover: "#4f46e5"
  surface-base: "#ffffff"
  surface-raised: "#f9fafb"
  surface-overlay: "#f3f4f6"
  border: "#e5e7eb"
  border-strong: "#d1d5db"
  text-primary: "#111827"
  text-secondary: "#6b7280"
  muted: "#9ca3af"
  background-dark: "#0a0a0a"
  foreground-dark: "#ededed"
  brand-dark: "#818cf8"
  brand-hover-dark: "#6366f1"
  surface-base-dark: "#0a0a0a"
  surface-raised-dark: "#111111"
  surface-overlay-dark: "#1a1a1a"
  border-dark: "#27272a"
  border-strong-dark: "#3f3f46"
  text-primary-dark: "#f4f4f5"
  text-secondary-dark: "#a1a1aa"
  muted-dark: "#71717a"
typography:
  sans:
    fontFamily: "var(--font-inter), Arial, Helvetica, sans-serif"
    fontSize: "text-sm"
    fontWeight: "normal"
  title-semibold:
    fontFamily: "var(--font-inter), Arial, Helvetica, sans-serif"
    fontSize: "text-2xl"
    fontWeight: "semibold"
  title:
    fontFamily: "var(--font-inter), Arial, Helvetica, sans-serif"
    fontSize: "text-lg"
    fontWeight: "semibold"
  body:
    fontFamily: "var(--font-inter), Arial, Helvetica, sans-serif"
    fontSize: "text-sm"
    fontWeight: "normal"
  label:
    fontFamily: "var(--font-inter), Arial, Helvetica, sans-serif"
    fontSize: "text-xs"
    fontWeight: "medium"
  micro:
    fontFamily: "var(--font-inter), Arial, Helvetica, sans-serif"
    fontSize: "text-[11px]"
    fontWeight: "medium"
  attribution:
    fontFamily: "var(--font-inter), Arial, Helvetica, sans-serif"
    fontSize: "text-[10px]"
    fontWeight: "normal"
  mono:
    fontFamily: "font-mono"
    fontSize: "text-xs"
    fontWeight: "normal"
rounded:
  default: "rounded"
  md: "rounded-md"
  lg: "rounded-lg"
  xl: "rounded-xl"
  "2xl": "rounded-2xl"
  full: "rounded-full"
spacing:
  compact: "px-2 py-1"
  control: "px-3 py-1.5"
  field: "px-3 py-2"
  button-platform: "px-4 py-2.5"
  button-auth: "py-2.5"
  thread: "p-3"
  card: "p-4"
  panel: "p-5"
  page-card: "p-6"
  auth-card: "px-8 pb-8 pt-6"
  shell-header: "px-4 py-2"
components:
  button-brand:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.background}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "{spacing.button-auth}"
  button-brand-hover:
    backgroundColor: "{colors.brand-hover}"
    textColor: "{colors.background}"
    rounded: "{rounded.md}"
    padding: "{spacing.button-auth}"
  button-brand-secondary:
    backgroundColor: "{colors.surface-base}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "{spacing.button-auth}"
  button-workspace-primary:
    backgroundColor: "{colors.brand}"
    textColor: "text-white"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "px-4 py-1.5"
  button-workspace-primary-hover:
    backgroundColor: "{colors.brand-hover}"
    textColor: "text-white"
    rounded: "{rounded.lg}"
    padding: "px-4 py-1.5"
  button-workspace-primary-disabled:
    backgroundColor: "{colors.brand}"
    textColor: "text-white"
    rounded: "{rounded.lg}"
    padding: "px-4 py-1.5"
  button-platform-primary:
    backgroundColor: "{colors.brand}"
    textColor: "text-white"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "{spacing.control}"
  button-platform-primary-hover:
    backgroundColor: "{colors.brand-hover}"
    textColor: "text-white"
    rounded: "{rounded.md}"
    padding: "{spacing.control}"
  button-platform-emphasis:
    backgroundColor: "{colors.brand}"
    textColor: "text-white"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "{spacing.button-platform}"
  button-knowledge-primary:
    backgroundColor: "{colors.brand}"
    textColor: "text-white"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "{spacing.control}"
  button-danger-quiet:
    backgroundColor: "bg-white"
    textColor: "text-red-700"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "{spacing.control}"
  button-danger-solid:
    backgroundColor: "bg-red-600"
    textColor: "text-white"
    typography: "{typography.label}"
    rounded: "{rounded.default}"
    padding: "px-3 py-1"
  button-success-solid:
    backgroundColor: "bg-emerald-600"
    textColor: "text-white"
    typography: "{typography.label}"
    rounded: "{rounded.default}"
    padding: "{spacing.compact}"
  input-auth:
    backgroundColor: "{colors.surface-base}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "py-2.5 pl-10 pr-3"
  input-chat:
    backgroundColor: "bg-gray-50"
    textColor: "text-gray-900"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "{spacing.field}"
  input-platform:
    backgroundColor: "bg-slate-950"
    textColor: "text-white"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "{spacing.field}"
  panel-chat:
    backgroundColor: "bg-white"
    textColor: "text-gray-800"
    rounded: "{rounded.lg}"
    padding: "px-3 py-2"
  panel-workspace-card:
    backgroundColor: "bg-white"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: "{spacing.page-card}"
  panel-platform:
    backgroundColor: "bg-slate-900/80"
    textColor: "text-slate-200"
    rounded: "{rounded.2xl}"
    padding: "{spacing.panel}"
  panel-office:
    backgroundColor: "bg-slate-900"
    textColor: "text-slate-200"
    rounded: "{rounded.2xl}"
    padding: "{spacing.panel}"
  tab-active:
    backgroundColor: "bg-white"
    textColor: "text-gray-900"
    typography: "{typography.label}"
    rounded: "{rounded.default}"
    padding: "px-3 py-1.5"
  tab-inactive:
    backgroundColor: "bg-gray-50"
    textColor: "text-gray-600"
    typography: "{typography.label}"
    rounded: "{rounded.default}"
    padding: "px-3 py-1.5"
  modal-scrim:
    backgroundColor: "bg-black bg-opacity-50"
  modal-panel:
    backgroundColor: "bg-white"
    textColor: "text-gray-900"
    rounded: "{rounded.lg}"
    width: "max-w-lg"
    height: "max-h-[80vh]"
  badge-neutral:
    backgroundColor: "bg-gray-100"
    textColor: "text-gray-500"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "px-3 py-1"
  badge-coming-soon:
    backgroundColor: "bg-amber-50"
    textColor: "text-amber-800"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "px-3 py-1"
  badge-active:
    backgroundColor: "bg-emerald-100"
    textColor: "text-emerald-800"
    typography: "{typography.micro}"
    rounded: "{rounded.full}"
    padding: "px-2 py-0.5"
  shell-workspace:
    backgroundColor: "bg-gray-100"
    height: "h-screen"
  shell-platform:
    backgroundColor: "bg-slate-950"
    height: "min-h-screen"
---

# Design System: ainow.biz

## 1. Overview

**Creative North Star: "A calm, dense workspace inside a command-center shell"**

The shipping UI is a dense work surface. Auth, the public landing slice, and the CSS variables share one light palette that also remaps under `prefers-color-scheme: dark`. The Builder workspace and the collaboration page are a separate light gray chrome. The platform dashboard, knowledge screen, and office page are a slate field. Every primary action on every screen is the one brand color. Agent station cards and the agent detail panel sit on that dark field and are themselves light.

The personality words safety, reversibility and clarity are confirmed in PRODUCT.md. The Builder workspace stays calm and plain. The RPG-inspired command-center look belongs to the platform shell and the office page only.

**Key Characteristics:**

- Full-height shells (`h-screen` in the workspace, `min-h-screen` on platform, knowledge, and office).
- Small type: `text-sm` body, `text-xs` labels, `text-[11px]` and `text-[10px]` for meta.
- Gently rounded controls (`rounded-md`, `rounded-lg`) and larger section shells (`rounded-xl`, `rounded-2xl`).
- Heroicons v2 outline, at `h-4 w-4`, `h-5 w-5`, or `h-6 w-6`, with `aria-hidden="true"`.
- Copy in `en`, `zh-TW`, and `zh-CN`. Strings must be allowed to grow: `min-w-0`, `truncate` on titles, `break-words` on notices, `overflow-x-auto` on the horizontal tab row, `whitespace-nowrap` on tab labels.

Sources: `frontend/app/globals.css`, `frontend/tailwind.config.js`, `frontend/app/[locale]/layout.tsx`, `frontend/components/workspace/workspace-shell.tsx`, `frontend/components/platform/platform-dashboard.tsx`, `frontend/components/office/office-screen.tsx`, `frontend/components/collaboration/collaboration-view.tsx`, `PRODUCT.md`

## 2. Colors

Two mechanisms are in the code. The hex list in the frontmatter is the CSS variable set. The other surfaces use Tailwind palette utilities and do not reference those variables.

### Primary

- **Brand indigo** (`{colors.brand}`, hover `{colors.brand-hover}`): the one primary action color on every screen: auth, password, landing, the workspace chat send button, the collaboration buttons, the platform dashboard, office desk panel, create-agent form, agent detail, and knowledge (`bg-brand`, `hover:bg-brand-hover`, `text-brand`). Disabled is `disabled:opacity-50`. Fixed (DESIGN-GAPS-01B).
- **Workspace blue (not an action color):** user chat bubbles are `border-blue-200 bg-blue-50 text-blue-900`. Status text is `text-blue-600`. Intent chips and the platform header links focus with `focus-visible:ring-brand`.
- **Indigo text and selection:** links and bound-agent labels in the workspace use `text-indigo-700`. The collaboration selected run is `border-brand bg-indigo-50`. The logo mark is `bg-indigo-500/90`.

### Neutral

- **Variable surfaces:** `{colors.background}`, `{colors.surface-base}`, `{colors.surface-raised}`, `{colors.surface-overlay}`, `{colors.border}`, `{colors.border-strong}`, `{colors.text-primary}`, `{colors.text-secondary}`, `{colors.muted}`, `{colors.foreground}`.
- **Workspace chrome:** page `bg-gray-100`; panels, header, and chat shell `bg-white`; hairline `border-gray-200`; quiet fills `bg-gray-50`; body text `text-gray-700`, `text-gray-800`, `text-gray-900`; secondary `text-gray-500` and `text-gray-600`; hint `text-gray-400`.
- **Platform, knowledge, and office field:** `bg-slate-950`, header border `border-slate-800`, raised panels `bg-slate-900/80` or `bg-slate-900`, controls `border-slate-700`, text `text-slate-200`, muted `text-slate-400`.
- **Agent cards on the dark field:** `bg-white` and `bg-gray-50/80` with `border-gray-200`. The detail panel is `bg-white`.

### Semantic

- **Warning:** `border-amber-200 bg-amber-50 text-amber-900` (collaboration notice, `role="alert"`). Coming-soon badges use `border-amber-200 bg-amber-50 text-amber-800` or `text-amber-700`. Knowledge warning blocks use `border-amber-900/80 bg-amber-950/40`.
- **Error:** chat `text-red-600`; small inline `text-red-700`; quiet danger `border-red-300 bg-white text-red-700` or `border-red-300 bg-red-50 text-red-700`; solid `bg-red-600`. Dark surfaces use `border-red-700/40 bg-red-950/30 text-red-300` with `ExclamationTriangleIcon`.
- **Success:** one green, `emerald-*`: banners `border-emerald-200 bg-emerald-50 text-emerald-800`; solid `bg-emerald-600` disabled `bg-emerald-300`; active dot `bg-emerald-500` on agent cards and the workspace live dot; the system-readiness chip `bg-emerald-600` hover `bg-emerald-700`. No `green-*` utility remains. Fixed (DESIGN-GAPS-01B).

### Dark mode

`@media (prefers-color-scheme: dark)` in the global CSS rewrites every variable above to the `-dark` tokens. `body` uses `var(--background)` and `var(--foreground)`. Auth and the landing slice follow the variables, so they shift with the OS. Workspace, collaboration, platform, knowledge, and office hardcode utilities. No `dark:` variant is applied in components. The sidebar string `account.dark` is copy, not a theme class.

**The One Action Color Rule.** Every primary action is `bg-brand`. Do not introduce another action color.

Sources: `frontend/app/globals.css`, `frontend/tailwind.config.js`, `frontend/app/[locale]/login/page.tsx`, `frontend/app/[locale]/register/page.tsx`, `frontend/components/public/public-landing-slice.tsx`, `frontend/components/workspace/workspace-shell.tsx`, `frontend/components/collaboration/collaboration-view.tsx`, `frontend/components/platform/platform-dashboard.tsx`, `frontend/components/platform/agent-station-card.tsx`, `frontend/components/platform/agent-detail-panel.tsx`, `frontend/components/knowledge/knowledge-screen.tsx`, `frontend/components/office/office-screen.tsx`, `frontend/components/office/office-desk-panel.tsx`, `frontend/components/SystemReadiness.tsx`

## 3. Typography

**Display Font:** none. No display face is loaded.
**Body Font:** `Inter` from `next/font/google`, assigned to `--font-inter`, then `Arial`, `Helvetica`, `sans-serif`. Tailwind `fontFamily.sans` is the same stack.
**Label/Mono Font:** labels use the sans stack. Code and preformatted chat use the `font-mono` utility. `tailwind.config.js` does not set a mono family.

**Character:** UI text is small and medium-weight. Page titles are the largest step in use.

### Hierarchy

- **Title, semibold** (`font-semibold`, `text-2xl`): auth and password headings; collaboration title; workspace template heading. Project names in the workspace header are `text-sm font-semibold` and `truncate`.
- **Title** (`text-lg font-semibold`): agent detail name.
- **Body** (`text-sm`): chat, forms, buttons, empty and error copy. Landing lede goes to `text-base` and `sm:text-lg`.
- **Label** (`text-xs font-medium`): tabs, context chips, badges. One scaffold label adds `uppercase tracking-wide`.
- **Micro** (`text-[11px]`): repo-doc rows, file-action meta, bound-agent dismiss.
- **Attribution** (`text-[10px] text-gray-400`): model and provider under an assistant message.

### Languages

Locales are `en`, `zh-TW`, and `zh-CN`. `Inter` is loaded with `subsets: ['latin']` only. No CJK family is named. Chinese glyphs depend on the fallback stack after Inter. Layout must allow a longer Traditional Chinese string and a shorter English one: do not fix a control width to the English word; let tabs scroll; truncate a single-line title; wrap notices with `break-words`.

**The Stack Rule.** Do not add a second Latin face. A CJK face is not in the code; do not pretend Inter covers Chinese.

Sources: `frontend/app/[locale]/layout.tsx`, `frontend/app/globals.css`, `frontend/tailwind.config.js`, `frontend/app/[locale]/login/page.tsx`, `frontend/components/workspace/workspace-shell.tsx`, `frontend/components/workspace/workspace-tab-bar.tsx`, `frontend/components/collaboration/collaboration-view.tsx`, `frontend/components/platform/agent-detail-panel.tsx`, `frontend/components/public/public-landing-slice.tsx`

## 4. Elevation

Depth is a hybrid, and it is uneven. Most workspace rows are flat: a `border` utility plus a gray or white fill. Cards that lift use Tailwind `shadow-sm`. Selected agent cards add `shadow-md`. Auth cards (login, register, forgot, reset) use `shadow-lg`. The repo-docs modal uses `shadow-xl`. The system-readiness panel uses `shadow-2xl`; its collapsed chip uses `shadow-lg`. Platform panels are flat borders on slate, sometimes with a slash opacity (`bg-slate-900/80`), not a shadow.

The workspace mobile sidebar scrim is `bg-black/20`. Modal scrims are `bg-black bg-opacity-50`.

No `box-shadow` value is written in this repo. `tailwind.config.js` does not extend `boxShadow`.

**The Flat Row Rule.** Lists, chat bubbles, and tab bars stay flat. Shadows belong to cards, menus, and modals that already use them.

Sources: `frontend/tailwind.config.js`, `frontend/app/[locale]/login/page.tsx`, `frontend/app/[locale]/register/page.tsx`, `frontend/app/[locale]/forgot-password/page.tsx`, `frontend/app/[locale]/reset-password/page.tsx`, `frontend/components/workspace/workspace-shell.tsx`, `frontend/components/workspace/workspace-tab-bar.tsx`, `frontend/components/platform/agent-station-card.tsx`, `frontend/components/platform/platform-dashboard.tsx`, `frontend/components/SystemReadiness.tsx`

## 5. Components

Icons are `@heroicons/react/24/outline`. Tests on the workspace shell and the platform dashboard reject the solid set. The workspace mobile menu is `Bars3Icon` and the tab-orientation control is `ArrowsRightLeftIcon` / `ArrowsUpDownIcon`, both at `h-5 w-5` with `aria-hidden`.

### Buttons

- **Shape:** `rounded-md` on auth and platform; `rounded-lg` on chat send, collaboration start, office desk, and agent detail; `rounded` on compact workspace row buttons.
- **Brand primary:** `{colors.brand}` fill, `{colors.background}` text (class `text-white`), `text-sm font-medium`, hover `{colors.brand-hover}`. Disabled `opacity-50`. Auth buttons are `py-2.5` with active `scale-[0.97]`. Used on every screen.
- **Brand secondary:** `border-border bg-surface-base`, hover `bg-surface-raised`, focus `focus-visible:ring-2 focus-visible:ring-brand`.
- **Workspace and collaboration primary:** the brand primary: `bg-brand text-white px-4 py-1.5 rounded-lg text-sm font-medium`, hover `bg-brand-hover`, disabled `opacity-50` and `cursor-not-allowed`.
- **Platform primary:** the brand primary: `bg-brand` hover `bg-brand-hover`, `rounded-md px-3 py-1.5`, focus `ring-2 ring-brand` with `ring-offset-2` and `ring-offset-slate-900` or `ring-offset-slate-950`. Desk and detail emphasis buttons are `rounded-lg px-4 py-2.5 font-semibold`.
- **Knowledge primary:** the brand primary, disabled `opacity-60`.
- **Quiet danger:** `border-red-300 text-red-700` on white, hover `bg-red-50`. Revert uses the red-50 fill. Solid confirm is `bg-red-600`.
- **Success solid:** `bg-emerald-600 text-white`, disabled `bg-emerald-300`.
- **Ghost:** `text-gray-600` or `text-gray-700`, hover `bg-gray-100`, no fill at rest.

### Chips

- **Ask / Build / Agent:** track `rounded-lg border-gray-200 bg-gray-100 p-0.5`. Selected segment `bg-white text-gray-900 shadow-sm`. Unselected `text-gray-600`. Focus `ring-brand`. Disabled `opacity-50`.
- **Coming soon:** amber pill, `rounded-full`, `text-xs`.
- **Active agent:** emerald pill, `text-[11px]`, with an `h-1.5 w-1.5` `bg-emerald-500` dot.
- **Neutral count:** `rounded-full bg-gray-100 text-gray-500`.
- **Bound agent:** `text-indigo-700`, not a filled pill. Office desk phases use translucent emerald, amber, red, or slate borders (`border-emerald-400/40`, `border-amber-400/40`, `border-red-400/40`, `border-slate-600`).

### Cards / Containers

- **Workspace shell:** `h-screen bg-gray-100`. Project header `bg-white border-b border-gray-200 px-4 py-2`. Chat column `md:w-96`. Sidebar drawer `w-72`, off-canvas below `md`, easing `cubic-bezier(0.32, 0.72, 0, 1)` over `250ms`.
- **Chat panel:** `bg-white border border-gray-200 rounded-lg`. Thread padding `p-3`. User bubble `ml-8` blue; assistant `mr-8` white; system `mr-8 bg-gray-100`.
- **Workspace cards:** `rounded-xl border-gray-200 bg-white shadow-sm`, padding `p-4` or `p-6`.
- **Platform and office:** `bg-slate-950`. Sections `rounded-2xl border-slate-800 bg-slate-900/80 p-4 sm:p-5`. Office desk panel `rounded-2xl border-slate-700 bg-slate-900 p-5`. Logo mark `h-9 w-9 rounded-lg bg-indigo-500/90`.
- **Collaboration page:** `max-w-3xl px-4 py-6 text-gray-900`, `overflow-x-hidden`. Selected run `border-brand bg-indigo-50`; unselected `border-gray-200 bg-white`.
- **Empty:** dashed border. Workspace templates `border-dashed border-gray-200 text-gray-500`. Platform `border-dashed border-slate-600 bg-slate-800/40`. Office and knowledge `border-dashed border-slate-700`. Chat empty is `text-sm text-gray-500` plus an optional gray pill. Agent detail empty is `border-dashed border-gray-300 bg-white/70`.
- **Loading:** a `text-sm` sentence, with the shared `Spinner` (`frontend/components/ui/Spinner.tsx`) beside it where a row is in flight. The spinner is an `aria-hidden` SVG with `animate-spin` (off under `motion-reduce`); it takes an optional translated `label` that is visually hidden (`sr-only`, `role="status"`). Workspace and collaboration use `text-gray-500`. Platform uses `text-slate-400` inside a slate box. Office loading is centered `text-slate-200` on `bg-slate-950`.
- **Error:** see Semantic. Collaboration and file-action errors keep the message in the row; platform and office add a retry control.
- **Success:** emerald banner or emerald button. The readiness chip is emerald, with `bg-yellow-600` while checking and `bg-red-600` when not ready. Its status glyphs are Heroicons (`CheckCircleIcon`, `XCircleIcon`, and the spinner while checking).

### Inputs / Fields

- **Auth:** `rounded-md border-border bg-surface-base`, icon `h-5 w-5` in a left slot, `focus-visible:ring-2 focus-visible:ring-brand`, `focus-visible:outline-none`.
- **Chat and collaboration:** `rounded-lg border-gray-200 bg-gray-50 px-3 py-2 text-sm`, placeholder `text-gray-400`. Focus `border-brand bg-white` with `focus-visible:ring-2 focus-visible:ring-brand`. Disabled `bg-gray-100 text-gray-500`. Chat textarea is `rows={3}` and `resize-none`; collaboration is `rows={4}` and `resize-y`.
- **Platform and knowledge fields:** `rounded-md border-slate-700 bg-slate-950 text-white`.
- **Selects in chat:** `rounded border-gray-200 bg-white px-2 py-1 text-xs text-gray-600`.

### Navigation

- **Workspace tabs:** bar `border-b border-gray-200 bg-gray-50`. Active `bg-white text-gray-900 shadow-sm`. Inactive `text-gray-600 hover:bg-gray-100`. Label `text-xs`. Horizontal labels are `whitespace-nowrap` inside `overflow-x-auto`. Vertical mode swaps to `border-r` and shows the outline icon at `h-5 w-5`.
- **Platform header links:** `rounded-md border-slate-700 text-slate-200 hover:bg-slate-800`, focus `ring-brand`.
- **Collaboration back link:** `text-sm font-medium text-indigo-700`.

### Modals

Scrim `fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4`. Repo-docs panel `max-w-lg max-h-[80vh] rounded-lg bg-white shadow-xl`, header `border-b border-gray-200 px-4 py-3`, close `XMarkIcon` at `h-5 w-5`. Clicking the scrim closes it.

### Motion

Auth buttons and the mobile menu button use `active:scale-[0.97]`. Sidebar transition is `250ms` with the cubic bezier above. Scrim fade is `duration-200 ease-out`. Agent cards use `duration-150`. The office art stylesheet sets `animation: none`, and under `prefers-reduced-motion: reduce` it sets `animation: none` and `transition: none`. The office screen listens to `matchMedia('(prefers-reduced-motion: reduce)')`.

Sources: `frontend/components/workspace/workspace-shell.tsx`, `frontend/components/workspace/workspace-tab-bar.tsx`, `frontend/components/collaboration/collaboration-page.tsx`, `frontend/components/collaboration/collaboration-view.tsx`, `frontend/components/platform/platform-dashboard.tsx`, `frontend/components/platform/agent-station-card.tsx`, `frontend/components/platform/agent-detail-panel.tsx`, `frontend/components/platform/create-agent-form.tsx`, `frontend/components/knowledge/knowledge-screen.tsx`, `frontend/components/office/office-screen.tsx`, `frontend/components/office/office-desk.tsx`, `frontend/components/office/office-desk-panel.tsx`, `frontend/components/office/office-art.tsx`, `frontend/app/[locale]/login/page.tsx`, `frontend/app/[locale]/register/page.tsx`, `frontend/components/SystemReadiness.tsx`

## 6. Do's and Don'ts

### Do:

- **Do** use `bg-brand` for every primary action and `focus-visible:ring-2 focus-visible:ring-brand` for every focus ring, on whichever surface you are editing (light chrome, or slate on platform, knowledge, and office).
- **Do** keep empty, loading, error, and success as the patterns in Components, and keep that copy in `en`, `zh-TW`, and `zh-CN`.
- **Do** use Heroicons v2 outline. Size `h-4 w-4`, `h-5 w-5`, or `h-6 w-6`. Mark them `aria-hidden` when the control has a text label.
- **Do** let Chinese run longer than English: `min-w-0`, `truncate`, `break-words`, and a scrolling tab row.
- **Do** leave risky or batch file changes behind the existing confirm control.

### Don't:

- **Don't** use generic AI-product marketing: purple gradients, neon accents, glassmorphism. (PRODUCT.md.)
- **Don't** add a new visual theme that ignores the screens already shipping. (PRODUCT.md.)
- **Don't** add decorative motion that ignores prefers-reduced-motion. (PRODUCT.md.)
- **Don't** size a layout only for English. (PRODUCT.md.)
- **Don't** load a second Latin font beside Inter.
- **Don't** import `@heroicons/react/24/solid` into the shell or the platform dashboard.

Sources: `PRODUCT.md`, `frontend/app/[locale]/layout.tsx`, `frontend/components/workspace/workspace-shell.tsx`, `frontend/components/platform/platform-dashboard.tsx`, `frontend/components/office/office-art.tsx`, `PRD.md`

## Known gaps

1. Fixed (DESIGN-GAPS-01B): every primary action button is `bg-brand hover:bg-brand-hover` (disabled `opacity-50`). Open: in dark mode the brand (`#818cf8`) under white text is lower contrast; it only shows on surfaces that follow the variables.
2. Tailwind utilities (`bg-slate-950`, `bg-gray-100`, emerald, amber, red) have no hex literal in this repo. `tailwind.config.js` does not override the default palette. Those frontmatter fields keep the class name.
3. Radius, spacing steps, and shadows are Tailwind utilities. No px, rem, or `box-shadow` value is declared here, so none is written as a length.
4. `font-mono` is used. No mono family is configured. No line-height token is set. `tracking-wide` appears on isolated labels only.
5. Fixed (DESIGN-GAPS-01A): page titles are `font-semibold` on auth, collaboration and template headings.
6. Dark mode rewrites CSS variables only. Workspace and collaboration stay light. Platform, knowledge, and office stay slate even in a light OS theme. Agent cards on the slate page are light.
7. Fixed (DESIGN-GAPS-01B): success is `emerald-*` everywhere; the live dot and the readiness chip no longer use `green-*`.
8. Fixed (DESIGN-GAPS-01B): one focus style, `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand`, on auth, platform, office, chips and the chat and collaboration textareas (which also take `focus:border-brand`).
9. Fixed (DESIGN-GAPS-01B): one shared `Spinner` replaces the pulsing gray dot in the shell loading rows and is used in the readiness check and the configuration loading state. Full-sentence loading text stays.
10. Inter is Latin-only. No CJK font is loaded. Chinese depends on fallback after `var(--font-inter)`.
11. Fixed (DESIGN-GAPS-01A): the mobile sidebar icon and tab orientation control are Heroicons v2 outline; the readiness chip and panel text come from the `systemReadiness` messages in en, zh-TW and zh-CN.
12. Fixed (DESIGN-GAPS-01A): all four auth cards are `rounded-xl shadow-lg`.
13. Fixed (DESIGN-GAPS-01B): the collaboration selection is `border-brand bg-indigo-50` and its buttons are `bg-brand`.
