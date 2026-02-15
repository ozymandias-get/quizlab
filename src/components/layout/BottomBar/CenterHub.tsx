import React, { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MagicWandIcon } from '@src/components/ui/Icons'
import { hubIconVariants, hubIconTransition, iconStyleVariants, hubGlowVariants } from './animations'

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
            id="bottom-bar-hub-btn"
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
                className="absolute inset-0 rounded-xl bg-violet-500/20 blur-xl pointer-events-none"
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
                    background: 'conic-gradient(from 0deg, transparent 0%, rgba(167, 139, 250, 0.25) 25%, transparent 50%, rgba(56, 189, 248, 0.25) 75%, transparent 100%)',
                    zIndex: 1,
                    mixBlendMode: 'overlay'
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
                >
                    <MagicWandIcon className="w-6 h-6" />
                </motion.div>
            </motion.div>

            {/* Tab Count Badge */}
            <AnimatePresence>
                {tabsCount > 1 && !isOpen && (
                    <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-violet-500 text-[9px] font-bold text-white shadow-lg pointer-events-none z-20"
                        style={{
                            border: '1.5px solid rgba(25, 25, 30, 1)',
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
