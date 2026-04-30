import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/admin/',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: parseInt(process.env.ADMIN_PORT || '3006'),
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.PORT || '3005'}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
