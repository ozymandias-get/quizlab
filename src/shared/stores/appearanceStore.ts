import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createDebouncedStorageAdapter } from './storeUtils'

type FocusMode = 'pdf' | 'ai' | null

const DEFAULT_VISIBLE_TOOLS: Record<string, boolean> = {
  'tour-target-tool-settings': true,
  'tool-gemini-web': true,
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
  persist<AppearanceState, [], [], Partial<AppearanceState>>(
    (set) => ({
      bottomBarOpacity: 0.7,
      setBottomBarOpacity: (value) => set({ bottomBarOpacity: value }),
      bottomBarScale: 1.0,
      setBottomBarScale: (value) => set({ bottomBarScale: value }),

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
      storage: createDebouncedStorageAdapter<Partial<AppearanceState>>(300),
      partialize: (state) => ({
        bottomBarOpacity: state.bottomBarOpacity,
        bottomBarScale: state.bottomBarScale,
        selectionColor: state.selectionColor,
        isLayoutSwapped: state.isLayoutSwapped,
        visibleTools: state.visibleTools,
        visibleModels: state.visibleModels
      }),
      /**
       * Re-hydrates only the fields this store still owns.
       *
       * A spread of the whole persisted entry would re-hydrate `bgMode` and
       * `bgSolidColor` as untyped properties nothing reads. Those belong to the
       * ambient glow that was removed because its continuously repainting 70px
       * blurred, blend-mode background starved the composited `WebContentsView`
       * AI panels; leaving them reachable here would keep a removed feature
       * alive in memory on every install that had ever saved them.
       *
       * The keys stay on disk. Rewriting the entry would need `version` +
       * `migrate`, and `migrate` marking the state dirty makes the persist
       * middleware write back — including after `settingsSync` restores state
       * from the main process, which is a restore that must not re-persist.
       * Ignoring them achieves the same result without a write.
       */
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Record<string, unknown> | undefined
        const {
          bgMode: _bgMode,
          bgSolidColor: _bgSolidColor,
          ...stillOwned
        } = (persisted ?? {}) as Record<string, unknown> & {
          bgMode?: unknown
          bgSolidColor?: unknown
        }
        return {
          ...currentState,
          ...stillOwned,
          visibleTools: mergeVisibleTools(
            (stillOwned.visibleTools as Record<string, boolean>) ?? undefined
          )
        }
      }
    }
  )
)
