import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths: OBS can load dist/index.html as a local file.
  base: './',
  plugins: [react()],
})
