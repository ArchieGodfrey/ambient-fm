/**
 * Server-side Kokoro TTS synthesis server.
 * Runs alongside the Vite dev server — proxied via /api/tts so the client
 * hits the same HTTPS origin with no CORS issues.
 *
 * Usage: bun run server/tts.ts
 */

import { KokoroTTS, type GenerateOptions } from 'kokoro-js';

type Voice = NonNullable<GenerateOptions['voice']>;

const PORT = Number(process.env.TTS_PORT ?? 5176);
// Allow GitHub Pages origin + local dev. Override with TTS_ALLOWED_ORIGIN env var.
const ALLOWED_ORIGIN = process.env.TTS_ALLOWED_ORIGIN ?? '*';

let tts: KokoroTTS | null = null;
let loadError: string | null = null;
let loading = false;

async function ensureModel(): Promise<KokoroTTS> {
  if (tts) return tts;
  while (loading) await new Promise(r => setTimeout(r, 200));
  if (tts) return tts;
  if (loadError) throw new Error(loadError);

  loading = true;
  console.log('[tts] Loading Kokoro model (server-side, onnxruntime)...');
  try {
    tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8',
      progress_callback: (info: Record<string, unknown>) => {
        if (info.status === 'downloading') process.stdout.write('.');
      },
    });
    console.log('\n[tts] Kokoro ready');
    return tts;
  } catch (err) {
    loadError = String(err);
    throw err;
  } finally {
    loading = false;
  }
}

// Pre-load on startup
ensureModel().catch(err => console.error('[tts] Preload failed:', err));

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Expose-Headers': 'X-Sample-Rate, X-Elapsed',
    };

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

    if (url.pathname === '/status') {
      return Response.json({ ready: !!tts, loading, error: loadError }, { headers: corsHeaders });
    }

    if (url.pathname === '/synthesize' && req.method === 'POST') {
      try {
        const model = await ensureModel();
        const { text, voice } = await req.json() as { text: string; voice?: Voice };
        if (!text) return new Response('text required', { status: 400 });

        const t0 = Date.now();
        const output = await model.generate(text, { voice: voice ?? 'af_sky' });
        const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
        console.log(`[tts] synthesised "${text.slice(0, 40)}" in ${elapsed}s`);

        const audio = output.audio instanceof Float32Array
          ? output.audio : new Float32Array(output.audio);

        return new Response(audio.buffer, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/octet-stream',
            'X-Sample-Rate': String(output.sampling_rate),
            'X-Elapsed': elapsed,
          },
        });
      } catch (err) {
        console.error('[tts] synthesis error:', err);
        return new Response(String(err), { status: 500, headers: corsHeaders });
      }
    }

    return new Response('Not found', { status: 404 });
  },
});

console.log(`[tts] Synthesis server running at http://localhost:${PORT}`);
