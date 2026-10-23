# Production stack decision — Premium V2

## Selected stack

Remotion 4.0.538 + React 19.3.1 + TypeScript 5.9.3. Custom HTML/CSS React interface components, small hand-adjusted SVG icons, deterministic frame-based interpolation/springs, Remotion Studio/Player, and Remotion's actual renderer. FFmpeg/FFprobe finish and inspect H.264/AAC. No old SVG page player or JPEG state-key capture engine is used.

Every requested output frame is evaluated at its exact 0–4499 frame index. No UI-state key permits previously captured JPEGs to substitute for later frames. Stillness is an editorial state, not a capture-cache optimisation. The new code separates tokens, components, interaction primitives, film-specific scenes, audio timelines and compositions.

## Evaluated options

| Approach | Available evidence / determinism | Decision |
|---|---|---|
| Remotion + React/TypeScript | Official README, renderMedia, useCurrentFrame, interpolate and spring documentation read from the official GitHub repository. Installed matching 4.0.538 renderer/bundler/player/CLI packages. Exact frame evaluation and repeatable audio/caption clock. | Primary engine. Familiar semantic UI and native typography, high editability, real Player and renderMedia export. |
| Motion for React | Official Motion README read. Rich gesture/layout/spring tools, browser/native animation support; MIT core. Wall-clock animate/RAF would require an explicit frame bridge for offline rendering. | Not needed alongside Remotion's frame-based primitives. No ornamental dependency. |
| GSAP | Official GSAP README read. Flexible CSS/SVG timelines, Flip/MorphSVG; README states free commercial toolset, specific GSAP license still applies. Offline seeking can be deterministic with a paused, frame-seeked timeline. | Strong alternative for complex path morphs; these stories require semantic product UI rather than path choreography, so omitted. |
| Rive | Official rive-wasm README and MIT runtime license read. Low-level API supports driving animation/state machines; editor/service/assets have separate terms. | No approved .riv asset or editor project. Rebuilding business UI as artboards would reduce text/data editability. Omitted. |
| Three.js / React Three Fiber | Official R3F README read; React19 pairs with Fiber9. Useful for true geometry/lighting; requires seeded/frame-driven updates and stable WebGL. | No useful 3D object interaction here. CSS perspective supplies restrained interface depth with sharper small text. |
| Blender | Blender4.3.2 installed; official Blender README read, GPL3 software. Real modelling/cloth/material workflow possible. No approved garment mesh, pattern or texture scans supplied. | A synthetic cloth simulation would risk mismatching the selected garment and consume work without improving identity consistency. New reference-conditioned editorial photography is more appropriate. |
| After Effects / Resolve Fusion | No licensed local After Effects or Resolve installation found. | Not selected; no unavailable application or proprietary project claimed. |
| FFmpeg | Local FFmpeg/FFprobe available. Deterministic encoding, loudness/duration/frame checks, audio correlation and frame extraction. | Encoder/QA support, not a substitute for designed animation. |

## Typography and assets

Geist, Inter and the old Manrope were compared. Inter's official README explains its screen-focused x-height and OpenType features. The local GRINDCTRL Next application brand rules already specify a Geist/Inter stack. Geist5.3.0's variable Latin WOFF2 and SIL OFL are distributed with this project. Geist is selected for the new UI and editorial type: weight contrast, tabular IDs/times and restrained spacing. The old Manrope is not blindly carried over.

Critical interface text is real React text, never generated inside a photograph. GRINDCTRL/Genesys/Zoho marks are existing supplied assets. Concrete is typeset as a name; no unofficial emblem is invented. New fictional garment/person photographs use reference-conditioned image edits, with asset lineage and visual inspection. No generated UI text or synthetic store results are treated as evidence.

## Reproducibility / local constraints

Local Node24, Chromium, FFmpeg/FFprobe, Blender4.3.2 and a4-CPU quota. No GPU-dependent material pipeline is required. Dependencies are pinned in package-lock.json. Sources and fonts are local; no runtime font CDN. Each film is a150-second/4500-frame composition at1920×1080/30fps. The same React component feeds preview and export. Audio source hashes/timing remain authoritative.

## Documentation access / licensing limits

The requested remotion.dev, motion.dev, gsap.com, rive.app and Apple HIG pages were attempted but blocked by the environment proxy. Accessible official GitHub documentation was read instead where present; inaccessible pages and404 paths are recorded honestly in research/access.json. Installed Player/renderer TypeScript APIs were also inspected for actual compatibility.

Remotion's distributed license permits individuals, non-profits and for-profit organisations with up to3employees to use it free, including commercial output; larger for-profit organisations need a company license. The owner's legal-entity size/license status is not supplied or independently verified. Its original license is included; no paid subscription or purchase is initiated or claimed. React/TypeScript and font licenses are retained. This report does not assert all libraries share an MIT license.
