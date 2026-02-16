import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * Toast Management System - Solid & Performant
 * Supports: Queueing (max 3), i18n, Progress Bar, Pause-on-hover, Framer Motion
 */

export interface Toast {
    id: string;
    message: string;
    title?: string;
    type: 'info' | 'success' | 'warning' | 'error';
    params?: Record<string, string>;
    duration?: number;
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => string;
    removeToast: (id: string) => void;
    showSuccess: (message: string, title?: string, params?: Record<string, string>, duration?: number) => string;
    showError: (message: string, title?: string, params?: Record<string, string>, duration?: number) => string;
    showWarning: (message: string, title?: string, params?: Record<string, string>, duration?: number) => string;
    showInfo: (message: string, title?: string, params?: Record<string, string>, duration?: number) => string;
}

const ToastContext = createContext<ToastContextType | null>(null);

const MAX_TOASTS = 3;
const DEFAULT_DURATION = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const addToast = useCallback(({ message, title, type = 'info', params = {}, duration = DEFAULT_DURATION }: Omit<Toast, 'id'>) => {
        const id = Math.random().toString(36).substring(2, 9);

        setToasts((prev) => {
            const newToast: Toast = { id, message, title, type, params, duration };
            const updated = [...prev, newToast];

            // Queue Mechanism: Max 3 toasts. If more, remove the oldest one.
            if (updated.length > MAX_TOASTS) {
                return updated.slice(updated.length - MAX_TOASTS);
            }
            return updated;
        });

        return id;
    }, []);

    // Convenience Methods
    const showSuccess = useCallback((message: string, title?: string, params?: Record<string, string>, duration?: number) =>
        addToast({ message, title, type: 'success', params, duration }), [addToast]);

    const showError = useCallback((message: string, title?: string, params?: Record<string, string>, duration?: number) =>
        addToast({ message, title, type: 'error', params, duration }), [addToast]);

    const showWarning = useCallback((message: string, title?: string, params?: Record<string, string>, duration?: number) =>
        addToast({ message, title, type: 'warning', params, duration }), [addToast]);

    const showInfo = useCallback((message: string, title?: string, params?: Record<string, string>, duration?: number) =>
        addToast({ message, title, type: 'info', params, duration }), [addToast]);

    const value = React.useMemo(() => ({
        toasts,
        addToast,
        removeToast,
        showSuccess,
        showError,
        showWarning,
        showInfo
    }), [toasts, addToast, removeToast, showSuccess, showError, showWarning, showInfo]);

    return (
        <ToastContext.Provider value={value}>
            {children}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}