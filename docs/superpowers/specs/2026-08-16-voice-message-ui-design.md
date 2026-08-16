# Voice message UI + voice-language picker

**Status:** Approved
**Scope:** `apps/web-next` assistant chat widget (`components/assistant/*`, `lib/assistant/*`)

## Context

Voice replies (Groq Orpheus TTS) now work end-to-end (terms accepted, correct
lowercase voice names, correct `response_format`). Two UX gaps remain:

1. Voice playback is fire-and-forget: `chat-window.tsx`'s `handleAssistantReply`
   plays the audio automatically with no visible control, no association to a
   specific message in the transcript, and no way to pause or replay it. The
   user asked for it to read as an actual "voice message," not silent
   background audio behind a plain text bubble.
2. Which language voice speaks is decided implicitly by the site's text-locale
   cookie. The user wants an explicit, lightweight control to choose it,
   without turning it into a bigger settings surface.

Both directions below were validated against mockups in a visual brainstorming
session (see conversation) before this spec was written; the user picked
option B in both cases.

## Decisions

- **Voice-only scope**: the language picker changes only which Orpheus
  model/voice speaks. It does not change the chat reply's text language
  (already auto-mirrors whatever language the visitor types, via the system
  prompt) and does not change site-wide UI language. Building a full locale
  switcher here would be materially bigger and more surprising than what was
  asked for.
- **No persistence**: the picker's override and the player's per-message state
  are in-memory only, matching how the existing voiceInput/voiceOutput mode
  toggles already behave (reset on remount). Not worth introducing new
  persisted state for this.
- **No true waveform**: the player's bars pulse via CSS while playing rather
  than reflecting real amplitude. Real waveform rendering needs decoding audio
  into a canvas — meaningful extra complexity for a decorative element.
- **No pre-audio loading state**: the player renders only once audio chunks
  have arrived (typically ~1-2s after the text reply). No skeleton/pending
  affordance for that gap.
- **Duration is real**: pulled from the native `HTMLAudioElement`'s loaded
  metadata (`duration`), not estimated — this is free, no library needed.
- **Popover opens on hover or tap**: hover-to-open is what was asked for, but
  hover doesn't exist on touch devices, so tap must also work. Both wire to
  the same open/close state.

## Components

### `VoiceMessagePlayer` (new — `components/assistant/voice-message-player.tsx`)

Renders inside an assistant `MessageList` bubble when that message has audio
attached. Props: `chunks: string[]` (base64 WAV strings, already
sentence-chunked server-side by `tts-chunker.ts`).

- Builds one `Audio` element per chunk lazily; sums `duration` from each
  chunk's `loadedmetadata` event for a total; tracks elapsed time across the
  sequence via `timeupdate` + chaining `onended` to the next chunk (same
  sequential-playback approach already used in `chat-window.tsx`, just now
  encapsulated with exposed state instead of being fire-and-forget).
  Autoplays once on mount (matches current behavior).
- Renders: circular play/pause icon button (lucide `Play`/`Pause`, matching
  existing icon set) + a row of small bar `span`s (CSS `animate-pulse`-style
  while `status === 'playing'`, static otherwise) + `mm:ss` label showing
  elapsed/total, formatted with the existing `formatMmSs` from
  `lib/assistant/i18n.ts` (already used by `RateLimitBanner`) rather than a
  new formatter.
- States: `idle | playing | paused | done`. No `loading`/`error` — a failed
  fetch never reaches this component (the existing `voiceError` banner in
  `chat-window.tsx` already covers that path; this component only ever
  receives chunks that already downloaded successfully).

### `VoiceLanguagePicker` (new — `components/assistant/voice-language-picker.tsx`)

Renders in `ChatWindow`'s header, next to the existing `ModeToggle`, only
when `voiceOutput` is true.

- Small round badge showing the active 2-letter code (`EN`/`AR`), sourced from
  `voiceLanguageOverride ?? locale` (from `useAssistantLocale()`).
- Clicking or hovering (with a short close-delay on `mouseleave` to avoid
  flicker) opens a 2-item popover: "English" / "العربية". Selecting an item
  sets the override and closes.
- `voiceLanguageOverride: 'en' | 'ar' | null` state lives in `ChatWindow`
  (TTS-only concern, not a site-locale concern — doesn't belong in
  `AssistantLocaleProvider`). `null` = follow site locale (current default
  behavior, unchanged for anyone who never touches the picker).

## Data flow changes

`DisplayMessage` (`use-assistant-chat.ts`) gains an optional
`audio?: { chunks: string[] }` field. `useAssistantChat`'s `onAssistantReply`
callback signature changes from `(text: string)` to
`(text: string, messageId: string)` so `chat-window.tsx` can attach arriving
TTS chunks to the correct message. A new setter, `setMessageAudio(id, chunks)`,
is exposed from the hook for this.

`handleAssistantReply` in `chat-window.tsx` keeps its existing responsibility
(call `streamTts`, handle `rate_limited`/`provider_unavailable` via the
existing banners) but on success calls `setMessageAudio(messageId, chunks)`
instead of playing audio itself — playback moves into `VoiceMessagePlayer`.

The TTS voice/model selection (`app/api/assistant/tts/route.ts`, already
locale-driven) is unchanged server-side; `chat-window.tsx` just passes
`voiceLanguageOverride ?? locale` instead of `locale` alone when calling
`client.streamTts`.

## Error handling

Unchanged from the existing (already-shipped) behavior: `rate_limited` and
`provider_unavailable` from `streamTts` are handled in `chat-window.tsx`
before any chunks reach the message list, via the existing `RateLimitBanner`
and `voiceError` muted-banner paths. `VoiceMessagePlayer` never has to reason
about failure — it only ever receives a message that already has real audio.

## Testing

- `voice-message-player.test.tsx`: renders given mock chunks; verifies
  autoplay-on-mount (mocked `HTMLMediaElement.play`); verifies clicking the
  button pauses/resumes; verifies the duration label updates once metadata
  "loads" (mocked `loadedmetadata` dispatch).
- `voice-language-picker.test.tsx`: hidden when `voiceOutput` is false; shows
  the correct active code; clicking a language item fires the change handler
  and closes the popover; opens on hover and stays open briefly after
  `mouseleave` (close-delay).
- `use-assistant-chat.test.ts`: update for the new `onAssistantReply(text, id)`
  signature and the new `setMessageAudio` setter.
- Live browser verification (as done for every other piece of this feature
  this session): real Groq audio actually plays through the new player, in
  both English and Arabic, at at least one mobile width for the picker's tap
  interaction.
