/**
 * Tests for src/shared/stores/notificationStore.ts
 *
 * Zustand store with persist middleware for notification type toggles.
 */
import { useNotificationPrefs } from '@shared/stores/notificationStore'

import { beforeEach, describe, expect, it } from 'vitest'

const STORAGE_KEY = 'notification-storage'

const TYPES = ['success', 'warning', 'error', 'info'] as const
type NotificationType = (typeof TYPES)[number]

type StoreState = ReturnType<typeof useNotificationPrefs.getState>

const setterFor = (type: NotificationType): StoreState[`setSuccessEnabled`] => {
  const state = useNotificationPrefs.getState() as unknown as Record<
    string,
    StoreState[`setSuccessEnabled`]
  >
  return state[`set${type[0].toUpperCase()}${type.slice(1)}Enabled`]
}

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
  it('has every notification type enabled by default', () => {
    const state = useNotificationPrefs.getState()
    for (const type of TYPES) {
      expect(state[`${type}Enabled`]).toBe(true)
      expect(state.isEnabled(type)).toBe(true)
    }
  })

  it.each(TYPES)('disables and re-enables %s notifications', (type) => {
    const setEnabled = setterFor(type)
    const key = `${type}Enabled` as const

    setEnabled(false)
    expect(useNotificationPrefs.getState()[key]).toBe(false)
    expect(useNotificationPrefs.getState().isEnabled(type)).toBe(false)

    setEnabled(true)
    expect(useNotificationPrefs.getState().isEnabled(type)).toBe(true)
  })

  it('treats an unknown type as enabled', () => {
    expect(useNotificationPrefs.getState().isEnabled('unknown' as never)).toBe(true)
  })

  // The preferences decide whether a user ever sees an error toast, so losing
  // them to a store reset or a stale key is silent and unrecoverable from the UI.
  describe('persistence', () => {
    it('writes the toggles through to localStorage', () => {
      useNotificationPrefs.getState().setSuccessEnabled(false)
      useNotificationPrefs.getState().setWarningEnabled(false)

      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
      expect(parsed.state.successEnabled).toBe(false)
      expect(parsed.state.warningEnabled).toBe(false)
      expect(parsed.state.errorEnabled).toBe(true)
    })

    it('rehydrates the toggles from localStorage', () => {
      useNotificationPrefs.getState().setErrorEnabled(false)

      useNotificationPrefs.persist.rehydrate()
      const state: Record<NotificationType, boolean> = {
        success: useNotificationPrefs.getState().successEnabled,
        warning: useNotificationPrefs.getState().warningEnabled,
        error: useNotificationPrefs.getState().errorEnabled,
        info: useNotificationPrefs.getState().infoEnabled
      }

      expect(state.error).toBe(false)
      expect(state.success).toBe(true)
    })
  })
})
