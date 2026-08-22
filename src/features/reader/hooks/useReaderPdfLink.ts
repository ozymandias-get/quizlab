import type { QuizLabBlock } from '@shared-core/types'

import { usePdfTabStore } from '@features/pdf/hooks/usePdfTabStore'
import { usePdfLinkStore } from '@features/reader/store/pdfLinkStore'

import { useCallback } from 'react'

export function useShowInPdf() {
  const requestShowInPdf = usePdfLinkStore((s) => s.requestShowInPdf)
  const setPdfViewMode = usePdfTabStore((s) => s.setPdfViewMode)
  const setPendingJumpPage = usePdfTabStore((s) => s.setPendingJumpPage)

  return useCallback(
    (block: QuizLabBlock, tabId?: string) => {
      const targetTabId = tabId ?? usePdfTabStore.getState().activePdfTabId
      if (!targetTabId) return
      setPdfViewMode(targetTabId, 'pdf')
      setPendingJumpPage(targetTabId, block.pageNumber)
      requestShowInPdf({ tabId: targetTabId, pageNumber: block.pageNumber, blockId: block.id })
    },
    [requestShowInPdf, setPdfViewMode, setPendingJumpPage]
  )
}

export function usePdfLinkRequest(tabId: string | undefined) {
  const pendingRequest = usePdfLinkStore((s) => s.pendingRequest)
  const consumeRequest = usePdfLinkStore((s) => s.consumeRequest)

  const requestForTab = pendingRequest && pendingRequest.tabId === tabId ? pendingRequest : null

  const consume = useCallback(() => {
    if (!tabId) return null
    return consumeRequest(tabId)
  }, [tabId, consumeRequest])

  return { request: requestForTab, consume }
}
