/**
 * Tests for src/shared/stores/appearanceStore.ts
 *
 * Zustand store with persist middleware. Controls UI appearance:
 * bottom bar, selection colour, focus mode, tool/model visibility.
 */
import { useAppearance } from '@shared/stores/appearanceStore'

import { beforeEach, describe, expect, it } from 'vitest'

beforeEach(() => {
  window.localStorage.clear()
  useAppearance.persist.clearStorage()
  useAppearance.setState({
    bottomBarOpacity: 0.7,
    bottomBarScale: 1.0,
    selectionColor: '#EAB308',
    isLayoutSwapped: false,
    focusMode: null,
    visibleTools: {
      'tour-target-tool-settings': true,
      'tool-gemini-web': true,
      'tour-target-tool-swap': true,
      'tour-target-tool-pdf-focus': true,
      'tour-target-tool-ai-focus': true,
      'tour-target-tool-picker': true
    },
    visibleModels: {}
  })
})

describe('appearanceStore', () => {
  describe('bottom bar settings', () => {
    it('updates bottom bar opacity', () => {
      useAppearance.getState().setBottomBarOpacity(1.0)
      expect(useAppearance.getState().bottomBarOpacity).toBe(1.0)
    })

    it('updates bottom bar scale', () => {
      useAppearance.getState().setBottomBarScale(1.5)
      expect(useAppearance.getState().bottomBarScale).toBe(1.5)
    })
  })

  describe('removed background settings', () => {
    // The ambient glow was removed with its settings. `merge` used to spread the
    // whole persisted entry over the current state, which re-hydrated `bgMode`
    // and `bgSolidColor` as untyped properties nothing reads — keeping a removed
    // feature alive in memory on every install that had ever saved them.
    beforeEach(async () => {
      // The debounced adapter's `getItem` prefers a *pending* write over what is
      // on disk (see `storeUtils`), so any `setState` left a queued write that
      // would shadow the fixture written below. Rehydrating once flushes that
      // queue and starts each case from a known-settled storage.
      await useAppearance.persist.rehydrate()
      window.localStorage.clear()
      useAppearance.persist.clearStorage()
    })

    const persistEntry = (extra: Record<string, unknown>) =>
      window.localStorage.setItem(
        'appearance-storage',
        JSON.stringify({
          state: {
            bottomBarOpacity: 0.9,
            bottomBarScale: 1.2,
            selectionColor: '#ff0000',
            isLayoutSwapped: true,
            visibleTools: {},
            visibleModels: {},
            ...extra
          },
          version: 0
        })
      )

    it('does not re-hydrate the removed background settings', async () => {
      persistEntry({ bgMode: 'ambient', bgSolidColor: '#123456' })
      await useAppearance.persist.rehydrate()

      const state = useAppearance.getState()
      expect(state).not.toHaveProperty('bgMode')
      expect(state).not.toHaveProperty('bgSolidColor')
    })

    it('still re-hydrates the settings that remain', async () => {
      persistEntry({ bgMode: 'solid', bgSolidColor: '#123456' })
      await useAppearance.persist.rehydrate()

      const state = useAppearance.getState()
      expect(state.bottomBarOpacity).toBe(0.9)
      expect(state.bottomBarScale).toBe(1.2)
      expect(state.selectionColor).toBe('#ff0000')
      expect(state.isLayoutSwapped).toBe(true)
    })
  })

  describe('selection color', () => {
    it('updates selection color', () => {
      useAppearance.getState().setSelectionColor('#ff0000')
      expect(useAppearance.getState().selectionColor).toBe('#ff0000')
    })
  })

  describe('layout swap', () => {
    it('sets layout swapped', () => {
      useAppearance.getState().setIsLayoutSwapped(true)
      expect(useAppearance.getState().isLayoutSwapped).toBe(true)
    })

    it('toggles layout swap', () => {
      useAppearance.getState().toggleLayoutSwap()
      expect(useAppearance.getState().isLayoutSwapped).toBe(true)
      useAppearance.getState().toggleLayoutSwap()
      expect(useAppearance.getState().isLayoutSwapped).toBe(false)
    })
  })

  describe('focus mode', () => {
    it('sets focus mode to pdf', () => {
      useAppearance.getState().setFocusMode('pdf')
      expect(useAppearance.getState().focusMode).toBe('pdf')
    })

    it('sets focus mode to ai', () => {
      useAppearance.getState().setFocusMode('ai')
      expect(useAppearance.getState().focusMode).toBe('ai')
    })

    it('clears focus mode', () => {
      useAppearance.getState().setFocusMode('pdf')
      useAppearance.getState().setFocusMode(null)
      expect(useAppearance.getState().focusMode).toBeNull()
    })

    it('toggles focus mode on', () => {
      useAppearance.getState().toggleFocusMode('pdf')
      expect(useAppearance.getState().focusMode).toBe('pdf')
    })

    it('toggles focus mode off when same mode', () => {
      useAppearance.getState().toggleFocusMode('pdf')
      useAppearance.getState().toggleFocusMode('pdf')
      expect(useAppearance.getState().focusMode).toBeNull()
    })
  })

  describe('tool visibility', () => {
    it('hides a tool', () => {
      useAppearance.getState().setVisibleTool('tour-target-tool-settings', false)
      expect(useAppearance.getState().visibleTools['tour-target-tool-settings']).toBe(false)
    })

    it('shows a tool after hiding', () => {
      useAppearance.getState().setVisibleTool('tour-target-tool-settings', false)
      useAppearance.getState().setVisibleTool('tour-target-tool-settings', true)
      expect(useAppearance.getState().visibleTools['tour-target-tool-settings']).toBe(true)
    })
  })

  describe('model visibility', () => {
    it('sets a model visible', () => {
      useAppearance.getState().setVisibleModel('gemini', true)
      expect(useAppearance.getState().visibleModels['gemini']).toBe(true)
    })

    it('hides a model', () => {
      useAppearance.getState().setVisibleModel('gemini', true)
      useAppearance.getState().setVisibleModel('gemini', false)
      expect(useAppearance.getState().visibleModels['gemini']).toBe(false)
    })
  })
})
