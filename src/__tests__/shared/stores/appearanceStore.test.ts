/**
 * Tests for src/shared/stores/appearanceStore.ts
 *
 * Zustand store with persist middleware. Controls UI appearance:
 * bottom bar, background, focus mode, tool/model visibility.
 */
import { useAppearance } from '@shared/stores/appearanceStore'

import { beforeEach, describe, expect, it } from 'vitest'

beforeEach(() => {
  window.localStorage.clear()
  useAppearance.setState({
    bottomBarOpacity: 0.7,
    bottomBarScale: 1.0,
    bgMode: 'ambient',
    bgSolidColor: '#000000',
    selectionColor: '#EAB308',
    isLayoutSwapped: false,
    focusMode: null,
    visibleTools: {
      'tour-target-tool-settings': true,
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
    it('has default opacity of 0.7', () => {
      expect(useAppearance.getState().bottomBarOpacity).toBe(0.7)
    })

    it('updates bottom bar opacity', () => {
      useAppearance.getState().setBottomBarOpacity(1.0)
      expect(useAppearance.getState().bottomBarOpacity).toBe(1.0)
    })

    it('has default scale of 1.0', () => {
      expect(useAppearance.getState().bottomBarScale).toBe(1.0)
    })

    it('updates bottom bar scale', () => {
      useAppearance.getState().setBottomBarScale(1.5)
      expect(useAppearance.getState().bottomBarScale).toBe(1.5)
    })
  })

  describe('background settings', () => {
    it('defaults to ambient mode', () => {
      expect(useAppearance.getState().bgMode).toBe('ambient')
    })

    it('switches to solid mode', () => {
      useAppearance.getState().setBgMode('solid')
      expect(useAppearance.getState().bgMode).toBe('solid')
    })

    it('has default solid color of #000000', () => {
      expect(useAppearance.getState().bgSolidColor).toBe('#000000')
    })

    it('updates solid color', () => {
      useAppearance.getState().setBgSolidColor('#ffffff')
      expect(useAppearance.getState().bgSolidColor).toBe('#ffffff')
    })

    it('has default selection color of #EAB308', () => {
      expect(useAppearance.getState().selectionColor).toBe('#EAB308')
    })

    it('updates selection color', () => {
      useAppearance.getState().setSelectionColor('#ff0000')
      expect(useAppearance.getState().selectionColor).toBe('#ff0000')
    })
  })

  describe('layout swap', () => {
    it('defaults to not swapped', () => {
      expect(useAppearance.getState().isLayoutSwapped).toBe(false)
    })

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
    it('defaults to null', () => {
      expect(useAppearance.getState().focusMode).toBeNull()
    })

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
    it('has all default tools visible', () => {
      const tools = useAppearance.getState().visibleTools
      expect(tools['tour-target-tool-settings']).toBe(true)
      expect(tools['tour-target-tool-swap']).toBe(true)
      expect(tools['tour-target-tool-pdf-focus']).toBe(true)
      expect(tools['tour-target-tool-ai-focus']).toBe(true)
      expect(tools['tour-target-tool-picker']).toBe(true)
    })

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
    it('starts with empty visible models', () => {
      expect(useAppearance.getState().visibleModels).toEqual({})
    })

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
