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
- **Phase 1 — Your Sound:** `Sound` profiles in Dexie + the listen-and-refine loop
  with live preview. Existing tech only.
- **Phase 2 — Capture:** MediaRecorder, store Recordings, `audio` feature-stimulus feeding the AI.
- **Phase 3 — Sound Memories:** synthesise/mix the recording as a layer; save memory =
  composition + recording + sound + context; the Journey timeline + replay.
- **Phase 4 — Adapt & Remix:** Sound lineage; remix/extend a memory into a new mood.
- **Phase 5 (later) — Melodies & vocals:** richer intent schema + vocal synthesis.

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
