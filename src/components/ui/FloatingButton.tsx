import React, { useMemo, useCallback, memo } from 'react'
import { useLanguage, useAppearance } from '@src/app/providers'

const ICON_SIZE = 20

interface FloatingButtonProps {
    onClick?: () => void;
    position: {
        top: number;
        left: number;
    } | null;
}

const FloatingButton: React.FC<FloatingButtonProps> = memo(({ onClick, position }) => {
    const { t } = useLanguage()
    const { selectionColor } = useAppearance()

    const style = useMemo<React.CSSProperties>(() => {
        if (!position) return {}
        return {
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`,
            // transform is handled by className to allow hover effects to compose
            backgroundColor: selectionColor,
            backgroundImage: `linear-gradient(to bottom right, rgba(255,255,255,0.25), rgba(0,0,0,0.05))`,
            boxShadow: `0 10px 30px -5px ${selectionColor}90, 0 8px 10px -6px ${selectionColor}50, inset 0 1px 0 rgba(255,255,255,0.4)`,
            opacity: 1,
        }
    }, [position, selectionColor])

    const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        onClick?.()
    }, [onClick])

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
    }, [])

    return (
        <div
            className="group fixed flex items-center gap-3 px-6 py-3.5 rounded-full text-white font-bold text-sm 
            border border-white/20 backdrop-blur-md cursor-pointer 
            transition-all duration-300 ease-out
            -translate-x-1/2
            hover:scale-105 hover:-translate-y-1 hover:brightness-110 hover:shadow-2xl
            active:scale-95 active:translate-y-0
            z-[100] animate-fadeIn select-none overflow-hidden"
            style={style}
            onClick={handleClick}
            onMouseDown={handleMouseDown}
        >
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="relative z-10 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110 drop-shadow-sm">
                <path d="M22 2L11 13" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="relative z-10 drop-shadow-sm tracking-wide">{t('send_to_ai')}</span>
        </div>
    )
})

FloatingButton.displayName = 'FloatingButton'

export default FloatingButton

