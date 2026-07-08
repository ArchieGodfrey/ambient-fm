# ambient-fm — Design Plan v2

Five themes, each grounded in the current code. Ordered by suggested sequencing.
References are `file:line` into `apps/pwa/src` unless noted.

---

## 1. Mood exploration & temporary "lean-in" themes

**Goal:** make it easy to explore different moods on demand and *temporarily* steer
the station toward a theme, without permanently retraining "Your Sound".

**Current state**
- Mood is not a first-class object. It's a derived word (`globalMood`, computed from
  energy+mode in `ai/intentToPlan.ts:38-42`) plus a closed section union
  `calm|focused|tense|ambient|energised` (`ai/types.ts:6`), and a separate editable
  4-axis `SoundMood {energy,calmness,tension,brightness}` used by Sounds
  (`sounds/types.ts:4-9`, mapped by `sounds/previewPlan.ts` `moodToIntent`/`describeMood`).
- The radio picks a track's character **fully automatically** in `useRadio.pickSource`
  (`hooks/useRadio.ts:52-61`): recent mic capture → emergent "Your Sound" (if
  `preference.confidence ≥ 0.3`) → random saved Sound. **No user mood input in the loop.**
- **Key unlock:** a `ManualMoodStimulusPlugin` already exists and already feeds the
  generation prompt (`stimulus/plugins/manual.ts`, persisted via `stimulus/setup.ts:24-33`),
  but **no UI writes to it** — a ready-made, unused steering channel.
- `CompositionDirection` (`ai/prompt.ts:8-16`) is the clean per-track override, injected
  as "USER DIRECTION (honour this closely)". `moodHue` (`components/Disc.tsx:20-29`) is the
  single visual mapping point.

**Proposed approach**
1. **Mood presets bar on Radio** (`screens/Radio.tsx`): 5–6 one-tap themes (Calm, Focus,
   Energised, Dreamy, Tense, + "Surprise me"). Each maps deterministically to a
   `SoundMood`/`CompositionDirection` via the existing `moodToIntent`/`describeMood`.
2. **Temporary lean-in semantics:** tapping a preset sets a `leanIn` state
   `{direction, startedAt}` in the session store; `pickSource` returns this direction while
   active. It stays **until the user cancels** (a "Leaning into *Dreamy*" chip with ✕) or
   picks another theme — and leaves a faint preference trace that grows with dwell time (below).
3. **Per-track nudges on now-playing:** "Calmer / Brighter / More energy" chips that push a
   one-shot `CompositionDirection` delta into just the next cycle (distinct from a persistent
   lean-in — no chip, doesn't linger).
4. **Exploration mode (optional):** a "Explore sounds" view that auditions short
   deterministic previews (`buildSoundscape`, no LLM — same path as Studio "Listen") across
   the theme space so users can sample without waiting on generation.
5. **Seed a theme/genre library (new):** ship a curated set of starter themes/genres beyond
   the five moods — e.g. lo-fi, ambient drone, synthwave, neo-classical, focus beats, warm
   jazz — authored as seed `Sound`/`CompositionDirection` presets. These populate the presets
   bar and become raw material for the LLM:
   - **Blend:** when a theme is chosen, both the theme direction *and* the user's "Your Sound"
     go into the prompt, so the LLM fuses the genre with the listener's emergent taste rather
     than replacing it.
   - **Auto-suggest / auto-create:** the LLM proposes new themes/genres from listening
     (e.g. "warm, slow evenings — try *Dusk Lo-fi*?"), saveable as new presets. New
     moods/genres are created on the fly, not limited to the fixed union.
   - Requires widening mood beyond the closed `CompositionSection.mood` union
     (`ai/types.ts:6`) — either a freeform string with a fallback `moodHue`, or a separate
     `genre` field alongside mood. Decide during implementation.

**Decided:** lean-in **gently informs taste** — it leaves a faint trace in "Your Sound".
- The preference weight **increases with cumulative time spent** in the mood: the longer you
  stay leaned into a theme, the stronger its trace on "Your Sound"; a quick sample barely
  registers. Always kept *below* an explicit ❤ so exploration can't hijack taste.
- Implementation: track dwell time per lean-in; emit a positive `feedback` signal whose weight
  scales with time-in-mood (reuse `feedback/feedback.ts` + `preference/model.ts`). Gentle
  curve, e.g. weight ≈ min(cap, k · minutes), capped below a like.

**Decided:** lean-in stays active **until the user cancels** — a visible mood chip with a ✕;
the user controls how long it colours the station (and thus how much it feeds taste).

**Still open:** the exact weight-curve constants + cap (tune once audible); the mood-vs-genre
data model for auto-created themes (decide in implementation).

**Effort:** M–L. UI + wiring the existing channel + a dwell-weighted preference signal + a
seed theme/genre library with prompt-level blend/suggest (widens the mood model).

---

## 2. Consistent background / lock-screen playback

**Goal:** music reliably continues when the screen locks or the app backgrounds
(it happens "accidentally" today — make it deterministic), ideally with lock-screen controls.

**Current state (the core problem)**
- All audio is **Web Audio via Tone.js** with a single global Transport/Destination
  (`audio/toneEngine.ts`, `audio/audioGraph.ts:60-67`). There are **no `<audio>` elements**.
- **Nothing supports backgrounding:** no MediaSession, no Wake Lock, no `visibilitychange`/
  `pagehide` handling anywhere in `src/` (confirmed absent).
- Track advance is a `setTimeout` in `useRadio.cycle` (`hooks/useRadio.ts:122-123`) and the
  composition runs on a `requestAnimationFrame` tick for the whole track
  (`audio/compositionRuntime.ts:254`). **Both are throttled/paused when backgrounded**, and
  iOS suspends a pure Web-Audio context on lock.

**Why it "sometimes" works:** iOS only keeps audio alive in the background when it's driven
by a **media element** (`<audio>`/`<video>`) that iOS recognises as active playback. A pure
Web Audio graph gets suspended. The accidental successes were likely timing/edge cases.

**Proposed approach (the reliable iOS pattern)**
1. **Route the master mix through a media element.** Add a `MediaStreamAudioDestinationNode`
   to the Tone context, feed the shared Destination into it, and set a persistent muted-then-
   played `<audio>.srcObject = stream`. iOS then treats playback as media and keeps the
   context running when locked/backgrounded. This is a new "master bus" node — note there is
   currently **no master gain bus** (volume is ramped on `Tone.getDestination().volume`,
   `toneEngine.ts:34-36`); introduce one and tap it for the stream.
2. **MediaSession integration** (`navigator.mediaSession`): set `metadata` (title = track
   name) and `setActionHandler` for **play/pause only** (v1). Keeps the session "active" and
   gives basic lock-screen transport. Skip/next and disc artwork are deliberately deferred.
3. **Visibility-resilient scheduling:** stop depending on rAF/`setTimeout` for correctness
   while backgrounded. Move track-advance to a Tone.Transport-scheduled event (audio clock,
   not wall-clock timers) and gate the visual rAF on `document.visibilityState` (see §5).
4. **Resume on foreground:** `visibilitychange` handler that calls `resumeAudioContext()`
   (already exists, `toneEngine.ts:12-30`) if the context got suspended.

**Decided:** target is **keep-playing + play/pause on the lock screen** (no skip in v1).
The bulk of the work is keeping audio alive (the media-element route); once that exists,
adding skip + disc artwork later is cheap — so ship play/pause first, treat skip and
artwork as fast follows.

**Risks / unknowns**
- iOS PWA (standalone) background-audio behaviour is finicky and version-dependent; needs
  on-device testing. The media-element route is the most reliable known method but verify.

**Effort:** M–L, and test-heavy on real iOS. Highest-value + highest-risk item.

---

## 3. Logo redesign (CD theme)

**Goal:** a logo/icon that matches the CD/disc identity, with a proper installable icon set.

**Current state**
- Single icon: `public/favicon.svg` (exists, ~9.5KB) referenced by `index.html` (favicon +
  apple-touch-icon) and the manifest (`vite.config.ts` icons). There's also `public/icons.svg`.
- **No PNG icons, no maskable icon, no 192/512 raster sizes** — only the one SVG `sizes:"any"`.
- `@vite-pwa/assets-generator` is already a devDependency but **not wired** (no
  `pwa-assets.config.*`, no `pwaAssets` block).
- There is no logo React component; the disc visual (`components/Disc.tsx`) is the closest
  existing "brand" asset (iridescent conic gradient banded around a mood hue).

**Proposed approach**
1. **Design an iridescent-disc mark (decided direction):** a glossy disc with center hole +
   subtle light-sweep, reusing the `moodHue`/iridescence language from `Disc.tsx` so the icon
   and in-app discs feel like one identity. Author as a clean, flat-background SVG
   (maskable-safe: keep the disc within the safe zone).
2. **Wire `@vite-pwa/assets-generator`:** add `pwa-assets.config.ts` + `pwaAssets` in
   `vite.config.ts` to generate `favicon.ico`, 192/512 `any` + `maskable` PNGs, and
   `apple-touch-icon` from one source SVG. Update the manifest `icons[]` to list the full set
   (currently one SVG entry).
3. **Brand colors — decided: fully periwinkle.** Move both manifest `background_color` and
   `theme_color` from slate `#0f172a` into the periwinkle family (accent `#6b62c9`,
   `index.css`) so the splash + status bar carry the in-app identity. Use a slightly deeper
   periwinkle for `background_color` so a light-toned disc logo stays legible on the splash.
4. Optionally add a small in-app wordmark/logo component for the header / onboarding.

**Effort:** S–M (mostly design + one-time asset pipeline wiring).

---

## 4. First-run onboarding: PWA install + offline prep

**Goal:** clear first-time guidance to install as a PWA and pre-cache everything for offline.

**Current state**
- VitePWA is configured with runtime caching for the WebLLM weights (`huggingface.co`,
  `raw.githubusercontent.com/mlc-ai`) and weather (`vite.config.ts:31-74`); WebLLM uses its own
  Cache-API/IndexedDB backend (`runtime/modelSelection.ts:53-65`); Piper voice persists in OPFS
  (`audio/hostPiper.ts`).
- **No install/onboarding UX at all:** no `beforeinstallprompt` handler, no "Add to Home
  Screen" guidance, no first-run flow. Standalone is only *detected* read-only in diagnostics
  (`hooks/useSystemHealth.ts:54`, `components/SystemHealth.tsx:31`).
- **No `navigator.storage.persist()`** anywhere → the multi-GB model/voice caches are
  eviction-eligible (a real offline-reliability risk).

**Decided vision:** a clean, staged first-time experience — **detect not-installed → install
guide → setup wizard with explicit download consent.** Two distinct gates:

1. **Gate A — Install (shown when NOT running standalone).** On first visit in a browser tab
   (`matchMedia("(display-mode: standalone)")` false, `hooks/useSystemHealth.ts:54`), present
   an install screen:
   - **iOS Safari:** a visual "Share → Add to Home Screen" walkthrough (no install API exists
     on iOS, so it must be illustrated step-by-step).
   - **Android/Chrome/desktop:** capture `beforeinstallprompt` and offer a one-tap Install
     button.
   - **Soft wall (decided):** present this as a full install screen first; the user must
     actively dismiss it to continue in the browser (offline + background audio work
     best/only as an installed PWA).
2. **Gate B — Setup wizard (first launch *after* install / standalone).** A short wizard:
   welcome + what the app does → **"Download the on-device AI (music model + DJ voice), ~X MB.
   Runs entirely on your device, works offline after."** → explicit **Accept** → download with
   live progress (reuse model load + `maybeAutoLoadVoice`, `audio/hostPiper.ts:93-100`) →
   **`navigator.storage.persist()`** to protect the caches → done.
   - **Nothing large downloads before the user accepts.** (Changes today's behaviour, where
     the voice lazy-loads on first tune-in.)
   - Keep the lazy load as a **safety net** if the user skips the wizard.
   - Show an honest size estimate — needs the real weight sizes (Qwen2-0.5B / Gemma3-1B +
     Piper voice); wire from `navigator.storage.estimate()` + known model sizes.
3. **Offline-readiness indicator** in Settings/System Health: model cached ✓, voice cached ✓,
   storage persisted ✓ — so users can confirm they're truly offline-ready.

**Decided:** browser users hit a **soft wall** — a full install screen they must dismiss to
proceed in-browser (not a hard block).

**Decided:** the setup wizard is **re-runnable from Settings** (re-download / repair / re-consent
the model + voice, re-check `storage.persist()`).

**Effort:** M–L. Install detection + illustrated iOS guide + `beforeinstallprompt` + wizard +
`storage.persist()`. The iOS install illustration is the fiddly part.

---

## 5. Battery vs. fresh generation

**Goal:** maximise battery life while keeping generation feeling fresh.

**Current state (drains, by cost)**
- **~60fps `requestAnimationFrame` tick for the entire track** (`compositionRuntime.ts:254`)
  recomputing drift/scheduler/audio params every frame — the biggest continuous cost.
- ML worker **heartbeat `setInterval` every 1s**, always on while the worker exists
  (`MLLayer.ts:151-177`).
- Checkpoint **`setInterval` every 5s** to IndexedDB (`compositionRuntime.ts:184-195`).
- **Two LLM inferences per track** (composition + title) (`useAudioComposer.ts:147,151`) —
  each is a full non-streaming completion; roughly every ≥120s cycle.
- Model is **kept warm** (not unloaded between tracks, `SessionProvider.tsx:88-90`) — good for
  freshness, low idle cost (just the heartbeat).

**Proposed approach**
1. **Throttle/replace the rAF tick.** Most param evolution is slow; drop from ~60fps to a
   coarser cadence (e.g. 10–15fps) or move scheduling onto `Tone.Transport.scheduleRepeat`
   (audio clock) + `Tone.Draw` for the few visual syncs. Biggest single win.
2. **Pause visual work when backgrounded** (ties into §2): on `visibilitychange` to hidden,
   stop the rAF entirely and keep only audio scheduling alive via the Transport/media element.
3. **Halve per-track inference:** ask the composition LLM call to also return the title in its
   JSON, removing the separate `generateTrackNameLLM` call (`useAudioComposer.ts:151`).
4. **Relax timers:** heartbeat 1s → 5–10s; checkpoint 5s → 15–30s (or checkpoint on section
   boundaries instead of wall-clock).
5. **Keep freshness:** retain warm model + per-track generation; freshness comes from varied
   directions (§1 lean-in, stimulus, preference), not from CPU-spinning the runtime.

**Decided:** **always optimized, no toggle.** All of the above are on by default with no
user-facing mode. There's no quality cost — the optimizations remove wasted CPU (over-frequent
frames/timers, a redundant inference), not musical variation. Ties directly into §2: when
backgrounded we drop the visual rAF entirely and rely on the audio clock.

**Effort:** S–M. Mostly loop-cadence changes + merging the title call; low risk, measurable.

---

## Suggested sequencing

1. **§5 battery loop cadence** (quick win, also de-risks §2's background scheduling).
2. **§2 background playback** (highest value; needs the Transport-scheduling from §5 and
   artwork from §3).
3. **§3 logo/icons** (feeds §2 MediaSession artwork and §4 onboarding visuals).
4. **§1 mood lean-in** (self-contained; surfaces an already-wired channel).
5. **§4 onboarding + offline prep** (best last — install guidance references the finished
   logo/brand and the offline story).

## Cross-cutting notes
- §2, §3, §5 are interdependent (Transport scheduling ↔ background ↔ artwork) — plan them
  together even if shipped separately.
- Everything stays offline-first; no new network dependencies introduced.
- The existing `CompositionDirection` + `ManualMoodStimulusPlugin` + `moodToIntent` give §1 a
  low-risk path with no new generation infrastructure.
