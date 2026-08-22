import { create } from 'zustand'

export interface PdfLinkRequest {
  tabId: string
  pageNumber: number
  blockId: string
  timestamp: number
}

interface PdfLinkState {
  pendingRequest: PdfLinkRequest | null
  requestShowInPdf: (req: Omit<PdfLinkRequest, 'timestamp'>) => void
  consumeRequest: (tabId: string) => PdfLinkRequest | null
  clearRequest: () => void
}

export const usePdfLinkStore = create<PdfLinkState>((set, get) => ({
  pendingRequest: null,
  requestShowInPdf: ({ tabId, pageNumber, blockId }) => {
    set({ pendingRequest: { tabId, pageNumber, blockId, timestamp: Date.now() } })
  },
  consumeRequest: (tabId) => {
    const req = get().pendingRequest
    if (req && req.tabId === tabId) {
      set({ pendingRequest: null })
      return req
    }
    return null
  },
  clearRequest: () => set({ pendingRequest: null })
}))

export function resetPdfLinkStore(): void {
  usePdfLinkStore.setState({ pendingRequest: null })
}
