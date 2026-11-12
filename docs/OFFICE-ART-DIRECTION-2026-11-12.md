# Office art direction: decision record (update)

**Date:** 2026-11-12, later the same day as `docs/OFFICE-VOICE-PRIVACY-DISCUSSION-2026-11-12.md`.
**Source:** Keith's chat with the review window, 2026-11-10 to 2026-11-12, plus the art kit in `C:\Users\knlee\office-art\` (outside the repository: palette, templates, `size-chart.png`, `README.md`, `ai-log.csv`, `pieces.csv`). The control plane looked at the kit; it is not committed.
**Nature:** a control-plane record. It admits nothing, and PRD.md is not edited.

**Supersedes:** two rows of section 1 of `docs/OFFICE-VOICE-PRIVACY-DISCUSSION-2026-11-12.md`.
- **Sizes:** 32x16 is replaced by 64x32.
- **Art:** "Keith draws every final piece himself; AI concepts only" is replaced by the sourcing rule below.

The rest of that record still stands: controls, voice and privacy.

## Decided (Keith)

| Topic | Decision |
|---|---|
| Look | Isometric pixel art with soft shading, in a bright daytime mood and our own art. A reference picture is mood only, and no outside assets are used. |
| Size | Floor tiles are 64x32 pixels, and characters about 64 px tall, shown enlarged. Keith chose this on 2026-11-12 from `size-chart.png`, over 32x16 and 48x24. It replaces the earlier 32x16 plan. The kit's templates are `tile-64x32`, `piece-1x1-64x96`, `piece-2x1-96x112` and `character-64x80`. |
| Palette | v1 (32 colours) is approved. |
| Modern feel | Soft shadows, screen glow and similar effects are added by the program, not painted in. Effects never hide or fake status. |
| Room | One fixed room with 12 desks: 4 system agents and 8 user agents. Extra agents appear in a side list that opens the same panel as a desk. The AI concept room is too cramped; the real room is larger, with wider aisles for walking, and a layout test decides its size. |
| Movement | A working agent is seated and typing only while a real run is going. Idle agents wander (to the water cooler or the break area) and come back. Movement is decoration, and status always comes from server data. Reduced motion turns wandering off. |
| Art sourcing | Characters may be AI-made (PixelLab or similar), then retouched and palette-matched by Keith. Provenance is logged: tool, plan, prompt, date and hand changes. The terms and the receipt are saved. Floors and walls that must tile are hand-made or heavily corrected. Pieces meant for sale need real human work. Keith draws the environment himself in Aseprite. |
| Drawing rules | Characters are drawn in two walking directions, mirrored for the other two. Status must be readable without colour. There is no text in the art. Every piece has a permanent ID and a free or paid tag. |
| Phones | 12 desks are small on a phone, so the scene has zoom and drag, with the side list as the fallback. |
| Later, already registered | A user-built office (OFFICE-BUILD-01). Selling unique pieces (OFFICE-SHOP-01), which needs a piece catalog, per-user ownership with the purchase event id, a purchase route, a server check that users use only owned pieces, and refund handling. `user_entitlements` cannot hold owned items, Stripe is not active, and art licences must allow resale. |

## Open (waits for Keith)

| Item | State |
|---|---|
| Palette v2 | A 48-colour draft is in `office-art\palette\office-palette-v2-draft.*`. It adds 16 colours for the 64x32 detail. Keith approves it before many pieces are drawn. |
| Tool test | Keith runs one character brief on PixelLab and on Retro Diffusion for Aseprite: standing, a 4-frame walk in two directions, and seated typing. He compares size consistency, the same-person look, palette conversion, retouching effort and the licence. PixelLab's terms (updated 2026-10-30) say users own the outputs and commercial use is allowed. Retro Diffusion's licence text is not confirmed. |
| Performance budget | To be confirmed by a prototype on a mid-range phone. Nothing has been measured. The proposal: <ul><li>an art area of up to about 2048x2048 px;</li><li>one sprite sheet of 1 to 2 MB;</li><li>animation capped at 30 frames a second, and paused when the tab is hidden or reduced motion is on;</li><li>the scene loaded only on the office page.</li></ul> |
| PRD wording | GOV-PRD-SYNC-01, in Keith's words. PRD.md line 483 still says a walking-town or moving-character simulation is not the current or next committed product. Earlier records cite it as line 482. It blocks OFFICE-SCENE-01. |
| saturationClass | OPTIONAL for the office tasks, for Keith to confirm. |

## Privacy (no change of status)

Keith wants the privacy work run in the main session. The control plane notes the scope the first step would have. The recommended order is unchanged, and no privacy task is registered until Keith says which.

The read-only data inventory would cover:
- everything stored, and where;
- who can read it, including admin staff;
- how long it is kept;
- what leaves our servers, including which AI providers see prompts;
- whether encryption at rest, backups and workspace snapshots are covered.

These conditions are on ACCESS-READY-01, the gate for users other than Keith.

## Dispositions

| Follow-up | Disposition |
|---|---|
| The art direction decisions | Superseded by OFFICE-SCENE-01; its Decided paragraph is replaced |
| Palette v2 approval, the tool test, the performance prototype | Superseded by OFFICE-SCENE-01: the first two are in its start condition and the third is in its stage-start |
| Art direction in the PRD wording | Superseded by GOV-PRD-SYNC-01 |
| Inventory scope and the privacy order | Superseded by ACCESS-READY-01: an added line, not registered at Keith's instruction |
| OFFICE-PLAYER-01, OFFICE-VOICE-01 | Already registered in 094f53f, not duplicated. OFFICE-PLAYER-01's art note is corrected to the new sourcing rule |
| OFFICE-BUILD-01, OFFICE-SHOP-01 | Kept as registered in 78f23d2 |

FOLLOWUPS: 0 registered / 6 superseded (art direction, palette v2, tool test and performance prototype into OFFICE-SCENE-01; art direction wording into GOV-PRD-SYNC-01; inventory scope into ACCESS-READY-01) / 0 dropped / 0 undisposed.

## Update (Keith, later on 2026-11-12)

- **Palette v2 approved:** the 48-colour palette (`office-art\palette\office-palette-v2-draft`) is approved and is now the drawing palette.
- **PixelLab makes the characters:** the two-tool test is dropped, and Retro Diffusion is not used.
- **On the purchase day,** Keith saves PixelLab's terms and the receipt. He retouches and palette-matches each character, and logs provenance.
- **Still open:** a first character at about 64 px is made in PixelLab as a test before the rest, then the first test set.

These replace the "Palette v2" and "Tool test" rows of the Open table above. OFFICE-SCENE-01 and plan rows 21 and 80a are updated in the same record.
