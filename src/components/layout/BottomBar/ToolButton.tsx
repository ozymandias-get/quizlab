import React, { memo, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { toolItemVariants } from './animations'

export interface ToolButtonProps {
    isActive?: boolean;
    activeColor?: string;
    onClick: () => void;
    title: string;
    children: React.ReactNode;
    delay?: number;
}

// Memoized Tool Button - Animated & GPU-accelerated
export const ToolButton = memo(({ isActive, activeColor, onClick, title, children, delay: _delay = 0 }: ToolButtonProps) => {
    const rippleRef = useRef<HTMLSpanElement>(null)

    const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        // Trigger ripple
        if (rippleRef.current) {
            const btn = e.currentTarget
            const rect = btn.getBoundingClientRect()
            const x = e.clientX - rect.left
            const y = e.clientY - rect.top
            const ripple = document.createElement('span')
            ripple.style.cssText = `
                position: absolute;
                top: ${y}px;
                left: ${x}px;
                width: 0;
                height: 0;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(255,255,255,0.35) 0%, transparent 70%);
                transform: translate(-50%, -50%) scale(0);
                animation: toolRipple 0.5s ease-out forwards;
                pointer-events: none;
                will-change: transform, opacity;
            `
            rippleRef.current.appendChild(ripple)
            setTimeout(() => ripple.remove(), 550)
        }
        onClick()
    }, [onClick])

    return (
        <motion.button
            variants={toolItemVariants}
            whileHover={{
                scale: 1.1,
                y: -2,
                transition: { type: "spring", stiffness: 420, damping: 22, mass: 0.6 }
            }}
            whileTap={{ scale: 0.92, transition: { duration: 0.1 } }}
            onClick={handleClick}
            title={title}
            className={`relative p-2.5 rounded-xl transition-colors duration-150 ${isActive ? 'tool-btn--active-glow' : ''}`}
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
                transform: 'translateZ(0)',
                '--active-glow-color': activeColor || 'rgba(139, 92, 246, 0.35)',
            } as React.CSSProperties}
        >
            {children}
            {/* Ripple container */}
            <span
                ref={rippleRef}
                className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none"
                style={{ transform: 'translateZ(0)' }}
            />
        </motion.button>
    )
})

ToolButton.displayName = 'ToolButton'
