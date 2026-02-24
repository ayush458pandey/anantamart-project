import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Use esbuild (built-in, no extra install needed)
    minify: 'esbuild',
    // Strip console.log and debugger in production
    esbuild: {
      drop: ['console', 'debugger'],
    },
    // Code splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
})
