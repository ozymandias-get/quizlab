import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteAliases } from './vite.aliases.mts'

function createManualChunks(id: string) {
  if (id.includes('react-i18next') || id.includes('i18next')) return 'vendor-i18n'
  if (id.includes('@tanstack/react-query')) return 'vendor-query'
  if (id.includes('motion')) return 'vendor-motion'
  if (id.includes('@headlessui/react')) return 'vendor-headless'
  if (id.includes('lucide-react')) return 'vendor-lucide'
  if (id.includes('react-colorful')) return 'vendor-colorful'
  if (id.includes('pdfjs-dist') || id.includes('@react-pdf-viewer')) return 'vendor-pdf'
  if (id.includes('@radix-ui')) return 'vendor-radix'
  if (id.includes('zustand')) return 'vendor-state'
  if (id.includes('@tsparticles')) return 'vendor-particles'
  if (
    id.includes('clsx') ||
    id.includes('tailwind-merge') ||
    id.includes('class-variance-authority')
  )
    return 'vendor-ui-utils'
  // Keep React core in main chunk for faster initial paint — splitting it
  // would add an extra request without caching benefit (changes with app code).
  return undefined
}

function handleRollupWarn(
  warning: { code?: string; id?: string; message: string },
  warn: (w: typeof warning) => void
) {
  if (
    warning.code === 'EVAL' &&
    typeof warning.id === 'string' &&
    warning.id.includes('pdfjs-dist/build/pdf.js')
  ) {
    return
  }
  warn(warning)
}

export default defineConfig({
  plugins: [tailwindcss(), react()],
  root: './src',
  publicDir: 'public',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 500,
    target: 'esnext',
    cssCodeSplit: true,
    sourcemap: false,
    minify: 'esbuild',
    assetsInlineLimit: 4096,
    reportCompressedSize: false,
    rollupOptions: {
      onwarn: handleRollupWarn,
      output: {
        manualChunks: createManualChunks,
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Rolldown (Vite 7+ experimental) — keep in sync with rollupOptions above.
    rolldownOptions: {
      onwarn: handleRollupWarn,
      output: {
        codeSplitting: {
          groups: [
            { test: /i18next|react-i18next/, name: 'vendor-i18n' },
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
