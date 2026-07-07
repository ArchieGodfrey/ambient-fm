import * as Tone from "tone";

// A short mechanical "cha-chunk" — a disc seating into / releasing from the tray.
// Synthesized on the fly (no samples). Routed straight to the hardware
// destination so it plays at full even while the master fades in — which also
// masks the tiny transient when audio first starts. Fits the CD metaphor.

function ctxNow(): [AudioContext, number] | null {
  try {
    const c = Tone.getContext().rawContext as unknown as AudioContext;
    if (c.state !== "running") return null;
    return [c, c.currentTime];
  } catch {
    return null;
  }
}

// Low pitched thump that drops in pitch — the disc seating.
function thunk(ctx: AudioContext, t: number, from: number, to: number, peak: number) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + 0.13);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.24);
}

// Short filtered noise burst — the mechanical click/latch.
function click(ctx: AudioContext, t: number, freq: number, peak: number, dur = 0.045) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = 0.9;
  const g = ctx.createGain();
  g.gain.value = peak;
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(t);
  src.stop(t + dur);
}

// Disc seating — a click then a settling thump.
export function playInsert() {
  const cn = ctxNow();
  if (!cn) return;
  const [ctx, t] = cn;
  click(ctx, t, 2600, 0.16);
  thunk(ctx, t + 0.05, 210, 62, 0.45);
}

// Disc releasing — a thump then a latch click.
export function playEject() {
  const cn = ctxNow();
  if (!cn) return;
  const [ctx, t] = cn;
  thunk(ctx, t, 150, 46, 0.4);
  click(ctx, t + 0.07, 2000, 0.13);
}
