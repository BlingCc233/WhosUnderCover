import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  preview: {
    host: '0.0.0.0',
    port: 3091,
  },
    server: {
        host: '0.0.0.0',
        port: 3091,
    },
})
