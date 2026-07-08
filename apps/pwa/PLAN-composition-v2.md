# ambient-fm — Composition v2 plan (musical variety)

**Problem:** generated tracks feel very similar, even across different lean-in moods.

## Root cause (from a full pipeline audit — not the model)

The in-browser LLM emits only **7 scalars** (`ai/intentSchema.ts`): key, bpm, progression,
motifDensity, complexity, energy, title. **Everything that gives a track its character is
hardcoded downstream** in `ai/intentToPlan.ts` and a fixed synth set. So the mood you pick
changes a few numbers; it never changes *what instruments play, how the piece is built, or how
the melody moves*. Specifics:

- **Instrumentation is a fixed ~10-voice synth set** (`audio/instruments/*`, `audio/layers/*`,
  `audio/harmonyTrack.ts`). Every track uses the same voices; mood only toggles 3 binaries
  (arp / choir / drums present). No samples anywhere. → biggest sameness driver.
- **Identical arrangement every track**: fixed 4-section arc `[0.55,0.75,1,0.65]`, fixed section
  moods, equal-length sections (`intentToPlan.ts:71-81`); fixed layer mix
  `{drone:.3,pad:.7,texture:.5,pulse:.3}` (`:113-118`).
- **One melodic algorithm**: stepwise chord-tone walk with only **3 rhythm pools** by energy band
  (`music/motifs/generator.ts`). Contour is statistically the same every time.
- **Fixed voicing**: chords always root/3rd/5th@oct3, bass@oct2 (`intentToPlan.ts:85-92`).
- **The lean-in mood is laundered through the LLM as prose** (`soundToDirection` sends only
  `moodWords`), not passed deterministically. The distinct numeric energies in the theme presets
  (0.22 vs 0.85) never reach the plan — the small model re-interprets prose and converges. This
  is why different lean-ins still sound alike.
- Dead/ignored: `intent.bpm` is unused (tempo = `60 + energy*40`, only 60–100 BPM).

**Implication:** widen the *output space* the composer can occupy. The model is not the lever.

## The three questions you asked

### 1. Model upgrade (Gemma 4 / newer on WebLLM)?
There is **no Gemma 4** — Gemma 3 is the current generation. **Gemma 3 is NOT in WebLLM's
official prebuilt list yet** (open request, only community/experimental builds); WebLLM prebuilt
offers Gemma 2 (2b/9b), Llama-3.2, Qwen2.5, Phi-3.5, etc. Given the root cause, **a bigger model
won't fix variety** — it would still be squeezed through the same 7 scalars and hardcoded plan.
Recommendation: **don't chase the model first.** Once the intent schema is widened (below), a
modestly larger model (e.g. Qwen2.5-1.5B / Gemma-2-2b) *could* fill the richer schema better —
but that's Phase D, gated on iOS memory, and optional.

### 2. Expand Tone.js + real instruments?
Yes — this is the **highest-leverage** change for perceived variety (timbre). Add
**`Tone.Sampler`** with **real recorded instrument samples** — the `tonejs-instruments` library
covers piano, guitars, strings, harp, cello, flute, etc. (mp3/ogg, pitch-shifted to fill gaps).
Offline: bundle/cache a **curated subset** (a few MB) via the service worker / OPFS, folded into
the existing setup-wizard download. Then a **mood/genre → instrument-palette** mapping picks
different instruments per track (a lo-fi track = electric piano + soft drums; neo-classical =
felt piano + strings; dreamy = pads + harp). This alone breaks the sameness.

### 3. Real vocals — options (offline)?
From lightest to most convincing:
- **(a) Vowel/formant synthesis** — today's "aah" choir. Cheap, clearly synthetic.
- **(b) Pitched TTS ("mesing" approach)** — eSpeak/meSpeak or **our existing Piper** output,
  pitch/time-shifted to the melody → actual words, but robotic. Good for occasional lymalical
  phrases, not lead vocals.
- **(c) Sample-based vocal chops (recommended)** — bundle **real recorded sung vowels/phrases**
  ("ooh"/"aah"/short syllables) and play them through `Tone.Sampler` pitched to the melody. This
  is how most electronic/ambient music gets *convincing* "real vocals" with no singer, and it's
  fully offline. Warm, human, and cheap to run.
- **(d) Neural singing (DiffSinger/RVC-style)** — genuinely convincing lead vocals with lyrics,
  but **not feasible in-browser offline** (huge models, no WebGPU port). Out of scope.

Recommendation: **(c)** for convincing offline vocals as a selectable layer; **(b)** with Piper
as a later option for lyric-ish lines.

## Proposed phases

**Phase A — Deterministic variety (no new assets; biggest bang-for-effort).**
Fix the pipeline so the composer actually explores its space:
- Thread the numeric mood (energy/tension/brightness/calmness) **deterministically** into the
  plan (like complexity/motifDensity already are), so lean-ins diverge — fixes the core bug.
- Make the **section arc, section count, lengths, and layer mix** functions of mood/energy
  instead of constants; add a few arc archetypes (steady / swell / ebb-and-flow).
- Widen tempo (honour `intent.bpm` or a wider mood map).
- Add **multiple melodic strategies** (stepwise, arpeggiated, sparse-sustained, call-response) and
  continuous rhythm variation; vary **voicing** (inversions, spread, register) by mood.
- Use the seed to vary structure, not just micro-jitter.

**Phase B — Instrument palette (real samples).**
`Tone.Sampler` + curated offline sample set; a mood/genre→palette selector; expand intent (or a
deterministic map) so tracks pick different instruments. Cache samples in the setup wizard.

**Phase C — Vocals.**
Sample-based vocal chops (pitched vowels/phrases) as a selectable layer, gated by `vocalLevel`;
optional Piper-pitched phrases later.

**Phase D — Model (optional, last).**
Only after the schema is widened: evaluate a modestly larger model for richer intent, weighed
against iOS memory. Expand `CompositionIntent` to let the model choose palette/arc/vocal style.

## Sequencing rationale
A first (free, fixes the actual cause and the lean-in bug), then B (timbre = the biggest
*perceived* leap), then C (vocals), then D (model) only if the widened schema wants a bigger brain.

## Open decisions
- Offline sample budget (how many instruments / MB) and where they're cached.
- Whether the LLM *chooses* instruments/arc/vocals (needs a wider schema + maybe bigger model) or
  a deterministic mood→palette map does (offline-safe, predictable). Hybrid is likely best.
- Vocals: chops-only now, or also wire Piper-pitched phrases.
