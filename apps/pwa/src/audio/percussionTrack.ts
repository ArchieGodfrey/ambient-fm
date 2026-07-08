import * as Tone from "tone";

// A gated, tempo-synced percussion pattern (kick / backbeat / hats) whose
// busyness scales with density. Calm pieces (low density) get no drums so the
// ambient character is preserved.
let kick: Tone.MembraneSynth | null = null;
let snare: Tone.NoiseSynth | null = null;
let hat: Tone.NoiseSynth | null = null;
let loop: Tone.Loop | null = null;
let step = 0;

function ensure() {
  if (kick) return;
  kick = new Tone.MembraneSynth({ octaves: 4, envelope: { attack: 0.001, decay: 0.4, sustain: 0 } }).toDestination();
  kick.volume.value = -10;
  snare = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.18, sustain: 0 } }).toDestination();
  snare.volume.value = -22;
  hat = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.04, sustain: 0 } }).toDestination();
  hat.volume.value = -30;
}

export function setPercussion(density?: number) {
  stopPercussion();
  const d = density ?? 0;
  if (d < 0.35) return; // sparse/ambient pieces stay drum-free
  ensure();
  step = 0;
  // 16-step bar. Kick on 1 & 3 (+ a pickup when busy), snare backbeat on 2 & 4,
  // hats on 8ths, tightening to 16ths at high density.
  loop = new Tone.Loop((time) => {
    const s = step % 16;
    if (s === 0 || s === 8 || (d > 0.7 && s === 10)) kick?.triggerAttackRelease("C1", "8n", time);
    if (s === 4 || s === 12) snare?.triggerAttackRelease("16n", time);
    const hatEvery = d > 0.75 ? 1 : 2; // 16ths when busy, else 8ths
    if (s % (hatEvery * 2) === 0) hat?.triggerAttackRelease("32n", time);
    step += 1;
  }, "16n");
  loop.start(0);
}

export function stopPercussion() {
  if (loop) { loop.stop(); loop.dispose(); loop = null; }
}

// Dispose the cached drum voices and null the singletons so the next
// setPercussion() rebuilds them in whatever Tone context is active (offline
// render / live rebuild).
export function resetPercussion() {
  stopPercussion();
  const safe = (fn: () => void) => { try { fn(); } catch { /* node from a disposed context */ } };
  safe(() => kick?.dispose());
  safe(() => snare?.dispose());
  safe(() => hat?.dispose());
  kick = null;
  snare = null;
  hat = null;
}
