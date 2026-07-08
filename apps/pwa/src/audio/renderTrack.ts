import * as Tone from "tone";
import type { CompositionPlan, CompositionSection, Phrase } from "../ai/types";
import { resetAudioModules, markLiveGraphDirty } from "./resetAudio";
import { beginRender, endRender } from "./renderGate";
import { PALETTES } from "./palettes";
import { preloadInstrument } from "./sampleBuffers";
import { initAudioGraph, applyComposition } from "./audioGraph";
import { startScheduler, tick as schedulerTick } from "./sectionScheduler";
import { activatePhrase, updatePhraseIntensity } from "./phraseRuntime";
import { setMelody } from "./melodyTrack";
import { setHarmony } from "./harmonyTrack";
import { setPercussion } from "./percussionTrack";
import { applySectionToAudio } from "./mapSectionToAudio";
import { deriveComposerState, getDrift } from "./compositionRuntime";
import { composerState } from "../composer/composerState";
import { field, getTick } from "../music/random/randomField";

// How often (in transport seconds) the offline render re-evaluates the musical
// evolution. Mirrors the live rAF tick's ~20fps throttle (TICK_INTERVAL_MS = 50).
const RENDER_TICK_SECONDS = 0.05;

const MIN_DURATION = 8;
const MAX_DURATION = 180;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// Encode an AudioBuffer as a 16-bit PCM WAV Blob (interleaved channels + RIFF
// header). Standalone so it can be reused by any renderer.
export function bufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;

  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i));
  };

  // RIFF chunk descriptor
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  // "fmt " sub-chunk
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // sub-chunk size (16 for PCM)
  view.setUint16(20, 1, true); // audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true); // bits per sample
  // "data" sub-chunk
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch += 1) channels.push(buffer.getChannelData(ch));

  let offset = 44;
  for (let frame = 0; frame < numFrames; frame += 1) {
    for (let ch = 0; ch < numChannels; ch += 1) {
      const sample = Math.max(-1, Math.min(1, channels[ch][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

// Render a CompositionPlan to a WAV Blob by running the EXISTING composition
// engine inside a Tone.Offline context. The audio graph + tracks are rebuilt in
// the offline context, then the live per-frame evolution loop
// (compositionRuntime's tick) is reproduced on a repeating offline-transport
// callback so the rendered audio matches live playback. NOT wired into playback.
export async function renderTrack(plan: CompositionPlan): Promise<Blob> {
  const rawDuration =
    typeof plan.duration === "number" && Number.isFinite(plan.duration) && plan.duration > 0
      ? plan.duration
      : 30;
  const duration = clamp(rawDuration, MIN_DURATION, MAX_DURATION);

  // Pre-decode the palette's sampled instrument on the LIVE context first. Building
  // a Tone.Sampler from URLs inside Tone.Offline loads asynchronously and never
  // resolves Tone.loaded() there → the sampled voice renders silent. With the
  // buffers cached, the offline Sampler is built ready, with no load.
  const sampleInst = plan.palette ? PALETTES[plan.palette]?.sample : undefined;
  if (sampleInst) await preloadInstrument(sampleInst);

  // Mark the render window: for its duration Tone's global context is offline, so
  // the voice/SFX must wait or skip rather than play into the render.
  beginRender();
  let rendered: Awaited<ReturnType<typeof Tone.Offline>>;
  try {
    rendered = await Tone.Offline(async () => {
    // During the Offline callback the global Tone context IS the offline context,
    // so getTransport()/toDestination()/new Tone.Part etc. all bind to it.
    const transport = Tone.getTransport();

    // Rebuild every cached audio singleton in THIS offline context, and mark the
    // live graph dirty so the next live playback rebuilds in the live context.
    markLiveGraphDirty();
    resetAudioModules();

    // Build the graph + tracks exactly as live playback does.
    initAudioGraph();
    applyComposition(plan);
    startScheduler(plan, 0); // offline clock is transport.seconds, starting at 0
    setMelody(plan.melodyNotes, plan.melodyInstrument);
    setHarmony(plan.chordEvents, plan.bassEvents, plan.arpDensity, plan.vocalLevel, plan.palette);
    setPercussion(plan.percussionDensity);
    transport.bpm.value = plan.bpm;
    // No buffer-load wait: sampled palettes are pre-decoded (preloadInstrument
    // above) so the Sampler is built ready, and everything else is synths.

    let currentPhrase: Phrase | null = null;
    // schedulerTick expects a ms clock measured from startScheduler's base (0);
    // transport.seconds * 1000 makes elapsed === transport.seconds.
    const clockMs = () => transport.seconds * 1000;

    // Reproduce compositionRuntime.tick's body on the offline transport clock.
    transport.scheduleRepeat(() => {
      const cursor = transport.seconds;
      const activeSection: CompositionSection | null =
        plan.sections.find((s) => cursor >= s.start && cursor < s.start + s.duration) ?? null;
      const beatTick = getTick(cursor, plan.bpm);
      const drift = getDrift(plan, beatTick);

      schedulerTick(clockMs, (phrase) => {
        currentPhrase = phrase;
        const phraseRng = field(plan.seed, beatTick, `phrase_${phrase.id}`);
        activatePhrase(
          phrase,
          plan.motifs ?? [],
          activeSection?.intensity ?? 0.5,
          composerState.currentDensity,
          phraseRng,
        );
      });

      if (currentPhrase) {
        updatePhraseIntensity(activeSection?.intensity ?? 0.5);
      }

      const derived = deriveComposerState(plan, beatTick);
      transport.bpm.value = derived.bpm;
      applySectionToAudio(activeSection, derived.layers, { ...plan, texture: derived.texture }, drift);
    }, RENDER_TICK_SECONDS);

    transport.start(0);
    }, duration, 2);
  } finally {
    endRender();
  }

  const audioBuffer = rendered.get();
  if (!audioBuffer) {
    throw new Error("renderTrack: offline render did not produce an audio buffer");
  }
  return bufferToWav(audioBuffer);
}
