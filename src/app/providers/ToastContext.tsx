import { create } from 'zustand'

/** Toast store: max 3 visible; `useToast()` API unchanged. */
export interface Toast {
  id: string
  message: string
  title?: string
  type: 'info' | 'success' | 'warning' | 'error'
  params?: Record<string, string>
  duration?: number
  actionLabel?: string
  onAction?: () => void
}

interface ToastStoreState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
  showSuccess: (
    message: string,
    title?: string,
    params?: Record<string, string>,
    duration?: number
  ) => string
  showError: (
    message: string,
    title?: string,
    params?: Record<string, string>,
    duration?: number
  ) => string
  showWarning: (
    message: string,
    title?: string,
    params?: Record<string, string>,
    duration?: number
  ) => string
  showInfo: (
    message: string,
    title?: string,
    params?: Record<string, string>,
    duration?: number
  ) => string
}

const MAX_TOASTS = 3
const DEFAULT_DURATION = 5000

const useToastStore = create<ToastStoreState>((set, get) => {
  const showTyped =
    (type: Toast['type']) =>
    (message: string, title?: string, params?: Record<string, string>, duration?: number) =>
      get().addToast({ message, title, type, params, duration })

  return {
    toasts: [],

    removeToast: (id: string) => {
      set((prev) => ({ toasts: prev.toasts.filter((toast) => toast.id !== id) }))
    },

    addToast: ({
      message,
      title,
      type = 'info',
      params = {},
      duration = DEFAULT_DURATION
    }: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9)

      set((prev) => {
        const next = [...prev.toasts, { id, message, title, type, params, duration }]
        return { toasts: next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next }
      })

      return id
    },

    showSuccess: showTyped('success'),
    showError: showTyped('error'),
    showWarning: showTyped('warning'),
    showInfo: showTyped('info')
  }
})

export function useToast() {
  const toasts = useToastStore((state) => state.toasts)
  const addToast = useToastStore((state) => state.addToast)
  const removeToast = useToastStore((state) => state.removeToast)
  const showSuccess = useToastStore((state) => state.showSuccess)
  const showError = useToastStore((state) => state.showError)
  const showWarning = useToastStore((state) => state.showWarning)
  const showInfo = useToastStore((state) => state.showInfo)

  return {
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showWarning,
    showInfo
  }
}
