import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates the PWA icon set (favicon, 192/512 any + maskable, apple-touch-icon)
// from the single source SVG, and injects the matching <link> tags into index.html.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: minimal2023Preset,
  images: ['public/favicon.svg'],
})
