import { create } from 'zustand'
import React from 'react'

/**
 * Toast Management Store
 * Supports queueing (max 3) and keeps the old hook API stable.
 */
export interface Toast {
    id: string;
    message: string;
    title?: string;
    type: 'info' | 'success' | 'warning' | 'error';
    params?: Record<string, string>;
    duration?: number;
    actionLabel?: string;
    onAction?: () => void;
}

interface ToastStoreState {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => string;
    removeToast: (id: string) => void;
    showSuccess: (message: string, title?: string, params?: Record<string, string>, duration?: number) => string;
    showError: (message: string, title?: string, params?: Record<string, string>, duration?: number) => string;
    showWarning: (message: string, title?: string, params?: Record<string, string>, duration?: number) => string;
    showInfo: (message: string, title?: string, params?: Record<string, string>, duration?: number) => string;
}

const MAX_TOASTS = 3
const DEFAULT_DURATION = 5000

const useToastStore = create<ToastStoreState>((set, get) => ({
    toasts: [],

    removeToast: (id: string) => {
        set((prev) => ({ toasts: prev.toasts.filter((toast) => toast.id !== id) }))
    },

    addToast: ({ message, title, type = 'info', params = {}, duration = DEFAULT_DURATION }: Omit<Toast, 'id'>) => {
        const id = Math.random().toString(36).substring(2, 9)

        set((prev) => {
            const next = [...prev.toasts, { id, message, title, type, params, duration }]
            return { toasts: next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next }
        })

        return id
    },

    showSuccess: (message, title, params, duration) => {
        return get().addToast({ message, title, type: 'success', params, duration })
    },

    showError: (message, title, params, duration) => {
        return get().addToast({ message, title, type: 'error', params, duration })
    },

    showWarning: (message, title, params, duration) => {
        return get().addToast({ message, title, type: 'warning', params, duration })
    },

    showInfo: (message, title, params, duration) => {
        return get().addToast({ message, title, type: 'info', params, duration })
    }
}))

// Backward-compatible wrapper for old tree usage.
export function ToastProvider({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}

export function useToast() {
    const toasts = useToastStore(state => state.toasts)
    const addToast = useToastStore(state => state.addToast)
    const removeToast = useToastStore(state => state.removeToast)
    const showSuccess = useToastStore(state => state.showSuccess)
    const showError = useToastStore(state => state.showError)
    const showWarning = useToastStore(state => state.showWarning)
    const showInfo = useToastStore(state => state.showInfo)

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
