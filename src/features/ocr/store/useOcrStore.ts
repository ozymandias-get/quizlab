import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createDocumentFingerprint } from '../lib/cacheKey'
import type { OcrConfig, OcrPageResult, OcrStatus } from '../types'
import { DEFAULT_OCR_CONFIG } from '../types'

export interface OcrStoreState {
  status: OcrStatus
  currentPage: number | null
  currentDocumentId: string | null
  result: OcrPageResult | null
  error: string | null
  isPanelOpen: boolean
  config: OcrConfig
  jobId: string | null
  requestToken: number
  isAreaSelectionActive: boolean
  pendingPage: number | null
  pendingPdfFile: {
    path?: string | null
    name?: string | null
    size?: number | null
    streamUrl?: string | null
  } | null
  /** Immutable snapshot at selection start — authoritative for staleness checks */
  pendingDocumentId: string | null
  pendingFingerprint: string | null
  pendingToken: number | null
  selectionGeneration: number
}

interface OcrStoreActions {
  setStatus: (s: OcrStatus) => void
  setResult: (r: OcrPageResult | null, page?: number | null, docId?: string | null) => void
  setError: (e: string | null) => void
  openPanel: () => void
  closePanel: () => void
  setCurrentRequest: (page: number | null, docId: string | null, jobId: string | null) => void
  setConfig: (c: Partial<OcrConfig>) => void
  reset: () => void
  bumpToken: () => number
  setAreaSelectionActive: (v: boolean) => void
  startAreaSelection: (
    page: number,
    pdfFile: {
      path?: string | null
      name?: string | null
      size?: number | null
      streamUrl?: string | null
    },
    pdfUrl: string | null
  ) => void
  cancelAreaSelection: () => void
  clearTransientResult: () => void
}

type OcrStore = OcrStoreState & OcrStoreActions

const initialState: OcrStoreState = {
  status: 'idle',
  currentPage: null,
  currentDocumentId: null,
  result: null,
  error: null,
  isPanelOpen: false,
  config: { ...DEFAULT_OCR_CONFIG },
  jobId: null,
  requestToken: 0,
  isAreaSelectionActive: false,
  pendingPage: null,
  pendingPdfFile: null,
  pendingDocumentId: null,
  pendingFingerprint: null,
  pendingToken: null,
  selectionGeneration: 0
}

export const useOcrStore = create<OcrStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setStatus: (status) => set({ status }),

      setResult: (result, page, docId) =>
        set({
          result,
          error: null,
          status: result ? 'success' : get().status,
          currentPage: page ?? get().currentPage,
          currentDocumentId: docId ?? get().currentDocumentId
        }),

      setError: (error) => set({ error, status: error ? 'error' : get().status }),

      openPanel: () => set({ isPanelOpen: true }),
      closePanel: () => set({ isPanelOpen: false }),

      setCurrentRequest: (currentPage, currentDocumentId, jobId) =>
        set({ currentPage, currentDocumentId, jobId, error: null }),

      setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),

      reset: () =>
        set({
          status: 'idle',
          error: null,
          result: null,
          currentPage: null,
          currentDocumentId: null,
          jobId: null,
          isPanelOpen: false,
          requestToken: get().requestToken + 1,
          isAreaSelectionActive: false,
          pendingPage: null,
          pendingPdfFile: null,
          pendingDocumentId: null,
          pendingFingerprint: null,
          pendingToken: null,
          selectionGeneration: get().selectionGeneration + 1
        }),

      bumpToken: () => {
        const next = get().requestToken + 1
        set({ requestToken: next })
        return next
      },

      setAreaSelectionActive: (v) => set({ isAreaSelectionActive: v }),

      startAreaSelection: (page, pdfFile, _pdfUrl) => {
        const fingerprint = createDocumentFingerprint({
          path: pdfFile.path ?? null,
          name: pdfFile.name ?? null,
          size: pdfFile.size ?? null,
          streamUrl: pdfFile.streamUrl ?? null
        })
        const documentId = fingerprint
        const token = get().requestToken
        return set({
          isAreaSelectionActive: true,
          pendingPage: page,
          pendingPdfFile: pdfFile,
          pendingDocumentId: documentId,
          pendingFingerprint: fingerprint,
          pendingToken: token,
          selectionGeneration: get().selectionGeneration + 1
        })
      },

      cancelAreaSelection: () =>
        set({
          isAreaSelectionActive: false,
          pendingPage: null,
          pendingPdfFile: null,
          pendingDocumentId: null,
          pendingFingerprint: null,
          pendingToken: null,
          selectionGeneration: get().selectionGeneration + 1
        }),

      clearTransientResult: () =>
        set({
          result: null,
          error: null,
          status: 'idle',
          currentPage: null,
          currentDocumentId: null,
          jobId: null
        })
    }),
    {
      name: 'ocr-storage',
      partialize: (state) => ({ config: state.config }) as unknown as OcrStoreState,
      version: 2,
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<OcrStoreState> | undefined
        const cfg = (persisted?.config ?? {}) as Partial<OcrConfig>
        return {
          ...currentState,
          ...(persisted ?? {}),
          config: { ...DEFAULT_OCR_CONFIG, ...cfg },
          status: 'idle' as OcrStatus,
          result: null,
          error: null,
          isPanelOpen: false,
          currentPage: null,
          currentDocumentId: null,
          jobId: null,
          requestToken: 0,
          isAreaSelectionActive: false,
          pendingPage: null,
          pendingPdfFile: null,
          pendingDocumentId: null,
          pendingFingerprint: null,
          pendingToken: null,
          selectionGeneration: 0
        } as OcrStore
      }
    }
  )
)

export function resetOcrStore(): void {
  useOcrStore.setState({ ...initialState, config: { ...DEFAULT_OCR_CONFIG } })
}
