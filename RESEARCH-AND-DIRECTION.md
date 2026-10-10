# Research and visual direction

Research performed before storyboard and slide generation. Access checked 11 October 2026. This is a documented, partially constrained research pass, not a claim that every requested reference was read.

## Access and evidence

All 12 supplied URLs were attempted through the environment's configured HTTPS proxy and failed with `Tunnel connection failed: 403 Forbidden`. Exact URLs and outcomes are in `research/access.json`. NN/g hierarchy, proximity, preattentive processing and squint-test pages, Cambridge's signaling chapter, Fluent's website, Zendesk Workspace, Intercom Helpdesk, Zoho's two pages and the Genesys glossary were **not read**. Their claims, screenshots and current product capabilities have not been verified. The requested domains were added to a saved configuration draft; publication is required to activate them. No network restriction was bypassed.

Primary alternatives actually read:

1. [W3C COGA user research: visual perception](https://github.com/w3c/coga/blob/f15bbd18d18f2acc32b94fe9b54f4519e2781ec5/user-research/index.html) identifies visual grouping by proximity, similarity, continuity and common motion. This is the task force's research synthesis, not a new experimental study.
2. [W3C: clear page structure](https://github.com/w3c/coga/blob/f15bbd18d18f2acc32b94fe9b54f4519e2781ec5/design-guide/o2p03-page-structure.html) explicitly illustrates common regions, borders and shading; recommends recognition and retrieval rather than reliance on memory; warns that too many icons also add cognitive load.
3. [W3C: avoid memorizing information](https://github.com/w3c/coga/blob/f15bbd18d18f2acc32b94fe9b54f4519e2781ec5/design-guide/o6p05-low-cognition.html) addresses copying digits and recalling information across steps. Applied to the demonstration's attention demands, without diagnosing Concrete staff or estimating performance.
4. [W3C: make important information easy to find](https://github.com/w3c/coga/blob/f15bbd18d18f2acc32b94fe9b54f4519e2781ec5/design-guide/o2p04-page-important.html) and [familiar hierarchy](https://github.com/w3c/coga/blob/f15bbd18d18f2acc32b94fe9b54f4519e2781ec5/design-guide/o1p02-familiar-design.html): familiar structure, visible key information, fewer navigation demands.
5. [IBM Carbon: grid usage](https://github.com/carbon-design-system/carbon-website/blob/5e9cd1da43c32d3d3b991dc947b427f674da61a8/src/pages/elements/2x-grid/usage.mdx) starts with user goals and content hierarchy, maintains geometry across product screens and explicitly cautions against monotonous repetition.
6. [IBM Carbon: spacing](https://github.com/carbon-design-system/carbon-website/blob/5e9cd1da43c32d3d3b991dc947b427f674da61a8/src/pages/elements/spacing/overview.mdx): consistent 2/4/8-based scales communicate relationships and density.
7. [IBM Carbon: motion choreography](https://github.com/carbon-design-system/carbon-website/blob/5e9cd1da43c32d3d3b991dc947b427f674da61a8/src/pages/elements/motion/choreography.mdx) and [motion overview](https://github.com/carbon-design-system/carbon-website/blob/5e9cd1da43c32d3d3b991dc947b427f674da61a8/src/pages/elements/motion/overview.mdx): shared elements, semantic/spatial consistency, sequential revelation and finishing on important content. Text and examples' captions were read; remotely embedded Kaltura videos were not played. Website timing guidance is not evidence of measured learning improvement.
8. [Microsoft Fluent motion introduction](https://github.com/microsoft/fluentui/blob/6e52576d457f0ca13225ea2712e0db7bd1c27e28/packages/react-components/react-motion/stories/src/Introduction/index.mdx) and [reduced-motion example](https://github.com/microsoft/fluentui/blob/6e52576d457f0ca13225ea2712e0db7bd1c27e28/packages/react-components/react-motion/stories/src/CreatePresenceComponent/CreatePresenceComponentReducedMotion.stories.md): separates motion from presence and supports a different reduced-motion experience.
9. [Chatwoot's own product screenshot](https://github.com/chatwoot/chatwoot/blob/develop/.github/screenshots/dashboard.png) was downloaded and visually inspected, alongside its [README](https://github.com/chatwoot/chatwoot/blob/develop/README.md). Observed: adjacent conversation and contact regions, a persistent customer header, selected conversation row, subdued separators, differentiated internal notes, collapsible previous-conversation content. Its screenshot is a conceptual reference only and is not copied into the deck. No Chatwoot installation at Concrete is implied. Contact information from that screenshot is not reused.
10. Existing GRINDCTRL `apps/web-next/DESIGN.md`: warm cream/charcoal, sparing orange-gold accent, weight contrast rather than large type, no gradient text or nested-card visual language. Actual GRINDCTRL logo reused. User's explicit Manrope / IBM Plex Sans Arabic requirement takes priority over the app's Geist/Inter typography.

## Psychology → actual decisions

| Principle | Decision in this presentation | Evidence / limitation |
|---|---|---|
| Proximity and common region | Call, associated contact, ticket list and selected note share one window. Status remains adjacent to its own ticket. | W3C structure; no causal performance claim |
| Similarity | Same contact avatar, masked number, T101 and note recur without rewriting. | W3C visual-perception synthesis |
| Continuity | Call panel keeps its location in scenes 2 and 3; lookup travels toward the record area. | W3C + Carbon choreography |
| Hierarchy / visual weight | Large workspace; narrow neutral chrome; one warm selected ticket/note region. No equal-weight benefit tiles. | Carbon hierarchy + W3C key information |
| Preattentive attention | A single contrast cue on the active number/selected record, reinforced by shape and position. Never rely on color alone. | Design hypothesis; requested NN/g source unavailable |
| Cognitive load | One example case, two relevant previous-ticket rows, one latest note. Remove counts, charts, filters and unrelated navigation. | W3C research and patterns |
| Mayer multimedia principles | Use relevant graphics with brief nearby labels (multimedia/contiguity); omit decorative content (coherence); reveal in meaningful chunks (segmenting); cue a single region (signaling). No redundant narration or efficacy claim. | Established principles used as provisional design hypotheses; requested primary chapter could not be read |
| Signaling / spatial contiguity | Note attached to selected ticket; number focus occurs before lookup; annotations sit beside the UI they explain. | Related W3C guidance + Carbon; Mayer source unverified |
| Progressive disclosure | HTML sequences call → number → authorized lookup → contact/history → selected ticket → note. The static artifact shows a complete meaningful state. | Carbon sequence guidance; design decision |
| Recognition rather than recall | Familiar handset, search field, pointer, ticket row, status and note. Same case across scenes. | W3C patterns |
| Contrast / focal point | Warm accent only where the eye should land; dark charcoal type on warm white surfaces; no dark UI cards. | W3C + brand direction |
| Squint / thumbnail | Reduce, blur and hide text to critique the actual composition. | User-requested heuristics; NN/g video unavailable; not validated comprehension thresholds |

## Motion direction

The main explanatory sequence is scene 3, with six readable beats, separated by approximately 1.4 seconds. Holds are presentation pacing, not service latency. The call remains anchored. The masked-number cue draws the eye, a lookup signal points from that area to existing Desk context, then history and the latest source note reveal in place. Fade is used for information appearing, not for arbitrary decoration. No spinning logo or unrelated moving UI.

HTML supports pause, replay, next event and full reveal; reduced-motion opens in the final state. Browser motion uses eased state transitions and spatially anchored reveals. Native PowerPoint uses timed fades, not a claimed Morph transition. True PowerPoint Morph is not needed to explain the state change and will not be claimed. Static exports show the final state. The before/after slide provides a direct simultaneous comparison.

## Internal art direction

A product demonstration, not an architecture pitch. Design a focused, independent proposed employee workspace, with believable application chrome and readable data. Cream #F8F7F4, white surfaces, charcoal #262626, warm-gray borders #E6E3DE; warm pale gold highlights using GRINDCTRL's orange-gold direction. Use thin lines and generous separation inside a single surface. Icons denote actual actions or objects, not decorations.

1280×720 shared source maps to 16:9 native PowerPoint. Outer margin 48 px, dominant scene about 1184×456 px, 8 px spacing rhythm. Heading 42 px / 31.5 pt; primary UI 24–28 px / 18–21 pt; small chrome 18 px / 13.5 pt; disclosure footer 15–16 px. No paragraphs on the main deck. Important source note remains at least 24 px. Full Arabic layout mirrors the spatial reading direction; phone numbers and IDs retain LTR shaping.

## Accuracy contract

Reported gap and manual phone lookup are user statements, not independently tested findings. November 2023 contract page 4 includes “CRM URL pop up integration”; inspect it before proposing infrastructure. Names, numbers, tickets, notes and dialogue are explicitly fictional. A phone association does not verify identity. Only read context; no refund, status mutation or unsupported CRM operation. Pilot benefits are expectations. New collaboration, no installed GRINDCTRL implementation, no live integration or generative-AI dependency.

## Research boundary

The accessible sources justify a concrete design direction. Requested publisher/vendor-page analysis remains incomplete because all supplied destinations were blocked. Do not label this as a fully completed literature review or vendor capability verification. No external user study has been performed.
