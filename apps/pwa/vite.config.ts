import { defineConfig, loadEnv } from 'vite'
import { createReadStream, cpSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
  base: './',
  plugins: [
    {
      name: 'ort-serve',
      // Dev: serve ORT files from node_modules at /ort/ (avoids public/ import restriction)
      configureServer(server) {
        const ortDist = resolve('node_modules/onnxruntime-web/dist');
        server.middlewares.use('/ort', (req, res, next) => {
          const file = (req.url ?? '').replace(/^\//, '').split('?')[0];
          if (!file || file.includes('..')) { next(); return; }
          const ext = (file.split('.').pop() ?? '');
          const mime = ext === 'wasm' ? 'application/wasm' : 'text/javascript';
          res.setHeader('Content-Type', mime);
          createReadStream(join(ortDist, file)).on('error', () => next()).pipe(res);
        });
      },
      // Production: copy MJS files alongside the already-copied WASM files
      closeBundle() {
        const ortDist = resolve('node_modules/onnxruntime-web/dist');
        const dest = resolve('public/ort');
        mkdirSync(dest, { recursive: true });
        for (const f of ['ort.bundle.min.mjs','ort.min.mjs','ort.wasm.bundle.min.mjs',
                          'ort.wasm.min.mjs','ort.webgl.min.mjs','ort.webgpu.bundle.min.mjs',
                          'ort.webgpu.min.mjs','ort-wasm-simd-threaded.jsep.mjs',
                          'ort-wasm-simd-threaded.mjs']) {
          try { cpSync(join(ortDist, f), join(dest, f)); } catch { /* skip if missing */ }
        }
      },
    },
    mkcert(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['favicon.svg', 'manifest.webmanifest'],
      devOptions: {
        enabled: true,
        type: 'module',
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,ico,png,txt,webmanifest,onnx,json,wasm,mp3}'],
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
      },
      manifest: {
        name: 'Ambient FM',
        short_name: 'AmbientFM',
        description: 'A minimal ambient audio PWA.',
        start_url: '.',
        scope: './',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
  optimizeDeps: {
    exclude: ['kokoro-js', '@huggingface/transformers', 'piper-tts-web', 'piper-wasm'],
  },
  define: {
    // Inject token into worker at build time so it can auth CDN redirects directly.
    // Only present in dev builds (token is empty string in production CI).
    __HF_TOKEN__: JSON.stringify(env.HF_TOKEN ?? ''),
  },
  server: {
    https: true,
    host: '0.0.0.0',
    port: 5173,

    proxy: {
      '/hf-proxy': {
        target: 'https://huggingface.co',
        changeOrigin: true,
        secure: true,
        rewrite: (path: string) => path.replace(/^\/hf-proxy/, ''),
        configure: (proxy: any) => {
          proxy.on('proxyReq', (proxyReq: any) => {
            const token = env.HF_TOKEN;
            if (token) proxyReq.setHeader('Authorization', `Bearer ${token}`);
          });


        },
      },
    },
  },
  preview: {
    https: true,
    host: '0.0.0.0',
    port: 4173,
  }
  };
})