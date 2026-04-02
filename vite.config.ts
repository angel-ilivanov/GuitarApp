import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@coderline/alphatab': path.resolve(
        __dirname,
        'node_modules/@coderline/alphatab/dist/alphaTab.core.mjs'
      ),
    },
  },
})
