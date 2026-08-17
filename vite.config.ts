import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'node:path'

// `vite build --mode singlefile` inlines all JS/CSS into one portable index.html
// (open it straight from the filesystem — no dev server). Normal `vite build` is
// unaffected. vite-plugin-singlefile is built for exactly this file:// use case.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'singlefile' ? [viteSingleFile()] : [])],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))
