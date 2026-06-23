import { PANEL_RESIZING_BODY_CLASS } from '@shared/constants/panelResize'

import { describe, expect, it } from 'vitest'

describe('panelResize constants', () => {
  it('defines the body class for panel resizing', () => {
    expect(PANEL_RESIZING_BODY_CLASS).toBe('panel-resizing')
  })
})
