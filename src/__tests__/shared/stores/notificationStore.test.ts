/**
 * Tests for src/shared/stores/notificationStore.ts
 *
 * Zustand store with persist middleware for notification type toggles.
 */
import { useNotificationPrefs } from '@shared/stores/notificationStore'

import { beforeEach, describe, expect, it } from 'vitest'

beforeEach(() => {
  window.localStorage.clear()
  useNotificationPrefs.setState({
    successEnabled: true,
    warningEnabled: true,
    errorEnabled: true,
    infoEnabled: true
  })
})

describe('notificationStore', () => {
  describe('default state', () => {
    it('has all notification types enabled by default', () => {
      const state = useNotificationPrefs.getState()
      expect(state.successEnabled).toBe(true)
      expect(state.warningEnabled).toBe(true)
      expect(state.errorEnabled).toBe(true)
      expect(state.infoEnabled).toBe(true)
    })
  })

  describe('setters', () => {
    it('disables success notifications', () => {
      useNotificationPrefs.getState().setSuccessEnabled(false)
      expect(useNotificationPrefs.getState().successEnabled).toBe(false)
    })

    it('disables warning notifications', () => {
      useNotificationPrefs.getState().setWarningEnabled(false)
      expect(useNotificationPrefs.getState().warningEnabled).toBe(false)
    })

    it('disables error notifications', () => {
      useNotificationPrefs.getState().setErrorEnabled(false)
      expect(useNotificationPrefs.getState().errorEnabled).toBe(false)
    })

    it('disables info notifications', () => {
      useNotificationPrefs.getState().setInfoEnabled(false)
      expect(useNotificationPrefs.getState().infoEnabled).toBe(false)
    })

    it('re-enables disabled notifications', () => {
      const store = useNotificationPrefs.getState()
      store.setSuccessEnabled(false)
      store.setSuccessEnabled(true)
      expect(useNotificationPrefs.getState().successEnabled).toBe(true)
    })
  })

  describe('isEnabled', () => {
    it('returns true for success when enabled', () => {
      expect(useNotificationPrefs.getState().isEnabled('success')).toBe(true)
    })

    it('returns false for success when disabled', () => {
      useNotificationPrefs.getState().setSuccessEnabled(false)
      expect(useNotificationPrefs.getState().isEnabled('success')).toBe(false)
    })

    it('returns true for warning when enabled', () => {
      expect(useNotificationPrefs.getState().isEnabled('warning')).toBe(true)
    })

    it('returns false for warning when disabled', () => {
      useNotificationPrefs.getState().setWarningEnabled(false)
      expect(useNotificationPrefs.getState().isEnabled('warning')).toBe(false)
    })

    it('returns true for error when enabled', () => {
      expect(useNotificationPrefs.getState().isEnabled('error')).toBe(true)
    })

    it('returns false for error when disabled', () => {
      useNotificationPrefs.getState().setErrorEnabled(false)
      expect(useNotificationPrefs.getState().isEnabled('error')).toBe(false)
    })

    it('returns true for info when enabled', () => {
      expect(useNotificationPrefs.getState().isEnabled('info')).toBe(true)
    })

    it('returns false for info when disabled', () => {
      useNotificationPrefs.getState().setInfoEnabled(false)
      expect(useNotificationPrefs.getState().isEnabled('info')).toBe(false)
    })

    it('returns true for unknown type', () => {
      expect(useNotificationPrefs.getState().isEnabled('unknown' as any)).toBe(true)
    })
  })
})
