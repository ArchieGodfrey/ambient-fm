import * as Tone from "tone";

// Salamander Grand Piano — 18 samples covering A1–C6
// Files are at /samples/piano/ (already downloaded)
const URLS: Record<string, string> = {
  "A1": "A1.mp3", "C2": "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3",
  "A2": "A2.mp3", "C3": "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3",
  "A3": "A3.mp3", "C4": "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3",
  "A4": "A4.mp3", "C5": "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3",
  "A5": "A5.mp3", "C6": "C6.mp3",
};

let sampler: Tone.Sampler | null = null;
let loadPromise: Promise<Tone.Sampler> | null = null;

export function getPianoSampler(): Tone.Sampler | null {
  return sampler;
}

export function loadPianoSampler(): Promise<Tone.Sampler> {
  if (sampler) return Promise.resolve(sampler);
  if (loadPromise) return loadPromise;
  loadPromise = new Promise<Tone.Sampler>((resolve, reject) => {
    sampler = new Tone.Sampler({
      urls: URLS,
      baseUrl: "/samples/piano/",
      onload: () => resolve(sampler!),
      onerror: (e) => reject(new Error(String(e))),
    });
  });
  return loadPromise;
}
