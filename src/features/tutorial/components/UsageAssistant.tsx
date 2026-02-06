import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '@src/app/providers'

/**
 * Kullanım Asistanı - Karartmasız
 * Sadece ok ve kare işaretleri ile hedefleri gösterir
 */

// ================== STEP CONFIG ==================
const STEP_CONFIG = [
    {
        targetId: 'bottom-bar-hub-btn',
        titleKey: 'ua_step1_title',
        textKey: 'ua_step1_text'
    },
    {
        targetIds: ['bottom-bar-tools-panel', 'bottom-bar-models-list'],
        titleKey: 'ua_step2_title',
        textKey: 'ua_step2_text'
    },
    {
        targetId: 'tool-btn-picker',
        titleKey: 'ua_step3_title',
        textKey: 'ua_step3_text'
    },
    {
        targetId: 'tool-btn-swap',
        titleKey: 'ua_step4_title',
        textKey: 'ua_step4_text'
    },
    {
        targetId: 'tool-btn-settings',
        titleKey: 'ua_step5_title',
        textKey: 'ua_step5_text'
    }
]

interface Rect {
    top: number;
    left: number;
    width: number;
    height: number;
    id?: string;
    targetId?: string;
    index?: number;
}

interface PointerProps {
    rect: Rect;
    color?: string;
}

interface HighlightBoxProps {
    rect: Rect;
    color?: string;
}

interface TooltipProps {
    step: number;
    totalSteps: number;
    title: string;
    text: string;
    onNext: () => void;
    onSkip: () => void;
    finishText: string;
    nextText: string;
    skipText: string;
}

interface UsageAssistantProps {
    isActive: boolean;
    onClose: () => void;
}

// ================== POINTER (OK İŞARETİ) ==================
const Pointer = React.memo<PointerProps>(({ rect, color = '#10b981' }) => {
    if (!rect) return null

    return (
        <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="fixed z-[10001] pointer-events-none"
            style={{
                left: rect.left + rect.width / 2 - 24,
                top: rect.top - 80
            }}
        >
            <div className="relative">
                {/* Glow aura */}
                <div
                    className="absolute inset-x-0 bottom-0 h-10 blur-xl opacity-40 rounded-full"
                    style={{ backgroundColor: color }}
                />

                <motion.svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    animate={{ y: [0, 12, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                    className="relative"
                >
                    <defs>
                        <linearGradient id="pointerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="white" stopOpacity="0.2" />
                            <stop offset="100%" stopColor={color} />
                        </linearGradient>
                    </defs>
                    <path
                        d="M12 4L12 20M12 20L6 14M12 20L18 14"
                        stroke="url(#pointerGradient)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M12 20L6 14M12 20L18 14"
                        stroke={color}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="opacity-50"
                        style={{ filter: 'blur(2px)' }}
                    />
                </motion.svg>
            </div>
        </motion.div>
    )
})

// ================== HIGHLIGHT BOX ==================
const HighlightBox = React.memo<HighlightBoxProps>(({ rect, color = '#3b82f6' }) => {
    if (!rect) return null

    return (
        <div
            className="fixed z-[10000] pointer-events-none"
            style={{
                left: rect.left - 12,
                top: rect.top - 12,
                width: rect.width + 24,
                height: rect.height + 24,
            }}
        >
            {/* Animated focus border */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 rounded-2xl"
                style={{
                    border: `2px solid ${color}`,
                    boxShadow: `0 0 0 2px ${color}20`,
                }}
            />

            {/* Pulsing outer glow */}
            <motion.div
                animate={{
                    opacity: [0.1, 0.3, 0.1],
                    scale: [1, 1.05, 1]
                }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="absolute inset-0 rounded-2xl"
                style={{
                    backgroundColor: `${color}10`,
                    boxShadow: `0 0 30px 5px ${color}30`,
                }}
            />

            {/* Corner accents */}
            {[
                "top-0 left-0 border-t-4 border-l-4",
                "top-0 right-0 border-t-4 border-r-4",
                "bottom-0 left-0 border-b-4 border-l-4",
                "bottom-0 right-0 border-b-4 border-r-4"
            ].map((cls, i) => (
                <div
                    key={i}
                    className={`absolute w-4 h-4 rounded-sm ${cls}`}
                    style={{ borderColor: color }}
                />
            ))}
        </div>
    )
})

// ================== TOOLTIP ==================
const Tooltip = React.memo<TooltipProps>(({ step, totalSteps, title, text, onNext, onSkip, finishText, nextText, skipText }) => {
    return (
        <motion.div
            key={step}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed z-[10002] left-1/2 bottom-[10%] -translate-x-1/2 w-[440px] p-8 rounded-[2rem] bg-slate-900/90 backdrop-blur-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] border border-white/10"
        >
            {/* Gloss effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-[2rem] pointer-events-none" />

            {/* Header */}
            <div className="relative flex items-center gap-5 mb-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center text-xl font-black shadow-lg shadow-amber-500/20">
                    {step + 1}
                </div>
                <div className="flex-1">
                    <h3 className="text-xl font-black text-white tracking-tight">{title}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                        {Array.from({ length: totalSteps }).map((_, i) => (
                            <div
                                key={i}
                                className={`h-1 rounded-full transition-all duration-500 ${i === step ? 'bg-amber-400 w-6' : 'bg-white/10 w-2'
                                    }`}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="relative mb-8">
                <p className="text-base text-white/70 leading-relaxed font-medium">{text}</p>
            </div>

            {/* Footer */}
            <div className="relative flex items-center justify-between pt-6 border-t border-white/5">
                <button
                    onClick={onSkip}
                    className="px-5 py-2.5 text-sm font-bold text-white/30 hover:text-white/60 transition-colors uppercase tracking-widest"
                >
                    {skipText}
                </button>

                <button
                    onClick={onNext}
                    className="group px-7 py-3 rounded-2xl bg-white text-slate-900 text-sm font-black transition-all hover:scale-105 active:scale-95 flex items-center gap-2 shadow-xl shadow-white/10"
                >
                    {step === totalSteps - 1 ? finishText : nextText}
                    <motion.svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        animate={{ x: [0, 3, 0] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                    </motion.svg>
                </button>
            </div>
        </motion.div>
    )
})

// ================== MAIN ==================
function UsageAssistant({ isActive, onClose }: UsageAssistantProps) {
    const { t } = useLanguage()
    const [step, setStep] = useState(0)
    const [rects, setRects] = useState<Rect[]>([])

    // Reset
    useEffect(() => {
        if (isActive) {
            setStep(0)
            setRects([])
        }
    }, [isActive])

    // Helper for rect comparison
    const areRectsSame = (r1: Rect[], r2: Rect[]) => {
        if (r1.length !== r2.length) return false
        return r1.every((rect, i) => {
            const other = r2[i]
            return rect.targetId === other.targetId &&
                Math.abs(rect.top - other.top) < 1 &&
                Math.abs(rect.left - other.left) < 1 &&
                Math.abs(rect.width - other.width) < 1 &&
                Math.abs(rect.height - other.height) < 1
        })
    }

    // Update rects
    const updateRects = useCallback(() => {
        if (!isActive) return

        const config = STEP_CONFIG[step]
        if (!config) return

        const newRects: Rect[] = []

        if (config.targetId) {
            const el = document.getElementById(config.targetId)
            if (el) {
                const rect = el.getBoundingClientRect()
                if (rect.width > 0 && rect.height > 0) {
                    newRects.push({
                        top: rect.top, left: rect.left, width: rect.width, height: rect.height,
                        id: config.targetId,
                        targetId: config.targetId
                    })
                }
            }
        }

        if (config.targetIds) {
            config.targetIds.forEach((id, index) => {
                const el = document.getElementById(id)
                if (el) {
                    const rect = el.getBoundingClientRect()
                    if (rect.width > 0 && rect.height > 0) {
                        newRects.push({
                            top: rect.top, left: rect.left, width: rect.width, height: rect.height,
                            id, index,
                            targetId: id
                        })
                    }
                }
            })
        }

        setRects(prev => {
            if (areRectsSame(prev, newRects)) return prev
            return newRects
        })
    }, [isActive, step])

    useEffect(() => {
        if (!isActive) return

        updateRects()

        // Event listeners for responsive updates
        window.addEventListener('resize', updateRects)
        window.addEventListener('scroll', updateRects, true) // Capture to detect any scroll

        // Slower fallback interval for animations/layout shifts
        const intervalId = setInterval(updateRects, 500)

        return () => {
            window.removeEventListener('resize', updateRects)
            window.removeEventListener('scroll', updateRects, true)
            clearInterval(intervalId)
        }
    }, [isActive, updateRects])

    // Next handler
    const handleNext = () => {
        // Bar zaten isTourActive ile açık tutuluyor
        if (step < STEP_CONFIG.length - 1) {
            setStep(s => s + 1)
        } else {
            onClose()
        }
    }

    // Colors memoization
    const colors = useMemo(() => ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'], [])

    if (!isActive) return null

    const config = STEP_CONFIG[step]
    const title = t(config?.titleKey) || `Step ${step + 1}`
    const text = t(config?.textKey) || ''


    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] pointer-events-none">
                {/* Tooltip - Ortada */}
                <div style={{ pointerEvents: 'auto' }}>
                    <Tooltip
                        step={step}
                        totalSteps={STEP_CONFIG.length}
                        title={title}
                        text={text}
                        onNext={handleNext}
                        onSkip={onClose}
                        finishText={t('ua_finish')}
                        nextText={t('ua_next')}
                        skipText={t('ua_skip')}
                    />
                </div>

                {/* Highlight boxes ve oklar */}
                {rects.map((rect, index) => (
                    <React.Fragment key={`${step}-${rect.id}-${index}`}>
                        <HighlightBox rect={rect} color={colors[index % colors.length]} />
                        {step === 0 && <Pointer rect={rect} color={colors[0]} />}
                    </React.Fragment>
                ))}
            </div>
        </AnimatePresence>
    )
}

export default UsageAssistant

