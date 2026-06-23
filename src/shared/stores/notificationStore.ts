import { createPersistedStore } from './utils'

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

interface NotificationPrefs {
  successEnabled: boolean
  warningEnabled: boolean
  errorEnabled: boolean
  infoEnabled: boolean
}

interface NotificationStoreState extends NotificationPrefs {
  setSuccessEnabled: (value: boolean) => void
  setWarningEnabled: (value: boolean) => void
  setErrorEnabled: (value: boolean) => void
  setInfoEnabled: (value: boolean) => void
  isEnabled: (type: NotificationType) => boolean
}

const DEFAULT_PREFS: NotificationPrefs = {
  successEnabled: true,
  warningEnabled: true,
  errorEnabled: true,
  infoEnabled: true
}

export const useNotificationPrefs = createPersistedStore<NotificationStoreState>(
  'notification-storage',
  (set, get) => ({
    ...DEFAULT_PREFS,

    setSuccessEnabled: (value) => set({ successEnabled: value }),
    setWarningEnabled: (value) => set({ warningEnabled: value }),
    setErrorEnabled: (value) => set({ errorEnabled: value }),
    setInfoEnabled: (value) => set({ infoEnabled: value }),

    isEnabled: (type: NotificationType) => {
      const state = get()
      switch (type) {
        case 'success':
          return state.successEnabled
        case 'error':
          return state.errorEnabled
        case 'warning':
          return state.warningEnabled
        case 'info':
          return state.infoEnabled
        default:
          return true
      }
    }
  }),
  (state) => ({
    successEnabled: state.successEnabled,
    warningEnabled: state.warningEnabled,
    errorEnabled: state.errorEnabled,
    infoEnabled: state.infoEnabled
  })
)
