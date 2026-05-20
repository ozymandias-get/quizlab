import { memo, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AiHubIcon } from '@ui/components/Icons'
import {
  hubIconVariants,
  hubIconTransition,
  iconStyleVariants,
  hubGlowVariants,
  smoothEase
} from './animations'
import { APP_CONSTANTS } from '@shared/constants/appConstants'

interface CenterHubProps {
  handleHubPointerDown: (e: PointerEvent) => void
  handleHubPointerUp: (e: PointerEvent) => void
  onClick: () => void
  onMouseDown?: (e: MouseEvent) => void
  isOpen: boolean
  isResizing?: boolean
  hubStyle: CSSProperties
  tabsCount?: number
  ariaLabel?: string
  performanceMode?: boolean
}

export const CenterHub = memo(
  ({
    handleHubPointerDown,
    handleHubPointerUp,
    onClick,
    onMouseDown,
    isOpen,
    isResizing = false,
    hubStyle,
    tabsCount = 0,
    ariaLabel = 'Toggle hub',
    performanceMode = false
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
        whileHover={performanceMode ? undefined : { scale: 1.05 }}
        whileTap={
          performanceMode
            ? undefined
            : {
                scale: 0.94,
                transition: { duration: 0.1 }
              }
        }
        className={`hub-center-btn ${isOpen ? 'hub-center-btn--open' : 'hub-center-btn--closed'}`}
        style={hubStyle}
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        aria-controls={`${APP_CONSTANTS.TOUR_TARGETS.TOOLS_PANEL} ${APP_CONSTANTS.TOUR_TARGETS.MODELS_LIST}`}
      >
        {!performanceMode && isResizing && (
          <motion.div
            variants={hubGlowVariants}
            initial="idle"
            animate="active"
            exit="idle"
            className="hub-center-btn__glow hub-center-btn__glow--open absolute inset-0 rounded-[16px] pointer-events-none"
            style={{ transform: 'translateZ(0)' }}
          />
        )}

        {!performanceMode && (
          <motion.div
            animate={{
              rotate: isOpen ? 360 : 0,
              opacity: isResizing ? 0.45 : isOpen ? 0.1 : 0,
              scale: isResizing ? 1.05 : isOpen ? 1 : 0.9
            }}
            transition={{
              rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
              opacity: { duration: 0.5, ease: smoothEase },
              scale: { duration: 0.5, ease: smoothEase }
            }}
            className="hub-center-btn__ring absolute -inset-[1px] rounded-[17px] pointer-events-none"
            style={{ transform: 'translateZ(0)' }}
          />
        )}

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
              borderRadius: 'calc(0.6875rem * var(--bar-scale-factor, 1))',
              transition:
                'background 0.6s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.6s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
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
              className="hub-center-btn__badge absolute top-1 right-1 flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-ql-10 leading-none font-bold text-white shadow-lg pointer-events-none z-20"
            >
              {tabsCount}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    )
  }
)

CenterHub.displayName = 'CenterHub'
