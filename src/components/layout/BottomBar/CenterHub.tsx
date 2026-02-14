import React, { memo } from 'react'
import { motion } from 'framer-motion'
import { MagicWandIcon } from '@src/components/ui/Icons'
import { hubIconVariants, hubIconTransition } from './animations'

interface CenterHubProps {
    handleHubPointerUp: (e: React.PointerEvent) => void;
    onMouseDown?: (e: React.MouseEvent) => void;
    isOpen: boolean;
    hubStyle: React.CSSProperties;
}

export const CenterHub = memo(({ handleHubPointerUp, onMouseDown, isOpen, hubStyle }: CenterHubProps) => {
    return (
        <motion.div
            role="button"
            id="bottom-bar-hub-btn"
            onPointerUp={handleHubPointerUp}
            onMouseDown={!isOpen ? onMouseDown : undefined}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            className={`hub-center-btn ${isOpen ? 'hub-center-btn--open' : 'hub-center-btn--closed'}`}
            style={hubStyle}
        >
            {/* Icon - Central Anchor */}
            <motion.div
                variants={hubIconVariants}
                animate={isOpen ? 'open' : 'closed'}
                transition={hubIconTransition}
                className="relative flex items-center justify-center w-full h-full"
                style={{ transformOrigin: 'center', transform: 'translateZ(0)' }}
            >
                <MagicWandIcon
                    className="w-6 h-6"
                    style={{
                        color: isOpen ? '#fff' : 'rgba(255,255,255,0.45)',
                        filter: isOpen
                            ? 'drop-shadow(0 0 8px rgba(167, 139, 250, 0.8)) drop-shadow(0 0 16px rgba(139, 92, 246, 0.4))'
                            : 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                />
            </motion.div>
        </motion.div>
    )
})

CenterHub.displayName = 'CenterHub'
