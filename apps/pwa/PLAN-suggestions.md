# ambient-fm — Suggestions system plan

**Aim:** give the listener new things to try; if they linger and like something, it
folds into their emergent "Your Sound" — **passively (auto-drift)**, no explicit
"adopt" step.

## Where suggestions live
As ✨ bubbles orbiting the Radio, mixed 1–2 at a time among the familiar anchors
(seed genres + your saved Sounds). Kept a small fraction of the ~8 bubbles so it's
fresh, not disorienting. Leaning into one plays it (from the buffer) like any lean.

## How incorporation works (decided: auto-drift only)
No save/adopt prompt. A leaned-in suggestion flows through the *existing* path:
`pickSource → compose → play → complete/like feedback → preference model`. The
longer you linger (more completed tracks in that vibe) and the more you like it,
the more "Your Sound" drifts toward it — weighted by dwell, below an explicit ❤
(same mechanism as normal listening). So passive discovery becomes ownership on
its own, with no new machinery.

## Candidate generation (offline-first, deterministic → LLM later)
1. **Contextual** — time-of-day / weather → a fitting theme, contextually named
   (e.g. "Evening wind-down"). *Built.*
2. **Adjacent-to-taste** — take Your Sound and nudge one mood axis (brighter /
   softer / more energy) → novelty right next to comfort (e.g. "Brighter you").
   *Building now.*
3. **Theme blends** — fuse two seed themes into a new named vibe (e.g. "Lo-fi ×
   Dreamy") → exploration a step further out. *Next.*
4. **Rediscovery** — a saved Sound you haven't heard in a while. *Optional.*
5. **LLM-authored** — during a buffer-fill window (model already loaded, no extra
   load), ask the model to invent a novel named theme + vibe; cache a few and
   refresh occasionally. *Follow-up (richest, but gated on the model being warm).*

## Selection / rotation
- Show **1–2** suggestions at once; rotate across sessions so it feels alive.
- Prefer suggestions *near-but-not-identical* to current taste (don't suggest what
  they already always get).
- **Decay** suggestions the user skips/dislikes (read from feedback); re-surface
  ones they linger on less often (they've "got" it — it's drifting in already).

## Flow / logic integration
- **Radio**: suggestion bubbles (✨) → lean in → buffered playback → completes/likes
  feed taste. No separate screen.
- **Preference model**: unchanged; suggestions just widen exposure. "Your Sound"
  (YourSound screen) visibly evolves as lingered-on suggestions drift in.
- **Studio**: no requirement under auto-drift; a future nicety is seeding a new
  Studio draft from "what you've been enjoying," but that's not needed now.

## Guardrails
- Novelty ratio stays low (1–2 of ~8 bubbles) so the station stays comfortable.
- Everything deterministic works fully offline; LLM suggestions are additive.
- No new persistence — suggestions are ephemeral `LeanTarget`s (kind `suggested`);
  engagement is captured by the existing feedback rows (mood/key/bpm).

## Build order
1. Adjacent-to-taste suggestion in `buildRadioBubbles` (now).
2. Theme-blend suggestion.
3. Rotation + decay (read feedback to weight/skip suggestions).
4. LLM-authored suggestions during buffer fill.
