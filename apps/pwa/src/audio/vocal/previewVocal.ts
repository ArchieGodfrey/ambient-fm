import { getVocalSynth } from './vocalSynth';
import { getPiperSynth } from './piperSynth';

const PREVIEW_TEXT = 'salt light before the tide';

function playFloat32(audio: Float32Array, sampleRate: number, ctx: AudioContext): number {
  const buffer = ctx.createBuffer(1, audio.length, sampleRate);
  buffer.getChannelData(0).set(audio);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
  return (audio.length / sampleRate) * 1000;
}

export async function previewVocal(voice: string): Promise<number> {
  // Web Speech — no AudioContext needed
  if (voice === 'browser') {
    return new Promise<number>((resolve) => {
      if (!('speechSynthesis' in window)) { resolve(0); return; }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(PREVIEW_TEXT);
      u.rate = 0.8; u.volume = 0.85;
      u.onend = () => resolve(0); u.onerror = () => resolve(0);
      window.speechSynthesis.speak(u);
    });
  }

  // Create and begin resuming the AudioContext NOW — synchronously within the
  // user gesture handler, before any async synthesis. The browser requires
  // AudioContext.resume() to be called within the gesture activation window.
  // We await the promise later, after synthesis completes.
  const ctx = new AudioContext();
  const resumePromise = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();

  if (voice.startsWith('piper_')) {
    try {
      const raw = await getPiperSynth().synthesize(PREVIEW_TEXT, voice);
      await resumePromise;
      return playFloat32(raw.audio, raw.sampleRate, ctx);
    } catch (err) {
      console.warn('[previewVocal] Piper failed:', err);
    }
  } else {
    // Kokoro voices
    try {
      const raw = await getVocalSynth().synthesize(PREVIEW_TEXT, voice);
      await resumePromise;
      return playFloat32(raw.audio, raw.sampleRate, ctx);
    } catch (err) {
      console.warn('[previewVocal] Kokoro unavailable, falling back to Web Speech:', err);
    }
  }

  // Web Speech fallback if synthesis failed
  await resumePromise.catch(() => {});
  return new Promise<number>((resolve) => {
    if (!('speechSynthesis' in window)) { resolve(0); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(PREVIEW_TEXT);
    u.rate = 0.75; u.volume = 0.8;
    u.onend = () => resolve(0); u.onerror = () => resolve(0);
    window.speechSynthesis.speak(u);
  });
}
