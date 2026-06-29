import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          recharts: ['recharts'],
          vendor: ['react', 'react-dom', 'zustand', 'immer'],
        },
      },
    },
    chunkSizeWarningLimit: 3000,
  },
})
