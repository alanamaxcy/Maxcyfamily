import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Stamped into the bundle and written to /version.json, so a running app can
 * tell whether the deploy it booted from is still the current one. Without
 * this, an iPad on a wall keeps whatever build it happened to start with —
 * nobody ever thinks to pull-to-refresh a picture frame.
 */
const BUILD_ID = `${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`

function emitVersion(): Plugin {
  return {
    name: 'emit-version',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ build: BUILD_ID }),
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), emitVersion()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2020',
    // Safari on older iPads chokes on very large single chunks; keep vendor split out.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
})
