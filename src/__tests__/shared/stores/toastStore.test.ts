/**
 * Tests for src/shared/stores/toastStore.ts
 *
 * Zustand store for toast notifications with deduplication, max count,
 * and notification preference integration.
 * NOTE: useToastActions and useToastList are React hooks, so we use
 * renderHook to call them inside a valid React component context.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Must hoist before all imports
const mockIsEnabled = vi.hoisted(() => vi.fn().mockReturnValue(true))
vi.mock('@shared/stores/notificationStore', () => ({
  useNotificationPrefs: {
    getState: () => ({
      isEnabled: mockIsEnabled
    })
  }
}))

const { useToastList, useToastActions } = await import('@shared/stores/toastStore')

beforeEach(() => {
  mockIsEnabled.mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

let testSeq = 0
function uniqueMessage(base = 'msg'): string {
  testSeq += 1
  return `${base}-${testSeq}`
}

describe('toastStore', () => {
  describe('initial state', () => {
    it('starts with empty toasts', () => {
      const { result } = renderHook(() => useToastList())
      expect(result.current.toasts).toEqual([])
    })
  })

  describe('addToast', () => {
    it('adds a toast and returns an id', () => {
      const { result: actions } = renderHook(() => useToastActions())
      let id = ''
      act(() => {
        id = actions.current.addToast({ message: uniqueMessage(), type: 'info' })
      })
      expect(id).toBeTruthy()
      expect(typeof id).toBe('string')
    })

    it('adds toast to the list', () => {
      const msg = uniqueMessage()
      const { result: list } = renderHook(() => useToastList())
      const { result: actions } = renderHook(() => useToastActions())

      act(() => {
        actions.current.addToast({ message: msg, type: 'info' })
      })

      const found = list.current.toasts.find((t) => t.message === msg)
      expect(found).toBeDefined()
    })

    it('assigns a type and createdAt', () => {
      const msg = uniqueMessage()
      const { result: actions } = renderHook(() => useToastActions())
      const { result: list } = renderHook(() => useToastList())

      let id = ''
      act(() => {
        id = actions.current.addToast({ message: msg, type: 'error' })
      })

      const toast = list.current.toasts.find((t) => t.id === id)
      expect(toast).toBeDefined()
      expect(toast!.type).toBe('error')
      expect(toast!.createdAt).toBeGreaterThan(0)
    })

    it('defaults to info type', () => {
      const msg = uniqueMessage()
      const { result: actions } = renderHook(() => useToastActions())
      const { result: list } = renderHook(() => useToastList())

      act(() => {
        actions.current.addToast({ message: msg })
      })

      expect(list.current.toasts.find((t) => t.message === msg)?.type).toBe('info')
    })

    it('defaults params to empty object', () => {
      const msg = uniqueMessage()
      const { result: actions } = renderHook(() => useToastActions())
      const { result: list } = renderHook(() => useToastList())

      act(() => {
        actions.current.addToast({ message: msg })
      })

      expect(list.current.toasts.find((t) => t.message === msg)?.params).toEqual({})
    })

    it('defaults duration to 5000', () => {
      const msg = uniqueMessage()
      const { result: actions } = renderHook(() => useToastActions())
      const { result: list } = renderHook(() => useToastList())

      act(() => {
        actions.current.addToast({ message: msg })
      })

      expect(list.current.toasts.find((t) => t.message === msg)?.duration).toBe(5000)
    })
  })

  describe('deduplication', () => {
    it('deduplicates identical messages within 1s window', () => {
      const msg = uniqueMessage('dup')
      const { result: actions } = renderHook(() => useToastActions())

      let id1 = ''
      let id2 = ''
      act(() => {
        id1 = actions.current.addToast({ message: msg, type: 'info' })
        id2 = actions.current.addToast({ message: msg, type: 'info' })
      })
      expect(id1).toBeTruthy()
      expect(id2).toBe('')
    })

    it('allows same message with different type', () => {
      const msg = uniqueMessage('same')
      const { result: actions } = renderHook(() => useToastActions())
      const { result: list } = renderHook(() => useToastList())

      act(() => {
        actions.current.addToast({ message: msg, type: 'info' })
        actions.current.addToast({ message: msg, type: 'error' })
      })

      const matching = list.current.toasts.filter((t) => t.message === msg)
      expect(matching).toHaveLength(2)
    })
  })

  describe('max toasts limit', () => {
    it('limits toasts to maximum 3', () => {
      const msgs = ['one', 'two', 'three', 'four'].map((m) => uniqueMessage(m))
      const { result: actions } = renderHook(() => useToastActions())
      const { result: list } = renderHook(() => useToastList())

      act(() => {
        msgs.forEach((m) => actions.current.addToast({ message: m, type: 'info' }))
      })

      expect(list.current.toasts.length).toBeLessThanOrEqual(3)
    })
  })

  describe('removeToast', () => {
    it('removes a toast by id', () => {
      const msg = uniqueMessage()
      const { result: actions } = renderHook(() => useToastActions())
      const { result: list } = renderHook(() => useToastList())

      let id = ''
      act(() => {
        id = actions.current.addToast({ message: msg, type: 'info' })
      })
      expect(list.current.toasts.find((t) => t.id === id)).toBeDefined()

      act(() => {
        actions.current.removeToast(id)
      })
      expect(list.current.toasts.find((t) => t.id === id)).toBeUndefined()
    })

    it('does nothing for unknown id', () => {
      const msg = uniqueMessage()
      const { result: actions } = renderHook(() => useToastActions())
      const { result: list } = renderHook(() => useToastList())

      act(() => {
        actions.current.addToast({ message: msg, type: 'info' })
      })
      const countBefore = list.current.toasts.length

      act(() => {
        actions.current.removeToast('non-existent')
      })
      expect(list.current.toasts.length).toBe(countBefore)
    })
  })

  describe('clearAll', () => {
    it('removes all toasts', () => {
      const { result: actions } = renderHook(() => useToastActions())
      const { result: list } = renderHook(() => useToastList())

      act(() => {
        actions.current.addToast({ message: uniqueMessage(), type: 'info' })
      })
      expect(list.current.toasts.length).toBeGreaterThan(0)

      act(() => {
        actions.current.clearAll()
      })
      expect(list.current.toasts).toHaveLength(0)
    })
  })

  describe('convenience methods', () => {
    it('showSuccess returns a toast id', () => {
      const { result: actions } = renderHook(() => useToastActions())
      let id = ''
      act(() => {
        id = actions.current.showSuccess(uniqueMessage('success'))
      })
      expect(id).toBeTruthy()
    })

    it('showError adds an error toast', () => {
      const { result: actions } = renderHook(() => useToastActions())
      act(() => {
        actions.current.showError(uniqueMessage('error'))
      })
    })

    it('showWarning adds a warning toast', () => {
      const { result: actions } = renderHook(() => useToastActions())
      act(() => {
        actions.current.showWarning(uniqueMessage('warning'))
      })
    })

    it('showInfo adds an info toast', () => {
      const { result: actions } = renderHook(() => useToastActions())
      act(() => {
        actions.current.showInfo(uniqueMessage('info'))
      })
    })
  })

  describe('notification preference integration', () => {
    it('does not add toast when notification type is disabled', () => {
      mockIsEnabled.mockReturnValue(false)
      const { result: actions } = renderHook(() => useToastActions())

      let id = ''
      act(() => {
        id = actions.current.addToast({ message: uniqueMessage('disabled'), type: 'info' })
      })
      expect(id).toBe('')
    })
  })
})
