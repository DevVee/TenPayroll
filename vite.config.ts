import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    // Never ship source maps to production — avoids leaking source code.
    sourcemap: false,
    // Keep individual chunks reasonably sized (<500 kB); warn at 600 kB.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor bundles — stable hashes, long-lived CDN caching.
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui':       ['framer-motion', 'lucide-react', 'recharts'],
          'vendor-state':    ['zustand', '@tanstack/react-query'],
        },
      },
    },
  },
})
