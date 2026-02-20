import React, { useRef, useCallback, useMemo, useState, memo, useEffect } from 'react'
import { Reorder, motion } from 'framer-motion'
import { getAiIcon } from '@src/components/ui/Icons'
import { useLanguage } from '@src/app/providers'

const hexColorRegex = /^#([0-9A-F]{3}){1,2}$/i
const isValidColor = (color: string) => hexColorRegex.test(color)

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
    draggable?: boolean;
}

export const AIItem = memo<AIItemProps>(function AIItem({
    modelKey,
    site = {},
    isSelected,
    setCurrentAI,
    setActiveDragItem,
    activeDragItem,
    animationDelay: _animationDelay = 0,
    showOnlyIcons = true,
    draggable = true
}: AIItemProps) {
    const { t } = useLanguage()
    const isDraggingRef = useRef(false)
    const dragEndTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const [isHovered, setIsHovered] = useState(false)

    const safeColor = useMemo(() =>
        (site?.color && isValidColor(site.color)) ? site.color : '#ffffff'
        , [site?.color])

    const isBeingDragged = activeDragItem === modelKey

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
            willChange: 'transform',
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden' as const,
        }
    }, [isSelected, isBeingDragged, safeColor, isHovered])

    const handleClick = useCallback((e: React.MouseEvent) => {
        if (isDraggingRef.current) {
            e.stopPropagation()
            return
        }
        setCurrentAI(modelKey)
    }, [setCurrentAI, modelKey])

    useEffect(() => {
        return () => {
            if (dragEndTimeoutRef.current) {
                clearTimeout(dragEndTimeoutRef.current)
            }
        }
    }, [])

    const handleDragStart = useCallback(() => {
        if (dragEndTimeoutRef.current) {
            clearTimeout(dragEndTimeoutRef.current)
            dragEndTimeoutRef.current = null
        }

        isDraggingRef.current = true
        setActiveDragItem(modelKey)
    }, [setActiveDragItem, modelKey])

    const handleDragEnd = useCallback(() => {
        setActiveDragItem(null)

        dragEndTimeoutRef.current = setTimeout(() => {
            isDraggingRef.current = false
            dragEndTimeoutRef.current = null
        }, 150)
    }, [setActiveDragItem])



    const translatedName = useMemo(() => {
        const translated = t(modelKey)
        if (translated && translated !== modelKey) return translated
        return site?.displayName || site?.name || (modelKey.charAt(0).toUpperCase() + modelKey.slice(1))
    }, [t, modelKey, site])

    const content = (
        <motion.button
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            whileHover={{
                scale: 1.08,
                y: -2,
                transition: { type: "spring", stiffness: 420, damping: 22, mass: 0.6 }
            }}
            whileTap={{ scale: 0.93, transition: { duration: 0.1 } }}
            className={`relative flex items-center justify-center rounded-xl transition-all duration-150 ${showOnlyIcons ? 'w-[40px] h-[40px] p-2.5' : 'px-3 py-2 gap-2.5 min-w-[100px]'}`}
            style={buttonStyle}
            onClick={handleClick}
            title={translatedName}
        >
            {getAiIcon(site?.icon || modelKey) || (
                <div className="w-4 h-4 flex items-center justify-center font-bold text-[10px]">
                    {translatedName.charAt(0) || '?'}
                </div>
            )}

            {!showOnlyIcons && (
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 whitespace-nowrap overflow-hidden text-ellipsis">
                    {translatedName}
                </span>
            )}

            {isSelected && (
                <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.9, 1, 0.9],
                    }}
                    transition={{
                        scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                        opacity: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                    }}
                    className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                    style={{
                        background: safeColor,
                        boxShadow: `0 0 8px ${safeColor}, 0 0 16px ${safeColor}60`,
                        transform: 'translateZ(0)',
                    }}
                />
            )}
        </motion.button>
    )

    if (draggable) {
        return (
            <Reorder.Item
                value={modelKey}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                animate={{
                    scale: isBeingDragged ? 1.05 : 1,
                    zIndex: isBeingDragged ? 50 : 1
                }}
                transition={{
                    duration: 0.2,
                    type: 'spring',
                    stiffness: 350,
                    damping: 25,
                }}
                whileDrag={{ scale: 1.12, cursor: 'grabbing' }}
                className="relative cursor-grab active:cursor-grabbing"
                style={{
                    filter: isBeingDragged ? `drop-shadow(0 0 18px ${safeColor}90)` : 'none',
                    transform: 'translateZ(0)',
                }}
            >
                {content}
            </Reorder.Item>
        )
    }

    return (
        <motion.div layout className="relative">
            {content}
        </motion.div>
    )
})
