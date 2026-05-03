import { defineConfig } from 'astro/config'

const port = parseInt(process.env.ASTRO_INTERNAL_PORT || '4321')

export default defineConfig({
  server: { port },
  output: 'server',
  prefetch: {
    defaultStrategy: 'hover',
  },
  compressHTML: true,
  vite: {
    server: {
      hmr: {
        // When behind dev proxy, HMR WebSocket connects directly to Astro's port
        ...(process.env.ASTRO_INTERNAL_PORT ? { clientPort: port } : {}),
      },
    },
  },
})
