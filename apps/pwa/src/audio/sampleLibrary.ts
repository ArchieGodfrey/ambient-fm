import { SAMPLE_INSTRUMENTS } from "./palettes";

// The real-instrument samples live in public/samples/ and are cached offline via
// a service-worker runtime-cache rule. The setup wizard "downloads" them (like the
// model + voice) by fetching each one to warm that cache; afterwards Tone.Sampler
// loads them from cache, so sampled palettes work offline.

export function sampleUrls(): string[] {
  const base = import.meta.env.BASE_URL; // "/" locally, "/ambient-fm/" on Pages
  const urls: string[] = [];
  for (const inst of Object.keys(SAMPLE_INSTRUMENTS)) {
    for (const file of Object.values(SAMPLE_INSTRUMENTS[inst])) urls.push(`${base}samples/${inst}/${file}`);
  }
  return urls;
}

// Fetch every sample so the SW caches it. Reports (loaded, total) for progress.
export async function downloadSamples(onProgress?: (loaded: number, total: number) => void): Promise<boolean> {
  const urls = sampleUrls();
  let ok = true;
  let done = 0;
  onProgress?.(0, urls.length);
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) ok = false;
      await res.arrayBuffer(); // drain so the SW fully caches the response
    } catch {
      ok = false;
    }
    onProgress?.(++done, urls.length);
  }
  return ok;
}
