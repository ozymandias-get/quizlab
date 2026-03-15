import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

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
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': [
            '@headlessui/react',
            'framer-motion',
            'lucide-react',
            'react-colorful',
            'react-virtuoso'
          ],
          'vendor-pdf': [
            'pdfjs-dist',
            '@react-pdf-viewer/core',
            '@react-pdf-viewer/page-navigation',
            '@react-pdf-viewer/scroll-mode',
            '@react-pdf-viewer/search',
            '@react-pdf-viewer/zoom'
          ],
          'vendor-utils': ['dompurify']
        }
      }
    }
  },
  resolve: {
    alias: {
      // Project aliases
      '@app': path.resolve(__dirname, 'src/app'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@shared-core': path.resolve(__dirname, 'shared'),
      '@electron': path.resolve(__dirname, 'electron'),
      '@ui': path.resolve(__dirname, 'src/shared/ui'),
      '@features': path.resolve(__dirname, 'src/features'),
      '@platform': path.resolve(__dirname, 'src/platform')
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
})
