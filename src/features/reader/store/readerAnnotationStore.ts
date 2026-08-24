import { createLocalStorageAdapter } from '@shared/stores/storeUtils'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange'

export interface BlockHighlight {
  id: string
  blockId: string
  documentId: string
  color: HighlightColor
  text?: string
  createdAt: number
}

export interface MarginNote {
  id: string
  blockId: string
  documentId: string
  text: string
  pageNumber: number
  createdAt: number
  updatedAt: number
}

interface AnnotationState {
  highlights: BlockHighlight[]
  notes: MarginNote[]
  addHighlight: (h: Omit<BlockHighlight, 'id' | 'createdAt'>) => string
  removeHighlight: (id: string) => void
  removeHighlightsForBlock: (blockId: string) => void
  getHighlightsForBlock: (blockId: string) => BlockHighlight[]
  addNote: (n: Omit<MarginNote, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateNote: (id: string, text: string) => void
  removeNote: (id: string) => void
  getNotesForBlock: (blockId: string) => MarginNote[]
  getNotesForDocument: (documentId: string) => MarginNote[]
  clearForDocument: (documentId: string) => void
}

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export const useReaderAnnotationStore = create<AnnotationState>()(
  persist(
    (set, get) => ({
      highlights: [],
      notes: [],

      addHighlight: (h) => {
        const id = genId()
        const highlight: BlockHighlight = { ...h, id, createdAt: Date.now() }
        set((s) => ({ highlights: [...s.highlights, highlight] }))
        // Persist to readingHistoryRepository-style key for cross-tab sync
        try {
          const key = `quizlab:highlights:${h.documentId}`
          const existing = JSON.parse(localStorage.getItem(key) ?? '[]') as BlockHighlight[]
          localStorage.setItem(key, JSON.stringify([...existing, highlight]))
        } catch {}
        return id
      },

      removeHighlight: (id) =>
        set((s) => {
          const target = s.highlights.find((x) => x.id === id)
          if (target) {
            try {
              const key = `quizlab:highlights:${target.documentId}`
              const existing = JSON.parse(localStorage.getItem(key) ?? '[]') as BlockHighlight[]
              localStorage.setItem(key, JSON.stringify(existing.filter((x) => x.id !== id)))
            } catch {}
          }
          return { highlights: s.highlights.filter((x) => x.id !== id) }
        }),

      removeHighlightsForBlock: (blockId) =>
        set((s) => ({ highlights: s.highlights.filter((x) => x.blockId !== blockId) })),

      getHighlightsForBlock: (blockId) => get().highlights.filter((x) => x.blockId === blockId),

      addNote: (n) => {
        const id = genId()
        const now = Date.now()
        const note: MarginNote = { ...n, id, createdAt: now, updatedAt: now }
        set((s) => ({ notes: [...s.notes, note] }))
        try {
          const key = `quizlab:marginNotes:${n.documentId}`
          const existing = JSON.parse(localStorage.getItem(key) ?? '[]') as MarginNote[]
          localStorage.setItem(key, JSON.stringify([...existing, note]))
        } catch {}
        return id
      },

      updateNote: (id, text) =>
        set((s) => ({
          notes: s.notes.map((x) => (x.id === id ? { ...x, text, updatedAt: Date.now() } : x))
        })),

      removeNote: (id) => set((s) => ({ notes: s.notes.filter((x) => x.id !== id) })),

      getNotesForBlock: (blockId) => get().notes.filter((x) => x.blockId === blockId),

      getNotesForDocument: (documentId) => get().notes.filter((x) => x.documentId === documentId),

      clearForDocument: (documentId) =>
        set((s) => ({
          highlights: s.highlights.filter((x) => x.documentId !== documentId),
          notes: s.notes.filter((x) => x.documentId !== documentId)
        }))
    }),
    {
      name: 'reader-annotations',
      storage: createLocalStorageAdapter<Partial<AnnotationState>>(),
      partialize: (state) => ({
        highlights: state.highlights,
        notes: state.notes
      })
    }
  )
)

// Convenience helpers for non-React contexts (e.g., readingHistoryRepository bridge)
export function getHighlightsForDocument(documentId: string): BlockHighlight[] {
  return useReaderAnnotationStore.getState().highlights.filter((h) => h.documentId === documentId)
}

export function getMarginNotesForDocument(documentId: string): MarginNote[] {
  return useReaderAnnotationStore.getState().notes.filter((n) => n.documentId === documentId)
}
