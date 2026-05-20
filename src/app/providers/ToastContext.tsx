import { create } from 'zustand'

/** Toast store: max 3 visible. Prefer `useToastActions` when you only show toasts (avoids re-renders on toast list changes). */
export interface Toast {
  id: string
  message: string
  title?: string
  type: 'info' | 'success' | 'warning' | 'error'
  params?: Record<string, string>
  duration?: number
  actionLabel?: string
  onAction?: () => void
  createdAt: number
}

interface ToastStoreState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => string
  removeToast: (id: string) => void
  clearAll: () => void
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
const DEDUPE_WINDOW_MS = 1000

let toastCounter = 0

function generateId(): string {
  toastCounter += 1
  return `toast-${Date.now()}-${toastCounter}`
}

function isDuplicate(existing: Toast[], message: string, type: Toast['type']): boolean {
  const now = Date.now()
  return existing.some(
    (t) => t.message === message && t.type === type && now - t.createdAt < DEDUPE_WINDOW_MS
  )
}

const useToastStore = create<ToastStoreState>((set, get) => {
  const showTyped =
    (type: Toast['type']) =>
    (message: string, title?: string, params?: Record<string, string>, duration?: number) =>
      get().addToast({ message, title, type, params, duration })

  return {
    toasts: [],

    clearAll: () => {
      set({ toasts: [] })
    },

    removeToast: (id: string) => {
      set((prev) => ({ toasts: prev.toasts.filter((toast) => toast.id !== id) }))
    },

    addToast: ({
      message,
      title,
      type = 'info',
      params = {},
      duration = DEFAULT_DURATION
    }: Omit<Toast, 'id' | 'createdAt'>) => {
      if (isDuplicate(get().toasts, message, type)) {
        return ''
      }

      const id = generateId()

      set((prev) => {
        const next = [
          ...prev.toasts,
          { id, message, title, type, params, duration, createdAt: Date.now() }
        ]
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

/** Subscribe only to stable action fns — not `toasts` — so new/dismissed toasts do not re-render callers. */
export function useToastActions() {
  const addToast = useToastStore((state) => state.addToast)
  const removeToast = useToastStore((state) => state.removeToast)
  const clearAll = useToastStore((state) => state.clearAll)
  const showSuccess = useToastStore((state) => state.showSuccess)
  const showError = useToastStore((state) => state.showError)
  const showWarning = useToastStore((state) => state.showWarning)
  const showInfo = useToastStore((state) => state.showInfo)

  return { addToast, removeToast, clearAll, showSuccess, showError, showWarning, showInfo }
}

/** For the toast stack UI only (`toasts` updates frequently). */
export function useToastList() {
  const toasts = useToastStore((state) => state.toasts)
  const removeToast = useToastStore((state) => state.removeToast)
  return { toasts, removeToast }
}
