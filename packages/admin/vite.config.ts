import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'

// Writes dist/.build-complete as the final step of `vite build`. server.ts
// uses this sentinel to detect partial/OOM-killed builds — without it a
// half-written dist would be served as broken 500s.
function buildSentinel(): Plugin {
  return {
    name: 'kritano:build-sentinel',
    apply: 'build',
    closeBundle() {
      writeFileSync(
        resolve(__dirname, 'dist/.build-complete'),
        `${new Date().toISOString()}\n`,
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), buildSentinel()],
  base: '/admin/',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: parseInt(process.env.VITE_INTERNAL_PORT || process.env.ADMIN_PORT || '3006'),
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.PORT || '3005'}`,
        changeOrigin: true,
      },
    },
    hmr: {
      // When behind dev proxy, HMR WebSocket connects directly to Vite's port
      ...(process.env.VITE_INTERNAL_PORT ? { clientPort: parseInt(process.env.VITE_INTERNAL_PORT) } : {}),
    },
  },
  optimizeDeps: {
    include: [
      'use-sync-external-store/shim',
      'use-sync-external-store/shim/with-selector',
    ],
  },
  build: {
    outDir: 'dist',
  },
})
