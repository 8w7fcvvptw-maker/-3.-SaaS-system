import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    globals: true,
    environment: 'node',
    exclude: ['**/node_modules/**', '**/e2e/**'],
  },
  server: {
    host: true,
    port: 5173,
    fs: {
      allow: [".."],
    },
  },
})
