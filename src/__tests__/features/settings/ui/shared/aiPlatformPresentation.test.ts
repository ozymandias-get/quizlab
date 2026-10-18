import {
  getAiPlatformIcon,
  getAiPlatformLabel
} from '@features/settings/ui/shared/aiPlatformPresentation'

import { describe, expect, it, vi } from 'vitest'

vi.mock('@ui/components/Icons', () => ({
  // Only ids prefixed `known-` resolve, so the fallback chain is observable.
  getAiIcon: vi.fn((icon: string) => (icon.startsWith('known-') ? `ICON(${icon})` : null))
}))

const passthroughT = (key: string) => key

describe('getAiPlatformIcon', () => {
  it('falls back through the platform icon, the fallback key and the fallback node', () => {
    // Platform icon wins.
    expect(getAiPlatformIcon({ icon: 'known-chatgpt' }, 'openai', 'FALLBACK')).toBe(
      'ICON(known-chatgpt)'
    )
    // No platform icon → the fallback key is looked up.
    expect(getAiPlatformIcon({ icon: '' }, 'known-openai', 'FALLBACK')).toBe('ICON(known-openai)')
    // Neither resolves → the caller's own node is used.
    expect(getAiPlatformIcon(undefined, 'unknown', 'FALLBACK')).toBe('FALLBACK')
  })
})

describe('getAiPlatformLabel', () => {
  it('prefers a translation that actually resolved', () => {
    const t = (key: string) => (key === 'openai' ? 'OpenAI' : key)
    expect(
      getAiPlatformLabel({ displayName: 'OpenAI Official', name: 'openai-official' }, 'openai', t)
    ).toBe('OpenAI')
  })

  it('ignores an untranslated key and uses the platform names instead', () => {
    expect(
      getAiPlatformLabel(
        { displayName: 'My Custom Platform', name: 'custom' },
        'openai',
        passthroughT
      )
    ).toBe('My Custom Platform')
    expect(getAiPlatformLabel({ name: 'custom-model' }, 'openai')).toBe('custom-model')
  })

  it.each<[string, { name: string } | undefined]>([
    ['undefined platform', undefined],
    // `name` is required by AiPlatform, so "no usable name" is an empty one:
    // `displayName || name` then falls through to the capitalized key.
    ['a platform with no usable name', { name: '' }]
  ])('capitalizes the fallback key for %s', (_label, candidate) => {
    expect(getAiPlatformLabel(candidate, 'openai')).toBe('Openai')
  })
})
