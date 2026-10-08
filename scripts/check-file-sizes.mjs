/**
 * File size limit checker.
 * Enforces (see GENERAL_LIMIT / COMPONENT_HOOK_LIMIT below, and the limits
 * documented in docs/CODING_STANDARD.md):
 *   - 700 lines max for general files
 *   - 650 lines max for hooks (use*.ts) and components (*.tsx)
 *
 * Discovery uses node:fs globSync (Node 22+; CI pins 24) instead of the `glob`
 * package. `glob` was never declared here: it only resolved because npm hoisted
 * glob@7 out of @doyensec/electronegativity's dependency tree, so a CI gate
 * depended on an unrelated package's transitive shape — and on a glob major
 * that is EOL and carries known advisories. Node's glob understands the same
 * patterns (`**`, `{ts,tsx}`) and takes its exclusions as `exclude` instead of
 * `ignore`; the matched file list is byte-for-byte identical on this tree.
 *
 * Usage: node scripts/check-file-sizes.mjs
 */

import { globSync, readFileSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const GENERAL_LIMIT = 700
const COMPONENT_HOOK_LIMIT = 650

const patterns = [
  join(ROOT, 'src/**/*.{ts,tsx}').replaceAll('\\', '/'),
  join(ROOT, 'electron/**/*.{ts,tsx}').replaceAll('\\', '/'),
  join(ROOT, 'shared/**/*.{ts,tsx}').replaceAll('\\', '/')
]

const exclude = [
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
    const matches = globSync(pattern, { exclude })
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
