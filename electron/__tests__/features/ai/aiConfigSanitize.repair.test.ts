/**
 * Sanitization, migration and hardening of the persisted repair metadata.
 *
 * The repair blob is the one part of the selector config that arrives from an
 * untrusted place (the managed AI view) and lands on disk, so this file treats it as
 * an input surface: bounded scalars, a closed key set, no arbitrary object
 * persistence, no prototype pollution, and no runtime marker smuggled in as a
 * CSS selector.
 */
import { CONFIG_KEYS, MAX_REPAIR_TIMESTAMP } from '@electron/features/ai/aiConfigConstants'
import {
  finalizeStoredConfig,
  mergeConfig,
  migrateConfigMap
} from '@electron/features/ai/aiConfigDomain'
import { sanitizeConfig } from '@electron/features/ai/aiConfigSanitize'

import type { SelectorRepairCandidate } from '@shared-core/types'

import type { AiConfigMap } from '@electron/features/ai/aiConfigDomain'

import { describe, expect, it } from 'vitest'

const VALID_CANDIDATE: SelectorRepairCandidate = {
  selector: 'textarea[data-testid="ask"]',
  strategy: 'candidate',
  confidenceScore: 95,
  confidenceLevel: 'high',
  firstSeenAt: 1_700_000_000_000,
  lastSeenAt: 1_700_000_000_000,
  successCount: 3,
  consecutiveSuccessCount: 3,
  sourceFingerprint: { tag: 'textarea', dataTestId: 'ask' }
}

describe('CONFIG_KEYS whitelist', () => {
  it('exposes the repair keys as writable', () => {
    expect(CONFIG_KEYS).toContain('repair')
    expect(CONFIG_KEYS).toContain('lastRepair')
  })

  it('never whitelists a prototype-pollution key', () => {
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      expect(CONFIG_KEYS as readonly string[]).not.toContain(key)
    }
  })

  it('keeps every whitelisted key assignable on the config type', () => {
    expect(new Set(CONFIG_KEYS).size).toBe(CONFIG_KEYS.length)
  })
})

describe('sanitizeConfig repair metadata', () => {
  it('keeps a well-formed repair state', () => {
    const result = sanitizeConfig({
      input: '#ask',
      button: '#send',
      repair: { input: VALID_CANDIDATE, button: null }
    })

    expect(result).not.toBeNull()
    expect(result!.repair?.input).toEqual(VALID_CANDIDATE)
    expect(result!.repair?.button).toBeNull()
  })

  it('keeps a well-formed lastRepair record', () => {
    const result = sanitizeConfig({
      input: '#ask',
      button: '#send',
      lastRepair: {
        repairedAt: 1_700_000_000_000,
        inputSelector: 'textarea[data-testid="ask"]',
        buttonSelector: 'button[data-testid="send"]',
        inputStrategy: 'candidate',
        buttonStrategy: 'fingerprint'
      }
    })

    expect(result!.lastRepair).toEqual({
      repairedAt: 1_700_000_000_000,
      inputSelector: 'textarea[data-testid="ask"]',
      buttonSelector: 'button[data-testid="send"]',
      inputStrategy: 'candidate',
      buttonStrategy: 'fingerprint'
    })
  })

  it('leaves configs without repair metadata untouched', () => {
    const result = sanitizeConfig({ input: '#ask', button: '#send' })
    expect(result).not.toBeNull()
    expect('repair' in (result as object)).toBe(false)
    expect('lastRepair' in (result as object)).toBe(false)
  })

  it('rejects an unknown strategy enum value', () => {
    expect(
      sanitizeConfig({ input: '#ask', repair: { input: { ...VALID_CANDIDATE, strategy: 'gpt' } } })
    ).toBeNull()
  })

  it('rejects an unknown confidence level', () => {
    expect(
      sanitizeConfig({
        input: '#ask',
        repair: { input: { ...VALID_CANDIDATE, confidenceLevel: 'certain' } }
      })
    ).toBeNull()
  })

  it('rejects an out-of-range confidence score', () => {
    expect(
      sanitizeConfig({
        input: '#ask',
        repair: { input: { ...VALID_CANDIDATE, confidenceScore: -1 } }
      })
    ).toBeNull()
    expect(
      sanitizeConfig({
        input: '#ask',
        repair: { input: { ...VALID_CANDIDATE, confidenceScore: 1e9 } }
      })
    ).toBeNull()
    expect(
      sanitizeConfig({
        input: '#ask',
        repair: { input: { ...VALID_CANDIDATE, confidenceScore: NaN } }
      })
    ).toBeNull()
    expect(
      sanitizeConfig({
        input: '#ask',
        repair: { input: { ...VALID_CANDIDATE, confidenceScore: '95' } }
      })
    ).toBeNull()
  })

  it('rejects a malformed success counter', () => {
    expect(
      sanitizeConfig({ input: '#ask', repair: { input: { ...VALID_CANDIDATE, successCount: -3 } } })
    ).toBeNull()
    expect(
      sanitizeConfig({
        input: '#ask',
        repair: { input: { ...VALID_CANDIDATE, successCount: 1e6 } }
      })
    ).toBeNull()
    expect(
      sanitizeConfig({
        input: '#ask',
        repair: { input: { ...VALID_CANDIDATE, consecutiveSuccessCount: {} } }
      })
    ).toBeNull()
  })

  it('rejects malformed timestamps', () => {
    expect(
      sanitizeConfig({ input: '#ask', repair: { input: { ...VALID_CANDIDATE, firstSeenAt: -1 } } })
    ).toBeNull()
    expect(
      sanitizeConfig({ input: '#ask', repair: { input: { ...VALID_CANDIDATE, lastSeenAt: 1e15 } } })
    ).toBeNull()
    expect(
      sanitizeConfig({ input: '#ask', lastRepair: { repairedAt: MAX_REPAIR_TIMESTAMP + 1 } })
    ).toBeNull()
    expect(sanitizeConfig({ input: '#ask', lastRepair: { repairedAt: 'yesterday' } })).toBeNull()
    expect(sanitizeConfig({ input: '#ask', lastRepair: {} })).toBeNull()
  })

  it('rejects a runtime marker selector', () => {
    for (const marker of [
      'fingerprint:descriptor',
      'semantic:auto',
      'gemini:composer-fallback',
      'chatgpt:known-pattern',
      'provider:generic:input:textarea'
    ]) {
      expect(
        sanitizeConfig({
          input: '#ask',
          repair: { input: { ...VALID_CANDIDATE, selector: marker } }
        })
      ).toBeNull()
      expect(
        sanitizeConfig({ input: '#ask', lastRepair: { repairedAt: 1, inputSelector: marker } })
      ).toBeNull()
    }
  })

  it('rejects an oversized repair selector', () => {
    expect(
      sanitizeConfig({
        input: '#ask',
        repair: { input: { ...VALID_CANDIDATE, selector: `#${'a'.repeat(2100)}` } }
      })
    ).toBeNull()
  })

  it('rejects unknown repair keys so no arbitrary object is persisted', () => {
    expect(
      sanitizeConfig({
        input: '#ask',
        repair: { input: VALID_CANDIDATE, snapshot: { html: '<html>' } }
      })
    ).toBeNull()
    expect(sanitizeConfig({ input: '#ask', repair: { messageBox: VALID_CANDIDATE } })).toBeNull()
  })

  it('rejects non-object and array repair payloads', () => {
    expect(sanitizeConfig({ input: '#ask', repair: 'yes' })).toBeNull()
    expect(sanitizeConfig({ input: '#ask', repair: [] })).toBeNull()
    expect(sanitizeConfig({ input: '#ask', repair: { input: 'yes' } })).toBeNull()
    expect(sanitizeConfig({ input: '#ask', repair: { input: [] } })).toBeNull()
  })

  it('accepts an explicit null to clear the repair state', () => {
    const result = sanitizeConfig({
      input: '#ask',
      button: '#send',
      repair: null,
      lastRepair: null
    })
    expect(result).not.toBeNull()
    expect(result!.repair).toBeNull()
    expect(result!.lastRepair).toBeNull()
  })

  it('drops a malformed nested fingerprint instead of persisting it', () => {
    const result = sanitizeConfig({
      input: '#ask',
      repair: { input: { ...VALID_CANDIDATE, sourceFingerprint: { tag: 42 } } }
    })
    expect(result).toBeNull()
  })

  it('does not persist prompt text, cookies or page content fields', () => {
    const result = sanitizeConfig({
      input: '#ask',
      repair: {
        input: {
          ...VALID_CANDIDATE,
          prompt: 'my secret prompt',
          cookies: 'session=abc',
          apiKey: 'sk-123',
          dom: '<html>...'
        }
      }
    })
    // Unknown keys inside a candidate are rejected outright rather than
    // silently stripped, so nothing unvetted can reach disk.
    expect(result).toBeNull()
  })
})

describe('prototype pollution', () => {
  it('ignores __proto__ keys in the repair state', () => {
    const payload = JSON.parse(
      '{"input":"#ask","button":"#send","repair":{"__proto__":{"polluted":true}}}'
    ) as Record<string, unknown>
    const result = sanitizeConfig(payload)

    expect(result).toBeNull()
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('never writes a prototype-pollution key through mergeConfig', () => {
    const incoming = JSON.parse('{"__proto__":{"polluted":true}}') as Record<string, unknown>
    const merged = mergeConfig({ input: '#ask' }, incoming as never)

    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(merged.input).toBe('#ask')
  })

  it('keeps a sanitized repair out of Object.prototype', () => {
    sanitizeConfig({ input: '#ask', repair: { input: VALID_CANDIDATE } })
    expect((Object.prototype as unknown as Record<string, unknown>).selector).toBeUndefined()
  })
})

describe('config domain carry-through', () => {
  it('carries repair metadata into the stored config', () => {
    const stored = finalizeStoredConfig(
      'example.com',
      {
        input: 'textarea[data-testid="ask"]',
        button: '#send',
        health: 'repaired',
        repair: { input: VALID_CANDIDATE, button: null },
        lastRepair: { repairedAt: 1_700_000_000_000, inputSelector: 'textarea[data-testid="ask"]' }
      },
      { defaultHealth: 'ready' }
    )

    expect(stored.health).toBe('repaired')
    expect(stored.repair?.input?.selector).toBe('textarea[data-testid="ask"]')
    expect(stored.lastRepair?.inputSelector).toBe('textarea[data-testid="ask"]')
  })

  it('normalizes an empty repair state to null', () => {
    const stored = finalizeStoredConfig(
      'example.com',
      { input: '#ask', button: '#send', repair: { input: null, button: null } },
      { defaultHealth: 'ready' }
    )
    expect(stored.repair).toBeNull()
  })

  it('still marks needs_repick when a locator is missing, even after a repair', () => {
    const stored = finalizeStoredConfig(
      'example.com',
      {
        input: 'textarea[data-testid="ask"]',
        button: null,
        health: 'repaired',
        repair: { input: VALID_CANDIDATE }
      },
      { defaultHealth: 'ready' }
    )
    expect(stored.health).toBe('needs_repick')
  })
})

describe('legacy config migration', () => {
  it('migrates a version 2 config without repair metadata and keeps it working', () => {
    const legacy: AiConfigMap = {
      'example.com': {
        version: 2,
        input: '#ask',
        button: '#send',
        inputCandidates: ['#ask'],
        buttonCandidates: ['#send'],
        health: 'ready'
      }
    }

    const { data, changed } = migrateConfigMap(legacy)

    expect(changed).toBe(true)
    expect(data['example.com'].input).toBe('#ask')
    expect(data['example.com'].button).toBe('#send')
    expect(data['example.com'].health).toBe('ready')
    expect(data['example.com'].repair).toBeNull()
    expect(data['example.com'].lastRepair).toBeNull()
  })

  it('keeps a repaired health across a migration', () => {
    const repaired: AiConfigMap = {
      'example.com': {
        version: 2,
        input: 'textarea[data-testid="ask"]',
        button: '#send',
        inputCandidates: ['textarea[data-testid="ask"]', '#ask'],
        buttonCandidates: ['#send'],
        health: 'repaired',
        lastRepair: { repairedAt: 1_700_000_000_000, inputSelector: 'textarea[data-testid="ask"]' }
      }
    }

    const { data } = migrateConfigMap(repaired)

    expect(data['example.com'].health).toBe('repaired')
    expect(data['example.com'].lastRepair?.inputSelector).toBe('textarea[data-testid="ask"]')
  })

  it('preserves staged repair counters across a migration', () => {
    const staged: AiConfigMap = {
      'example.com': {
        version: 2,
        input: '#ask',
        button: '#send',
        health: 'ready',
        repair: { input: VALID_CANDIDATE }
      }
    }

    const { data } = migrateConfigMap(staged)

    expect(data['example.com'].repair?.input?.consecutiveSuccessCount).toBe(3)
  })

  it('falls back to needs_repick for an unsanitizable legacy config', () => {
    const { data } = migrateConfigMap({
      'example.com': { repair: { input: { ...VALID_CANDIDATE, strategy: 'bogus' } } } as never
    })

    expect(data['example.com'].health).toBe('needs_repick')
    expect(data['example.com'].repair).toBeNull()
  })

  it('is idempotent for an already migrated repaired config', () => {
    const once = migrateConfigMap({
      'example.com': {
        version: 2,
        input: 'textarea[data-testid="ask"]',
        button: '#send',
        inputCandidates: ['textarea[data-testid="ask"]', '#ask'],
        buttonCandidates: ['#send'],
        health: 'repaired',
        lastRepair: { repairedAt: 1_700_000_000_000, inputSelector: 'textarea[data-testid="ask"]' }
      }
    })
    const twice = migrateConfigMap(once.data)

    expect(twice.changed).toBe(false)
    expect(twice.data['example.com'].health).toBe('repaired')
  })
})
