# UX-01 CHECKPOINT — Manual UX/UI Acceptance and Polish

## Task Metadata

- Task ID: UX-01
- Title: Manual UX UI Acceptance and Polish
- Nature: VALIDATION (PRODUCT QUALITY, MANUAL UX/UI ACCEPTANCE)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/UX-01-CHECKPOINT.md`

## Scope Reviewed

All surfaces were reviewed via static code analysis of the full frontend source:
- `frontend/components/public/public-landing-slice.tsx` — landing page
- `frontend/app/[locale]/login/page.tsx` — auth/login
- `frontend/components/workspace/workspace-shell.tsx` — full workspace shell (chat, editor, preview, history, projects, dashboard)
- `frontend/app/[locale]/app/page.tsx` — workspace page controller
- `frontend/app/[locale]/keys/page.tsx` — API key management

---

## Manual Review Findings by Surface

### Landing Page (`/`)

- Clean, minimal, functional. Hero copy is accurate. CTA routing (signed-in vs signed-out) is handled correctly.
- Trust note present. Feature cards are clear.
- One redundant CTA: both a hero "Sign In to Start" button and a separate "Open Login" link appear in the hero area when the user is not signed in. They go to the same page but label differently, which is slightly confusing.
- No product name / branding consistency issue — "AI Sandbox" is used consistently here.

---

### Auth / Login (`/login`)

- Form is clean and functional.
- Test credentials block (`demo@aisandbox.com` / `demo123`) is prominently displayed with a "🔑 Test Credentials" heading. **This is a development-era artifact that should not be shipped to production users.** It is currently the most prominent thing on the login page above the form.
- No registration link or "Sign up" path visible on the login page. For a product accepting new users, this is a functional gap — users who land on login have no visible path to register.
- Language switcher (`<LanguageSwitcher />`) is present but positioned top-right (absolute). Acceptable for internal/early-access but could conflict with product header once that is added.
- Error messaging is clear and contained.

---

### Workspace Shell — Entry and Header

- Header shows hardcoded subtitle: `"Core shell baseline (Slice 1)"`. This is internal build-phase scaffolding copy, not a user-facing label.
- Header shows user ID as `"User <uuid>"` — raw UUID, not email or display name.
- Header also shows hardcoded text: `"Launch polish slice 1: responsive + state clarity"` — another internal implementation note left in the rendered UI.
- Footer shows `"Workspace shell state: <state>"` and `"Sessions: <n>"` — raw internal state machine label exposed to users.
- These internal labels are present in every workspace view and are the most visible UX defect class.

---

### Session Sidebar

- Session cards show `"Session <8-char-id>"` — truncated UUID only, no human-readable label or creation timestamp.
- `getSessionLabel()` is called but shows status-based label (e.g. "active"). No creation time, no context.
- "New Session" button is clear and prominent.
- Active session count with quota limit is shown (`Active sessions: N/5`) — good.
- Stop/Remove button actions are clear.
- No confirmation on "Stop" — user can accidentally stop a session with one click.

---

### Workspace Main — Layout

- Three-column grid at `xl:grid-cols-3` for chat / editor / preview is functionally correct.
- Trust note (`"Workspace data is session-scoped…"`) renders on every load — useful first time, noisy thereafter since there is no dismiss or persistence.
- No visual hierarchy between chat/editor/preview columns. All panels are labeled with internal build names: `"Chat Panel"`, `"Editor Panel"`, `"Preview Panel"` as plain text headings inside the section cards. These are placeholder labels acceptable for development but would benefit from cleaner visual framing.

---

### Chat Panel

- Prompt textarea is functional; placeholder text is practical.
- Model selector is labeled `"Model Provider"` — reasonably clear.
- Orchestration toggle label: `"Enable bounded orchestration (up to 3 sequential steps)"` — functional but wordy; exposes an implementation-level description to the user.
- Chat thread renders user messages (blue) and assistant messages (gray) with clear role separation.
- Assistant messages show model attribution (`"Model: <name> (<provider>)"`) — useful for multi-AI context.
- AI responses render in `<pre>` with `whitespace-pre-wrap font-mono` — code is readable but prose responses look typewriter/monospaced. For non-code AI responses this may be jarring.
- File action state shown after AI messages — useful but currently text-only; no visual indicator distinguishing "AI applied files" from "AI responded only".
- Execution ID shown below the prompt on completion — raw UUID, not useful to a user.

---

### Editor Panel

- File tree + Monaco editor composition is standard and appropriate.
- No observed issues from code structure; UX depends on session having active files loaded.

---

### Preview Panel

- Standard iframe preview with refresh button — structurally sound.
- No session isolation indicator to clarify that preview is session-scoped.

---

### History / Control Section (below main grid)

- Section heading: `"History / Control (Slice 1)"` — internal build phase label exposed in UI.
- Projects sub-section heading: `"Projects (PR-03-01)"` — internal task ID exposed in UI.
- Public browse sub-section heading: `"Public Browse (ADV-05-01)"` — internal spec ID exposed in UI.
- Dashboard section heading: `"Dashboard (Slice 1)"` — internal build phase label.
- These internal task/spec labels (`PR-03-01`, `ADV-05-01`, `Slice 1`) are among the most visible structural issues.
- Project creation input, open-project selector, visibility toggle, and public browse are all presented in a single dense block with no visual separation or user-level section labeling.
- Visibility update button is a separate action from project creation — easy to miss that a separate click is needed to set visibility after selecting it.

---

### Checkpoint / History Surface

- Checkpoint list with search, filter, revert, diff, compare, and live-open is feature-complete.
- History surface density (compact/expanded toggle) and focus mode are present.
- Checkpoint list capped at 5 visible items with total match count shown — appropriate.
- Revert flow has a preview + confirm step — good safety pattern.
- Section has no top-level label explaining "this is your git history" to a non-technical user. "History / Control (Slice 1)" is the only heading.

---

### Quota / Plan / Dashboard

- Dashboard shows user email, plan name, plan status, active session count, 24h session count, 24h token count, and quota reset time.
- Section heading: `"Dashboard (Slice 1)"` — internal label.
- `quotaResetsAt` renders a raw ISO timestamp string. Not formatted for readability.
- No visual progress bar or gauge for quota — raw numbers only. Functional but not immediately scannable.

---

### API Keys Page (`/keys`)

- Significantly better visual quality than workspace shell — uses card-based layout with proper spacing.
- Test credentials block removed here — good.
- `alert()` used for "API key copied to clipboard" confirmation — native browser `alert()` is jarring UX. Should be a toast or inline message.
- `confirm()` used for revoke confirmation — native browser `confirm()` dialog. Functional but inconsistent with the rest of the product. Should be an inline confirmation or modal.
- New key display modal is well-implemented (prominent warning, copy button, one-time display pattern).
- Revoked keys remain visible in the list — good for audit trail, but no filtering or hide-revoked toggle.
- No navigation to the keys page from the workspace shell — user must know the `/keys` route.

---

## Issue List by Severity

### Blocker (would prevent internal acceptance)

| # | Surface | Type | Issue |
|---|---------|------|-------|
| B1 | Login | Functional/Clarity | Test credentials block (`demo@aisandbox.com` / `demo123`) is the most prominent element on the login page. Must be removed or gated before any non-development audience. |
| B2 | Workspace header, section labels | Clarity | Multiple internal build-phase/task labels rendered in the UI: `"Core shell baseline (Slice 1)"`, `"Launch polish slice 1: responsive + state clarity"`, `"History / Control (Slice 1)"`, `"Dashboard (Slice 1)"`, `"Projects (PR-03-01)"`, `"Public Browse (ADV-05-01)"`. These are visible to users. |

### Important (meaningful UX gaps)

| # | Surface | Type | Issue |
|---|---------|------|-------|
| I1 | Workspace header | Clarity | User ID shown as raw UUID (`"User <uuid>"`). Should show email or display name. |
| I2 | Workspace footer | Clarity | Footer renders raw internal state machine label (`"Workspace shell state: <state>"`). Not user-meaningful. |
| I3 | Chat thread | Visual/Polish | AI response text rendered in monospace `<pre>`. Prose responses look like code. Plain prose should render without monospace. |
| I4 | Login | Functional | No visible registration path on the login page. Users who need to sign up have no CTA. |
| I5 | Session sidebar | Functional | No confirmation on "Stop session". One-click stop with no undo. |
| I6 | API Keys | Functional | `alert()` / `confirm()` used for copy/revoke feedback. Should be inline feedback or modal. |
| I7 | Workspace | Functional | No navigation link to the API Keys page from within the workspace. |
| I8 | Dashboard | Clarity | `quotaResetsAt` renders raw ISO timestamp. Should be a human-readable relative or local time. |

### Polish (low severity, product taste)

| # | Surface | Type | Issue |
|---|---------|------|-------|
| P1 | Landing | Visual/Polish | Two CTAs on hero when signed out ("Sign In to Start" + "Open Login") both go to login — redundant. |
| P2 | Trust note | Visual/Polish | Workspace trust note (`"Workspace data is session-scoped…"`) renders every load with no dismiss. Useful once, noisy always. |
| P3 | Session sidebar | Clarity | Session cards show only `"Session <8-char-id>"`. Creation time or last-used timestamp would help. |
| P4 | Chat panel | Clarity | Execution UUID shown below prompt after completion. Not useful to a user; should be hidden or tucked away. |
| P5 | Chat panel | Clarity | Orchestration toggle label is wordy implementation-level text. |
| P6 | Dashboard | Visual/Polish | Token quota shown as raw numbers. A simple visual bar/gauge would aid scannability. |
| P7 | History | Clarity | No user-facing label explaining what the history section is (e.g. "Git History / Checkpoints"). |
| P8 | Projects | Clarity | Visibility select + "Update Visibility" is a two-step action not visually explained. Could be confusing that a separate save click is needed. |
| P9 | API Keys | Visual/Polish | Revoked keys shown without a filter/hide option. |

---

## Recommended Follow-Up Work (small bounded tasks, one per issue)

1. **UX-01-01:** Remove or gate test-credentials block from login page (`B1`).
2. **UX-01-02:** Remove internal task/slice labels from rendered workspace UI headings (`B2`). Replace with user-meaningful labels.
3. **UX-01-03:** Replace raw UUID header with user email or display name (`I1`).
4. **UX-01-04:** Remove or simplify workspace footer internal state label (`I2`).
5. **UX-01-05:** Render AI prose responses in normal readable font, not monospace; keep code blocks in monospace (`I3`).
6. **UX-01-06:** Add a registration link/CTA to the login page (`I4`).
7. **UX-01-07:** Add a stop-session confirmation step to session sidebar (`I5`).
8. **UX-01-08:** Replace `alert()`/`confirm()` in API keys page with inline feedback (`I6`).
9. **UX-01-09:** Add navigation link to API Keys page from workspace shell (`I7`).
10. **UX-01-10:** Format quota reset timestamp as human-readable (`I8`).

---

## Code Change Statement

No code was changed in UX-01. This task is review and documentation only.
