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
    // Warn at 1600 kB — vendor-pdf (@react-pdf/renderer) is ~1.5 MB by design
    // (embedded PDF engine + font subsetting); it is lazy-loaded so no boot cost.
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor bundles — stable hashes, long-lived CDN caching.
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui':       ['framer-motion', 'lucide-react', 'recharts'],
          'vendor-state':    ['zustand', '@tanstack/react-query'],
          // PDF engine — isolated; only loaded when Payslip route is accessed.
          'vendor-pdf':      ['@react-pdf/renderer'],
          // Spreadsheet engine — isolated; loaded on-demand via exportService.
          'vendor-xlsx':     ['xlsx'],
        },
      },
    },
  },
})
