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
  title-bold:
    fontFamily: "var(--font-inter), Arial, Helvetica, sans-serif"
    fontSize: "text-2xl"
    fontWeight: "bold"
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
    backgroundColor: "bg-blue-600"
    textColor: "text-white"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "px-4 py-1.5"
  button-workspace-primary-hover:
    backgroundColor: "bg-blue-700"
    textColor: "text-white"
    rounded: "{rounded.lg}"
    padding: "px-4 py-1.5"
  button-workspace-primary-disabled:
    backgroundColor: "bg-blue-300"
    textColor: "text-white"
    rounded: "{rounded.lg}"
    padding: "px-4 py-1.5"
  button-platform-primary:
    backgroundColor: "bg-indigo-600"
    textColor: "text-white"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "{spacing.control}"
  button-platform-primary-hover:
    backgroundColor: "bg-indigo-500"
    textColor: "text-white"
    rounded: "{rounded.md}"
    padding: "{spacing.control}"
  button-platform-emphasis:
    backgroundColor: "bg-indigo-600"
    textColor: "text-white"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "{spacing.button-platform}"
  button-knowledge-primary:
    backgroundColor: "bg-indigo-500"
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

The shipping UI is a dense work surface. Auth, the public landing slice, and the CSS variables share one light palette that also remaps under `prefers-color-scheme: dark`. The Builder workspace and the collaboration page are a separate light gray chrome with blue actions. The platform dashboard, knowledge screen, and office page are a slate field with indigo actions. Agent station cards and the agent detail panel sit on that dark field and are themselves light.

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

- **Brand indigo** (`{colors.brand}`, hover `{colors.brand-hover}`): fill and text on auth, password, and the public landing slice (`bg-brand`, `text-brand`, `focus:ring-brand`).
- **Workspace blue** (`bg-blue-600`, hover `bg-blue-700`, disabled `bg-blue-300`): the chat send button and the collaboration start button. User chat bubbles are `border-blue-200 bg-blue-50 text-blue-900`. Status text is `text-blue-600`. Focus on the chat field is `focus:border-blue-300`; intent chips use `focus-visible:ring-blue-400`.
- **Platform indigo** (`bg-indigo-600`, hover `bg-indigo-500`, mark `bg-indigo-500/90`): primary buttons on the platform dashboard, office desk panel, create-agent form, and agent detail. Knowledge uses `bg-indigo-500` hover `bg-indigo-400` for the same role. Links and bound-agent labels in the workspace use `text-indigo-700`.

### Neutral

- **Variable surfaces:** `{colors.background}`, `{colors.surface-base}`, `{colors.surface-raised}`, `{colors.surface-overlay}`, `{colors.border}`, `{colors.border-strong}`, `{colors.text-primary}`, `{colors.text-secondary}`, `{colors.muted}`, `{colors.foreground}`.
- **Workspace chrome:** page `bg-gray-100`; panels, header, and chat shell `bg-white`; hairline `border-gray-200`; quiet fills `bg-gray-50`; body text `text-gray-700`, `text-gray-800`, `text-gray-900`; secondary `text-gray-500` and `text-gray-600`; hint `text-gray-400`.
- **Platform, knowledge, and office field:** `bg-slate-950`, header border `border-slate-800`, raised panels `bg-slate-900/80` or `bg-slate-900`, controls `border-slate-700`, text `text-slate-200`, muted `text-slate-400`.
- **Agent cards on the dark field:** `bg-white` and `bg-gray-50/80` with `border-gray-200`. The detail panel is `bg-white`.

### Semantic

- **Warning:** `border-amber-200 bg-amber-50 text-amber-900` (collaboration notice, `role="alert"`). Coming-soon badges use `border-amber-200 bg-amber-50 text-amber-800` or `text-amber-700`. Knowledge warning blocks use `border-amber-900/80 bg-amber-950/40`.
- **Error:** chat `text-red-600`; small inline `text-red-700`; quiet danger `border-red-300 bg-white text-red-700` or `border-red-300 bg-red-50 text-red-700`; solid `bg-red-600`. Dark surfaces use `border-red-700/40 bg-red-950/30 text-red-300` with `ExclamationTriangleIcon`.
- **Success:** banners `border-emerald-200 bg-emerald-50 text-emerald-800`; solid `bg-emerald-600` disabled `bg-emerald-300`; active dot `bg-emerald-500` on agent cards. A separate green is also used: `bg-green-500` live dot, and `bg-green-600` / `bg-green-700` on the system-readiness chip.

### Dark mode

`@media (prefers-color-scheme: dark)` in the global CSS rewrites every variable above to the `-dark` tokens. `body` uses `var(--background)` and `var(--foreground)`. Auth and the landing slice follow the variables, so they shift with the OS. Workspace, collaboration, platform, knowledge, and office hardcode utilities. No `dark:` variant is applied in components. The sidebar string `account.dark` is copy, not a theme class.

**The One Surface Rule.** Match the file you are editing. Do not introduce a third action color.

Sources: `frontend/app/globals.css`, `frontend/tailwind.config.js`, `frontend/app/[locale]/login/page.tsx`, `frontend/app/[locale]/register/page.tsx`, `frontend/components/public/public-landing-slice.tsx`, `frontend/components/workspace/workspace-shell.tsx`, `frontend/components/collaboration/collaboration-view.tsx`, `frontend/components/platform/platform-dashboard.tsx`, `frontend/components/platform/agent-station-card.tsx`, `frontend/components/platform/agent-detail-panel.tsx`, `frontend/components/knowledge/knowledge-screen.tsx`, `frontend/components/office/office-screen.tsx`, `frontend/components/office/office-desk-panel.tsx`, `frontend/components/SystemReadiness.tsx`

## 3. Typography

**Display Font:** none. No display face is loaded.
**Body Font:** `Inter` from `next/font/google`, assigned to `--font-inter`, then `Arial`, `Helvetica`, `sans-serif`. Tailwind `fontFamily.sans` is the same stack.
**Label/Mono Font:** labels use the sans stack. Code and preformatted chat use the `font-mono` utility. `tailwind.config.js` does not set a mono family.

**Character:** UI text is small and medium-weight. Page titles are the largest step in use.

### Hierarchy

- **Title, bold** (`font-bold`, `text-2xl`): auth and password headings.
- **Title, semibold** (`font-semibold`, `text-2xl`): collaboration title; workspace template heading. Project names in the workspace header are `text-sm font-semibold` and `truncate`.
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

Depth is a hybrid, and it is uneven. Most workspace rows are flat: a `border` utility plus a gray or white fill. Cards that lift use Tailwind `shadow-sm`. Selected agent cards add `shadow-md`. Auth cards use `shadow-lg` (login, register) or `shadow-md` (forgot and reset). The repo-docs modal uses `shadow-xl`. The system-readiness panel uses `shadow-2xl`; its collapsed chip uses `shadow-lg`. Platform panels are flat borders on slate, sometimes with a slash opacity (`bg-slate-900/80`), not a shadow.

The workspace mobile sidebar scrim is `bg-black/20`. Modal scrims are `bg-black bg-opacity-50`.

No `box-shadow` value is written in this repo. `tailwind.config.js` does not extend `boxShadow`.

**The Flat Row Rule.** Lists, chat bubbles, and tab bars stay flat. Shadows belong to cards, menus, and modals that already use them.

Sources: `frontend/tailwind.config.js`, `frontend/app/[locale]/login/page.tsx`, `frontend/app/[locale]/register/page.tsx`, `frontend/app/[locale]/forgot-password/page.tsx`, `frontend/app/[locale]/reset-password/page.tsx`, `frontend/components/workspace/workspace-shell.tsx`, `frontend/components/workspace/workspace-tab-bar.tsx`, `frontend/components/platform/agent-station-card.tsx`, `frontend/components/platform/platform-dashboard.tsx`, `frontend/components/SystemReadiness.tsx`

## 5. Components

Icons are `@heroicons/react/24/outline`. Tests on the workspace shell and the platform dashboard reject the solid set. The workspace mobile menu is an inline 20×20 stroke SVG, not a Heroicon. The tab-orientation control is the glyphs `⇔` and `⇕`.

### Buttons

- **Shape:** `rounded-md` on auth and platform; `rounded-lg` on chat send, collaboration start, office desk, and agent detail; `rounded` on compact workspace row buttons.
- **Brand primary:** `{colors.brand}` fill, `{colors.background}` text (class `text-white`), `py-2.5`, `text-sm font-medium`. Hover `{colors.brand-hover}`. Active `scale-[0.97]`. Disabled `opacity-50`.
- **Brand secondary:** `border-border bg-surface-base`, hover `bg-surface-raised`, focus `ring-2 ring-brand`.
- **Workspace and collaboration primary:** `bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium`. Hover `bg-blue-700`. Disabled `bg-blue-300` and `cursor-not-allowed`.
- **Platform primary:** `bg-indigo-600` hover `bg-indigo-500`, `rounded-md px-3 py-1.5`, focus `ring-2 ring-indigo-400` with `ring-offset-2` and `ring-offset-slate-900` or `ring-offset-slate-950`. Desk and detail emphasis buttons are `rounded-lg px-4 py-2.5 font-semibold`.
- **Knowledge primary:** `bg-indigo-500` hover `bg-indigo-400`, disabled `opacity-60`.
- **Quiet danger:** `border-red-300 text-red-700` on white, hover `bg-red-50`. Revert uses the red-50 fill. Solid confirm is `bg-red-600`.
- **Success solid:** `bg-emerald-600 text-white`, disabled `bg-emerald-300`.
- **Ghost:** `text-gray-600` or `text-gray-700`, hover `bg-gray-100`, no fill at rest.

### Chips

- **Ask / Build / Agent:** track `rounded-lg border-gray-200 bg-gray-100 p-0.5`. Selected segment `bg-white text-gray-900 shadow-sm`. Unselected `text-gray-600`. Focus `ring-blue-400`. Disabled `opacity-50`.
- **Coming soon:** amber pill, `rounded-full`, `text-xs`.
- **Active agent:** emerald pill, `text-[11px]`, with an `h-1.5 w-1.5` `bg-emerald-500` dot.
- **Neutral count:** `rounded-full bg-gray-100 text-gray-500`.
- **Bound agent:** `text-indigo-700`, not a filled pill. Office desk phases use translucent emerald, amber, red, or slate borders (`border-emerald-400/40`, `border-amber-400/40`, `border-red-400/40`, `border-slate-600`).

### Cards / Containers

- **Workspace shell:** `h-screen bg-gray-100`. Project header `bg-white border-b border-gray-200 px-4 py-2`. Chat column `md:w-96`. Sidebar drawer `w-72`, off-canvas below `md`, easing `cubic-bezier(0.32, 0.72, 0, 1)` over `250ms`.
- **Chat panel:** `bg-white border border-gray-200 rounded-lg`. Thread padding `p-3`. User bubble `ml-8` blue; assistant `mr-8` white; system `mr-8 bg-gray-100`.
- **Workspace cards:** `rounded-xl border-gray-200 bg-white shadow-sm`, padding `p-4` or `p-6`.
- **Platform and office:** `bg-slate-950`. Sections `rounded-2xl border-slate-800 bg-slate-900/80 p-4 sm:p-5`. Office desk panel `rounded-2xl border-slate-700 bg-slate-900 p-5`. Logo mark `h-9 w-9 rounded-lg bg-indigo-500/90`.
- **Collaboration page:** `max-w-3xl px-4 py-6 text-gray-900`, `overflow-x-hidden`. Selected run `border-indigo-300 bg-indigo-50`; unselected `border-gray-200 bg-white`.
- **Empty:** dashed border. Workspace templates `border-dashed border-gray-200 text-gray-500`. Platform `border-dashed border-slate-600 bg-slate-800/40`. Office and knowledge `border-dashed border-slate-700`. Chat empty is `text-sm text-gray-500` plus an optional gray pill. Agent detail empty is `border-dashed border-gray-300 bg-white/70`.
- **Loading:** a `text-sm` sentence. Workspace and collaboration use `text-gray-500`. Platform uses `text-slate-400` inside a slate box. Office loading is centered `text-slate-200` on `bg-slate-950`. The shell also pulses `h-1.5 w-1.5 rounded-full bg-gray-400`.
- **Error:** see Semantic. Collaboration and file-action errors keep the message in the row; platform and office add a retry control.
- **Success:** emerald banner or emerald button. The readiness chip is green, with `bg-yellow-600` while checking and `bg-red-600` when not ready.

### Inputs / Fields

- **Auth:** `rounded-md border-border bg-surface-base`, icon `h-5 w-5` in a left slot, `focus:ring-2 focus:ring-brand`, `focus:outline-none`.
- **Chat and collaboration:** `rounded-lg border-gray-200 bg-gray-50 px-3 py-2 text-sm`, placeholder `text-gray-400`. Focus `border-blue-300 bg-white outline-none`. Disabled `bg-gray-100 text-gray-500`. Chat textarea is `rows={3}` and `resize-none`; collaboration is `rows={4}` and `resize-y`.
- **Platform and knowledge fields:** `rounded-md border-slate-700 bg-slate-950 text-white`.
- **Selects in chat:** `rounded border-gray-200 bg-white px-2 py-1 text-xs text-gray-600`.

### Navigation

- **Workspace tabs:** bar `border-b border-gray-200 bg-gray-50`. Active `bg-white text-gray-900 shadow-sm`. Inactive `text-gray-600 hover:bg-gray-100`. Label `text-xs`. Horizontal labels are `whitespace-nowrap` inside `overflow-x-auto`. Vertical mode swaps to `border-r` and shows the outline icon at `h-5 w-5`.
- **Platform header links:** `rounded-md border-slate-700 text-slate-200 hover:bg-slate-800`, focus `ring-indigo-400`.
- **Collaboration back link:** `text-sm font-medium text-indigo-700`.

### Modals

Scrim `fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4`. Repo-docs panel `max-w-lg max-h-[80vh] rounded-lg bg-white shadow-xl`, header `border-b border-gray-200 px-4 py-3`, close `XMarkIcon` at `h-5 w-5`. Clicking the scrim closes it.

### Motion

Auth buttons and the mobile menu button use `active:scale-[0.97]`. Sidebar transition is `250ms` with the cubic bezier above. Scrim fade is `duration-200 ease-out`. Agent cards use `duration-150`. The office art stylesheet sets `animation: none`, and under `prefers-reduced-motion: reduce` it sets `animation: none` and `transition: none`. The office screen listens to `matchMedia('(prefers-reduced-motion: reduce)')`.

Sources: `frontend/components/workspace/workspace-shell.tsx`, `frontend/components/workspace/workspace-tab-bar.tsx`, `frontend/components/collaboration/collaboration-page.tsx`, `frontend/components/collaboration/collaboration-view.tsx`, `frontend/components/platform/platform-dashboard.tsx`, `frontend/components/platform/agent-station-card.tsx`, `frontend/components/platform/agent-detail-panel.tsx`, `frontend/components/platform/create-agent-form.tsx`, `frontend/components/knowledge/knowledge-screen.tsx`, `frontend/components/office/office-screen.tsx`, `frontend/components/office/office-desk.tsx`, `frontend/components/office/office-desk-panel.tsx`, `frontend/components/office/office-art.tsx`, `frontend/app/[locale]/login/page.tsx`, `frontend/app/[locale]/register/page.tsx`, `frontend/components/SystemReadiness.tsx`

## 6. Do's and Don'ts

### Do:

- **Do** copy the surface you are editing: variable brand on auth and landing, `bg-blue-600` on workspace and collaboration actions, slate plus indigo on platform, knowledge, and office.
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

1. Primary actions are three treatments: `bg-brand` (`#6366f1` / dark `#818cf8`), `bg-blue-600`, and `bg-indigo-600` or `bg-indigo-500`. No single hex was chosen.
2. Tailwind utilities (`bg-blue-600`, `bg-indigo-600`, `bg-slate-950`, `bg-gray-100`, emerald, amber, red, green) have no hex literal in this repo. `tailwind.config.js` does not override the default palette. Those frontmatter fields keep the class name.
3. Radius, spacing steps, and shadows are Tailwind utilities. No px, rem, or `box-shadow` value is declared here, so none is written as a length.
4. `font-mono` is used. No mono family is configured. No line-height token is set. `tracking-wide` appears on isolated labels only.
5. Title weight is `font-bold` on auth and `font-semibold` on collaboration and template headings.
6. Dark mode rewrites CSS variables only. Workspace and collaboration stay light. Platform, knowledge, and office stay slate even in a light OS theme. Agent cards on the slate page are light.
7. Success green is split: `emerald-*` on workspace banners and agent badges, `green-500` / `green-600` on the live dot and the readiness chip.
8. Focus is split: `focus:ring-brand` on auth, `focus-visible:ring-indigo-400` or `ring-indigo-500` on platform and office, `focus-visible:ring-blue-400` on intent chips, and `focus:border-blue-300` with `outline-none` and no ring on the chat and collaboration textareas.
9. Loading has no shared spinner. Some rows are a sentence; some pulse a gray dot.
10. Inter is Latin-only. No CJK font is loaded. Chinese depends on fallback after `var(--font-inter)`.
11. The mobile sidebar icon is a custom 20×20 SVG. Tab orientation uses `⇔` and `⇕`. The readiness chip hardcodes English ("System Ready", "Config").
12. Auth card radius is `rounded-xl` on login and register, `rounded-lg` on forgot and reset. Auth shadow is `shadow-lg` on login and register, `shadow-md` on forgot and reset.
13. Collaboration selection is indigo (`border-indigo-300 bg-indigo-50`) while its primary button is `bg-blue-600`.
