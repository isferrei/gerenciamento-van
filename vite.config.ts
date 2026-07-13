import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// OCR local: em dev o cliente chama http://localhost:8888 (ver extract-entry-client).
// Um comando: npm run dev:with-functions
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
