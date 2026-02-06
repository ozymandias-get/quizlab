import React, { useRef, useCallback, useMemo, useState, memo, useEffect } from 'react'
import { Reorder, motion, Easing } from 'framer-motion'
import { getAiIcon } from '@src/components/ui/Icons'

// Color validation
const hexColorRegex = /^#([0-9A-F]{3}){1,2}$/i
const isValidColor = (color: string) => hexColorRegex.test(color)

// Animation config
const itemTransition = { duration: 0.25, ease: [0.16, 1, 0.3, 1] as Easing }

interface AiSite {
    color?: string;
    displayName?: string;
    icon?: string;
    name?: string;
    [key: string]: unknown;
}

export interface AIItemProps {
    modelKey: string;
    site: AiSite;
    isSelected: boolean;
    setCurrentAI: (key: string) => void;
    setActiveDragItem: (key: string | null) => void;
    activeDragItem: string | null;
    animationDelay?: number;
    showOnlyIcons?: boolean;
}

/**
 * Optimized AI Item Component
 */
export const AIItem = memo<AIItemProps>(function AIItem({
    modelKey,
    site = {},
    isSelected,
    setCurrentAI,
    setActiveDragItem,
    activeDragItem,
    animationDelay = 0,
    showOnlyIcons = true
}: AIItemProps) {
    // isDragging durumunu ref ile takip etmek daha performanslı ve senkron sorunsuz
    const isDraggingRef = useRef(false)
    const dragEndTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const [isHovered, setIsHovered] = useState(false)

    // Memoized color - fallback to neutral white instead of blue
    const safeColor = useMemo(() =>
        (site?.color && isValidColor(site.color)) ? site.color : '#ffffff'
        , [site?.color])

    const isBeingDragged = activeDragItem === modelKey

    // Memoized style - Sharp & Clear
    const buttonStyle = useMemo<React.CSSProperties>(() => {
        const isActive = isSelected || isBeingDragged

        if (isActive) {
            return {
                background: `linear-gradient(145deg, ${safeColor}25, ${safeColor}35)`,
                border: `1px solid ${safeColor}55`,
                boxShadow: `0 4px 16px -4px ${safeColor}45, inset 0 1px 0 rgba(255,255,255,0.15)`,
                color: '#fff',
                textShadow: 'none',
                willChange: 'transform'
            }
        }

        if (isHovered) {
            return {
                background: `linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))`,
                border: `1px solid rgba(255,255,255,0.15)`,
                boxShadow: `0 6px 16px -6px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.1)`,
                color: '#fff',
                textShadow: 'none',
                willChange: 'transform'
            }
        }

        return {
            background: 'linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.55)',
            textShadow: 'none',
            willChange: 'transform'
        }
    }, [isSelected, isBeingDragged, safeColor, isHovered])

    const handleClick = useCallback((e: React.MouseEvent) => {
        // Eğer sürükleme işlemi yapıldıysa tıklamayı engelle
        if (isDraggingRef.current) {
            e.stopPropagation()
            return
        }
        setCurrentAI(modelKey)
    }, [setCurrentAI, modelKey])

    // Component unmount olduğunda timeout'u temizle
    useEffect(() => {
        return () => {
            if (dragEndTimeoutRef.current) {
                clearTimeout(dragEndTimeoutRef.current)
            }
        }
    }, [])

    const handleDragStart = useCallback(() => {
        // Yeni bir sürükleme başlarsa, önceki reset timeout'unu iptal et
        // Bu, hızlı sürüklemelerde "isDraggingRef"in yanlışlıkla false olmasını önler
        if (dragEndTimeoutRef.current) {
            clearTimeout(dragEndTimeoutRef.current)
            dragEndTimeoutRef.current = null
        }

        isDraggingRef.current = true
        setActiveDragItem(modelKey)
    }, [setActiveDragItem, modelKey])

    const handleDragEnd = useCallback(() => {
        setActiveDragItem(null)

        // Tıklama olayının tetiklenmesini engellemek için kısa bir gecikme
        dragEndTimeoutRef.current = setTimeout(() => {
            isDraggingRef.current = false
            dragEndTimeoutRef.current = null
        }, 150)
    }, [setActiveDragItem])



    return (
        <Reorder.Item
            value={modelKey}
            // dragListener={true} varsayılan davranıştır, useDragControls kullanmıyoruz
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            initial={{ opacity: 0, scale: 0.8, y: 6 }}
            animate={{
                opacity: 1,
                scale: isBeingDragged ? 1.05 : 1,
                y: 0,
                zIndex: isBeingDragged ? 50 : 1
            }}
            exit={{ opacity: 0, scale: 0.8, y: 6 }}
            transition={{ ...itemTransition, delay: animationDelay }}
            whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
            className="relative cursor-grab active:cursor-grabbing"
            style={{ filter: isBeingDragged ? `drop-shadow(0 0 15px ${safeColor}80)` : 'none' }}
        >
            <motion.button
                onHoverStart={() => setIsHovered(true)}
                onHoverEnd={() => setIsHovered(false)}
                whileHover={{
                    scale: 1.1,
                    y: -2,
                    transition: { type: "spring", stiffness: 450, damping: 25 }
                }}
                whileTap={{ scale: 0.92 }}
                className={`relative flex items-center justify-center rounded-xl transition-all duration-150 ${showOnlyIcons ? 'w-[42px] h-[42px] p-2.5' : 'px-3 py-2 gap-2.5 min-w-[100px]'}`}
                style={buttonStyle}
                onClick={handleClick}
                title={site?.displayName || modelKey}
            >
                {getAiIcon(site?.icon || modelKey) || (
                    <div className="w-4 h-4 flex items-center justify-center font-bold text-[10px]">
                        {site?.displayName?.charAt(0) || site?.name?.charAt(0) || '?'}
                    </div>
                )}

                {!showOnlyIcons && (
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 whitespace-nowrap overflow-hidden text-ellipsis">
                        {site?.displayName || modelKey}
                    </span>
                )}

                {isSelected && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-white"
                        style={{ boxShadow: `0 0 6px ${safeColor}` }}
                    />
                )}
            </motion.button>
        </Reorder.Item>
    )
})

