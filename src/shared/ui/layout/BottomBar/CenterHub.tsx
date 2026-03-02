import React, { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AiHubIcon } from '@ui/components/Icons'
import { hubIconVariants, hubIconTransition, iconStyleVariants, hubGlowVariants } from './animations'
import { APP_CONSTANTS } from '@shared/constants/appConstants'

interface CenterHubProps {
    handleHubPointerDown: (e: React.PointerEvent) => void;
    handleHubPointerUp: (e: React.PointerEvent) => void;
    onClick: () => void;
    onMouseDown?: (e: React.MouseEvent) => void;
    isOpen: boolean;
    hubStyle: React.CSSProperties;
    tabsCount?: number;
    hintText?: string;
    ariaLabel?: string;
}

export const CenterHub = memo(({
    handleHubPointerDown,
    handleHubPointerUp,
    onClick,
    onMouseDown,
    isOpen,
    hubStyle,
    tabsCount = 0,
    hintText = 'Open hub',
    ariaLabel = 'Toggle hub'
}: CenterHubProps) => {
    return (
        <motion.button
            type="button"
            id={APP_CONSTANTS.TOUR_TARGETS.HUB_BTN}
            onPointerDown={handleHubPointerDown}
            onPointerUp={handleHubPointerUp}
            onClick={(e) => {
                if (e.detail === 0) {
                    onClick()
                }
            }}
            onMouseDown={!isOpen ? onMouseDown : undefined}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`hub-center-btn ${isOpen ? 'hub-center-btn--open' : 'hub-center-btn--closed'}`}
            style={hubStyle}
            title={!isOpen ? hintText : undefined}
            aria-expanded={isOpen}
            aria-label={ariaLabel}
            aria-controls={`${APP_CONSTANTS.TOUR_TARGETS.TOOLS_PANEL} ${APP_CONSTANTS.TOUR_TARGETS.MODELS_LIST}`}
        >
            <motion.div
                variants={hubGlowVariants}
                animate={isOpen ? 'active' : 'idle'}
                className={`hub-center-btn__glow ${isOpen ? 'hub-center-btn__glow--open' : 'hub-center-btn__glow--closed'} absolute inset-0 rounded-[16px] pointer-events-none`}
            />

            <motion.div
                animate={{
                    rotate: isOpen ? 360 : 0,
                    opacity: isOpen ? 0.5 : 0,
                    scale: isOpen ? 1 : 0.8
                }}
                transition={{
                    rotate: { duration: 8, repeat: Infinity, ease: 'linear' },
                    opacity: { duration: 0.4 },
                    scale: { duration: 0.4 }
                }}
                className="hub-center-btn__ring absolute -inset-[1px] rounded-[17px] pointer-events-none"
            />

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
                    className={`hub-center-btn__icon-shell ${isOpen ? 'hub-center-btn__icon-shell--open' : 'hub-center-btn__icon-shell--closed'} relative flex items-center justify-center`}
                    style={{
                        width: 'calc(2.25rem * var(--bar-scale-factor, 1))',
                        height: 'calc(2.25rem * var(--bar-scale-factor, 1))',
                        borderRadius: 'calc(0.6875rem * var(--bar-scale-factor, 1))'
                    }}
                >
                    <AiHubIcon
                        className="w-5 h-5"
                        style={{
                            width: 'calc(1.25rem * var(--bar-scale-factor, 1))',
                            height: 'calc(1.25rem * var(--bar-scale-factor, 1))'
                        }}
                    />
                </motion.div>
            </motion.div>

            <AnimatePresence>
                {tabsCount > 1 && !isOpen && (
                    <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="hub-center-btn__badge absolute top-1 right-1 flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[9px] leading-none font-bold text-white shadow-lg pointer-events-none z-20"
                    >
                        {tabsCount}
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {!isOpen && (
                    <motion.span
                        initial={{ opacity: 0, y: 2 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 2 }}
                        transition={{ duration: 0.22 }}
                        className="hub-center-btn__hint absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none"
                    >
                        {hintText}
                    </motion.span>
                )}
            </AnimatePresence>
        </motion.button>
    )
})

CenterHub.displayName = 'CenterHub'
