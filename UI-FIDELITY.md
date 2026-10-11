# Later Concrete UI-fidelity pass

**Current status: conceptual UI. No verified Concrete screenshots are included.** The presentation deliberately shows adjacent call and Desk windows. It does not assert that an embedded context panel is supported, or that Concrete's native applications have this exact geometry.

Inspect the existing `CRM URL pop up integration` scope in the November 2023 contract, PDF page 4, and its actual configuration first. Product edition, call-assignment event, target URL, employee permissions, shared-number matching and separate/embedded screen-pop behavior remain unverified. The original voice-over refers to an existing pop-up; the visuals qualify that with “Current operation unverified.” A contract line is not proof that a working pop-up currently reaches Desk history.

## Prepared structure

`ui-fidelity-manifest.json` contains explicit region IDs, placement rectangles and normalized **illustrative** semantic anchors. Framing and narration stay separate from vendor UI.

| Slot | Role |
|---|---|
| `genesys.call` | Employee call window, caller number and call status |
| `desk.search` | Current manual phone lookup and retrieved ticket |
| `desk.context` | Proposed associated contact, existing history and selected note |
| `desk.case` | Exchange-case close-up |
| `comparison.current` / `comparison.proposed` | Matched crops for the before/after comparison |
| `workspace.benefits` | A derived composite crop; not claimed to be one native application screen |
| `workspace.test` | Proposed test-call illustration, to update after technical validation |

The runtime hook `GRINDCTRL.applyFidelity(config)` accepts approved anonymized image states. State entries can be attached to existing cue IDs, preserving the audio clock. It is disabled by default; no screenshot is fabricated as a stand-in for client evidence. The hook supports state replacement and language persistence; it does **not** automatically validate screenshot contents, native behavior or revised highlight positions.

Example structural entry (fill with authorized assets only):

```json
{
  "enabled": true,
  "slots": {
    "desk.context": {
      "approved": true,
      "anonymized": true,
      "states": [
        {"scene_id": "S3", "at_cue": "C15", "data_url": "<approved empty/search state>"},
        {"scene_id": "S3", "at_cue": "C16", "data_url": "<approved associated-record state>"},
        {"scene_id": "S3", "at_cue": "C17", "data_url": "<approved ticket/note state>"}
      ]
    }
  }
}
```

## Pass requirements

- Record authorization reference, capture date, product/edition, employee role and source file in the manifest. Keep customer names, phone numbers, email, notes, IDs and session information anonymized consistently across states.
- Use the actual employee-facing Genesys interaction and Zoho Desk search/contact/ticket views as the top layout reference. Preserve their terminology, relative geometry and controls. GRINDCTRL branding remains presentation framing.
- Distinguish existing native surfaces from proposed additions. A planned lookup result or screen-pop target requires technical validation; do not label an overlay as a working integration.
- Remeasure every number, record, ticket and note anchor against each crop. The current normalized coordinates are templates, not verified native anchors. Revise highlights, masks and reveal regions accordingly.
- Match aspect ratios and text legibility without stretching screenshots. Any combined view must be explicitly a composition of the approved native screens.
- Rebuild HTML, videos, native slides and PDFs together; rerun phrase-state, pause/seek, layout and export-drift checks. Seek between empty, matched and multiple-match states to catch premature information display.
- Review supervisor/manager interfaces and permissions separately if added later. This package assumes only an illustrative employee experience.

The manifest and runtime adapter prepare the next pass; that pass remains unfinished until actual authorized captures and supported behavior are available.
