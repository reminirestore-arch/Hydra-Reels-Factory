# Overlay Editor Architecture (Fabric.js)

This editor represents each overlay as a **block**: a background rectangle and a text object that
share a numeric `blockId` stored in `object.data`. The `blockId` is serialized in Fabric JSON, so
loading a saved state can rebuild every overlay pair without ambiguity.

## Key Concepts

- **blockId pairing**
  - Both the background and text objects carry `data.role` (`overlay-background` / `overlay-text`)
    and a shared `data.blockId` value.
  - When loading legacy JSON without `blockId`, the editor assigns sequential IDs and pairs objects
    by index.
- **Link offsets (data.link)**
  - Each text stores offsets and rotation delta relative to its background in `data.link`.
  - Moving the background applies these offsets to keep the text aligned.
  - Moving the text clamps it inside its background and recalculates the link data.
- **Serialization**
  - The editor saves Fabric JSON with custom `data` fields, keeping overlay identity and offsets.
  - The video frame background image is *not* serialized; it is reloaded from the file path.
- **Selection + UI**
  - UI controls act on the currently selected block. When selection changes, the editor reads the
    selected block’s properties and updates the panel sliders and inputs to match.

## Flow Summary

1. **Canvas init** → create Fabric canvas, load video frame, then load JSON overlays (if present).
2. **Sync overlays** → ensure roles, assign block IDs, build overlay map, reattach links.
3. **Editing** → per-block move/scale/align logic updates link offsets and clamps text bounds.
4. **Save** → export overlay PNG (temporarily removing the frame), serialize JSON, restore frame.

This structure enables multiple overlays, reliable save/load, and background image stability.
