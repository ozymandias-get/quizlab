/**
 * File size limit checker.
 * Enforces:
 *   - 400 lines max for general files
 *   - 250 lines max for hooks (use*.ts) and components (*.tsx)
 *
 * Usage: node scripts/check-file-sizes.mjs
 */

import { readFileSync, statSync } from 'fs'
import pkg from 'glob'
import { join, relative, sep } from 'path'
import { fileURLToPath } from 'url'
const { sync: globSync } = pkg

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const GENERAL_LIMIT = 400
const COMPONENT_HOOK_LIMIT = 250

const patterns = [
  join(ROOT, 'src/**/*.{ts,tsx}').replaceAll('\\', '/'),
  join(ROOT, 'electron/**/*.{ts,tsx}').replaceAll('\\', '/'),
  join(ROOT, 'shared/**/*.{ts,tsx}').replaceAll('\\', '/')
]

const ignore = [
  '**/node_modules/**',
  '**/dist/**',
  '**/__tests__/**',
  '**/*.test.*',
  '**/*.spec.*',
  '**/*.d.ts'
]

let files = []
for (const pattern of patterns) {
  try {
    const matches = globSync(pattern, { ignore })
    files = [...files, ...matches]
  } catch (e) {
    console.error(`Error with pattern ${pattern}:`, e.message)
  }
}

let hasErrors = false

for (const file of files) {
  const content = readFileSync(file, 'utf-8')
  const lines = content.split('\n').length
  const filename = relative(ROOT, file).replaceAll('\\', '/')
  const isHook = filename.endsWith('.ts') && filename.includes('/use')
  const isComponent = filename.endsWith('.tsx')
  const limit = isHook || isComponent ? COMPONENT_HOOK_LIMIT : GENERAL_LIMIT

  if (lines > limit) {
    const type = isHook ? 'hook' : isComponent ? 'component' : 'general'
    console.error(
      `ERROR: ${filename} (${lines} lines) exceeds ${type} limit of ${limit} lines ` +
        `by ${lines - limit} lines`
    )
    hasErrors = true
  }
}

if (hasErrors) {
  process.exit(1)
}

console.log('All files within size limits.')
