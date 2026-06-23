import { execSync } from 'child_process'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const THRESHOLDS = { app: 98.0, node: 98.0 }

let hasErrors = false

for (const [project, threshold] of Object.entries(THRESHOLDS)) {
  const label = `tsconfig.${project}.json`
  const msg = `Type coverage (${label} >= ${threshold}%) ...`
  try {
    const output = execSync(`npx.cmd type-coverage --strict --project tsconfig.${project}.json`, {
      encoding: 'utf-8',
      cwd: ROOT
    })
    const m = output.match(/\((\d+)\s*\/\s*(\d+)\)\s*([\d.]+)%/)
    if (m) {
      const pct = Number(m[3])
      if (pct < threshold) {
        console.error(`${msg} FAILED: ${pct}% < ${threshold}%`)
        hasErrors = true
      } else {
        console.log(`${msg} ${pct}% (OK)`)
      }
    } else {
      console.warn(`${msg} Could not parse:\n${output}`)
    }
  } catch (e) {
    console.error(`${msg} Error: ${e.message}`)
    hasErrors = true
  }
}

process.exit(hasErrors ? 1 : 0)
