import type { SingingParams } from './musicTheory';

// ─── Pitch detection ──────────────────────────────────────────────────────────

export function detectF0(audio: Float32Array, sr: number): number | null {
  const len = Math.min(audio.length, (sr * 0.4) | 0);
  const minPeriod = Math.floor(sr / 500);
  const maxPeriod = Math.floor(sr / 60);

  let rms = 0;
  for (let i = 0; i < len; i++) rms += audio[i] * audio[i];
  if (Math.sqrt(rms / len) < 0.004) return null;

  let bestPeriod = minPeriod, bestDiff = Infinity;
  for (let tau = minPeriod; tau <= maxPeriod; tau++) {
    let diff = 0;
    for (let i = 0; i < len - tau; i++) { const d = audio[i] - audio[i + tau]; diff += d * d; }
    if (diff < bestDiff) { bestDiff = diff; bestPeriod = tau; }
  }
  return sr / bestPeriod;
}

// ─── Onset detection ──────────────────────────────────────────────────────────

function detectOnsets(audio: Float32Array, sr: number): number[] {
  const win = Math.floor(sr * 0.02);
  const minGap = Math.floor(sr * 0.08);
  const threshold = 0.012;

  const energy: number[] = [];
  for (let i = 0; i < audio.length; i += win) {
    let s = 0; const end = Math.min(i + win, audio.length);
    for (let j = i; j < end; j++) s += audio[j] * audio[j];
    energy.push(Math.sqrt(s / (end - i)));
  }
  const smooth = energy.map((_, i) => {
    let s = 0, n = 0;
    for (let j = Math.max(0, i - 1); j <= Math.min(energy.length - 1, i + 1); j++) { s += energy[j]; n++; }
    return s / n;
  });

  const onsets: number[] = [0];
  for (let i = 1; i < smooth.length - 1; i++) {
    if (smooth[i] - smooth[i - 1] > threshold && smooth[i] > 0.008) {
      const idx = i * win;
      if (idx - onsets[onsets.length - 1] > minGap) onsets.push(idx);
    }
  }
  return onsets;
}

// ─── Pitch shift ──────────────────────────────────────────────────────────────

function resamplePitch(audio: Float32Array, semitones: number): Float32Array {
  const ratio = Math.pow(2, semitones / 12);
  const outLen = Math.round(audio.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const src = i * ratio; const lo = src | 0; const hi = lo + 1; const frac = src - lo;
    out[i] = hi < audio.length ? audio[lo] * (1 - frac) + audio[hi] * frac
           : lo < audio.length ? audio[lo] : 0;
  }
  return out;
}

function crossfade(a: Float32Array, b: Float32Array, fadeLen: number): Float32Array {
  const len = Math.min(fadeLen, a.length, b.length);
  const out = new Float32Array(a.length + b.length - len);
  out.set(a.slice(0, a.length - len));
  for (let i = 0; i < len; i++) {
    const t = i / len;
    out[a.length - len + i] = a[a.length - len + i] * (1 - t) + b[i] * t;
  }
  out.set(b.slice(len), a.length);
  return out;
}

// ─── Time stretch (OLA) ───────────────────────────────────────────────────────

/** Overlap-Add time stretch — changes duration without changing pitch.
 *  Clamped to 0.25×–4× to avoid extreme artefacts. */
function timeStretch(audio: Float32Array, sr: number, targetSec: number): Float32Array {
  const currentSec = audio.length / sr;
  let factor = targetSec / currentSec;
  factor = Math.max(0.25, Math.min(4, factor));
  if (Math.abs(factor - 1) < 0.04) return audio; // already close

  const winSize = Math.floor(sr * 0.025); // 25 ms window
  const hopIn  = Math.floor(winSize * 0.25);
  const hopOut = Math.round(hopIn * factor);
  const outLen = Math.ceil(targetSec * sr);

  const out    = new Float32Array(outLen);
  const counts = new Float32Array(outLen);

  // Hanning window
  const hann = new Float32Array(winSize);
  for (let i = 0; i < winSize; i++) hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (winSize - 1)));

  let inPtr = 0, outPtr = 0;
  while (inPtr + winSize <= audio.length && outPtr + winSize <= outLen) {
    for (let i = 0; i < winSize; i++) {
      const oi = outPtr + i;
      out[oi]    += audio[inPtr + i] * hann[i];
      counts[oi] += hann[i];
    }
    inPtr  += hopIn;
    outPtr += hopOut;
  }

  // Normalise
  for (let i = 0; i < outLen; i++) if (counts[i] > 0.001) out[i] /= counts[i];

  // Fade out last 80 ms to avoid abrupt cutoff
  const fadeLen = Math.min(Math.floor(sr * 0.08), outLen);
  for (let i = 0; i < fadeLen; i++) out[outLen - 1 - i] *= i / fadeLen;

  // Fade in first 20 ms
  const fadeIn = Math.min(Math.floor(sr * 0.02), outLen);
  for (let i = 0; i < fadeIn; i++) out[i] *= i / fadeIn;

  return out;
}

// ─── Vibrato ──────────────────────────────────────────────────────────────────

function addVibrato(audio: Float32Array, sr: number, rateHz: number, depthSemi: number): Float32Array {
  const out = new Float32Array(audio.length);
  const maxDelay = (depthSemi / 12) * Math.log2(2) * sr * 5;
  for (let i = 0; i < audio.length; i++) {
    const phase = (2 * Math.PI * rateHz * i) / sr;
    const src = i - maxDelay * Math.sin(phase);
    const lo = src | 0; const hi = lo + 1; const frac = src - lo;
    out[i] = lo >= 0 && hi < audio.length ? audio[lo] * (1 - frac) + audio[hi] * frac
           : lo >= 0 && lo < audio.length ? audio[lo] : 0;
  }
  return out;
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

/** Phase 1+2+3 pipeline:
 *  1. Syllable onset detection
 *  2. Per-syllable pitch shift to chord tone
 *  3. OLA time stretch to target bar duration
 *  4. Vibrato + fade */
export function processForSinging(
  audio: Float32Array,
  sr: number,
  params: SingingParams,
): Float32Array {
  const speechF0 = detectF0(audio, sr);
  if (!speechF0 || speechF0 <= 0) return audio;

  const { chordNotesHz, rootHz, vibratoRate, vibratoDepth, targetDurationSec } = params;
  const targets = chordNotesHz.length > 0 ? chordNotesHz : [rootHz];
  const onsets = detectOnsets(audio, sr);
  const fadeLen = Math.floor(sr * 0.008);

  let pitched: Float32Array;

  if (onsets.length <= 1) {
    // Phase 1 fallback — global shift to root
    const semitones = Math.max(-24, Math.min(24, 12 * Math.log2(rootHz / speechF0)));
    pitched = resamplePitch(audio, semitones);
  } else {
    // Phase 2 — syllable-level chord tone mapping
    let result: Float32Array = new Float32Array(0);
    for (let i = 0; i < onsets.length; i++) {
      const start = onsets[i];
      const end = i + 1 < onsets.length ? onsets[i + 1] : audio.length;
      const segment = audio.slice(start, end);
      const segF0 = detectF0(segment, sr) ?? speechF0;
      const targetHz = targets[i % targets.length];
      const semitones = Math.max(-24, Math.min(24, 12 * Math.log2(targetHz / segF0)));
      const shifted = resamplePitch(segment, semitones);
      result = result.length === 0 ? shifted : crossfade(result, shifted, fadeLen);
    }
    pitched = result;
  }

  // Phase 3 — time stretch to target musical duration
  const stretched = timeStretch(pitched, sr, targetDurationSec);

  // Vibrato applied after stretching
  return addVibrato(stretched, sr, vibratoRate, vibratoDepth);
}
