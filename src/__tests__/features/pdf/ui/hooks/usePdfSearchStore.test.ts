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

  it('scopes the query to the document that typed it', () => {
    usePdfSearchStore.getState().open('doc-a')
    usePdfSearchStore.getState().setKeyword('lupus', 'doc-a')

    expect(usePdfSearchStore.getState()).toMatchObject({
      isOpen: true,
      keyword: 'lupus',
      ownerId: 'doc-a'
    })

    // Another document claiming the search starts from a clean query.
    usePdfSearchStore.getState().setKeyword('entropy', 'doc-b')
    expect(usePdfSearchStore.getState()).toMatchObject({
      keyword: 'entropy',
      ownerId: 'doc-b'
    })
  })

  it('only lets the owning document reset its search', () => {
    usePdfSearchStore.getState().open('doc-a')
    usePdfSearchStore.getState().setKeyword('lupus', 'doc-a')

    usePdfSearchStore.getState().resetOwner('doc-b')
    expect(usePdfSearchStore.getState().keyword).toBe('lupus')

    usePdfSearchStore.getState().resetOwner('doc-a')
    expect(usePdfSearchStore.getState()).toMatchObject({
      isOpen: false,
      keyword: '',
      ownerId: null
    })
  })
})
