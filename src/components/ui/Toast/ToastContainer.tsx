import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { useToast } from '@src/app/providers';
import ToastItem from './ToastItem';

const ToastContainer: React.FC = () => {
    const { toasts, removeToast } = useToast();

    // Portal targets the body to stay above all elements and avoid z-index/transform issues
    const container = typeof document !== 'undefined' ? document.body : null;

    if (!container) return null;

    return createPortal(
        <div
            id="toast-root"
            className="fixed top-6 right-6 z-[99999] flex flex-col items-end pointer-events-none"
            aria-live="polite"
        >
            <AnimatePresence mode="popLayout">
                {toasts.map((toast) => (
                    <ToastItem
                        key={toast.id}
                        toast={toast}
                        onRemove={removeToast}
                    />
                ))}
            </AnimatePresence>
        </div>,
        container
    );
};

export default ToastContainer;

