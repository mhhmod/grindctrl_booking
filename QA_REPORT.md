# Part 04 — production and QA report

## Final single-master acceptance

1. **ONE narration source:** `Part04_FINAL_VOICEOVER.mp3`; SHA-256 `3371c5f655e8f4741a0f62bb436a70439cfacf50ae7787652a4c93fc89e4a81a`. Original supplied MP3 retained byte-for-byte in source/HTML/PPTX. HTML verifies one audio element; timeline verifies one locked track at 00:00 with no edits. No scene audio files exported.
2. **Continuous complete recording:** 12,609,072 samples at 44.1 kHz, **285.920s**, covered in full by the MP4. First word through final phrase retained. No narration slicing, content omissions, speed changes, fades, normalization, silence insertion or replacement speech applied. Standard MP4 AAC encoding only.
3. **All NINE scenes:** measured boundaries follow actual topic anchors, not equal duration guesses. Scene spans below. 124 measured phrase intervals and 82 visual event boundaries.
4. **Runtime within encoding tolerance:** MP3 container 285.962449s includes encoder padding; decoded master 285.920s; MP4 audio 285.920s; video 285.933333s / 8,578 frames. H264 Full HD, 30 fps; AAC 192 kb/s mono, 44.1 kHz.
5. **No source-to-export cuts:** full video decoded successfully. 21 PCM comparisons cover the opening, all topics, scene transitions and ending. All best lags **0 samples**; lowest correlation **0.9998971**. MP4 contains one audio stream. Source has 0 near-full-scale clipped samples, peak 0.261156. This is technical preservation evidence, not a human pronunciation certification.

## Actual measured video scene spans

| Scene | Start (s) | End (s) | Opening phrase / topic |
|---|---:|---:|---|
| S01 | 0.000 | 29.583 | في الفيديوهات اللي فاتت، شفنا إزاي GRINDCTRL ممكن تساعد Concrete تطور تجربة خدمة العملاء، |
| S02 | 29.583 | 61.463 | تخيلوا عميل داخل على متجر Concrete الأونلاين، |
| S03 | 61.463 | 93.035 | ونفس التجربة ممكن تكمل جوه الأونلاين ستور. |
| S04 | 93.035 | 125.674 | نرجع بقى للـContact Center. |
| S05 | 125.674 | 157.510 | وفي الفروع، |
| S06 | 157.510 | 189.096 | بس الفرص مش كلها قدام العميل. |
| S07 | 189.096 | 220.181 | أما فريق الماركتنج، |
| S08 | 220.181 | 253.969 | ولما نبص من ناحية الإدارة، |
| S09 | 253.969 | 285.920 | كل الأمثلة دي بتوصلنا لفكرة واحدة: |

## Visual / runtime checks

- **146 actual encoded MP4 frames** compared with HTML at identical frame/30 time, including scene boundaries/dissolves, typing, product refinement, review states and ending. Maximum mean pixel difference **1.953/255** under H264 tolerance.
- Encoded MP4 played unmuted at **12** sampled positions in Chromium and reached its real ending; audio/video decode counters and media errors checked. This is software playback, not a human audition.
- **434 English/RTL seek states**, nine scenes, **0 text-overflow findings**. Caption RTL and six representative subtitle positions passed layout checks.
- Seventeen business-state checks passed: proposed solutions/not live systems banner in S01; shopper occasion/uncertainty cards and budget in typed stylist prompt in S02; outfit shirt -> knit after customer refinement; conditional visit/no booking; size/branch follow-up chips and unavailable stock data (shown as unknown, no guess) in S03; demo policy reference; AI DRAFT separate from prior human note with edit/approval and explicit no-exchange/refund/delivery-promise guard in S04; proper membership tier pills (Lifestyle / Prestige / Elite) and optional appointment note with no VIP/Gold in S05; move-quantity/replenishment/demand-forecast chips and manager approval/rejection (with dedicated reject icon) without execution in S06; distinct DRAFT campaign layouts (Social post / Email header / Social story) with zero text/crop collision and Concrete team editorial gate in S07; Buying behavior + permitted-sources/data-quality note + demo source-linked executive brief with no percentages in S08; not-building-everything-at-once callout, authorized scoped pilot, measurement, and closing tagline in S09.
- Reproducibility defect fixed: added the missing `source/assets/icon-mic.png` referenced by `source/build-pptx.py` and `source/assets/icon-reject.png` for the S06 manager Reject button; updated QA scripts to write directly into `qa/`.
- One audio clock, pause freeze, replay, step, seeking, 0.35-second visual-only scene dissolves and reduced-motion rendering checked. Visual transitions do not modify the audio.
- 390px English/RTL: page stays within 390px, visible controls at least 42px. Enlarge supports detailed scene reading.
- 13-page browser PDFs and editable native PowerPoint exported. Native fonts, image viewport crops, manager-flow arrow direction and representative native renders inspected through LibreOffice. Native Microsoft PowerPoint audio/animation playback was not tested; HTML/MP4 are the synchronized audiovisual masters.
- All nine scenes and the ending contact sheet visually inspected. GRINDCTRL spelling/artwork correct, warm light series identity, rebuilt readable text, no source-generated UAE/prices/benefits/commitments/KPIs/founding year exposed in the displayed photo viewports.

## Remaining limits

- No human full listen-through or Arabic-English phonetic certification performed. Context recognition supports the supplied script—including the negative “not existing live systems” wording and final GRINDCTRL/Concrete mention—but does not certify accent, naturalness or every phoneme.
- Arabic subtitles are script-matched/ASR-assisted, with measured phrase intervals and normalized brand spelling; not certified verbatim or forced-aligned individual-word timings. Raw recognition/context outputs retained.
- No authorized actual Concrete brand guide/logo/store photographs, current winter collection or native screenshots were accessible. Source photography is generative illustrative art direction; it is not verified Concrete imagery.
- Genesys/Zoho/Retail Pro/WooCommerce versions, native AI features/paid entitlements, API access, membership source, stock freshness/branch mapping, permissions, consent and retention remain unverified. Evidence report distinguishes contracted/vendor-documented/proposed/unknown.
- No live integration, inventory transfer, actual appointment, campaign publication, pilot, external audience testing, financial saving or uplift is claimed. No “all 29 opportunities built/live” claim.

Checked source reports are in `qa/`; full scope/corrections are in `BRAND_EVIDENCE_AND_FIDELITY.md`. Sources contain one voice asset and nine video scenes.
