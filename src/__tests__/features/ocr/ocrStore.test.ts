import { resetOcrStore, useOcrStore } from '@features/ocr/store/useOcrStore'

import { beforeEach, describe, expect, it } from 'vitest'

describe('useOcrStore', () => {
  beforeEach(() => resetOcrStore())

  it('initial state is idle', () => {
    const s = useOcrStore.getState()
    expect(s.status).toBe('idle')
    expect(s.isPanelOpen).toBe(false)
  })

  it('transitions status', () => {
    useOcrStore.getState().setStatus('processing')
    expect(useOcrStore.getState().status).toBe('processing')
  })

  it('opens and closes panel', () => {
    useOcrStore.getState().openPanel()
    expect(useOcrStore.getState().isPanelOpen).toBe(true)
    useOcrStore.getState().closePanel()
    expect(useOcrStore.getState().isPanelOpen).toBe(false)
  })

  it('bumps token', () => {
    const t1 = useOcrStore.getState().requestToken
    useOcrStore.getState().bumpToken()
    expect(useOcrStore.getState().requestToken).toBe(t1 + 1)
  })

  it('setCurrentRequest updates fields', () => {
    useOcrStore.getState().setCurrentRequest(5, 'doc123', 'job1')
    const s = useOcrStore.getState()
    expect(s.currentPage).toBe(5)
    expect(s.currentDocumentId).toBe('doc123')
    expect(s.jobId).toBe('job1')
  })
})
