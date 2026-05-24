import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useToastActions, useToastList } from '@app/providers/ToastContext'

describe('ToastContext & Zustand Store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useToastActions())
    act(() => {
      result.current.clearAll()
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should add a toast and assign a unique ID', () => {
    const { result: actionsResult } = renderHook(() => useToastActions())
    const { result: listResult } = renderHook(() => useToastList())

    let id = ''
    act(() => {
      id = actionsResult.current.addToast({
        message: 'Hello World',
        type: 'info'
      })
    })

    expect(id).toMatch(/^toast-\d+-\d+$/)
    expect(listResult.current.toasts).toHaveLength(1)
    expect(listResult.current.toasts[0]).toMatchObject({
      id,
      message: 'Hello World',
      type: 'info'
    })
  })

  it('should respect MAX_TOASTS limit of 3', () => {
    const { result: actionsResult } = renderHook(() => useToastActions())
    const { result: listResult } = renderHook(() => useToastList())

    act(() => {
      actionsResult.current.addToast({ message: 'T1', type: 'info' })
      actionsResult.current.addToast({ message: 'T2', type: 'info' })
      actionsResult.current.addToast({ message: 'T3', type: 'info' })
      actionsResult.current.addToast({ message: 'T4', type: 'info' })
    })

    expect(listResult.current.toasts).toHaveLength(3)
    // T1 should be dropped and only T2, T3, T4 should remain
    expect(listResult.current.toasts.map((t) => t.message)).toEqual(['T2', 'T3', 'T4'])
  })

  it('should deduplicate similar toasts added within dedupe window', () => {
    const { result: actionsResult } = renderHook(() => useToastActions())
    const { result: listResult } = renderHook(() => useToastList())

    let id1 = ''
    let id2 = ''
    act(() => {
      id1 = actionsResult.current.addToast({ message: 'Duplicate', type: 'warning' })
      id2 = actionsResult.current.addToast({ message: 'Duplicate', type: 'warning' })
    })

    expect(id1).not.toBe('')
    expect(id2).toBe('') // Duplicate ignored
    expect(listResult.current.toasts).toHaveLength(1)

    // Advance time beyond dedupe window (1000ms)
    act(() => {
      vi.advanceTimersByTime(1001)
    })

    let id3 = ''
    act(() => {
      id3 = actionsResult.current.addToast({ message: 'Duplicate', type: 'warning' })
    })

    expect(id3).not.toBe('')
    expect(listResult.current.toasts).toHaveLength(2)
  })

  it('should remove a specific toast when removeToast is called', () => {
    const { result: actionsResult } = renderHook(() => useToastActions())
    const { result: listResult } = renderHook(() => useToastList())

    let id = ''
    act(() => {
      id = actionsResult.current.addToast({ message: 'To Remove', type: 'error' })
    })

    expect(listResult.current.toasts).toHaveLength(1)

    act(() => {
      actionsResult.current.removeToast(id)
    })

    expect(listResult.current.toasts).toHaveLength(0)
  })

  it('should handle type helper methods correctly', () => {
    const { result: actionsResult } = renderHook(() => useToastActions())
    const { result: listResult } = renderHook(() => useToastList())

    act(() => {
      actionsResult.current.showSuccess('Success msg')
      actionsResult.current.showError('Error msg')
      actionsResult.current.showWarning('Warning msg')
      actionsResult.current.showInfo('Info msg')
    })

    // capped at max 3 -> last 3 (Error, Warning, Info)
    expect(listResult.current.toasts).toHaveLength(3)
    expect(listResult.current.toasts[0].type).toBe('error')
    expect(listResult.current.toasts[1].type).toBe('warning')
    expect(listResult.current.toasts[2].type).toBe('info')
  })
})
