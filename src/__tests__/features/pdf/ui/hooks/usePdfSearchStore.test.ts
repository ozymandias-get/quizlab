import { resetPdfSearchStore, usePdfSearchStore } from '@features/pdf/ui/hooks/usePdfSearchStore'

import { beforeEach, describe, expect, it } from 'vitest'

describe('usePdfSearchStore', () => {
  beforeEach(() => {
    resetPdfSearchStore()
  })

  it('toggles the search bar open state', () => {
    expect(usePdfSearchStore.getState().isOpen).toBe(false)

    usePdfSearchStore.getState().open()
    expect(usePdfSearchStore.getState().isOpen).toBe(true)

    usePdfSearchStore.getState().close()
    expect(usePdfSearchStore.getState().isOpen).toBe(false)
  })

  it('resets to closed', () => {
    usePdfSearchStore.getState().open()
    resetPdfSearchStore()

    expect(usePdfSearchStore.getState().isOpen).toBe(false)
  })
})
