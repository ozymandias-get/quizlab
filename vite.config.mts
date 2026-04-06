import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteAliases } from './vite.aliases.mts'

export default defineConfig({
  plugins: [react()],
  root: './src',
  publicDir: 'public',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      onwarn(warning, warn) {
        if (
          warning.code === 'EVAL' &&
          typeof warning.id === 'string' &&
          warning.id.includes('pdfjs-dist/build/pdf.js')
        ) {
          return
        }
        warn(warning)
      },
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': [
            '@headlessui/react',
            'framer-motion',
            'lucide-react',
            'react-colorful'
          ],
          'vendor-pdf': [
            'pdfjs-dist',
            '@react-pdf-viewer/core',
            '@react-pdf-viewer/page-navigation',
            '@react-pdf-viewer/scroll-mode',
            '@react-pdf-viewer/search',
            '@react-pdf-viewer/zoom'
          ]
        }
      }
    }
  },
  resolve: {
    alias: viteAliases
  },
  server: {
    port: 5173,
    strictPort: true
  }
})
