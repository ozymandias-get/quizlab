import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteAliases } from './vite.aliases.mts'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  root: './src',
  publicDir: 'public',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
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
        codeSplitting: {
          groups: [
            { test: /@tanstack\/react-query/, name: 'vendor-query' },
            { test: /motion/, name: 'vendor-motion' },

            { test: /@headlessui\/react/, name: 'vendor-headless' },
            { test: /lucide-react/, name: 'vendor-lucide' },
            { test: /react-colorful/, name: 'vendor-colorful' },
            {
              test: /(?:pdfjs-dist|@react-pdf-viewer)/,
              name: 'vendor-pdf'
            },
            {
              test: /@radix-ui\/react-(?:slider|slot|tooltip|switch|separator|select|scroll-area|label|avatar)/,
              name: 'vendor-radix'
            },
            { test: /zustand/, name: 'vendor-state' },
            { test: /@tsparticles/, name: 'vendor-particles' },

            {
              test: /(?:clsx|tailwind-merge|class-variance-authority)/,
              name: 'vendor-ui-utils'
            }
          ]
        }
      }
    }
  },
  resolve: {
    alias: viteAliases
  },
  optimizeDeps: {
    include: ['@welldone-software/why-did-you-render']
  },
  server: {
    port: 5173,
    strictPort: true
  }
})
