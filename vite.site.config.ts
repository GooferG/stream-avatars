import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// The viewer-facing avatar builder, the only page published (GitHub Pages,
// see .github/workflows/pages.yml). The overlay and the strip stay local.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist-site',
    rolldownOptions: {
      input: { builder: fileURLToPath(new URL('./builder.html', import.meta.url)) },
    },
  },
})
