# Your Station — personalize the host + write-in requests

Extends DJ v2 (feature/composition-v2). Make the station feel like *yours*: name
it, name + voice + shape the host, and write in song requests the host reads out
and spins.

## Decisions (locked)
- **Requests → bespoke track.** A write-in becomes a `CompositionDirection`; the
  host reads it out and a brand-new track is generated for it, jumping the queue.
  The generation wait is covered by the host reading the request aloud.
- **Wizard: one optional step + Settings editor.** A single skippable "Make it
  yours" step (station name, host name, personality, voice) with good defaults;
  all editable later in Settings → Station & host.
- **Host lines: starter batch + top-ups.** Generate a small personality-flavored
  batch in the wizard if the model's ready, then keep topping up during radio
  buffering. Deterministic templates remain the offline/locked fallback.
- **Voices: curated English shortlist + preview.** ~8 hand-picked US/UK voices;
  selecting one downloads it (~60-75MB). **The voice's display name is the default
  host name** (editable).

## Config (`config/station.ts`, localStorage + useStation hook)
- `stationName` — default "Ambient FM"
- `hostName` — default = default voice's display name ("Ava")
- `hostPersonality` — free text, default "" (→ warm, informational)
- `voiceId` — default `en_US-hfc_female-medium` (already downloaded; no surprise
  re-download for existing users)

Curated voices (id → display name / accent / gender): hfc_female→"Ava" (US F,
default), amy→"Amy" (US F), kristin→"Kristin" (US F), ryan→"Ryan" (US M),
joe→"Joe" (US M), cori→"Cori" (UK F), jenny→"Jenny" (UK F), alan→"Alan" (UK M).

## Build phases (fold into this work, in order)
1. **Foundation** — `config/station.ts` + `useStation()`; thread `stationName`/
   `hostName` into the deterministic `hostScript` lines (immediate flavor); a
   Settings → "Station & host" editor (name, host name, personality text).
2. **Voice picker** — curated list + preview; `hostPiper` reads `voiceId` from
   config (not the constant); selecting downloads the voice + resets the session;
   picking auto-fills host name to the voice's display name. Add to the wizard
   "Make it yours" step + Settings.
3. **LLM host lines** — `ai/hostLines.ts`: generate a pool of personality-flavored
   lines (categories: welcome, observation, back-announce, intro, request-ack)
   using host name + personality + stimulus. Starter batch in the wizard (if model
   ready); top up during `useRadio.fill()` when the model's loaded; cache + evict
   stale. Deterministic templates remain the fallback; mix pools in the rotation.
4. **Write-in requests** — a "Write in" section on the Radio page (mirrors
   captures): text → a pending request. At the next transition the host reads it
   (LLM/templated) and the next track is generated from it (direction derived from
   the text: instruction/vibe/moodWords), jumping the queue.

## Notes
- Voice runs on its own AudioContext already (DJ v2), so line generation/preview
  won't collide with track/bed renders.
- Request → direction reuses existing `composeTrack(direction)` plumbing.
- Keep first-run fast: personalization step is skippable; requests + LLM lines
  degrade gracefully to deterministic behavior offline / model-not-loaded.
