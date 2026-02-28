import React, { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AiHubIcon } from '@ui/components/Icons'
import { hubIconVariants, hubIconTransition, iconStyleVariants, hubGlowVariants } from './animations'
import { APP_CONSTANTS } from '@shared/constants/appConstants'

interface CenterHubProps {
    handleHubPointerUp: (e: React.PointerEvent) => void;
    onMouseDown?: (e: React.MouseEvent) => void;
    isOpen: boolean;
    hubStyle: React.CSSProperties;
    tabsCount?: number;
}

export const CenterHub = memo(({ handleHubPointerUp, onMouseDown, isOpen, hubStyle, tabsCount = 0 }: CenterHubProps) => {
    return (
        <motion.div
            role="button"
            id={APP_CONSTANTS.TOUR_TARGETS.HUB_BTN}
            onPointerUp={handleHubPointerUp}
            onMouseDown={!isOpen ? onMouseDown : undefined}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`hub-center-btn ${isOpen ? 'hub-center-btn--open' : 'hub-center-btn--closed'}`}
            style={hubStyle}
        >
            {/* Ambient Glow Pulse */}
            <motion.div
                variants={hubGlowVariants}
                animate={isOpen ? 'active' : 'idle'}
                className="absolute inset-0 rounded-[16px] pointer-events-none"
                style={{
                    background: isOpen
                        ? 'radial-gradient(circle at 24% 22%, rgba(56, 189, 248, 0.4) 0%, rgba(56, 189, 248, 0.14) 36%, transparent 70%), radial-gradient(circle at 78% 82%, rgba(245, 158, 11, 0.34) 0%, transparent 64%)'
                        : 'radial-gradient(circle at 28% 24%, rgba(56, 189, 248, 0.2) 0%, rgba(56, 189, 248, 0.06) 34%, transparent 70%), radial-gradient(circle at 74% 80%, rgba(245, 158, 11, 0.16) 0%, transparent 60%)',
                    filter: 'blur(12px)',
                }}
            />

            {/* Rotating Holographic Ring (Visible when Open) */}
            <motion.div
                animate={{
                    rotate: isOpen ? 360 : 0,
                    opacity: isOpen ? 0.5 : 0,
                    scale: isOpen ? 1 : 0.8
                }}
                transition={{
                    rotate: { duration: 8, repeat: Infinity, ease: "linear" },
                    opacity: { duration: 0.4 },
                    scale: { duration: 0.4 }
                }}
                className="absolute -inset-[1px] rounded-[17px] pointer-events-none"
                style={{
                    background: 'conic-gradient(from 0deg, transparent 0%, rgba(56, 189, 248, 0.34) 23%, rgba(245, 158, 11, 0.32) 48%, rgba(56, 189, 248, 0.3) 72%, transparent 100%)',
                    zIndex: 1,
                    mixBlendMode: 'screen'
                }}
            />

            {/* Icon - Central Anchor */}
            <motion.div
                variants={hubIconVariants}
                animate={isOpen ? 'open' : 'closed'}
                transition={hubIconTransition}
                className="relative flex items-center justify-center w-full h-full z-10"
                style={{ transformOrigin: 'center', transform: 'translateZ(0)' }}
            >
                <motion.div
                    variants={iconStyleVariants}
                    animate={isOpen ? 'open' : 'closed'}
                    className="relative flex items-center justify-center"
                    style={{
                        width: 'calc(2.25rem * var(--bar-scale-factor, 1))',
                        height: 'calc(2.25rem * var(--bar-scale-factor, 1))',
                        borderRadius: 'calc(0.6875rem * var(--bar-scale-factor, 1))',
                        background: isOpen
                            ? 'linear-gradient(145deg, rgba(56, 189, 248, 0.26) 0%, rgba(245, 158, 11, 0.2) 100%)'
                            : 'linear-gradient(145deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
                        border: isOpen
                            ? '1px solid rgba(56, 189, 248, 0.35)'
                            : '1px solid rgba(255, 255, 255, 0.11)',
                        boxShadow: isOpen
                            ? '0 8px 18px -10px rgba(56, 189, 248, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.34)'
                            : '0 6px 14px -10px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.18)'
                    }}
                >
                    <AiHubIcon
                        className="w-5 h-5"
                        style={{
                            width: 'calc(1.25rem * var(--bar-scale-factor, 1))',
                            height: 'calc(1.25rem * var(--bar-scale-factor, 1))',
                        }}
                    />
                </motion.div>
            </motion.div>

            {/* Tab Count Badge */}
            <AnimatePresence>
                {tabsCount > 1 && !isOpen && (
                    <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white shadow-lg pointer-events-none z-20"
                        style={{
                            border: '1.5px solid rgba(15, 23, 42, 0.95)',
                            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.95) 0%, rgba(245, 158, 11, 0.95) 100%)',
                            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.35)'
                        }}
                    >
                        {tabsCount}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
})

CenterHub.displayName = 'CenterHub'


