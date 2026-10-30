import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// В dev-режиме запросы /api/* проксируются на FastAPI (в backend нет CORS).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const target = env.VITE_PROXY_TARGET || 'http://localhost:8001'
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
      },
    },
  }
})
