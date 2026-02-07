import React, { memo } from 'react'
import { motion } from 'framer-motion'

export interface ToolButtonProps {
    isActive?: boolean;
    activeColor?: string;
    onClick: () => void;
    title: string;
    children: React.ReactNode;
    delay?: number;
}

// Memoized Tool Button - Sharp & Clear
export const ToolButton = memo(({ isActive, activeColor, onClick, title, children, delay: _delay = 0 }: ToolButtonProps) => (
    <motion.button
        whileHover={{
            scale: 1.05,
            y: -1,
            transition: { type: "spring", stiffness: 380, damping: 28 }
        }}
        whileTap={{ scale: 0.96 }}
        onClick={onClick}
        title={title}
        className="relative p-2.5 rounded-xl transition-all duration-150"
        style={{
            background: isActive
                ? `linear-gradient(145deg, ${activeColor || 'rgba(99,102,241,0.25)'}, ${activeColor?.replace('0.4', '0.35')?.replace('0.5', '0.45') || 'rgba(139,92,246,0.35)'})`
                : 'linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
            border: isActive
                ? `1px solid ${activeColor?.replace('0.4', '0.5')?.replace('0.5', '0.6') || 'rgba(139,92,246,0.5)'}`
                : '1px solid rgba(255,255,255,0.1)',
            boxShadow: isActive
                ? `0 4px 16px -4px ${activeColor || 'rgba(99,102,241,0.4)'}, inset 0 1px 0 rgba(255,255,255,0.15)`
                : 'inset 0 1px 0 rgba(255,255,255,0.06)',
            color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
        }}
    >
        {children}
    </motion.button>
))

ToolButton.displayName = 'ToolButton'
