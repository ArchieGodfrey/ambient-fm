# ambient-fm — Design & Redesign Plan

An offline PWA where an in-browser AI "composer" (WebLLM/WebGPU) helps you turn
moments of your day into personal music. Started as soundscapes; moving toward
melodies and vocals as models improve.

## Product vision — the journey

> Capture a moment → feel & tune its mood → let the composer weave it with *your
> sound* → keep it as a **Sound Memory** → revisit → adapt into a new mood →
> remix / extend.

The emotional core is a **library of Sound Memories** — a journal of your days,
in sound. The point is to merge AI + human creativity so anyone can get a
personal, evolving sound with minimal effort.

## Design principles

1. **Sound-first, minimal.** Heavy negative space, one focal action per screen,
   audio visualised, minimal text/labels. No developer surfaces in the journey.
2. **The AI gives direction, not raw audio.** The LLM emits a small
   `CompositionIntent`; deterministic algorithms synthesise reliable sound. Keep
   this split — it's why the app works offline on tiny models.
3. **Recordings become musical material, not clips.** A captured sample is
   *interpreted* (features → AI) **and** *heard* — but synthesised/transformed
   (pitch/tempo-aligned texture, granular wash, or used to drive/modulate synth)
   so it fits the piece rather than being pasted in raw. Degree of transform is a knob.
4. **Personal & evolvable.** Users keep multiple named **Sounds** (moods/profiles)
   and branch new ones from old.
5. **The model is invisible.** Download/load/unload become an automatic,
   backgrounded "preparing your composer" step. Diagnostics live in Settings.

## Core concepts / data model (Dexie v6)

| Entity | Meaning | Fields (sketch) |
|---|---|---|
| **Recording** | a captured real-world sample (e.g. the commute) | `id, ts, blob, durationMs, features{rms, centroid, onsetRate, tempo}, context{time, weather, geo?}, label` |
| **Sound** (profile) | a personal, evolvable palette — the "personalised sound" | `id, name, mood{energy, calmness, tension, brightness}, palette{layers, texture, key/scale bias}, composerSettings, parentId?(lineage), createdAt, updatedAt` |
| **Sound Memory** | a saved moment = recording + sound + the composition it made | `id, ts, title, recordingId?, soundId, plan(CompositionPlan), moodSnapshot, context, note?` |

- Absorbs today's `sessions` table. `runtimeSnapshots` stays (playback restore).
- Custom moods move out of localStorage into `Sound`.

## How it fits the existing (working) architecture

- **LLM path (keep):** `useAudioComposer → WebLLM worker → CompositionIntent → intentToPlan → CompositionPlan → Tone.js` (audioGraph layers: drone/pad/texture/pulse → compositionRuntime → sectionScheduler → phraseRuntime → motifEngine).
- **Recording → AI:** extract features client-side and emit an **`audio` stimulus**
  (a `StimulusSource` already typed but unbuilt) into the existing stimulus→intent
  prompt. No architecture change.
- **Recording → ears:** add a processed layer to `audioGraph` (Tone.Player /
  granular / convolution) whose gain is driven by the composition.

## Visual language — the CD / disc metaphor

The whole experience is framed as **burning memories onto CDs and playing them back**:

- **A day = a disc.** Composing multiple times in a day burns multiple **tracks**
  onto that day's disc.
- **Compose = "burn a track."** A `<Disc>` shows a **laser burn sweep** and a
  **burn-progress ring** (driven by real generation progress) while writing.
- **Playing = the disc spins.** Iridescent CD sheen, grooves, center label + hole.
- **Mood tints the disc.** Each disc's iridescence/glow is hued by its mood
  (`moodHue`: calm→blue, focus→indigo, tense→red, energised→pink, ambient→violet).
- **Discs insert.** A disc drops into place when composed or swapped (keyed remount).
- **The Library is a rack** of day-discs you flip through; select one to see its
  tracklist and play a track.
- Reusable component: `components/Disc.tsx` (props: size, spinning, burning,
  progress, mood, label, sublabel, inserting).

## Redesigned UI shell

Replace the 3 developer tabs (Now/Mood/Sessions) with a journey shell:

- **Today** — today's disc on a player: burn a track, spin it up to listen. The
  disc is the focal point (mood-tinted, spins on play, burns on compose).
- **Library** — a rack of day-discs (grouped by day); pick a disc → tracklist → play.
- **Your Sound** — the refine space: shape mood/palette, save/branch profiles.
- **Settings** — model, GPU, diagnostics + a **Developer** toggle ("Show progress
  steps") — hidden from the journey.

### Shell conventions
- **Responsive:** bottom tab bar on phones; left sidebar rail on desktops (≥900px)
  with a wider centred content column (CSS media queries on `.afm-nav/.afm-main/.afm-transport`).
- **No toasts.** Errors surface inline (clear red text on Today, error banner in
  Settings). `postToast` still feeds the status string but nothing overlays.
- **Progress is visual.** The disc's burn ring conveys progress; the verbal
  step-by-step is dev-only behind Settings → Developer.
- Minimal design system in `index.css`: neutral base + one periwinkle accent,
  soft radii, light/dark, animations (spin, burn-sweep, breathe, insert).

## Runtime gotchas (learned)
- **OffscreenCanvas transfers once per page** — transfer it to the worker at most
  once (`MLLayer` flag); it's optional (inference requests its own GPU device).
- **GPU preflight** requires only the WebGPU baseline (16384 B) of workgroup
  storage — never derive it from VRAM/buffer size.
- Dev server runs behind Caddy (TLS) → vite HMR websockets don't traverse cleanly;
  HMR + dev SW are disabled in dev (refresh to see changes).

## Phased roadmap (each phase shippable)

- **Phase 0 — Reset & consolidate** *(start here)*: delete dead code, unify RNG,
  new minimal app shell + nav, diagnostics → Settings. No new features; de-risks all later work.
- **Phase 1 — Your Sound:** `Sound` profiles in Dexie + the listen-and-refine loop, delivered as
  the full-screen **Sound Studio** — tempo, key, chords, layers, mood, and a **piano melody input**
  (tap keys → instant audio via a Tone.js audition synth, editable note groupings). Melody stored as
  note names (absolute pitches you played); key/chords are the harmonic context around it.
  Deterministic `buildSoundscape` extrapolates any level of input into a full plan.
- **Phase 2 — AI direction & the musical journal:**
  - **Gap-filling choice:** the melody is the seed; key/chords/mood are context. Offer "let the AI
    fill the song" (with a free-text instruction on *how*) vs "deterministic from mood".
  - **Vibe prose:** generate a lyrical/poetic "feel" from the user's inputs + stimulus (or let them
    write their own); feed it to the AI as composition direction — the on-ramp to the musical journal.
  - **Capture:** MediaRecorder, store Recordings, `audio` feature-stimulus feeding the AI.
- **Phase 3 — Sound Memories:** synthesise/mix the recording as a layer; save memory =
  composition + recording + sound + context; the Journey timeline + replay.
- **Phase 4 — Adapt & Remix:** Sound lineage; remix/extend a memory into a new mood.
- **Phase 5 (later) — Melodies & vocals:** richer intent schema + vocal synthesis (see below).

## Phase 5 experiment plan — Vocals from generated lyrics

Goal: a track can *sing* — the LLM writes lyrics from the track's mood/vibe/theme,
and a voice performs them over the music, in time. Builds directly on the Kokoro
voice already shipped for the DJ host. Explicitly an **experiment**: keep a
reliable baseline and gate the ambitious modes behind it.

### Pipeline
1. **Lyric generation:** LLM writes short, structured lyrics (e.g. 2 verses + a
   refrain) from the track's mood/key/vibe + the day's stimulus — reuse the
   `ai/vibe.ts` / `ai/hostScript.ts` prompt pattern. Store on the plan/session
   (`lyrics: { section, lines[] }`), shown as karaoke-style captions in NowPlaying.
2. **Timing/alignment:** map lines → sections and words/syllables → beats. Kokoro
   can emit token/word timings; where it can't, distribute syllables across the
   section's beats by count. This alignment is the crux of sounding musical.
3. **Vocalization** — a spectrum, cheapest/most-reliable first:
   - **E2 · Spoken-word:** Kokoro renders the lines as speech, placed at section
     starts, ducked into the mix (talk-over / spoken-word aesthetic). Works with
     what we have today; the reliable baseline.
   - **E3 · Pseudo-singing:** pitch-shift/time-stretch the Kokoro render so
     syllables land on the melody's notes and hold for their durations
     (Tone.PitchShift or an offline phase-vocoder). Approximate singing; expect
     artifacts — A/B against E2.
   - **E4 · Real singing synthesis (stretch):** a dedicated singing-voice model.
     No good fully-offline in-browser option today (heavy); likely needs a hosted
     model or a sampled vocal library — revisit as the ecosystem matures.

### Sub-phases (each shippable/evaluable)
- **E1 — Lyrics only:** generate + display lyric captions synced to sections. No
  audio. Validate lyric quality, structure, and mood-fit first.
- **E2 — Spoken-word vocals:** the baseline above + karaoke caption sync.
- **E3 — Pseudo-singing:** melody-aligned pitch/time-warp, opt-in and A/B-tested.
- **E4 — Evaluate real SVS / hosted options.**

### Constraints & risks
- **Scheduling:** vocals must be rendered ahead of time (during the track's
  generation window) and go through the same GPU serialization as LLM + Kokoro DJ
  (never three GPU jobs at once) — see the orchestration work.
- **Alignment quality** is the make-or-break for anything past spoken-word.
- **Mobile budget:** lyric inference + vocal render + music on a phone is tight;
  measure, and let vocals be an opt-in per Sound.
- **Uncanniness:** pseudo-singing can sound wrong; keep spoken-word selectable.

## Session experience (Phase 2, in progress)
A dedicated space where listening, capturing and composing interleave.
- **Capture (built):** MediaRecorder records the room; cheap features (RMS energy,
  zero-crossing brightness) are stored and emitted as an `audio` StimulusEvent so
  burns reflect the captured moment. Its own Capture tab.
- **LLM vibe prose (built):** the vibe is written by the model from the user's
  blocks (ai/vibe.generateVibeText), with the deterministic describeVibe as the
  instant fallback.
- **Turn-taking (next):** on iPhone, WebGPU inference can't run alongside heavy
  audio/recording — sequence the phases (capture → pause → compose → play) rather
  than running them concurrently. A small session state machine.
- **Fake lock screen (next):** expand the now-playing track; a lock icon dims the
  screen, freezes animations, shows static content, and ignores gestures except a
  double-tap and press-and-hold on the lock to exit. For eyes-free listening.

## Phase 3 (next) — Radio: continuous play + a DJ host

Reframe Today from "burn one track" into a **station you tune into**. Press play and
the composer generates an *ongoing* set — track flows into track — building from the
loaded Sound and coloured by the day's captures. A DJ host speaks between tracks,
narrating the time/weather and introducing the next track's themes. Press stop and
the set is saved to the day's disc. This is the on-ramp to the "vocals" north star.

### The governing constraint (discovered)
`infer()` **suspends the entire Tone audio context for the whole duration of an
inference** (`runtime/core/RuntimeKernel.ts:41-53` — GPU pause + `audio.suspend()`,
resumed in `finally`; serialized by `Scheduler`). So we **cannot play music while
composing the next track.** Two facts turn this from a blocker into the design:
1. **Web Speech `speechSynthesis` is independent of the Web Audio context** — the host
   voice keeps talking while the audio context is suspended for generation. The host
   *is* the cover for the generation gap. (Must verify on iOS Safari early — gesture
   rules + focus quirks are the main risk.)
2. Generation is short (seconds on a small model). The transition is: duck → host
   speaks → (audio suspends while next track generates, voice continues) → audio
   resumes → host finishes the intro → next track plays.

So the architecture is **host-bridged, not cross-faded** — no gapless/cross-fade
scheduling needed (and none is feasible through a suspension anyway). The host segment
both masks the compute pause and provides the segue.

### Transition sequence (per track change)
1. Controller detects the current track is near its end (own timer on `plan.duration`,
   or watch the cursor wrap via `subscribeRuntimeState`, `compositionRuntime.ts:316`;
   note plans loop `elapsed % duration` and never signal "finished", `:58-63`).
2. **Duck to bed:** stop the melodic tracks (`stopMelody/stopHarmony/stopPercussion`)
   and hold `drone`+`pad` at low intensity as an ambient bed — no master-gain rewiring
   needed (there is no master bus today; only `Tone.Destination.mute/.volume`).
3. **Host line 1** (time/weather greeting) via `speechSynthesis` — deterministic,
   instant, needs no track info. Sourced from the time plugin (part-of-day + hour,
   `stimulus/plugins/time.ts`) and weather plugin (condition + temperature,
   `stimulus/plugins/weather.ts`).
4. **Generate the next track** (`generateComposition` → `startCompositionRuntime`).
   The audio context suspends here; the voice continues over it.
5. **Host line 2** (the intro) built from the new track's name/mood/key/vibe —
   "up next, a [mood] piece … [title]" — spoken as audio resumes and the bed returns.
6. Start the new track; fade the host out.

### Building blocks (new)
- `audio/stationController.ts` — the state machine: `idle → announcing → generating →
  playing → (near end) announcing → …`. Owns the loop, boundary timing, and save. One
  clean orchestrator over existing start/stop; no deep runtime surgery.
- `audio/host.ts` — thin `speechSynthesis` wrapper: `speak(text, {voice,rate,pitch})`,
  `cancel()`, `onend`; feature-detected, graceful no-op when unavailable.
- `audio/bed.ts` (or extend `audioGraph`) — `duckToBed()` / `unduck()` using existing
  layer intensity + track stop/start.
- `ai/hostScript.ts` — assemble the host lines. **Deterministic first** (templates from
  time/weather + track name/mood/vibe — zero extra inference, so no extra suspension);
  an LLM-authored variant (reuse the `ai/vibe.ts` prompt pattern) is a later upgrade.

### Sub-phases (each shippable)
- **3a — Continuous play:** station controller does generate → play → near-end →
  generate → segue → repeat, ducking to bed across the gap (no voice yet). Proves the
  loop + boundary detection. Keep per-track save (nothing lost on tab close); present
  the day's disc as the accumulating set.
- **3b — The DJ host (deterministic + TTS):** add `speechSynthesis` host lines from
  time/weather + track name/mood over the bed. **Verify TTS survives context
  suspension on iOS Safari here — this is the riskiest assumption.**
- **3c — LLM host + polish:** richer LLM-authored scripts, voice selection (Settings),
  cadence ("every now and then", not every transition — e.g. every 2-3 tracks or on a
  time/weather change), host bed tuning.
- **3d — Today reframe + save-on-stop UX:** restructure the screens so the radio is
  the front door and the "disc" detail lives one tap deeper:
  - **Today = the Radio station** (replaces the current Today). One focal action —
    tune in / play-stop — plus station status and the DJ host captions. It is the
    *station*, not a disc browser. (No big disc here; the disc lives in the expanded view.)
  - **Expanded track view** (the existing `NowPlaying`, opened by tapping the
    now-playing item in the bottom `CurrentSessionBar`): full-screen with **one** big
    spinning disc, and the day's tracklist rendered as a **plain text list** (track ·
    time · key/mood; tap a row to play) — no mini-disc icons, so the big disc is the
    only CD on the page. This absorbs the day's-disc tracklist that currently sits on
    Today (move it out of `screens/Today.tsx` into `NowPlaying`, mini-discs → text rows).
  - Keep per-track save; frame the day's disc as the session's set.

### Shipped / decided
- **Voice:** Kokoro-82M neural TTS (kokoro-js, WebGPU/WASM), lazy-loaded, rendered
  to a clip BEFORE generation (GPU) and played via HTMLAudio DURING it; falls back
  to Web Speech if Kokoro can't load. iOS behaviour still to verify on device.
- **Sound selection:** the DJ auto-picks — a fresh capture drives the track if the
  mic's been used recently, otherwise a random saved Sound. No selector on the
  station; bespoke/manual generation lives in the Studio only.
- **Track length:** ≥ 120s (plan duration 90–150s, floored in the loop).
- **Vocals verdict:** real in-browser singing synthesis isn't practical offline yet.
  Near-term = a synthesized "aah" choir pad (formant bandpass + vibrato over the
  chord, gated by a complexity-driven `vocalLevel`); real sung vocals remain the
  Phase 5 north star (would need a heavier model or sample library).
- **Sign-off:** "Tune out" fades the mix before stopping (no hard cut).

### Open questions (resolved recommendations)
- Cross-fade vs. host-bridge → **host-bridge** (masks the suspension; simpler).
- Save cadence → **keep per-track save** (safer than deferring to stop), framed as the set.
- Host cadence → interval/probability, not every gap; skip the host on the very first track.
- Voice → default `speechSynthesis` voice; picker in Settings later.
- Passive capture during a station session → capture and generation both need the
  mic/GPU respectively; keep capture opt-in and paused during the generation window.
- iOS `speechSynthesis` reliability under context suspension → **prototype on device in 3b.**

## Phase 6 (new) — The emergent "Your Sound" + feedback engine

Today's Sounds are **inspiration**: user-authored palettes you shape, elevate
(AI fills them in), and burn into tracks; the radio draws on them. Phase 6 adds a
*distinct, un-editable* **"Your Sound"** — a living signature that the app forms
for you and that slowly evolves. You don't edit it; it's earned.

- **What it is:** a read-only Sound (visually distinct — e.g. a special disc) that
  represents "you, in sound right now." It is never hand-edited; it's recomputed.
- **What shapes it:**
  1. **Recent stimulus** — captures (room audio features), time/weather, recency.
  2. **Long-term track analysis** — aggregate the plans/sessions you've made:
     common keys, tempos, moods, layer balances, complexity, which motifs recur.
  3. **A feedback/recommendation engine** — the crucial new piece. Signals:
     explicit (a thumbs up/down or ❤ on the now-playing track), and implicit
     (played to the end vs. skipped early, replayed, burned-and-kept vs. deleted,
     tuned out during). These weight the aggregation toward what you actually like.
- **How it evolves:** a periodic recompute (on app open / after N new signals)
  blends long-term preference (slow-moving centroid) with recent stimulus (fast-
  moving) — so it has a stable core that drifts over weeks, plus day-to-day colour.
  Show the drift ("your sound is getting brighter / calmer lately").
- **Where it plugs in:** it becomes a first-class source the **radio** can pick
  ("now, something in *your sound*"), and a starting point users can *branch* from
  in the Studio (branch = editable copy; the original stays emergent).

### The feedback engine (foundational — build first)
- **Data:** a `Feedback` store — `{ id, ts, trackId/sessionId, signal, weight }`
  where signal ∈ like/dislike/skip/complete/replay/keep/delete, each with a weight.
- **Capture points:** ❤/✕ on NowPlaying + the radio; the station already knows
  play-through vs. skip and tune-outs; the Library already has keep/delete.
- **Model:** a preference vector over the musical features we already generate
  (mood dims, key/mode tendency, tempo band, layer balances, complexity, density,
  arp/percussion/vocal levels). Update via weighted moving average per signal.
- **Uses beyond Your Sound:** bias the radio's Sound/҂capture pick and the AI
  `direction`; re-rank the Library; "more like this" from any track.

### Sub-phases — SHIPPED
- **6a ✓ Feedback capture + store:** ❤/✕ on the Radio + now-playing view; implicit
  complete/replay/delete; Dexie v8 `feedback` table with a feature snapshot.
- **6b ✓ Preference model:** `preference/model.ts` weights each track by its net
  feedback and blends with long-term track analysis into a `PreferenceVector`
  (energy/complexity/tempo/minorBias/layers + top moods/keys + confidence).
- **6c ✓ Emergent Your Sound:** `preference/yourSound.ts` synthesizes a read-only
  Sound from the preference vector coloured by recent stimulus; shown as a
  distinct card with its drift; branch = editable copy (`useSounds.createFromSound`).
- **6d ✓ Close the loop:** the radio picks the emergent Your Sound once confident
  (the DJ says "drawn from your own sound"); "More like this" on any Library track
  composes a fresh track seeded from it.

### Risks
- Cold start (no history) — fall back to authored Sounds / mood defaults.
- Over-fitting to a few signals — use slow moving averages + require a minimum.
- Feedback fatigue — lean on implicit signals; keep explicit ones one-tap and rare.

## Deferred experiments (follow-up)
- **More musical, non-slider bed inputs:** e.g. a chord wheel, draggable layer
  meters, an XY mood pad — make the "bed" controls feel as native as the piano.
- **Today page + sound-selection flow (own phase, needs discovery):** Today
  should show which Sound is loaded, and likely the whole flow of choosing a
  sound needs revisiting; consider a track selector for the tracks burnt onto the
  current day's disc. Warrants real planning/discovery before building.
- **Per-beat motif development:** apply evolutionProfile (motifMutationChance,
  rhythmVariation) so the melody develops note-by-note over time rather than
  repeating its motif per section.

## Consolidation targets (Phase 0 — confirmed dead/duplicated)

- Dead: `audio/deriveAudioState.ts`, `audio/motifManager.ts`, `music/instruments/*`,
  `music/motifs/player.ts`, `music/scheduler/chordScheduler.ts`,
  `composer/{decideNextAction,evolution,motifs,stimulusReaction,scheduler,instruments}.ts`
  (only `composerState` seeding + `buildHarmony` are live), `stimuli/timeStimulus.ts`,
  `stimuli/weatherStimulus.ts`.
- Duplicated → collapse: instrument registries (keep `audio/instruments/`); motif engines
  (keep `audio/motifEngine` + `music/motifs/generator`); seeded RNG (`music/random/randomField`
  + `utils/randomField` → one); stimulus (`stimuli/` → `stimulus/`, keep `buildStimulusSnapshot`).

## Live spine to preserve

`hooks/useAudioComposer.ts`, `audio/{toneEngine,audioGraph,compositionRuntime,sectionScheduler,phraseRuntime,phraseEngine,motifEngine}.ts`, `audio/instruments/`, `audio/layers/`, `ai/{inference,intentToPlan,intentSchema,prompt,compositionContext,types}.ts`, `runtime/*` (model lifecycle), `stimulus/*`, `memory/*`, `music/{harmony,motifs/generator,random}`.
