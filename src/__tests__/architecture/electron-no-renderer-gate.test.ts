/**
 * `electron-no-renderer`: Electron main process renderer katmanına bağımlı olamaz.
 *
 * Bu kural bir süre ölüydü: `to.path` deseni `^@(app|features|shared|ui|platform)/`
 * idi, oysa dependency-cruiser `from`/`to` eşleşmesini **çözümlenmiş** dosya
 * yollarına uygular (`electron/core/logger.ts` → `src/shared/lib/logger.ts`).
 * Alias yazımı çözümlemeden önce kaybolduğu için desen hiçbir şeyi yakalayamıyor,
 * kapı yeşil kalıyordu. `.dependency-cruiser.cjs` içindeki düzeltme deseni
 * `^src/(app|features|shared|platform)/` yapar.
 *
 * Bu dosya yalnızca konfigürasyon metnini değil, gerçek çözümlemeyi sınar:
 * geçici fixture dosyaları `electron/` altına yazılıp dependency-cruiser'ın
 * `cruise` API'sinden geçirilir; yasak import ihlal üretmeli, belgeli logger
 * istisnası üretmemelidir. Fixture'lar test sonunda silinir, üretim ağacına
 * kalıcı dosya eklenmez.
 */
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

interface Rule {
  name?: string
  severity?: string
  comment?: string
  from?: { path?: string; pathNot?: string }
  to?: { path?: string; pathNot?: string }
}

const depcruiseConfig = require('../../../.dependency-cruiser.cjs') as {
  forbidden: Rule[]
}

const TIMEOUT = 120_000

const PROBE_DIR = join(repoRoot, 'electron')
const FORBIDDEN_PROBE = join(PROBE_DIR, '__tmp-gate-probe-forbidden.ts')
const ALLOWED_PROBE = join(PROBE_DIR, '__tmp-gate-probe-allowed.ts')

function writeProbes(): void {
  // Yasak: renderer katmanından gerçek bir modül (relative path; alias da aynı
  // çözüme ulaşır, ancak relative yazım logger shim'inin de kullandığı
  // bypass olduğu için özellikle bu seçildi).
  writeFileSync(
    FORBIDDEN_PROBE,
    [
      "import { useLocalStorage } from '../src/shared/hooks/useLocalStorage.js'",
      '',
      'export function __gateProbeForbidden(): typeof useLocalStorage {',
      '  return useLocalStorage',
      '}',
      ''
    ].join('\n')
  )
  // Meşru: belgeli tek istisna — runtime-agnostik logger shim'i.
  writeFileSync(
    ALLOWED_PROBE,
    [
      "import { Logger } from '../src/shared/lib/logger.js'",
      '',
      'export function __gateProbeAllowed(): typeof Logger {',
      '  return Logger',
      '}',
      ''
    ].join('\n')
  )
}

function removeProbes(): void {
  for (const file of [FORBIDDEN_PROBE, ALLOWED_PROBE]) {
    if (existsSync(file)) rmSync(file)
  }
}

interface CruiseViolation {
  from: string
  to: string
  rule: { severity: string; name: string }
}

async function cruiseProbes(): Promise<CruiseViolation[]> {
  const { cruise } = (await import('dependency-cruiser')) as {
    cruise: (
      paths: string[],
      options: { validate: boolean; ruleSet: unknown }
    ) => Promise<{ output: { summary: { violations: CruiseViolation[] } }; exitCode: number }>
  }
  const result = await cruise([FORBIDDEN_PROBE, ALLOWED_PROBE], {
    validate: true,
    ruleSet: depcruiseConfig
  })
  return result.output.summary.violations
}

describe('electron-no-renderer: kural çözümlenmiş yollara bakar', () => {
  const rule = depcruiseConfig.forbidden.find((r) => r.name === 'electron-no-renderer')

  it('kural mevcut ve blocking şiddette', () => {
    expect(rule).toBeDefined()
    expect(rule?.severity).toBe('error')
  })

  it('electron katmanından çıkar', () => {
    expect(rule?.from?.path).toBe('^electron/')
  })

  it('alias desenine değil çözümlenmiş src/ yollarına bakar', () => {
    // Ölü desen `^@…` idi: çözümleme sonrası hiçbir modül @ ile başlamaz.
    expect(rule?.to?.path).not.toMatch(/^\^@/)
    expect(rule?.to?.path).toBe('^src/(app|features|shared|platform)/')
  })

  it('desen çözümlenmiş renderer yollarıyla eşleşir, shared-core ile eşleşmez', () => {
    const to = new RegExp(rule?.to?.path ?? '(?!)')
    for (const resolved of [
      'src/features/ai/viewState.ts',
      'src/shared/hooks/useLocalStorage.ts',
      'src/app/components/Toast/ToastContainer.tsx',
      'src/platform/electron/useElectron.ts'
    ]) {
      expect(to.test(resolved)).toBe(true)
    }
    for (const resolved of [
      'shared/lib/errorClassifier.ts',
      'electron/core/logger.ts',
      'src/shared/lib/logger.ts'
    ]) {
      // logger.ts ayrıca pathNot ile muaf; burada desenin shared-core'u
      // kapsamadığını gösteriyoruz (src/shared/lib/logger.ts pathNot'a takılır).
      if (resolved !== 'src/shared/lib/logger.ts') expect(to.test(resolved)).toBe(false)
    }
  })

  it('tek istisna belgeli logger shimidir, geniş allowlist yok', () => {
    expect(rule?.to?.pathNot).toBe('^src/shared/lib/logger\\.ts$')
    expect(rule?.comment).toMatch(/logger/)
  })
})

describe(
  'electron-no-renderer: gerçek dependency-cruiser çözümlemesi',
  () => {
    it('yasak renderer importunu yakalar, meşru logger importunu geçirir', async () => {
      writeProbes()
      try {
        const violations = await cruiseProbes()
        const rendererHits = violations.filter((v) => v.rule.name === 'electron-no-renderer')

        const forbiddenHit = rendererHits.find((v) =>
          v.from.endsWith('__tmp-gate-probe-forbidden.ts')
        )
        expect(forbiddenHit).toBeDefined()
        expect(forbiddenHit?.to).toBe('src/shared/hooks/useLocalStorage.ts')

        const allowedHit = rendererHits.find((v) => v.from.endsWith('__tmp-gate-probe-allowed.ts'))
        expect(allowedHit).toBeUndefined()
      } finally {
        removeProbes()
      }
      expect(existsSync(FORBIDDEN_PROBE)).toBe(false)
      expect(existsSync(ALLOWED_PROBE)).toBe(false)
    })
  },
  TIMEOUT
)
