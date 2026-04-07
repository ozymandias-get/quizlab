import { execSync } from 'node:child_process'

const output = execSync('git ls-files', { encoding: 'utf8' })
const tracked = output
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)

const generatedPatterns = [
  /^dist[\\/]/,
  /^dist-electron[\\/]/,
  /^release[\\/]/,
  /^coverage[\\/]/,
  /^playwright-report[\\/]/,
  /^test-results[\\/]/,
  /^\.nyc_output[\\/]/,
  /^\.cache[\\/]/,
  /\.tsbuildinfo$/
]
const forbidden = tracked.filter((file) => generatedPatterns.some((pattern) => pattern.test(file)))
const mixedSeparators = tracked.filter((file) => file.includes('\\'))
const canonicalPathCollisions = (() => {
  const canonicalToOriginal = new Map()
  const collisions = []
  for (const file of tracked) {
    const canonical = file.replace(/\\/g, '/').toLowerCase()
    const existing = canonicalToOriginal.get(canonical)
    if (existing && existing !== file) {
      collisions.push([existing, file])
      continue
    }
    canonicalToOriginal.set(canonical, file)
  }
  return collisions
})()

if (forbidden.length > 0) {
  console.error('[hygiene] generated artifacts are tracked:')
  for (const file of forbidden) {
    console.error(` - ${file}`)
  }
  process.exit(1)
}

if (mixedSeparators.length > 0) {
  console.error('[hygiene] non-portable git paths found (use forward slashes):')
  for (const file of mixedSeparators) {
    console.error(` - ${file}`)
  }
  process.exit(1)
}

if (canonicalPathCollisions.length > 0) {
  console.error('[hygiene] canonical path collisions found:')
  for (const [left, right] of canonicalPathCollisions) {
    console.error(` - ${left} <-> ${right}`)
  }
  process.exit(1)
}

process.exit(0)
