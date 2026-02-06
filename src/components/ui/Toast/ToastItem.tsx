import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useLanguage, type Toast } from '@src/app/providers';

type ToastType = Toast['type'];

const ICONS: Record<ToastType, React.ReactNode> = {
    success: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
    ),
    error: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
    ),
    warning: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
    ),
    info: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
    )
};

const STYLES: Record<ToastType, string> = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    error: 'bg-red-500/10 text-red-400 border-red-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
};

const PROGRESS_COLORS: Record<ToastType, string> = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500'
};

interface ToastItemProps {
    toast: Toast;
    onRemove: (id: string) => void;
}

const ToastItem = React.forwardRef<HTMLDivElement, ToastItemProps>(({ toast, onRemove }, ref) => {
    const { t } = useLanguage();
    const [progress, setProgress] = useState(100);
    const [isPaused, setIsPaused] = useState(false);
    const startTimeRef = useRef(Date.now());
    const remainingTimeRef = useRef(toast.duration || 5000);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const startTimer = () => {
        startTimeRef.current = Date.now();
        timerRef.current = setInterval(() => {
            const elapsedTime = Date.now() - startTimeRef.current;
            const newRemaining = remainingTimeRef.current - elapsedTime;

            const newProgress = (newRemaining / (toast.duration || 5000)) * 100;

            if (newProgress <= 0) {
                if (timerRef.current) clearInterval(timerRef.current);
                onRemove(toast.id);
            } else {
                setProgress(newProgress);
            }
        }, 100); // Reduced to 10fps for performance
    };

    useEffect(() => {
        if (!isPaused) {
            startTimer();
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isPaused]);

    const handleMouseEnter = () => {
        setIsPaused(true);
        remainingTimeRef.current -= (Date.now() - startTimeRef.current);
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const handleMouseLeave = () => {
        setIsPaused(false);
    };

    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation();
        onRemove(toast.id);
    };

    return (
        <motion.div
            ref={ref}
            layout
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95, transition: { duration: 0.2 } }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`
                relative group pointer-events-auto
                w-80 md:w-96 p-4 mb-3
                rounded-2xl border backdrop-blur-xl
                shadow-[0_8px_32px_rgba(0,0,0,0.3)]
                flex items-start gap-4
                ${STYLES[toast.type] || STYLES.info}
                transition-all duration-300
            `}
        >
            {/* Multi-layered Glass Effect */}
            <div className="absolute inset-0 rounded-2xl bg-white/[0.02] pointer-events-none" />

            {/* Status Icon */}
            <div className="flex-shrink-0 mt-0.5">
                {ICONS[toast.type] || ICONS.info}
            </div>

            {/* Content */}
            <div className="flex-grow min-w-0">
                <h4 className="text-sm font-semibold mb-1 truncate">
                    {toast.title ? t(toast.title, toast.params) : t(`toast.${toast.type}.title`)}
                </h4>
                <p className="text-xs opacity-80 leading-relaxed break-words">
                    {t(toast.message, toast.params)}
                </p>
            </div>

            {/* Close Button */}
            <button
                onClick={handleClose}
                className="flex-shrink-0 opacity-40 hover:opacity-100 transition-opacity p-1 -mr-1"
            >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>

            {/* Progress Bar Container */}
            <div className="absolute bottom-0 left-4 right-4 h-[2px] bg-black/10 rounded-full overflow-hidden mb-1">
                {/* Visual Progress */}
                <motion.div
                    className={`h-full ${PROGRESS_COLORS[toast.type] || PROGRESS_COLORS.info} shadow-[0_0_8px_rgba(0,0,0,0.2)]`}
                    initial={{ width: "100%" }}
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: "linear", duration: 0.1 }}
                />
            </div>
        </motion.div>
    );
});

export default ToastItem;

