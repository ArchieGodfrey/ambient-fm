import * as Tone from "tone";
import { isRendering } from "./renderGate";

// A short, soft mechanical "k-thock" — a disc seating into / releasing from the
// tray. Synthesized on the fly (no samples), routed to the hardware destination
// so it plays at full even while the master fades in. Kept clean and gentle: a
// tight latch tick + a rounded, low-passed settle, both with soft attacks so
// there are no clicks/pops that read as glitches.

function ctxNow(): [AudioContext, number] | null {
  // During an offline render the global context is the offline one — skip the SFX
  // rather than route this one-shot into the render.
  if (isRendering()) return null;
  try {
    const c = Tone.getContext().rawContext as unknown as AudioContext;
    if (c.state !== "running") return null;
    return [c, c.currentTime];
  } catch {
    return null;
  }
}

// Rounded low "thock" — a sine that dips in pitch, low-passed so it has body
// without harsh harmonics; soft attack, quick settle.
function thock(ctx: AudioContext, t: number, from: number, to: number, peak: number) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 800;
  osc.type = "sine";
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + 0.13);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.012); // soft attack — no pop
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  osc.connect(g).connect(lp).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.22);
}

// Tight latch "tick" — a very short noise burst through a narrow band-pass (high
// Q) so it reads as a clean click, not a hiss.
function tick(ctx: AudioContext, t: number, freq: number, peak: number) {
  const dur = 0.028;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2); // fast decay = tighter
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = 6; // narrow → a clean tick, not broadband static
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(t);
  src.stop(t + dur + 0.01);
}

// Disc seating — a light latch tick, then the disc settling.
export function playInsert() {
  const cn = ctxNow();
  if (!cn) return;
  const [ctx, t] = cn;
  tick(ctx, t, 1500, 0.06);
  thock(ctx, t + 0.045, 150, 72, 0.16);
}

// Disc releasing — the settle first, then a lighter latch tick.
export function playEject() {
  const cn = ctxNow();
  if (!cn) return;
  const [ctx, t] = cn;
  thock(ctx, t, 130, 60, 0.13);
  tick(ctx, t + 0.06, 1300, 0.05);
}
