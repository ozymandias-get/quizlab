import React, { memo } from 'react'
import { motion } from 'framer-motion'
import { MagicWandIcon } from '../Icons'

interface CenterHubProps {
    handleHubPointerUp: (e: React.PointerEvent) => void;
    isOpen: boolean;
    hubStyle: React.CSSProperties;
}

export const CenterHub = memo(({ handleHubPointerUp, isOpen, hubStyle }: CenterHubProps) => {
    return (
        <motion.div
            role="button"
            id="bottom-bar-hub-btn"
            onPointerUp={handleHubPointerUp}
            whileHover={{ scale: 1.05, y: -1 }}
            whileTap={{ scale: 0.95 }}
            className="relative z-30 h-[52px] px-4 rounded-[18px] flex items-center justify-center cursor-pointer"
            style={hubStyle}
        >
            <motion.div
                animate={{
                    rotate: isOpen ? 45 : 0,
                    scale: isOpen ? 1.05 : 1
                }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
                <MagicWandIcon
                    className="w-5 h-5 transition-all duration-150"
                    style={{
                        color: isOpen ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)',
                    }}
                />
            </motion.div>

            {/* Subtle glow when closed */}
            {!isOpen && (
                <motion.div
                    animate={{
                        opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 rounded-[18px] pointer-events-none"
                    style={{
                        boxShadow: '0 0 16px -4px rgba(255,255,255,0.1)',
                    }}
                />
            )}
        </motion.div>
    )
})

CenterHub.displayName = 'CenterHub'
