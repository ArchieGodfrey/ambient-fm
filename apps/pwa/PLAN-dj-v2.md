# DJ v2 — hide the generation gap + a proper station host

Folds into the pre-rendered-radio work (feature/composition-v2). Track generation
and rendering stay **untouched** (full length, full quality). The wait before the
first track is covered by the DJ + a soft backing bed instead of shortening music.

## Decisions (locked)
- **Lines:** hybrid — expanded deterministic templates by default; optionally
  pre-generate a few LLM-authored lines during buffering to sprinkle in.
- **Backing bed:** a short pre-rendered ambient loop, played via a media element
  (backgroundable), under the DJ, faded out as the track comes in.
- **Host style:** informational — current time, weather, mood — with a small
  playful tone. Present between tracks (back-announce + intro).

## Constraint found
The render gate made the voice *wait* for renders (so it wouldn't read Tone's
offline context). But the DJ must talk *during* the first-track render to cover
it. Fix: **decouple the voice onto its own AudioContext**, independent of Tone's
offline swap — then the voice never touches the global context and needs no gate.

## Build phases
1. **Voice decouple** — dedicated `AudioContext` in hostPiper (render-decode +
   playback); `unlockVoice()` creates/resumes it in the tune-in tap. Drop the
   voice's render-gate wait in host.ts.
2. **Render mutex** — renderGate becomes a serializing mutex (`runRender`) so the
   bed and track renders never overlap (both swap Tone's global context); keep
   `isRendering()` so the disc SFX still skips during a render.
3. **DJ bed** — `djBed.ts` renders a short soft pad loop once (cached);
   `bedPlayer.ts` plays it on its own gesture-unlocked, low-volume, looping
   element. Fades in under the DJ, out when the track starts.
4. **Talk-until-ready** — the tune-in intro becomes a paced multi-line segment
   that keeps going (informational observations) until the first track is ready,
   instead of one filler line then silence.
5. **Richer line library** — informational + lightly playful templates drawing on
   the same stimulus the music uses (day-part, weather+temp, photo/audio scene
   labels, emotional state) + back-announcing the previous track.
6. **Hybrid LLM sprinkle** (follow-up) — pre-generate a few host lines with the
   loaded model during buffering; mix into the deterministic rotation.
