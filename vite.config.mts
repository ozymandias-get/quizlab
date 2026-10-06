import { cpSync, existsSync, readFileSync, statSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { viteAliases } from './vite.aliases.mts'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/**
 * Directories copied out of `node_modules/pdfjs-6` and served from
 * `<base>pdfjs/`. Kept in sync with `PDFJS_ASSET_SUBDIRS` in
 * `src/features/pdf/engine/pdfDocumentOptions.ts`, which builds the URLs the
 * native engine hands to `getDocument`.
 */
const PDFJS_ASSET_SUBDIRS = ['cmaps', 'standard_fonts', 'wasm', 'iccs'] as const

/** Where the aliased PDF.js 6 package lives on disk. */
const PDFJS_6_PACKAGE = 'node_modules/pdfjs-6'

/**
 * Stages the native PDF.js 6 runtime assets without adding a dependency.
 *
 * PDF.js needs CMaps, standard font data, the wasm decoders (JBIG2, OpenJPEG,
 * qcms) and an ICC profile at runtime; ~200 files / ~3.4 MB that must reach both
 * the dev server and the packaged app.
 *
 * Committed `public/` files were rejected (3.4 MB of vendored binaries in git)
 * and so was a copy plugin (a new dependency for one directory). This hook uses
 * only Node built-ins and runs inside the existing build pipeline:
 *
 *   - dev: a middleware serves the files straight from `node_modules`
 *   - build: `closeBundle` copies them into `dist/pdfjs/`
 *
 * `closeBundle` fires after Vite has written the output *and* after
 * `emptyOutDir` has wiped it, so `dist/pdfjs` cannot accumulate stale files from
 * a previous run. Nothing is deleted here: this hook only ever adds files under
 * its own directory.
 *
 * Only the `pdfjs-6` tree is read. The legacy `pdfjs-dist@3.11.174` assets used
 * by `@react-pdf-viewer` are untouched — see `docs/pdfjs-migration-plan.md`.
 */
function pdfjsAssets(): Plugin {
  const assetRoot = `${PDFJS_6_PACKAGE}`
  const urlPrefix = '/pdfjs/'

  return {
    name: 'quizlab:pdfjs-assets',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const requestUrl = req.url ?? ''
        if (!requestUrl.startsWith(urlPrefix)) {
          next()
          return
        }
        const relative = decodeURIComponent(requestUrl.slice(urlPrefix.length))
        // Resolve inside the package and refuse anything that escapes it.
        const resolved = path.resolve(assetRoot, relative)
        if (!resolved.startsWith(path.resolve(assetRoot))) {
          res.statusCode = 403
          res.end('Forbidden')
          return
        }
        if (!existsSync(resolved) || !statSync(resolved).isFile()) {
          next()
          return
        }
        res.setHeader('Content-Type', contentTypeFor(resolved))
        res.end(readFileSync(resolved))
      })
    },

    closeBundle() {
      const outDir = path.resolve(rootDir, 'dist')
      for (const subdir of PDFJS_ASSET_SUBDIRS) {
        const from = path.resolve(assetRoot, subdir)
        const to = path.join(outDir, 'pdfjs', subdir)
        cpSync(from, to, { recursive: true })
      }
    }
  }
}

function contentTypeFor(filePath: string): string {
  if (filePath.endsWith('.bcmap')) return 'application/octet-stream'
  if (filePath.endsWith('.wasm')) return 'application/wasm'
  if (filePath.endsWith('.icc')) return 'application/vnd.iccprofile'
  if (filePath.endsWith('.js')) return 'text/javascript'
  return 'application/octet-stream'
}

function createManualChunks(id: string) {
  if (id.includes('react-i18next') || id.includes('i18next')) return 'vendor-i18n'
  if (id.includes('@tanstack/react-query')) return 'vendor-query'
  if (id.includes('motion')) return 'vendor-motion'
  if (id.includes('@headlessui/react')) return 'vendor-headless'
  if (id.includes('lucide-react')) return 'vendor-lucide'
  if (id.includes('react-colorful')) return 'vendor-colorful'
  if (id.includes('pdfjs-dist') || id.includes('@react-pdf-viewer')) return 'vendor-pdf-legacy'
  // The native migration runtime must not be folded into the legacy chunk: two
  // PDF.js versions are installed on purpose and bundling them together would
  // make it impossible to delete either one later.
  if (id.includes('pdfjs-6')) return 'vendor-pdf-native'
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
  plugins: [tailwindcss(), react(), pdfjsAssets()],
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
              name: 'vendor-pdf-legacy'
            },
            {
              test: /pdfjs-6/,
              name: 'vendor-pdf-native'
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
