import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createLocalStorageAdapter } from './utils'

type FocusMode = 'pdf' | 'ai' | null
export type BackgroundMode = 'ambient' | 'solid'

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
        }))
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
        visibleModels: state.visibleModels
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
