import React, { useMemo, useCallback, memo } from 'react'
import { useLanguage, useAppearance } from '../context'

// Icon boyutu (px)
const ICON_SIZE = 18

interface FloatingButtonProps {
    onClick?: () => void;
    position: {
        top: number;
        left: number;
    } | null;
}

const FloatingButton: React.FC<FloatingButtonProps> = memo(({ onClick, position }) => {
    const { t } = useLanguage()
    // Directly destruct selectionColor from hook - it is stable from context
    const { selectionColor } = useAppearance()

    // Memoize style calculation
    const style = useMemo<React.CSSProperties>(() => {
        if (!position) return {}
        return {
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`,
            transform: 'translateX(-50%)',
            backgroundColor: selectionColor,
            boxShadow: `0 10px 40px -10px ${selectionColor}80`,
            opacity: 1,
        }
    }, [position, selectionColor])

    const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        onClick?.()
    }, [onClick])

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        // Seçimin iptal olmasını engelle
        e.preventDefault()
        e.stopPropagation()
    }, [])

    return (
        <div
            className="fixed flex items-center gap-2.5 px-5 py-3.5 rounded-2xl text-white font-bold text-sm border border-white/20 backdrop-blur-md cursor-pointer transition-all duration-300 hover:scale-105 hover:-translate-y-1 z-[100] animate-fadeIn"
            style={style}
            onClick={handleClick}
            onMouseDown={handleMouseDown}
        >
            <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="drop-shadow-sm">
                <path d="M22 2L11 13" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="drop-shadow-sm">{t('send_to_ai')}</span>
        </div>
    )
})

FloatingButton.displayName = 'FloatingButton'

export default FloatingButton
