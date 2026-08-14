# BUILDER-INTENT-01 Step 4A-M1 — Mobile Stacked Workspace Layout Design

**Status:** DESIGN ONLY — no source edits, no tests changed, no runtime changes  
**Date:** 2026-08-12  
**Task:** BUILDER-INTENT-01 Step 4A-M1  
**GLOBAL_EXECUTION_ENABLED:** `false` — remains false throughout this document  
**Next step gate:** BUILDER-INTENT-01 Step 4A-M2 (Implementation) — not yet active

---

## 1. Exact Current Mobile Layout Chain

All class strings are from `frontend/components/workspace/workspace-shell.tsx`.
Line numbers reference the source as of this design audit.

```
[html] className="... h-full"                        (app/[locale]/layout.tsx:30)
  [body] className="h-full"                          (layout.tsx:31)

    [div] data-testid="workspace-shell"              (line 2294)
      className="h-screen bg-gray-100 flex flex-col"
      ├─ FIXED VIEWPORT HEIGHT: h-screen
      ├─ FLEX DIRECTION: flex flex-col

      [div] mobile header bar                        (line 2295)
        className="border-b border-gray-200 bg-white px-4 py-2 md:hidden"
        ├─ NATURAL HEIGHT: ~40px (hamburger row)
        ├─ DESKTOP: hidden (md:hidden)

      [div] middle layout section                    (line 2317)
        className="flex-1 min-h-0 flex flex-col md:flex-row"
        ├─ FLEX GROWTH: flex-1 — fills shell minus header and footer
        ├─ MOBILE MIN-FLOOR: min-h-0
        ├─ MOBILE FLOW: flex-col (stacked)
        ├─ DESKTOP FLOW: md:flex-row (side-by-side sidebar + main)
        ├─ ALLOCATED HEIGHT (mobile): h-screen − 40px mobile header − 40px footer ≈ viewport − 80px

        [aside/div] WorkspaceSidebar                 (lines 2325–2331)
          className="fixed inset-y-0 left-0 z-20 w-72 ..."
          ├─ MOBILE: position: fixed — ZERO flex contribution to middle section width/height
          ├─ DESKTOP: md:static — participates in flex layout

        [main] data-testid="workspace-content-shell" (line 2380)
          className="flex-1 min-w-0 flex flex-col overflow-y-auto"
          ├─ FLEX GROWTH: flex-1 — fills all of middle (sidebar is fixed on mobile)
          ├─ WIDTH FLOOR: min-w-0 (not a height constraint)
          ├─ MOBILE OVERFLOW: overflow-y-auto — POTENTIAL scroll owner (currently unused; content never exceeds allocation)
          ├─ DEFINITE HEIGHT (mobile): inherits from middle section ≈ viewport − 80px

          [div] data-testid="workspace-project-view" (line 2392)
            className="flex flex-1 min-h-0 flex-col overflow-hidden"
            ├─ FLEX GROWTH: flex-1 — fills content-shell
            ├─ HEIGHT FLOOR: min-h-0 — minimum content size = 0; element fills flex allocation exactly
            ├─ CLIP: overflow-hidden — CLIPS ALL CONTENT to the allocated height (viewport − 80px)
            ├─ KEY CONSTRAINT: this element is the principal mobile prison

            [header] project mode header              (lines 2393–2416)
              className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2"
              ├─ NATURAL HEIGHT: ~40px (back button, project name, collapse toggle)

            [div] inner layout section               (line 2417)
              className="flex flex-1 min-h-0 flex-col md:flex-row"
              ├─ FLEX GROWTH: flex-1 — fills project-view minus project header
              ├─ HEIGHT FLOOR: min-h-0 — collapses to fill flex allocation
              ├─ MOBILE FLOW: flex-col (stacked: AI on top, content below)
              ├─ DESKTOP FLOW: md:flex-row (side-by-side)

              [aside] data-testid="workspace-project-ai-panel"  (line 2420)
                className="w-full max-h-[50vh] md:w-96 md:max-h-none border-r border-gray-200 bg-white overflow-hidden flex flex-col gap-2 p-2"
                ├─ MOBILE WIDTH: w-full (full column)
                ├─ MOBILE MAX HEIGHT CAP: max-h-[50vh] — clamps AI panel to 50% of viewport
                ├─ MOBILE OVERFLOW: overflow-hidden — clips everything above 50vh
                ├─ DESKTOP WIDTH: md:w-96 (384px side panel)
                ├─ DESKTOP CAP REMOVED: md:max-h-none
                ├─ DESKTOP SEPARATOR: border-r (right border in row layout)
                ├─ INTERIOR: projectChatSection (flex flex-col flex-1 min-h-0 overflow-hidden)

              [main] data-testid="workspace-project-content-panel"  (lines 2427–2430)
                className="flex-1 min-h-0 min-w-0 flex [flex-col|flex-row]"
                ├─ FLEX GROWTH: flex-1 — fills remaining height after AI panel
                ├─ HEIGHT FLOOR: min-h-0 — collapses to flex allocation
                ├─ WIDTH FLOOR: min-w-0 (horizontal constraint; not height)
                ├─ MOBILE HEIGHT AVAILABLE: viewport − 80px − 40px project-header − 50vh AI cap ≈ very small
                ├─ NOTE: min-h-0 fix added here in prior step; must remain on desktop

                [WorkspaceTabBar]                     (line 2432)
                  ├─ NATURAL HEIGHT: ~40px (tab strip)

                [div] data-testid="workspace-tab-content"  (line 2439)
                  className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col"
                  ├─ FLEX GROWTH: flex-1 — fills content-panel minus tab bar
                  ├─ HEIGHT FLOOR: min-h-0
                  ├─ CLIP: overflow-hidden
                  ├─ MOBILE AVAILABLE HEIGHT: near zero

                  [div] data-testid="preview-panel-shell"  (line 2442)
                    className="flex flex-col flex-1 min-h-0 overflow-hidden"
                    ├─ FLEX GROWTH: flex-1 / HEIGHT FLOOR: min-h-0 / CLIP: overflow-hidden

                    [WorkspacePreviewPanel fillHeight=true]
                      panelClassName: "flex flex-col flex-1 min-h-0 overflow-hidden rounded border border-gray-200 bg-gray-50 p-2"
                      ├─ FLEX GROWTH: flex-1 / HEIGHT FLOOR: min-h-0 / CLIP: overflow-hidden
                      controls row: ~40px
                      iframeClassName: "mt-2 w-full flex-1 min-h-0 rounded border border-gray-200 bg-white"
                      ├─ IFRAME: flex-1 min-h-0 — NO natural content height → collapses to ~0

                  [div] data-testid="editor-panel-shell"   (line 2469)
                    className="flex flex-col flex-1 min-h-0 overflow-hidden"
                    ├─ Same chain: flex-1 min-h-0 overflow-hidden

                  [div] data-testid="build-targets-panel-shell"  (line 2490)
                    className="flex flex-col flex-1 min-h-0 overflow-hidden p-3"
                    ├─ Same chain: flex-1 min-h-0 overflow-hidden

      [footer] workspace footer                      (line 2529)
        className="h-10 bg-white border-t border-gray-200 px-4 flex items-center justify-between text-xs text-gray-600"
        ├─ FIXED HEIGHT: h-10 = 40px
        ├─ OUTSIDE scroll area (sibling to middle, not child)
```

---

## 2. Exact Cause of Compressed Mobile Layout

The compression is not a single class but a **reinforcing interaction** between five mechanisms:

### Mechanism 1: `h-screen` on workspace-shell

```
h-screen  →  height: 100vh  (the full viewport, fixed)
```

The shell has a definite viewport height. No child can grow the shell beyond `100vh`. Combined with `html h-full` and `body h-full` in the layout file, the total page height is locked to the viewport. Browser/document scroll is structurally disabled.

### Mechanism 2: `flex-1 min-h-0` propagation chain

Every element from middle section → content-shell → project-view → inner-section → content-panel → tab-content carries `flex-1 min-h-0`. This chain:
- `flex-1` allocates each element a proportional share of its parent's definite height.
- `min-h-0` overrides the CSS default `min-height: auto` (which would use min-content-size). With `min-h-0`, each element's minimum size is 0 — it can be compressed to zero by the flex algorithm.
- Together: every element fills exactly its allocated share of `h-screen`, compressing to the available size with no natural floor.

The chain is:
```
h-screen (viewport) → flex-1 min-h-0 → flex-1 min-h-0 → flex-1 min-h-0 → ...
```
Each level divides the fixed viewport height further.

### Mechanism 3: `overflow-hidden` on workspace-project-view

`overflow-hidden` on workspace-project-view clips anything exceeding its allocated height. Even if a child attempted to declare a natural height, it would be clipped before reaching workspace-content-shell's scroll container. This is the "prison door" sealing the compression.

### Mechanism 4: `max-h-[50vh]` on the AI panel

The AI panel aside carries `max-h-[50vh]` on mobile. Within the stacked `flex-col` inner section, the AI panel gets 50vh. The remaining content panel gets:

```
available = (h-screen − 40px mobile-header − 40px footer − 40px project-header − 50vh AI) 
          ≈ 100vh − 170px − 50vh 
          ≈ 50vh − 170px 
          ≈ ~250px on a 844px device
```

The preview iframe — with `flex-1 min-h-0` and no natural content — gets near-zero height from this residual.

### Mechanism 5: iframe has no natural content height

An `<iframe>` element has zero intrinsic content height. With `flex-1 min-h-0`, it gets whatever the flex algorithm allocates — which at the bottom of the compressed chain is near zero. There is no floor. `fillHeight=true` was designed for the desktop case where the full layout provides a definite height from the top.

### Summary

The mobile experience is compressed because:
1. `h-screen` locks total height to viewport
2. `overflow-hidden` on project-view prevents any child from pushing content-shell to scroll
3. The `flex-1 min-h-0` chain subdivides the locked height at each level, allowing compression at every step
4. The AI panel is capped at `max-h-[50vh]`, leaving minimal space for Preview
5. The preview iframe collapses because it has no natural content height and no minimum floor

---

## 3. Selected Mobile Scroll Owner

**Selected: `workspace-content-shell`** (`data-testid="workspace-content-shell"`)

This element already has `overflow-y-auto`. It sits directly above workspace-project-view with a definite allocated height from the `h-screen` shell chain. No changes to `html`, `body`, or `h-screen` are needed.

**Why not browser/document scroll:**
`html` has `h-full` and `body` has `h-full` (verified in `app/[locale]/layout.tsx:30–31`). These lock the page height to the viewport. Even with `min-h-dvh` on the shell, browser scroll requires body to grow taller than the viewport, which `h-full` prevents without changing the layout file. Changing the layout file would touch routing infrastructure, exceeding this task's scope.

**Why not a new outer scroll container:**
No new elements are introduced. workspace-content-shell is the natural, existing container for this scroll.

**How workspace-content-shell activates as scroll owner:**
By removing `min-h-0` and `overflow-hidden` from workspace-project-view on mobile, workspace-project-view's minimum content size becomes the sum of its children's natural heights. When that sum exceeds the content-shell's allocated height (`viewport − 80px`), `overflow-y-auto` on workspace-content-shell activates scroll.

The user scrolls within the workspace content area (between the fixed mobile header and the fixed footer). On mobile this feels identical to page scroll — the mobile header (hamburger) and footer (workspace info) remain anchored.

---

## 4. Responsive Breakpoint Strategy

Using Tailwind's existing `md:` breakpoint (`768px`), consistent with all current responsive classes in the codebase.

**Mobile (< 768px):**
- workspace-shell: height controlled by flex chain (no change — stays `h-screen`)
- workspace-content-shell: becomes active scroll owner via `overflow-y-auto` (already present)
- workspace-project-view: natural stacked column, no clip
- AI section: comfortable minimum height of `60dvh`
- Preview section: comfortable minimum height of `60dvh` via iframe floor

**Desktop (md: — ≥ 768px):**
- All existing classes restored via `md:` prefixes
- `overflow-hidden` restored on project-view and all inner panels
- `min-h-0` restored on all flex chain elements
- AI panel: `md:min-h-0` removes the mobile floor, restoring side-by-side flex behavior
- Preview iframe: `md:min-h-0` removes the mobile floor, restoring fillHeight fill
- NO behavioral change on desktop

---

## 5. AI Panel Mobile Sizing

**Decision: Replace `max-h-[50vh]` with `min-h-[60dvh]`**

The `max-h-[50vh]` cap is removed entirely. It is not restored at any breakpoint.  
A `min-h-[60dvh]` floor replaces it for mobile only.  
`md:min-h-0` restores zero floor on desktop, deferring to flex allocation from the side-by-side layout.

**Rationale:**
- `60dvh` (60% of the dynamic viewport height) provides a comfortable area for: project context, AI history toggle, the chat thread (scrolling within the panel), Ask/Build toggle, prompt textarea, Send, model selector, orchestration checkbox.
- Using `dvh` (dynamic viewport height) rather than `vh`: `dvh` tracks the actual visible viewport as browser toolbars show/hide on iOS Safari and Chrome for Android. `vh` uses the larger value (no toolbar), which can cause layout to extend slightly off-screen when toolbars are present. Tailwind 3.4.1 supports `min-h-[60dvh]` as an arbitrary value.
- The AI panel does NOT need a `max-h` on mobile. If a long conversation makes the thread taller, the AI section grows naturally and the page scrolls further before reaching Preview. This is the correct behavior ("not squeezed").
- `md:overflow-hidden` replaces the current bare `overflow-hidden`. On desktop, the AI panel retains internal overflow clipping (the chat thread scrolls within its allocated side-panel height). On mobile, no overflow clipping occurs, allowing natural content flow.

The current `md:max-h-none` class is dropped because there is no mobile cap to override on desktop.

**AI panel chat internals (chat-panel-shell and below):**
The chat-panel-shell (`flex flex-col flex-1 min-h-0 bg-white border border-gray-200 rounded-lg overflow-hidden`) does NOT change. With the AI aside having a definite `min-h-[60dvh]` on mobile, the aside has a proper containing height. `flex-1 min-h-0` inside it correctly divides that definite height between the chat content area and the composer. The chat thread's `overflow-y-auto` scrolls within the panel. No changes needed to any element inside the AI panel.

---

## 6. Preview Mobile Sizing

**Decision: Add `min-h-[60dvh] md:min-h-0` to the preview iframe**

The `WorkspacePreviewPanel` `fillHeight` iframe class is the deepest element in the content chain. Adding `min-h-[60dvh]` to the iframe establishes a natural content size that propagates upward through the `flex-1` chain (which has `min-h-0` removed at each level on mobile), giving the Preview section a substantial minimum height.

The preview iframe receives `min-h-[60dvh]` so that after removing the `min-h-0` chain, the iframe's minimum content size (60dvh) propagates to all ancestors and produces a natural section height of approximately:

```
tab bar (~40px) + preview controls (~40px) + iframe (60dvh) ≈ 60dvh + 80px
```

**Prefer `dvh` over `vh` for the same reason as AI panel above.**

`md:min-h-0` on the desktop restores zero floor, allowing `flex-1` and the definite desktop height to control sizing (current behavior).

The Preview iframe retains its own internal scrolling independently (the preview app inside the iframe).

---

## 7. Workspace Tabs / Controls Accessibility

All four tabs (Preview, Code & Files, Build Targets, Database) are rendered by `WorkspaceTabBar`, which has natural content height (~40px). It sits outside the `flex-1` chain inside workspace-project-content-panel. It is unaffected by the min-h changes.

**Tab bar: no sticky positioning.** The WorkspaceTabBar naturally sits at the top of the content panel section. As the user scrolls down to Preview, the tab bar scrolls with the content. There is no need for sticky positioning — the workspace-content-shell scroll area is bounded between the fixed mobile header and footer, so the scroll distance is manageable.

**Preview controls row:** Inside `WorkspacePreviewPanel`, the controls row (Live Preview label, Refresh, Start Preview, Visual Edit toggle) is above the iframe with natural height. It scrolls with the section. Accessible before and after scroll to the Preview section.

**Build Targets, Database tabs:** These panels sit in the same `workspace-tab-content` chain. They are currently placeholder or have natural content height. With `md:overflow-hidden` instead of bare `overflow-hidden`, they display correctly on mobile (no clip). No minimum height is added for Build Targets — the `WorkspaceBuildPanel` content (dropdowns, run button, output area) has natural content height. If the output textarea needs a minimum on mobile, that is deferred to a targeted fix.

---

## 8. Composer Accessibility

The composer (Ask/Build toggle, prompt textarea, Send button, model controls, orchestration checkbox) lives inside `WorkspaceChatPanel`, which is inside `projectChatSection`, which is inside the AI panel aside.

With the AI panel having `min-h-[60dvh]` and the chat-panel-shell retaining `flex-1 min-h-0 overflow-hidden`, the full AI section height is dedicated to the chat thread (scrollable) + composer (pinned to bottom by the chat panel's `flex flex-col` layout).

At 390px:
- AI panel: ≥ 60dvh ≈ 506px on a 844px device
- chat-panel-shell occupies ~(60dvh − 2*gap − 2*p) ≈ 490px
- Chat thread: `overflow-y-auto` above composer, scrolls when messages accumulate
- Composer: renders at bottom of flex column, always visible within the AI section

Ask/Build toggle, prompt textarea, Send button, model selector, and orchestration checkbox all fit within the composer area at 390px (no change to composer layout).

---

## 9. Mobile Browser Viewport Correctness

The shell currently uses `h-screen` = `height: 100vh`. On iOS Safari and Chrome for Android:
- `100vh` = the "large viewport height" (window height without address bar)
- When the address bar is visible, the actual visible height is smaller than `100vh`
- This means the footer can be partially hidden behind the address bar

**Recommendation (optional, low-risk enhancement):**  
Change shell to `h-dvh` (`height: 100dvh`). `dvh` dynamically tracks the actual visible viewport, adjusting as browser toolbars show/hide. Tailwind 3.4.1 supports `h-dvh` as a first-class utility.

**This is OPTIONAL.** It does not affect the scroll mechanism. The scroll mechanism works identically with `h-screen` or `h-dvh`. If implemented, the test at line 2559 (`'workspace-shell uses h-screen not min-h-screen for definite viewport height'`) updates its assertion from `/h-screen/` to `/h-dvh/`.

**Decision for this design:** The core mobile scroll mechanism described here keeps `h-screen` unchanged. The `dvh` improvement is flagged as a follow-on improvement (one line change + one test update) that can be batched with this step or deferred.

---

## 10. Nested Scrolling Behavior After Change

### Mobile (< 768px)

| Scroll surface | What it scrolls | Mechanism |
|---|---|---|
| workspace-content-shell | The stacked workspace content (AI section → Preview section) | `overflow-y-auto` (already present); now activated because project-view exceeds allocation |
| AI chat thread (`workspace-chat-thread`) | Chat messages within the AI panel | Independent `overflow-y-auto` on the thread; the AI panel's `min-h-[60dvh]` gives it a definite height |
| Preview iframe | The preview app content | Native iframe scroll; never interrupted |
| Editor textarea | Code file content | `overflow-auto` inside the editor pane |

**No conflicting nested vertical scroll surfaces:**
- The workspace-content-shell scroll (outer) covers the full scroll range from AI section to Preview section.
- The AI chat thread scroll (inner) only activates when the message history exceeds the AI panel's `min-h-[60dvh]` area. The user can scroll the workspace-content-shell to move between sections without triggering the inner chat scroll.
- The preview iframe scroll is always distinct (inside the embedded app).
- There is no case where two vertical scroll surfaces compete for the same touch gesture because the inner scrollers (chat thread, iframe) are sized by `min-h-[60dvh]` floors, making them tall enough that the outer scroll is typically used for section-switching and the inner scroll for content-browsing.

### Desktop (md: ≥ 768px)

No change from current behavior. All scroll surfaces remain as they are today:
- Workspace shell: `h-screen`, no page scroll
- AI chat thread: `overflow-y-auto` within the fixed side panel
- Preview iframe: internal scroll
- Editor textarea: `overflow-auto`

---

## 11. Desktop Preservation Strategy

The implementation uses responsive overrides only. Every desktop class is preserved exactly by prefixing the mobile-specific removals with `md:`.

Desktop invariants maintained:
- `h-screen` on workspace-shell (definite viewport height) — no change
- `flex-1 min-h-0` flex chain — restored at `md:` breakpoint
- `overflow-hidden` on project-view and all tab/panel shells — restored at `md:` breakpoint
- AI panel: `md:w-96` (384px sidebar), `md:min-h-0` (no mobile floor), `md:overflow-hidden` (internal clip), `md:border-r` (right border in row layout)
- Preview iframe: `md:min-h-0` (fillHeight fill from flex chain)
- Editor panel: `md:min-h-0` on all fill-height chain elements, `md:overflow-hidden`
- WorkspaceTabBar: unchanged
- workspace-footer: unchanged (h-10, outside scroll area)
- Sidebar: unchanged
- AI-panel-collapse-toggle behavior: unchanged
- tab orientation (horizontal/vertical): unchanged
- Desktop scroll behavior: unchanged (chat thread scrolls, preview iframe scrolls, no page scroll)

---

## 12. Exact Before → After Class Changes

All changes are in `frontend/components/workspace/workspace-shell.tsx`.

---

### workspace-project-view (line 2392)

- **Current:** `flex flex-1 min-h-0 flex-col overflow-hidden`
- **Mobile:** `flex flex-1 flex-col` — no min-h-0, no overflow-hidden; natural content height enables content-shell scroll
- **Desktop (md+):** `md:min-h-0 md:overflow-hidden` — restores existing behavior
- **Full proposed:** `flex flex-1 md:min-h-0 flex-col md:overflow-hidden`
- **Reason:** Removing `min-h-0` allows natural content size to propagate upward; removing `overflow-hidden` removes the clip that blocks content-shell scroll activation.

---

### Inner layout section div (line 2417)

- **Current:** `flex flex-1 min-h-0 flex-col md:flex-row`
- **Mobile:** `flex flex-1 flex-col` — no min-h-0
- **Desktop (md+):** `md:min-h-0 md:flex-row` — restores existing behavior
- **Full proposed:** `flex flex-1 md:min-h-0 flex-col md:flex-row`
- **Reason:** `min-h-0` here collapses AI + content section heights to zero even after the project-view change. Removal allows natural heights to propagate.

---

### AI panel aside (line 2420)

- **Current:** `w-full max-h-[50vh] md:w-96 md:max-h-none border-r border-gray-200 bg-white overflow-hidden flex flex-col gap-2 p-2`
- **Mobile:** `w-full min-h-[60dvh] border-b border-gray-200 bg-white flex flex-col gap-2 p-2`
  - Removes `max-h-[50vh]` (the mobile cap being replaced)
  - Removes bare `overflow-hidden` (no clip on mobile)
  - Adds `min-h-[60dvh]` (comfortable AI section minimum)
  - Changes `border-r` → `border-b` (visually correct in stacked layout)
- **Desktop (md+):** `md:min-h-0 md:w-96 md:border-b-0 md:border-r md:overflow-hidden`
  - `md:min-h-0`: removes mobile floor, restores flex-controlled height
  - `md:w-96`: restores 384px width
  - `md:border-b-0 md:border-r`: swaps border back to right side for row layout
  - `md:overflow-hidden`: restores internal overflow clip for chat thread scroll
- **Full proposed:** `w-full min-h-[60dvh] md:min-h-0 md:w-96 border-b md:border-b-0 md:border-r border-gray-200 bg-white md:overflow-hidden flex flex-col gap-2 p-2`
- **Reason:** `min-h-[60dvh]` gives the AI section a comfortable natural height on mobile without imposing a cap. The border swap ensures visual correctness in stacked vs side-by-side layouts.

---

### workspace-project-content-panel main (lines 2427–2430)

- **Current (dynamic):** `flex-1 min-h-0 min-w-0 flex ${tabOrientation === 'vertical' ? 'flex-row' : 'flex-col'}`
- **Mobile:** `flex-1 min-w-0 flex [flex-row|flex-col]` — no min-h-0
- **Desktop (md+):** `md:min-h-0` — restores floor
- **Full proposed:** `flex-1 md:min-h-0 min-w-0 flex ${tabOrientation === 'vertical' ? 'flex-row' : 'flex-col'}`
- **Reason:** `min-h-0` must be removed from the content-panel chain so iframe's `min-h-[60dvh]` can propagate natural height upward.

---

### workspace-tab-content div (line 2439)

- **Current:** `flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col`
- **Mobile:** `flex-1 min-w-0 flex flex-col` — no min-h-0, no overflow-hidden
- **Desktop (md+):** `md:min-h-0 md:overflow-hidden` — restores both
- **Full proposed:** `flex-1 md:min-h-0 min-w-0 md:overflow-hidden flex flex-col`
- **Reason:** Same chain-removal as above; `overflow-hidden` here would also clip iframe height propagation on mobile.

---

### preview-panel-shell div (line 2442)

- **Current:** `flex flex-col flex-1 min-h-0 overflow-hidden`
- **Mobile:** `flex flex-col flex-1` — no min-h-0, no overflow-hidden
- **Desktop (md+):** `md:min-h-0 md:overflow-hidden`
- **Full proposed:** `flex flex-col flex-1 md:min-h-0 md:overflow-hidden`
- **Reason:** Same chain. `overflow-hidden` and `min-h-0` here clip the preview iframe on mobile.

---

### editor-panel-shell div (line 2469)

- **Current:** `flex flex-col flex-1 min-h-0 overflow-hidden`
- **Full proposed:** `flex flex-col flex-1 md:min-h-0 md:overflow-hidden`
- **Reason:** Same chain. Code & Files tab content needs same treatment for usability.

---

### build-targets-panel-shell div (line 2490)

- **Current:** `flex flex-col flex-1 min-h-0 overflow-hidden p-3`
- **Full proposed:** `flex flex-col flex-1 md:min-h-0 md:overflow-hidden p-3`
- **Reason:** Same chain. Build Targets tab should not be clipped on mobile.

---

### WorkspacePreviewPanel fillHeight — panelClassName (lines 4754–4755)

- **Current:** `flex flex-col flex-1 min-h-0 overflow-hidden rounded border border-gray-200 bg-gray-50 p-2`
- **Full proposed:** `flex flex-col flex-1 md:min-h-0 md:overflow-hidden rounded border border-gray-200 bg-gray-50 p-2`
- **Reason:** Same chain continuation. Clipping inside the panel would clip the iframe.

---

### WorkspacePreviewPanel fillHeight — iframeClassName (lines 4757–4758)

- **Current:** `mt-2 w-full flex-1 min-h-0 rounded border border-gray-200 bg-white`
- **Mobile:** adds `min-h-[60dvh]` — gives the iframe a natural content height floor
- **Desktop (md+):** `md:min-h-0` — restores zero floor, fillHeight flex-1 takes over
- **Full proposed:** `mt-2 w-full flex-1 min-h-[60dvh] md:min-h-0 rounded border border-gray-200 bg-white`
- **Reason:** The iframe has no intrinsic content height. Without `min-h-[60dvh]`, the entire Preview section collapses to zero after the chain changes. This is the only new value added to the design (all others are existing classes moved behind responsive prefixes).

---

### WorkspaceEditorPanel fillHeight — panelClassName (lines 4854–4855)

- **Current:** `flex flex-col flex-1 min-h-0 overflow-hidden rounded border border-gray-200 bg-gray-50 p-2`
- **Full proposed:** `flex flex-col flex-1 md:min-h-0 md:overflow-hidden rounded border border-gray-200 bg-gray-50 p-2`
- **Reason:** Code & Files panel chain; same as preview.

---

### WorkspaceEditorPanel fillHeight — layoutClassName (lines 4857–4858)

- **Current:** `mt-2 flex flex-1 min-h-0 gap-2`
- **Full proposed:** `mt-2 flex flex-1 md:min-h-0 gap-2`
- **Reason:** The horizontal layout row for file tree + editor; must not collapse on mobile.

---

### WorkspaceEditorPanel fillHeight — editorPaneClassName (lines 4863–4864)

- **Current:** `flex flex-col flex-1 min-h-0 overflow-hidden rounded border border-gray-200 bg-white p-2`
- **Full proposed:** `flex flex-col flex-1 md:min-h-0 md:overflow-hidden rounded border border-gray-200 bg-white p-2`
- **Reason:** Editor pane container; clipping here prevents textarea from having visible height on mobile.

---

### WorkspaceEditorPanel fillHeight — textareaClassName (lines 4866–4867)

- **Current:** `mt-2 flex-1 min-h-0 w-full resize-none overflow-auto rounded border border-gray-200 bg-gray-50 p-2 font-mono text-[11px] text-gray-800 disabled:bg-gray-100 disabled:text-gray-500`
- **Mobile:** adds `min-h-[50dvh]` — gives the code editor a comfortable minimum height
- **Desktop (md+):** `md:min-h-0` — restores zero floor, fillHeight takes over
- **Full proposed:** `mt-2 flex-1 min-h-[50dvh] md:min-h-0 w-full resize-none overflow-auto rounded border border-gray-200 bg-gray-50 p-2 font-mono text-[11px] text-gray-800 disabled:bg-gray-100 disabled:text-gray-500`
- **Reason:** Same as iframe. The textarea has no intrinsic content height and collapses without a floor.
- **Note:** `50dvh` (not 60dvh) for the editor — slightly smaller than Preview is intentional; the editor's file tree (w-56) takes horizontal space on mobile and the editor area does not need a full 60dvh to be usable.

---

## 13. Exact Implementation File Scope

### REQUIRED SOURCE

```
frontend/components/workspace/workspace-shell.tsx
```

All 14 class changes are in this single file. No other source files are needed.

### TEST ONLY

```
frontend/components/workspace/workspace-shell.test.tsx
```

No other test files. No new test framework. All tests use the existing `node:test` + `renderToStaticMarkup` + `renderWorkspaceShellElementByTestId` pattern already in the file.

---

## 14. Regression Tests

### Tests to UPDATE (existing assertions change meaning)

**Test at line 2535:** `'workspace-project-view uses overflow-hidden to prevent page-level scroll'`

This test's purpose changes: overflow-hidden is now desktop-only.

```typescript
test('workspace-project-view uses md:overflow-hidden for desktop clip and no clip on mobile', () => {
  const projectView = renderWorkspaceShellElementByTestId('workspace-project-view', {
    projectFirstUxEnabled: true,
    workspaceView: 'project',
  });
  assert.ok(projectView);
  const className = String(projectView.props.className ?? '');
  // Desktop overflow clipping preserved via responsive prefix
  assert.match(className, /md:overflow-hidden/);
  // Mobile: no bare overflow-hidden (allows content-shell to scroll)
  assert.doesNotMatch(className, /(?<![a-z]:)overflow-hidden/);
  assert.doesNotMatch(className, /overflow-y-auto/);
});
```

---

**Test at line 2546:** `'workspace-project-ai-panel uses 50vh mobile cap and preserves desktop max height behavior'`

This test fully inverts: the cap is gone, replaced with a comfortable floor.

```typescript
test('workspace-project-ai-panel uses 60dvh mobile minimum height and no mobile overflow clip', () => {
  const aiPanel = renderWorkspaceShellElementByTestId('workspace-project-ai-panel', {
    projectFirstUxEnabled: true,
    workspaceView: 'project',
  });
  assert.ok(aiPanel);
  const className = String(aiPanel.props.className ?? '');
  // Mobile comfortable minimum height (replaces max-h cap)
  assert.match(className, /min-h-\[60dvh\]/);
  // Desktop: restores zero floor for flex-controlled height
  assert.match(className, /md:min-h-0/);
  // Desktop: overflow clip preserved for internal chat scroll
  assert.match(className, /md:overflow-hidden/);
  // Verify old cap is fully removed
  assert.doesNotMatch(className, /max-h-\[50vh\]/);
  assert.doesNotMatch(className, /md:max-h-none/);
  // No bare overflow-hidden on mobile
  assert.doesNotMatch(className, /(?<![a-z]:)overflow-hidden/);
});
```

---

**Test at line 2857:** `'tab content wrapper renders with full-height overflow-hidden layout'`

```typescript
test('tab content wrapper uses md:overflow-hidden for desktop clip only', () => {
  const tabContent = renderWorkspaceShellElementByTestId('workspace-tab-content', {
    projectFirstUxEnabled: true,
    workspaceView: 'project',
  });
  assert.ok(tabContent);
  const className = String(tabContent.props.className ?? '');
  // Desktop overflow clip preserved
  assert.match(className, /md:overflow-hidden/);
  // No bare overflow-hidden (mobile must not clip)
  assert.doesNotMatch(className, /(?<![a-z]:)overflow-hidden/);
  assert.doesNotMatch(className, /overflow-y-auto/);
});
```

---

**Test at line 2869 (preview-panel-shell, lines 2881–2886):**

Lines 2885 and 2886 currently assert `min-h-0` and `overflow-hidden` (bare). Both change.

```typescript
// Replace lines 2885–2886:
assert.match(className, /flex-1/);
assert.match(className, /md:min-h-0/);
assert.match(className, /md:overflow-hidden/);
// No bare min-h-0 or overflow-hidden on mobile
assert.doesNotMatch(className, /(?<![a-z]:)min-h-0/);
assert.doesNotMatch(className, /(?<![a-z]:)overflow-hidden/);
```

---

**Test at line 2952:** `'workspace-project-content-panel includes min-h-0 to prevent mobile clipping'`

The content-panel now uses `md:min-h-0` (desktop only). Test title and assertion update.

```typescript
test('workspace-project-content-panel includes md:min-h-0 to preserve desktop flex height', () => {
  const html = renderWorkspaceShell({
    projectFirstUxEnabled: true,
    workspaceView: 'project',
  });
  const contentPanelTestIdIndex = html.indexOf('data-testid="workspace-project-content-panel"');
  assert.notEqual(contentPanelTestIdIndex, -1);
  const contentPanelTagStart = html.lastIndexOf('<main', contentPanelTestIdIndex);
  const contentPanelTagEnd = html.indexOf('>', contentPanelTestIdIndex);
  const contentPanelOpeningTag = html.slice(contentPanelTagStart, contentPanelTagEnd);
  // Desktop min-h-0 preserved via responsive prefix
  assert.match(contentPanelOpeningTag, /md:min-h-0/);
  // No bare min-h-0 on mobile
  assert.doesNotMatch(contentPanelOpeningTag, /(?<![a-z]:)min-h-0/);
});
```

---

### Tests to ADD (new behavioral contract)

```typescript
test('mobile workspace layout: workspace-content-shell is the scroll owner', () => {
  const shell = renderWorkspaceShellElementByTestId('workspace-content-shell', {
    projectFirstUxEnabled: true,
    workspaceView: 'project',
  });
  assert.ok(shell);
  const className = String(shell.props.className ?? '');
  // Content-shell retains overflow-y-auto enabling scroll when project-view exceeds height
  assert.match(className, /overflow-y-auto/);
});

test('mobile workspace layout: project view has no mobile clip or min-h floor', () => {
  const projectView = renderWorkspaceShellElementByTestId('workspace-project-view', {
    projectFirstUxEnabled: true,
    workspaceView: 'project',
  });
  assert.ok(projectView);
  const className = String(projectView.props.className ?? '');
  assert.doesNotMatch(className, /(?<![a-z]:)min-h-0/);
  assert.doesNotMatch(className, /(?<![a-z]:)overflow-hidden/);
});

test('mobile workspace layout: inner layout section has no mobile min-h floor', () => {
  const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
  // Inner section that wraps AI + content panels uses md:min-h-0 not bare min-h-0
  assert.match(shellSource, /flex flex-1 md:min-h-0 flex-col md:flex-row/);
});

test('mobile workspace layout: AI panel has comfortable minimum height and no cap', () => {
  const aiPanel = renderWorkspaceShellElementByTestId('workspace-project-ai-panel', {
    projectFirstUxEnabled: true,
    workspaceView: 'project',
  });
  assert.ok(aiPanel);
  const className = String(aiPanel.props.className ?? '');
  assert.match(className, /min-h-\[60dvh\]/);
  assert.doesNotMatch(className, /max-h-\[50vh\]/);
});

test('mobile workspace layout: preview iframe has substantial mobile minimum height', () => {
  const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
  // fillHeight iframe has 60dvh floor on mobile
  assert.match(shellSource, /min-h-\[60dvh\] md:min-h-0/);
});

test('mobile workspace layout: desktop preview iframe sizing unchanged via md:min-h-0', () => {
  const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
  // Desktop restores to zero floor, flex-1 fillHeight controls sizing
  assert.match(shellSource, /flex-1 min-h-\[60dvh\] md:min-h-0 rounded border border-gray-200 bg-white/);
});

test('mobile workspace layout: desktop flex safety preserved in tab-content', () => {
  const tabContent = renderWorkspaceShellElementByTestId('workspace-tab-content', {
    projectFirstUxEnabled: true,
    workspaceView: 'project',
  });
  assert.ok(tabContent);
  const className = String(tabContent.props.className ?? '');
  assert.match(className, /md:min-h-0/);
  assert.match(className, /md:overflow-hidden/);
});

test('mobile workspace layout: Ask|Build composer is present in project view', () => {
  const html = renderWorkspaceShell({
    projectFirstUxEnabled: true,
    workspaceView: 'project',
    selectedProjectId: 'project-1',
  });
  // Composer section present (Ask|Build toggle)
  assert.match(html, /workspace-chat-submit/);
});
```

---

## 15. Manual Validation Plan — 390px

After implementation, validate at 390px device width (iPhone or DevTools mobile simulation).

**A. Chat / AI section (top of page):**
1. The AI section occupies a comfortable height (~60% of screen). The prompt textarea, Send button, Ask/Build toggle, model selector, and orchestration checkbox are all visible and tappable without scrolling within the section.
2. If chat messages exist, the chat thread scrolls internally within the AI panel. The AI section does not grow off-screen before reaching Preview.
3. The project header (back button, project name, collapse toggle) is visible above the AI panel.

**B. Scroll from AI to Preview:**
4. Scrolling downward with finger/touch on the workspace content area (between mobile header bar and footer) moves content down naturally.
5. The AI section scrolls up and out of view.
6. Preview section comes into view below.

**C. Preview section:**
7. The Preview panel is tall (~60% of screen minimum). It does not feel like a small sliver.
8. Preview iframe content is visible and usable.
9. Touch interactions within the preview iframe (scrolling within the preview app) work independently without conflicting with workspace scroll.

**D. Controls accessibility:**
10. Workspace tab bar (Preview / Code & Files / Build Targets / Database) is visible and tappable at the top of the content section.
11. Preview controls (Live Preview label, Refresh, Start Preview button where applicable) are visible above the iframe.
12. Switching to Code & Files tab shows a usable editor and file tree.

**E. Scroll return:**
13. Scrolling upward naturally returns to the AI section.
14. No scroll fighting between the AI chat thread internal scroll and the workspace-content-shell scroll.
15. No horizontal overflow or clipping at 390px.

**F. Desktop (md+ ≥ 768px):**
16. The workspace remains in the existing fixed two-column layout (AI sidebar left, Preview/editor right).
17. AI panel has its 384px (`w-96`) width and no `min-h-[60dvh]` in effect (overridden by `md:min-h-0`).
18. Preview panel fills the right column at full height (fillHeight behavior preserved).
19. Chat thread and preview/editor scroll independently within their panels.
20. No visual change from current desktop behavior.

---

## 16. Scope Classification

**NORMAL BOUNDED UX**

Justification:
- Single source file (`workspace-shell.tsx`): 14 class changes, all following the identical pattern of adding responsive `md:` prefixes to existing classes, plus two new `min-h-[60dvh]` / `min-h-[50dvh]` values.
- Single test file (`workspace-shell.test.tsx`): 5 updated tests + 8 new tests.
- No new components, no routing changes, no architecture changes, no new dependencies, no backend, no API Gateway.
- No new sticky positioning, no new layout structure.
- All desktop behavior is preserved via responsive override — the implementation is additive on mobile.

Would escalate to RISKY if source inspection revealed the AI panel or preview panel were defined in separate component files requiring multi-file coordination. Inspection confirms all affected code is inline in `workspace-shell.tsx`. Scope remains NORMAL BOUNDED UX.

---

## 17. Key Risks

**R1: Tailwind `dvh` unit support**  
`dvh` requires Tailwind 3.4.x (confirmed: project uses 3.4.1) and browser support (Chrome 108+, Safari 15.4+, Firefox 101+). All are 2025-standard browsers. Risk: LOW.

**R2: `md:min-h-0` Tailwind CSS ordering**  
`md:min-h-0` must override `min-h-[60dvh]` on desktop. In Tailwind, responsive variants are generated after base utilities in the CSS output, so `md:min-h-0` takes precedence at ≥768px. This is the standard Tailwind override mechanism used throughout this codebase. Risk: LOW.

**R3: Non-project views (home, projects, templates)**  
Removing `overflow-hidden` from workspace-project-view only affects the `resolvedWorkspaceView === 'project'` branch. Home, projects, and templates views are rendered at the workspace-content-shell level and are unaffected. Risk: NONE.

**R4: AI panel border in stacked layout**  
Changing `border-r` to `border-b md:border-b-0 md:border-r` is a visual-only change. The border separates the AI section from the Preview section in stacked layout. If the visual is not desired, `border-b` can be removed (keeping `md:border-r` only). Risk: LOW (visual only).

**R5: Editor panel mobile layout (w-56 file tree + editor at 390px)**  
The editor panel in `fillHeight` mode uses a horizontal row layout with a 224px file tree pane. At 390px, this leaves ~166px for the editor pane. This is cramped but is the existing design. The task does not include redesigning the editor's mobile layout — `min-h-[50dvh]` on the textarea gives it sufficient vertical space. Risk: LOW (known limitation, not regression).

**R6: Scroll interaction on chat-panel-shell**  
The chat-panel-shell retains its `flex-1 min-h-0 overflow-hidden` classes on mobile. With the AI aside having `min-h-[60dvh]`, the chat-panel-shell has a definite parent height and these classes work correctly. If there is a pathological case where the chat panel content overflows `60dvh`, `overflow-hidden` clips it. This is intentional — the AI section has a floor, not a ceiling. Risk: LOW.

**R7: `overflow-hidden` regex in new tests**  
The regex `(?<![a-z]:)overflow-hidden` uses a negative lookbehind to match bare `overflow-hidden` (not `md:overflow-hidden` or similar). This is a correct JavaScript/Node.js regex. Risk: LOW.

---

## 18. Confirmation of No Implementation/Runtime Changes

This document is design-only. The following are confirmed unchanged:

- No source files edited
- No test files edited
- No git operations performed
- No staging or runtime activated
- `GLOBAL_EXECUTION_ENABLED=false` throughout
- Phase G has not been entered
- PRIVATE-BETA-INVITE-01 untouched
- 03C/03D untouched
- No backend changes (API Gateway, AI Service, Container Manager)
- No dependencies added
- No routing changes
- No new navigation architecture

---

## 19. GLOBAL_EXECUTION_ENABLED State

```
GLOBAL_EXECUTION_ENABLED=false
```

Remains false. This document does not activate or modify any execution gate.

---

## 20. Final Verdict

**READY FOR BOUNDED IMPLEMENTATION**

The source inspection is complete. The change mechanism (workspace-content-shell as scroll owner, min-h-0 removal chain, AI panel min-h floor, preview iframe min-h floor) is fully traced and confirmed to produce the desired mobile scroll behavior without affecting desktop layout.

All changes are confined to `workspace-shell.tsx` (14 class changes) and `workspace-shell.test.tsx` (5 updated + 8 new tests).

---

## Exact Next Step

**BUILDER-INTENT-01 Step 4A-M2 — Mobile Stacked Workspace Implementation**

Inputs required for M2:
- This design document
- Active task: BUILDER-INTENT-01 Step 4A (confirm task registration before implementation)
- Source: `frontend/components/workspace/workspace-shell.tsx`
- Test: `frontend/components/workspace/workspace-shell.test.tsx`
- Validation: `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit && npm test`

Implementation applies exactly the 14 class changes specified in Section 12 and the test changes specified in Section 14.

---

## Quick Reference: Full Change Table

| Element | Current class(es) | Proposed change | Line |
|---|---|---|---|
| workspace-project-view | `flex-1 min-h-0 flex-col overflow-hidden` | `flex-1 md:min-h-0 flex-col md:overflow-hidden` | 2392 |
| Inner layout div | `flex-1 min-h-0 flex-col md:flex-row` | `flex-1 md:min-h-0 flex-col md:flex-row` | 2417 |
| AI panel aside | `w-full max-h-[50vh] md:w-96 md:max-h-none border-r ... overflow-hidden` | `w-full min-h-[60dvh] md:min-h-0 md:w-96 border-b md:border-b-0 md:border-r ... md:overflow-hidden` | 2420 |
| content-panel main | `flex-1 min-h-0 min-w-0 flex [...]` | `flex-1 md:min-h-0 min-w-0 flex [...]` | 2427 |
| workspace-tab-content | `flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col` | `flex-1 md:min-h-0 min-w-0 md:overflow-hidden flex flex-col` | 2439 |
| preview-panel-shell | `flex flex-col flex-1 min-h-0 overflow-hidden` | `flex flex-col flex-1 md:min-h-0 md:overflow-hidden` | 2442 |
| editor-panel-shell | `flex flex-col flex-1 min-h-0 overflow-hidden` | `flex flex-col flex-1 md:min-h-0 md:overflow-hidden` | 2469 |
| build-targets-panel-shell | `flex flex-col flex-1 min-h-0 overflow-hidden p-3` | `flex flex-col flex-1 md:min-h-0 md:overflow-hidden p-3` | 2490 |
| Preview panelClassName (fillHeight) | `... flex-1 min-h-0 overflow-hidden ...` | `... flex-1 md:min-h-0 md:overflow-hidden ...` | 4755 |
| Preview iframeClassName (fillHeight) | `... flex-1 min-h-0 ...` | `... flex-1 min-h-[60dvh] md:min-h-0 ...` | 4758 |
| Editor panelClassName (fillHeight) | `... flex-1 min-h-0 overflow-hidden ...` | `... flex-1 md:min-h-0 md:overflow-hidden ...` | 4855 |
| Editor layoutClassName (fillHeight) | `mt-2 flex flex-1 min-h-0 gap-2` | `mt-2 flex flex-1 md:min-h-0 gap-2` | 4858 |
| Editor editorPaneClassName (fillHeight) | `... flex-1 min-h-0 overflow-hidden ...` | `... flex-1 md:min-h-0 md:overflow-hidden ...` | 4864 |
| Editor textareaClassName (fillHeight) | `... flex-1 min-h-0 w-full ...` | `... flex-1 min-h-[50dvh] md:min-h-0 w-full ...` | 4867 |
