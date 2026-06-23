import { CONFIG_VERSION } from '@electron/features/ai/aiConfigConstants'
import {
  finalizeStoredConfig,
  mergeConfig,
  migrateConfigMap,
  resolveConfigForHostname
} from '@electron/features/ai/aiConfigDomain'

import { describe, expect, it } from 'vitest'

describe('finalizeStoredConfig', () => {
  it('should fill missing input from inputCandidates', () => {
    const result = finalizeStoredConfig(
      'example.com',
      {
        input: null,
        button: '#btn',
        inputCandidates: ['#a', '#b'],
        buttonCandidates: ['#btn']
      },
      { defaultHealth: 'ready' }
    )
    expect(result.input).toBe('#a')
  })

  it('should fill missing button from buttonCandidates', () => {
    const result = finalizeStoredConfig(
      'example.com',
      {
        input: '#input',
        button: null,
        buttonCandidates: ['#x', '#y']
      },
      { defaultHealth: 'ready' }
    )
    expect(result.button).toBe('#x')
  })

  it('should default submitMode to mixed when missing', () => {
    const result = finalizeStoredConfig(
      'example.com',
      {
        input: '#input',
        button: '#button'
      },
      { defaultHealth: 'ready' }
    )
    expect(result.submitMode).toBe('mixed')
  })

  it('should preserve existing submitMode', () => {
    const result = finalizeStoredConfig(
      'example.com',
      {
        input: '#input',
        button: '#button',
        submitMode: 'click'
      },
      { defaultHealth: 'ready' }
    )
    expect(result.submitMode).toBe('click')
  })

  it('should set health to needs_repick when input is missing', () => {
    const result = finalizeStoredConfig(
      'example.com',
      {
        input: null,
        button: '#button'
      },
      { defaultHealth: 'ready' }
    )
    expect(result.health).toBe('needs_repick')
  })

  it('should set health to needs_repick when button is missing', () => {
    const result = finalizeStoredConfig(
      'example.com',
      {
        input: '#input',
        button: null
      },
      { defaultHealth: 'ready' }
    )
    expect(result.health).toBe('needs_repick')
  })

  it('should set CONFIG_VERSION as version', () => {
    const result = finalizeStoredConfig(
      'example.com',
      {
        input: '#input',
        button: '#button'
      },
      { defaultHealth: 'ready' }
    )
    expect(result.version).toBe(CONFIG_VERSION)
  })

  it('should include timestamp when provided', () => {
    const ts = 1234567890
    const result = finalizeStoredConfig(
      'example.com',
      {
        input: '#input',
        button: '#button'
      },
      { defaultHealth: 'ready', timestamp: ts }
    )
    expect(result.timestamp).toBe(ts)
  })

  it('should not include timestamp when not provided', () => {
    const result = finalizeStoredConfig(
      'example.com',
      {
        input: '#input',
        button: '#button'
      },
      { defaultHealth: 'ready' }
    )
    expect(result.timestamp).toBeUndefined()
  })

  it('should normalize sourceHostname from hostname', () => {
    const result = finalizeStoredConfig(
      'EXAMPLE.COM',
      {
        input: '#input',
        button: '#button'
      },
      { defaultHealth: 'ready' }
    )
    expect(result.sourceHostname).toBe('example.com')
  })
})

describe('mergeConfig', () => {
  it('should merge incoming into existing', () => {
    const result = mergeConfig({ input: '#old', button: '#old' }, { input: '#new' })
    expect(result.input).toBe('#new')
    expect(result.button).toBe('#old')
  })

  it('should handle undefined existing', () => {
    const result = mergeConfig(undefined, { input: '#new', button: '#btn' })
    expect(result.input).toBe('#new')
    expect(result.button).toBe('#btn')
  })

  it('should not overwrite with undefined values', () => {
    const result = mergeConfig({ input: '#keep' }, { input: undefined })
    expect(result.input).toBe('#keep')
  })

  it('should overwrite with null values', () => {
    const result = mergeConfig({ input: '#keep' }, { input: null as any })
    expect(result.input).toBeNull()
  })
})

describe('migrateConfigMap', () => {
  it('should return empty data and false changed for empty map', () => {
    const result = migrateConfigMap({})
    expect(result.data).toEqual({})
    expect(result.changed).toBe(false)
  })

  it('should normalize hostnames and mark changed', () => {
    const result = migrateConfigMap({
      'EXAMPLE.COM': {
        input: '#input',
        button: '#button',
        version: CONFIG_VERSION,
        health: 'ready'
      }
    })
    expect(result.changed).toBe(true)
    expect(result.data['example.com']).toBeDefined()
  })

  it('should drop invalid hostnames', () => {
    const result = migrateConfigMap({
      '///invalid': { input: '#i', button: '#b' }
    })
    expect(result.changed).toBe(true)
    expect(Object.keys(result.data)).toHaveLength(0)
  })

  it('should create needs_repick config for invalid configs', () => {
    const result = migrateConfigMap({
      'example.com': { invalid: true } as any
    })
    expect(result.changed).toBe(true)
    expect(result.data['example.com'].health).toBe('needs_repick')
  })
})

describe('resolveConfigForHostname', () => {
  const configMap = {
    'gemini.google.com': { input: '#gemini', button: '#gbtn' } as any
  }

  it('should return exact match', () => {
    const result = resolveConfigForHostname(configMap, 'gemini.google.com')
    expect(result!.input).toBe('#gemini')
  })

  it('should return null for unknown hostname', () => {
    expect(resolveConfigForHostname(configMap, 'unknown.com')).toBeNull()
  })

  it('should return null for undefined hostname', () => {
    expect(resolveConfigForHostname(configMap, undefined)).toBeNull()
  })

  it('should return null for empty hostname', () => {
    expect(resolveConfigForHostname(configMap, '')).toBeNull()
  })
})
