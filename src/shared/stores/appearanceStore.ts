import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createLocalStorageAdapter } from './storeUtils'

type FocusMode = 'pdf' | 'ai' | null
export type BackgroundMode = 'ambient' | 'solid'

// Reader customization – Tipografi, Tema ve Okuma Modu Ayarları
export type ReaderFontFamily = 'sans' | 'serif' | 'mono' | 'dyslexic'
export type ReaderTheme = 'default' | 'sepia' | 'solarized' | 'eink' | 'highContrast'

const DEFAULT_VISIBLE_TOOLS: Record<string, boolean> = {
  'tour-target-tool-settings': true,
  'tour-target-tool-swap': true,
  'tour-target-tool-pdf-focus': true,
  'tour-target-tool-ai-focus': true,
  'tour-target-tool-picker': true
}

function mergeVisibleTools(saved?: Record<string, boolean>): Record<string, boolean> {
  return { ...DEFAULT_VISIBLE_TOOLS, ...(saved ?? {}) }
}

interface AppearanceState {
  bottomBarOpacity: number
  setBottomBarOpacity: (value: number) => void
  bottomBarScale: number
  setBottomBarScale: (value: number) => void

  bgMode: BackgroundMode
  setBgMode: (mode: BackgroundMode) => void
  bgSolidColor: string
  setBgSolidColor: (color: string) => void
  selectionColor: string
  setSelectionColor: (color: string) => void
  isLayoutSwapped: boolean
  setIsLayoutSwapped: (value: boolean) => void
  toggleLayoutSwap: () => void
  // Transient focus mode (NOT persisted). When set, the matching panel
  // (PDF or AI) takes over the full screen until the user exits.
  focusMode: FocusMode
  setFocusMode: (mode: FocusMode) => void
  toggleFocusMode: (mode: Exclude<FocusMode, null>) => void

  // Bottom bar tool visibility
  visibleTools: Record<string, boolean>
  setVisibleTool: (toolId: string, visible: boolean) => void

  // Bottom bar model visibility
  visibleModels: Record<string, boolean>
  setVisibleModel: (modelId: string, visible: boolean) => void

  // Reader typography & theming (AppearanceTab + ReaderBlockShell)
  readerFontFamily: ReaderFontFamily
  setReaderFontFamily: (v: ReaderFontFamily) => void
  readerLineHeight: number
  setReaderLineHeight: (v: number) => void
  readerParagraphGap: number
  setReaderParagraphGap: (v: number) => void
  readerMaxWidth: string
  setReaderMaxWidth: (v: string) => void
  readerLetterSpacing: string
  setReaderLetterSpacing: (v: string) => void
  readerTheme: ReaderTheme
  setReaderTheme: (v: ReaderTheme) => void
}

export const useAppearance = create<AppearanceState>()(
  persist(
    (set) => ({
      bottomBarOpacity: 0.7,
      setBottomBarOpacity: (value) => set({ bottomBarOpacity: value }),
      bottomBarScale: 1.0,
      setBottomBarScale: (value) => set({ bottomBarScale: value }),

      bgMode: 'ambient',
      setBgMode: (mode) => set({ bgMode: mode }),
      bgSolidColor: '#000000',
      setBgSolidColor: (color) => set({ bgSolidColor: color }),
      selectionColor: '#EAB308',
      setSelectionColor: (color) => set({ selectionColor: color }),
      isLayoutSwapped: false,
      setIsLayoutSwapped: (value) => set({ isLayoutSwapped: value }),
      toggleLayoutSwap: () => set((state) => ({ isLayoutSwapped: !state.isLayoutSwapped })),

      focusMode: null,
      setFocusMode: (mode) => set({ focusMode: mode }),
      toggleFocusMode: (mode) =>
        set((state) => ({ focusMode: state.focusMode === mode ? null : mode })),

      visibleTools: { ...DEFAULT_VISIBLE_TOOLS },
      setVisibleTool: (toolId, visible) =>
        set((state) => ({
          visibleTools: { ...state.visibleTools, [toolId]: visible }
        })),

      visibleModels: {},
      setVisibleModel: (modelId, visible) =>
        set((state) => ({
          visibleModels: { ...state.visibleModels, [modelId]: visible }
        })),

      // Reader customization defaults – Sepya / E-Ink / Yüksek Kontrast için hazır
      readerFontFamily: 'sans' as ReaderFontFamily,
      setReaderFontFamily: (v) => set({ readerFontFamily: v }),
      readerLineHeight: 1.7,
      setReaderLineHeight: (v) => set({ readerLineHeight: Math.min(2.4, Math.max(1.2, v)) }),
      readerParagraphGap: 0.75,
      setReaderParagraphGap: (v) => set({ readerParagraphGap: Math.min(2, Math.max(0.2, v)) }),
      readerMaxWidth: '46rem',
      setReaderMaxWidth: (v) => set({ readerMaxWidth: v }),
      readerLetterSpacing: '0em',
      setReaderLetterSpacing: (v) => set({ readerLetterSpacing: v }),
      readerTheme: 'default' as ReaderTheme,
      setReaderTheme: (v) => set({ readerTheme: v })
    }),
    {
      name: 'appearance-storage',
      storage: createLocalStorageAdapter<Partial<AppearanceState>>(),
      partialize: (state) => ({
        bottomBarOpacity: state.bottomBarOpacity,
        bottomBarScale: state.bottomBarScale,
        bgMode: state.bgMode,
        bgSolidColor: state.bgSolidColor,
        selectionColor: state.selectionColor,
        isLayoutSwapped: state.isLayoutSwapped,
        visibleTools: state.visibleTools,
        visibleModels: state.visibleModels,
        readerFontFamily: state.readerFontFamily,
        readerLineHeight: state.readerLineHeight,
        readerParagraphGap: state.readerParagraphGap,
        readerMaxWidth: state.readerMaxWidth,
        readerLetterSpacing: state.readerLetterSpacing,
        readerTheme: state.readerTheme
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Record<string, unknown> | undefined
        return {
          ...currentState,
          ...(persisted ?? {}),
          visibleTools: mergeVisibleTools(
            (persisted?.visibleTools as Record<string, boolean>) ?? undefined
          )
        }
      }
    }
  )
)
