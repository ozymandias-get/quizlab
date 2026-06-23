import { WEBVIEW_ALLOW_POPUPS } from '@shared/constants/electronWebview'

import { describe, expect, it } from 'vitest'

describe('electronWebview constants', () => {
  it('allows popups by default', () => {
    expect(WEBVIEW_ALLOW_POPUPS).toBe(true)
  })
})
