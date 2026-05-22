# I18N-SHELL-01 Checkpoint — Wire Visual Edit UI i18n Keys

**Status:** COMPLETE and LOCKED
**Task ID:** I18N-SHELL-01
**Family:** I18N
**Completed:** 2026-05-22
**Checkpoint doc:** `docs/I18N-SHELL-01-CHECKPOINT.md`
**Depends on:** UX-IA-17 (COMPLETE and LOCKED), AUTH-MODULE-03 (COMPLETE and LOCKED)

---

## Objective

Remove hardcoded English user-facing strings from the visual-edit file-action UI introduced around UX-IA-16/17, and wire them into the existing workspace-shell locale-switch pattern across all three supported locales (en, zh-TW, zh-CN).

---

## Exact Files Changed

### Production source files
- `frontend/components/workspace/workspace-shell.tsx`
- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`

### Test files
- `frontend/components/workspace/workspace-shell.test.tsx`

---

## Implementation Detail

### Helper added — `workspace-shell.tsx`

Added `getAiMessages(locale)` at line ~110, following the identical locale-switch pattern used by `getTabMessages`, `getProjectPanelMessages`, and `getCommonMessages`:

```ts
function getAiMessages(locale: string): typeof enMessages.ai {
  if (locale === 'zh-TW') return zhTwMessages.ai;
  if (locale === 'zh-CN') return zhCnMessages.ai;
  return enMessages.ai;
}
```

Added `aiMessages` memo in `WorkspaceShell`:

```ts
const aiMessages = React.useMemo(() => getAiMessages(locale), [locale]);
```

Passed `aiMessages` and `commonMessages` as props into `WorkspaceChatPanel`, which forwards them to `WorkspaceAssistantFileActionSummary`.

### Hardcoded strings replaced

| Old hardcoded string | Replaced with |
|---|---|
| `File Action Results` | `{props.aiMessages.fileActionResults}` |
| `Source: Visual Edit mode selection.` | `{props.aiMessages.visualEditAttribution}` |
| `Loading diff preview...` | `{props.aiMessages.diffPreviewLoading}` |
| `Diff preview unavailable for one or more files. You can still apply or cancel.` | `{props.aiMessages.diffPreviewUnavailable}` |
| `Undo / Revert` | `{props.aiMessages.undoRevert}` |
| `Apply` (confirm button) | `{props.aiMessages.apply}` |
| `Cancel` (cancel button) | `{props.commonMessages.cancel}` |

`ai.apply` and `common.cancel` were pre-existing keys — not newly added.

Visual layout, classNames, and all `data-testid` values preserved unchanged.

---

## Keys Added Per Locale File

5 new keys added under the `ai` namespace in all three locale files:

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `fileActionResults` | `"File Action Results"` | `"檔案操作結果"` | `"文件操作结果"` |
| `visualEditAttribution` | `"Source: Visual Edit mode selection."` | `"來源：Visual Edit 模式選取。"` | `"来源：Visual Edit 模式选择。"` |
| `diffPreviewLoading` | `"Loading diff preview..."` | `"正在載入差異預覽..."` | `"正在加载差异预览..."` |
| `diffPreviewUnavailable` | `"Diff preview unavailable for one or more files. You can still apply or cancel."` | `"一或多個檔案無法提供差異預覽。你仍可套用或取消。"` | `"一个或多个文件暂无法提供差异预览。你仍可应用或取消。"` |
| `undoRevert` | `"Undo / Revert"` | `"還原 / 回退"` | `"撤销 / 回退"` |

---

## Tests Added

In `frontend/components/workspace/workspace-shell.test.tsx`, added describe block `workspace visual edit i18n wiring — I18N-SHELL-01` with 4 source-assertion tests:

1. **`getAiMessages` helper exists** — verifies function signature and all three locale branches.
2. **Required `ai.*` keys exist in all 3 locale files** — reads `en.json`, `zh-TW.json`, `zh-CN.json` and asserts all 6 required `ai.*` keys and `common.cancel` are present and non-empty strings.
3. **Hardcoded English visual-edit strings removed** — `doesNotMatch` assertions confirm none of the 5 target strings exist verbatim in `workspace-shell.tsx`.
4. **Apply/Cancel wired through message values** — `match` assertions confirm `{props.aiMessages.apply}` and `{props.commonMessages.cancel}` are present in source.

---

## Validation Results

All run from `C:\Users\knlee\aiSandBox2026B\frontend`:

| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 447 tests, 0 failed, 0 skipped |
| `ReadLints` on touched files | PASS — no linter errors |
| `npm run build` | FAILED — environmental only (see caveat below) |

### Known Environmental Caveat — Google Fonts TLS

`npm run build` fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` when fetching `Inter` from Google Fonts via `next/font`. This is a local TLS/certificate environment issue, not a code failure. The same failure was present before this slice and is unrelated to i18n changes.

`frontend/tsconfig.tsbuildinfo` was restored after the build attempt:

```powershell
git -C "C:\Users\knlee\aiSandBox2026B" restore -- frontend/tsconfig.tsbuildinfo
```

---

## Non-Goals Confirmed

- No `page.tsx` changes — confirmed.
- No AUTH-MODULE chat message cleanup — confirmed.
- No checkpoint description translation — confirmed.
- No broad workspace-shell i18n migration — confirmed. Only the 7 listed visual-edit strings were targeted.
- No backend changes — confirmed.
- No routing changes — confirmed.
- No new dependencies — confirmed.
- No UI redesign — confirmed.
- No TASK-73C-1 changes — confirmed.

---

## Invariants Preserved

- Existing `data-testid` values unchanged.
- Visual layout and classNames unchanged.
- Existing test IDs and test bodies for prior tasks unchanged.
- Locale-switch helper pattern followed exactly as established by prior tasks.
- No hardcoded English user-facing strings remain for the targeted visual-edit file-action UI.

---

## Next Recommended Task

The I18N family has additional hardcoded English strings remaining in `workspace-shell.tsx` and `page.tsx` (identified in the read-only audit that preceded this slice). Register and implement subsequent I18N cleanup slices per the same pattern, targeting the next highest-impact group of hardcoded strings.
