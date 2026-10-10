# Visual comprehension review

This is designer self-review of the actual exported scenes, not a study with external participants. Three-second glance, squint, no-text and thumbnail checks are design heuristics; no scientific comprehension rate or performance improvement is claimed.

Evidence: `review/slide-overview-en.png`, `review/slide-overview-ar.png`, `review/no-text-overview-en.png`, `review/squint-overview-en.png`, individual full-size slides and representative native PowerPoint renders.

| Scene | First-glance subject / event | No-text and squint observation | Executive takeaway / remaining reading |
|---|---|---|---|
| 1 | Call and existing service record inside one workspace. | Handset/waveform at left, contact above, selected row adjacent to source note. One joined surface dominates. Note is the strongest tinted region. | Employee sees existing context with the call. Exact identity and pending status require short labels. |
| 2 | Active call beside a separate number-search window. | Search field, pointer, copy icon and number transfer trace remain recognizable when labels disappear. Window offset makes switching visible. | Existing information must be manually retrieved. This is the reported workflow, not measured observation. |
| 3 | The same anchored call, with context revealed beside it. | Number outline leads into the selected record; selection connection terminates in ticket detail. Source logo persists during lookup. | Proposed authorized lookup makes context visible. Animation explains order; the complete static frame still shows the result. |
| 4 | A selected ticket and its large latest note, with a human conversation cue below. | The note dominates; handset and speech icon establish the ongoing conversation. Without text, exact case status cannot be inferred and is not expected to be. | Continue from a recorded update. Response is illustrative human speech, not AI output or a ticket mutation. |
| 5 | Matched current/proposed workspaces. | Left has a secondary search window and cursor; right has a single continuous call/ticket surface with a visible note. The structural difference survives text removal. | Fewer illustrated manual retrieval actions. No elapsed-time claim. |
| 6 | An enlarged employee view with annotations at specific features. | Contact, ticket and source note form one vertical reading sequence; call remains at the top. Benefit wording is in marginal annotations, not equal-weight boxes. | Expected benefits trace directly to the UI. Precise business interpretation needs three short annotations and pilot validation. |
| 7 | Contract document → configuration inspection → test call. | Document silhouette, configuration icon and call/ticket window are distinct even without headings. The exact contractual scope necessarily requires the quoted words. | Review the existing pop-up before choosing the smallest suitable change and testing authorized calls. |

## Changes made after visual review

- Split the Arabic associated-record label from the LTR masked number after seeing mixed-direction display reversal. Native and browser rendering were reviewed after the correction.
- Reduced the selected ticket's background emphasis, leaving the latest note as the primary highlighted content. Added a short selection-to-detail cue, physically attached to the relevant row.
- Kept the Zoho source identity visible before context enters, so the lookup sequence has a visible source.
- Corrected step-through behavior so the first click reveals the first event, rather than skipping directly to the second event.

## Static / animated parity

All seven browser-exported PDF pages are populated in both languages. Native PPTX was opened/rendered with LibreOffice, yielding seven populated pages per language. The static view shows full context and the manual-search action on the current-workflow slide. Motion adds timing and attention cues; it is not the only carrier of meaning.

There are 198 timed native entrance effects per language (many shapes belong to one semantic event), preserved after a LibreOffice PPTX round trip. This does not establish Microsoft PowerPoint, Keynote or Google Slides playback behavior. PowerPoint uses timed fades; no native Morph is claimed. Browser motion and MP4 are the directly rendered animation versions.

## Browser checks actually run

- Seven scenes × two languages × six widths (320, 390, 768, 1024, 1366, 1440): no horizontal overflow.
- All desktop text boxes checked against their actual scroll dimensions: no clipping.
- Call-first ordering, later context/note disclosure, pause, replay, step-through and full reveal checked.
- Reduced-motion initial full state checked; no external font/image requests or browser errors.
- Arabic keyboard direction, evidence dialog, matching line/arrow colors and PDF visibility checked.

## Limits

No Concrete employee, manager or external test participant has evaluated comprehension in this session. No live system access, vendor capability verification or production acceptance test occurred. The requested research pages were blocked; accessible primary alternatives and the unresolved source coverage are documented separately. Scenes 1 and 3 intentionally reuse the same geometry because the user requested continuity. Other slides vary the framing and scale according to their purpose.
