/**
 * Generates (or verifies) the selector engine the Chrome extension loads.
 *
 * The engine is not a copy of the picker algorithm: it is the picker's own
 * source, emitted by the same builders the Electron picker injects. The
 * TypeScript builders cannot be imported by plain Node, so this script bundles
 * the builder with esbuild first and then calls it.
 *
 * Usage:
 *   node scripts/generate-extension-selector-engine.mjs           # write
 *   node scripts/generate-extension-selector-engine.mjs --check   # verify
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { build } from 'esbuild'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENTRY = path.join(ROOT, 'electron/features/automation/selectorEngine/buildSelectorEngine.ts')
const TARGET = path.join(ROOT, 'extensions/quizlab-session-extension/content/selector-engine.js')
const BUILD_DIR = path.join(ROOT, '.cache/extension-selector-engine')
const BUILT_MODULE = path.join(BUILD_DIR, 'builder.mjs')

const CHECK = process.argv.includes('--check')

/**
 * Resolves TypeScript files that are imported with a `.js` specifier.
 *
 * The backend uses NodeNext resolution, where a source file imports its
 * sibling as `./name.js` while the file on disk is `name.ts`. Node cannot run
 * that import graph, so the bundle is built first with this rewrite.
 */
const tsFromJsPlugin = {
  name: 'ts-from-js',
  setup(buildApi) {
    buildApi.onResolve({ filter: /^\.{1,2}\/.*\.js$/ }, (args) => {
      const candidate = path.resolve(args.resolveDir, args.path.replace(/\.js$/, '.ts'))
      return existsSync(candidate) ? { path: candidate } : undefined
    })
  }
}

async function loadBuilder() {
  mkdirSync(BUILD_DIR, { recursive: true })
  await build({
    entryPoints: [ENTRY],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    outfile: BUILT_MODULE,
    plugins: [tsFromJsPlugin],
    logLevel: 'silent'
  })
  const module = await import(`${pathToFileURL(BUILT_MODULE).href}?v=${Date.now()}`)
  if (typeof module.buildSelectorEngineSource !== 'function') {
    throw new Error('The selector engine builder did not export buildSelectorEngineSource()')
  }
  return module.buildSelectorEngineSource()
}

const source = await loadBuilder()

if (CHECK) {
  const current = existsSync(TARGET) ? readFileSync(TARGET, 'utf8') : ''
  if (current !== source) {
    console.error(
      `[selector-engine] ${path.relative(ROOT, TARGET)} is stale. ` +
        'Run: node scripts/generate-extension-selector-engine.mjs'
    )
    process.exit(1)
  }
  console.log('[selector-engine] the generated engine matches its source')
} else {
  mkdirSync(path.dirname(TARGET), { recursive: true })
  writeFileSync(TARGET, source, 'utf8')
  console.log(`[selector-engine] wrote ${path.relative(ROOT, TARGET)} (${source.length} bytes)`)
}
