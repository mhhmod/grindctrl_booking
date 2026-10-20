# Part 02 — UI fidelity and the later screenshot pass

**Concrete’s actual Genesys and Zoho Desk interfaces were not inspected.** No authorized tenant captures were available. Every visible UI is an illustrative proposed experience with fictional records, labeled throughout the film. No native embedded sidebar is promised.

The approved Part 01 MP4 was visually inspected at 6, 38, 61 and 122 seconds, and its available motion/player/PowerPoint source was read. Part 02 retains the supplied GRINDCTRL mark, Genesys/Zoho identifiers, Manrope, IBM Plex Sans Arabic, warm #F8F7F4 background, white surfaces, #262626 text, thin warm-gray borders and restrained amber accents. It adds detailed ticket fields, safe selection and explicit error states. All frames remain light.

Official vendor UI documentation was attempted; the Genesys help/product pages were blocked and the Zoho help pages rendered empty shells. The accessible official Genesys SDK README verifies integration mechanisms in principle, not the tenant’s visual layout. Thus this production uses the reported workflow, contract scope, actual narration and established support-interface grouping; it does not claim pixel fidelity to current vendor-native or Concrete screens.

## Prepared replacement surfaces

`part02-ui-fidelity-manifest.json` is disabled, with empty capture states. `source/story.json` provides scene-specific replacement rectangles and normalized anchors for:

- `genesys.call`: the persistent call surface, caller number and active-call state.
- `desk.context`: the contact/history, detailed ticket, candidate selector and distinct fallback states.
- `comparison.current` / `comparison.proposed`: the pilot comparison surfaces.

Coordinates are based on the 1280×720 authoring canvas; the film is rendered at 1920×1080. Geometry is scene-specific. For example, the closeup ticket scene locates the status field separately from the latest note. Approved captures must use remeasured anchors; current anchors are not measurements of Concrete screens.

The player accepts multiple screenshot states per scene, indexed by actual audio cue or absolute time, and reconstructs the correct state after seeking. Replacements are accepted only with explicit `approved: true`, `anonymized: true` and nonempty states. An empty or unapproved manifest has no visual effect. Build HTML again after editing the manifest. The hook is tested with a synthetic image fixture, not a client screenshot.

## A later authorized pass

1. Obtain authorized, anonymized captures of the actual call workspace, existing screen-pop target, manual phone search, contact history, T101-equivalent ticket fields, multiple-match handling and available error states. Keep identifiers and sensitive information masked.
2. Confirm the actual supported surface: existing URL pop-up/tab, script, application surface or other verified mechanism. Adapt the composition to it rather than forcing the concept into a sidebar.
3. Confirm which fields/notes the relevant employee may see, the phone normalization/search rules, shared-number verification and the no-match/unavailable procedures. Do not turn an unseen private note into an assumed entitlement.
4. Map those captures and anchors to the existing eight scenes and measured narration cues. Synthetic records remain the default for public footage.
5. Re-render and repeat bounds, timing, fallback, privacy and source-audio checks.

## Format fidelity

HTML and MP4 provide the synchronized animation. English and Arabic visual versions use the same final Arabic recording. PDF and editable PowerPoint are **static scene references**: eight principal scenes plus two complementary fallback/selection states. PowerPoint contains native text/shapes and the unchanged original MP3, but does not reproduce the full HTML choreography or seeking behavior. Its static layout was opened/rendered with LibreOffice; Microsoft PowerPoint audiovisual playback was not tested. Bundled fonts should be installed before editing.
