import { useToastActions, useToastList } from '@shared/stores/toastStore'

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock notificationStore to always allow toasts
vi.mock('@shared/stores/notificationStore', () => ({
  useNotificationPrefs: {
    getState: () => ({
      isEnabled: () => true
    })
  }
}))

describe('toastStore - useToastActions & useToastList', () => {
  beforeEach(() => {
    // Clear all toasts via useToastActions
    const { result } = renderHook(() => useToastActions())
    act(() => {
      result.current.clearAll()
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('addToast', () => {
    it('adds a toast and returns its id', () => {
      const { result } = renderHook(() => useToastActions())
      let id: string = ''
      act(() => {
        id = result.current.addToast({
          message: 'Test message',
          type: 'success'
        })
      })
      expect(id).toBeTruthy()

      const { result: listResult } = renderHook(() => useToastList())
      expect(listResult.current.toasts).toHaveLength(1)
      expect(listResult.current.toasts[0].message).toBe('Test message')
      expect(listResult.current.toasts[0].type).toBe('success')
    })

    it('generates unique ids', () => {
      const { result } = renderHook(() => useToastActions())
      const ids: string[] = []
      act(() => {
        ids.push(result.current.addToast({ message: 'First', type: 'info' }))
        ids.push(result.current.addToast({ message: 'Second', type: 'info' }))
      })
      expect(ids[0]).not.toBe(ids[1])
    })

    it('enforces MAX_TOASTS limit of 3', () => {
      const { result } = renderHook(() => useToastActions())
      act(() => {
        result.current.addToast({ message: 'Toast 1', type: 'info' })
        result.current.addToast({ message: 'Toast 2', type: 'info' })
        result.current.addToast({ message: 'Toast 3', type: 'info' })
        result.current.addToast({ message: 'Toast 4', type: 'info' })
      })

      const { result: listResult } = renderHook(() => useToastList())
      expect(listResult.current.toasts).toHaveLength(3)
      // First toast should be removed
      expect(listResult.current.toasts[0].message).toBe('Toast 2')
    })

    it('deduplicates within 1 second', () => {
      const { result } = renderHook(() => useToastActions())
      act(() => {
        result.current.addToast({ message: 'Duplicate', type: 'error' })
      })
      act(() => {
        vi.advanceTimersByTime(500)
      })
      let id: string = ''
      act(() => {
        id = result.current.addToast({ message: 'Duplicate', type: 'error' })
      })
      expect(id).toBe('')
    })

    it('allows duplicate after dedup window', () => {
      const { result } = renderHook(() => useToastActions())
      act(() => {
        result.current.addToast({ message: 'Same', type: 'warning' })
      })
      act(() => {
        vi.advanceTimersByTime(1100)
      })
      act(() => {
        result.current.addToast({ message: 'Same', type: 'warning' })
      })
      const { result: listResult } = renderHook(() => useToastList())
      expect(listResult.current.toasts).toHaveLength(2)
    })

    it('allows same message with different type', () => {
      const { result } = renderHook(() => useToastActions())
      act(() => {
        result.current.addToast({ message: 'Same msg', type: 'success' })
        result.current.addToast({ message: 'Same msg', type: 'error' })
      })
      const { result: listResult } = renderHook(() => useToastList())
      expect(listResult.current.toasts).toHaveLength(2)
    })
  })

  describe('removeToast', () => {
    it('removes a toast by id', () => {
      const { result } = renderHook(() => useToastActions())
      let id: string = ''
      act(() => {
        id = result.current.addToast({ message: 'Remove me', type: 'info' })
      })

      act(() => {
        result.current.removeToast(id)
      })

      const { result: listResult } = renderHook(() => useToastList())
      expect(listResult.current.toasts).toHaveLength(0)
    })

    it('does nothing for non-existent id', () => {
      const { result } = renderHook(() => useToastActions())
      act(() => {
        result.current.addToast({ message: 'Keep', type: 'info' })
      })
      act(() => {
        result.current.removeToast('non-existent')
      })
      const { result: listResult } = renderHook(() => useToastList())
      expect(listResult.current.toasts).toHaveLength(1)
    })
  })

  describe('clearAll', () => {
    it('removes all toasts', () => {
      const { result } = renderHook(() => useToastActions())
      act(() => {
        result.current.addToast({ message: 'A', type: 'info' })
        result.current.addToast({ message: 'B', type: 'success' })
        result.current.addToast({ message: 'C', type: 'warning' })
      })

      act(() => {
        result.current.clearAll()
      })

      const { result: listResult } = renderHook(() => useToastList())
      expect(listResult.current.toasts).toHaveLength(0)
    })
  })

  describe('typed convenience methods', () => {
    it('showSuccess adds success toast', () => {
      const { result } = renderHook(() => useToastActions())
      act(() => {
        result.current.showSuccess('Done!')
      })
      const { result: listResult } = renderHook(() => useToastList())
      expect(listResult.current.toasts[0].type).toBe('success')
      expect(listResult.current.toasts[0].message).toBe('Done!')
    })

    it('showError adds error toast', () => {
      const { result } = renderHook(() => useToastActions())
      act(() => {
        result.current.showError('Failed!')
      })
      const { result: listResult } = renderHook(() => useToastList())
      expect(listResult.current.toasts[0].type).toBe('error')
    })

    it('showWarning adds warning toast', () => {
      const { result } = renderHook(() => useToastActions())
      act(() => {
        result.current.showWarning('Careful!')
      })
      const { result: listResult } = renderHook(() => useToastList())
      expect(listResult.current.toasts[0].type).toBe('warning')
    })

    it('showInfo adds info toast', () => {
      const { result } = renderHook(() => useToastActions())
      act(() => {
        result.current.showInfo('FYI')
      })
      const { result: listResult } = renderHook(() => useToastList())
      expect(listResult.current.toasts[0].type).toBe('info')
    })
  })

  describe('toast properties', () => {
    it('includes title when provided', () => {
      const { result } = renderHook(() => useToastActions())
      act(() => {
        result.current.addToast({ message: 'msg', title: 'Title', type: 'info' })
      })
      const { result: listResult } = renderHook(() => useToastList())
      expect(listResult.current.toasts[0].title).toBe('Title')
    })

    it('includes params when provided', () => {
      const { result } = renderHook(() => useToastActions())
      act(() => {
        result.current.addToast({
          message: 'msg',
          type: 'info',
          params: { name: 'ChatGPT' }
        })
      })
      const { result: listResult } = renderHook(() => useToastList())
      expect(listResult.current.toasts[0].params).toEqual({ name: 'ChatGPT' })
    })

    it('sets createdAt timestamp', () => {
      const { result } = renderHook(() => useToastActions())
      const before = Date.now()
      act(() => {
        result.current.addToast({ message: 'msg', type: 'info' })
      })
      const { result: listResult } = renderHook(() => useToastList())
      expect(listResult.current.toasts[0].createdAt).toBeGreaterThanOrEqual(before)
    })
  })
})
