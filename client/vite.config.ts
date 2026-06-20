import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Em dev: Vite serve a UI e faz proxy de /api para o servidor de sinalização
// (rode `node server.js --http` na raiz do projeto). Em produção, o próprio
// server.js serve o build (client/dist) e as rotas /api na mesma origem.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8443',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
