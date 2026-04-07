import { describe, expect, it } from 'vitest'
import { GOOGLE_WEB_SESSION_REGISTRY_IDS } from '../../../../shared/constants/google-ai-web-apps'
import { sanitizeEnabledAppIds } from '../../../features/gemini-web-session/sessionMetadataRepository'

describe('session metadata repository', () => {
  it('falls back to all registry ids when value is not an array', () => {
    expect(sanitizeEnabledAppIds(undefined)).toEqual([...GOOGLE_WEB_SESSION_REGISTRY_IDS])
    expect(sanitizeEnabledAppIds('invalid')).toEqual([...GOOGLE_WEB_SESSION_REGISTRY_IDS])
  })

  it('keeps only valid unique app ids in original order', () => {
    const [first] = GOOGLE_WEB_SESSION_REGISTRY_IDS
    const second = GOOGLE_WEB_SESSION_REGISTRY_IDS[1] ?? first
    const result = sanitizeEnabledAppIds([first, 'invalid', second, first, 12, null])
    expect(result).toEqual([first, second])
  })
})
