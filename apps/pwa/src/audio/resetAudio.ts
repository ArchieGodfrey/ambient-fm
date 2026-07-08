import { resetAudioGraph } from "./audioGraph";
import { resetHarmony } from "./harmonyTrack";
import { resetMelody } from "./melodyTrack";
import { resetPercussion } from "./percussionTrack";
import { resetPhraseRuntime } from "./phraseRuntime";
import { resetInstruments } from "./instruments";

// The audio modules cache their Tone nodes as module-level singletons bound to
// the Tone context they were created in. To render a track in an OFFLINE context
// (Tone.Offline) every node must be rebuilt there, and to keep LIVE playback
// working every node must be rebuilt again in the live context afterwards.
//
// This disposes all of those singletons and nulls them, so the next setup call
// (initAudioGraph / setHarmony / setMelody / setPercussion / activatePhrase)
// rebuilds against whatever Tone context is currently active. Call it before an
// offline render AND at the top of startCompositionRuntime.
export function resetAudioModules() {
  resetInstruments();
  resetPhraseRuntime();
  resetAudioGraph();
  resetHarmony();
  resetMelody();
  resetPercussion();
}

// An offline render disposes the singletons and rebuilds them in the offline
// context, so the LIVE graph must be rebuilt before the next live playback. We
// only want to pay that (and risk it) when a render actually happened — so an
// offline render marks the live graph dirty, and startCompositionRuntime rebuilds
// only if dirty. With no renders, the live path is completely untouched.
let liveGraphDirty = false;
export function markLiveGraphDirty() { liveGraphDirty = true; }
export function resetAudioModulesIfDirty() {
  if (!liveGraphDirty) return;
  liveGraphDirty = false;
  resetAudioModules();
}
