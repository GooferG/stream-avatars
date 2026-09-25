import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const page = (file: string) => fileURLToPath(new URL(file, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths: OBS can load the built pages as local files.
  base: './',
  plugins: [react()],
  build: {
    rolldownOptions: {
      // two OBS sources: the avatars overlay and the !avatarinfo strip
      input: {
        main: page('./index.html'),
        avatarInfo: page('./avatar-info.html'),
      },
    },
  },
})
