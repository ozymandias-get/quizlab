import { type NotificationType, useNotificationPrefs } from '@shared/stores/notificationStore'

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

describe('notificationStore - useNotificationPrefs', () => {
  beforeEach(() => {
    window.localStorage.clear()
    // Reset the store to defaults
    const { result } = renderHook(() => useNotificationPrefs())
    act(() => {
      result.current.setSuccessEnabled(true)
      result.current.setWarningEnabled(true)
      result.current.setErrorEnabled(true)
      result.current.setInfoEnabled(true)
    })
  })

  describe('default state', () => {
    it('all notification types are enabled by default', () => {
      const { result } = renderHook(() => useNotificationPrefs())
      expect(result.current.successEnabled).toBe(true)
      expect(result.current.warningEnabled).toBe(true)
      expect(result.current.errorEnabled).toBe(true)
      expect(result.current.infoEnabled).toBe(true)
    })

    it('isEnabled returns true for all types by default', () => {
      const { result } = renderHook(() => useNotificationPrefs())
      expect(result.current.isEnabled('success')).toBe(true)
      expect(result.current.isEnabled('error')).toBe(true)
      expect(result.current.isEnabled('warning')).toBe(true)
      expect(result.current.isEnabled('info')).toBe(true)
    })
  })

  describe('toggling notifications', () => {
    it('disables success notifications', () => {
      const { result } = renderHook(() => useNotificationPrefs())
      act(() => {
        result.current.setSuccessEnabled(false)
      })
      expect(result.current.successEnabled).toBe(false)
      expect(result.current.isEnabled('success')).toBe(false)
    })

    it('disables error notifications', () => {
      const { result } = renderHook(() => useNotificationPrefs())
      act(() => {
        result.current.setErrorEnabled(false)
      })
      expect(result.current.errorEnabled).toBe(false)
      expect(result.current.isEnabled('error')).toBe(false)
    })

    it('disables warning notifications', () => {
      const { result } = renderHook(() => useNotificationPrefs())
      act(() => {
        result.current.setWarningEnabled(false)
      })
      expect(result.current.warningEnabled).toBe(false)
      expect(result.current.isEnabled('warning')).toBe(false)
    })

    it('disables info notifications', () => {
      const { result } = renderHook(() => useNotificationPrefs())
      act(() => {
        result.current.setInfoEnabled(false)
      })
      expect(result.current.infoEnabled).toBe(false)
      expect(result.current.isEnabled('info')).toBe(false)
    })

    it('re-enables a previously disabled type', () => {
      const { result } = renderHook(() => useNotificationPrefs())
      act(() => {
        result.current.setSuccessEnabled(false)
      })
      act(() => {
        result.current.setSuccessEnabled(true)
      })
      expect(result.current.isEnabled('success')).toBe(true)
    })
  })

  describe('persistence', () => {
    it('persists preferences to localStorage', () => {
      const { result } = renderHook(() => useNotificationPrefs())
      act(() => {
        result.current.setSuccessEnabled(false)
        result.current.setWarningEnabled(false)
      })

      const stored = window.localStorage.getItem('notification-storage')
      expect(stored).toBeTruthy()
      const parsed = JSON.parse(stored!)
      expect(parsed.state.successEnabled).toBe(false)
      expect(parsed.state.warningEnabled).toBe(false)
    })

    it('restores preferences from localStorage', () => {
      // Set preferences
      const { result: result1 } = renderHook(() => useNotificationPrefs())
      act(() => {
        result1.current.setSuccessEnabled(false)
      })

      // Create new hook instance (simulates page reload)
      const { result: result2 } = renderHook(() => useNotificationPrefs())
      expect(result2.current.successEnabled).toBe(false)
    })
  })

  describe('isEnabled edge cases', () => {
    it('returns true for unknown type (default case)', () => {
      const { result } = renderHook(() => useNotificationPrefs())
      expect(result.current.isEnabled('unknown' as NotificationType)).toBe(true)
    })
  })
})
