import {
  cloneElement,
  isValidElement,
  useRef,
  useCallback,
  useMemo,
  useState,
  memo,
  useEffect,
  type CSSProperties,
  type MouseEvent,
  type ReactElement
} from 'react'
import { Reorder, motion } from 'framer-motion'
import { Pin, X } from 'lucide-react'
import { getAiIcon } from '@ui/components/Icons'
import { buttonBaseClass } from '@ui/components/button'
import { cn } from '@shared/lib/uiUtils'
import { useLanguageStrings } from '@app/providers'

const DEFAULT_BAR_COLOR = '#ffffff'
const hexColorRegex = /^#([0-9A-F]{3}){1,2}$/i
const isValidColor = (color: string) => hexColorRegex.test(color)
const ICON_SCALE_STYLE: CSSProperties = {
  width: 'calc(1.25rem * var(--bar-scale-factor, 1))',
  height: 'calc(1.25rem * var(--bar-scale-factor, 1))'
}
const ICON_ONLY_BUTTON_METRICS: CSSProperties = {
  width: 'calc(40px * var(--bar-scale-factor, 1))',
  height: 'calc(40px * var(--bar-scale-factor, 1))',
  padding: 'calc(10px * var(--bar-scale-factor, 1))',
  borderRadius: 'calc(0.75rem * var(--bar-scale-factor, 1))'
}
const LABEL_BUTTON_METRICS: CSSProperties = {
  padding: 'calc(8px * var(--bar-scale-factor, 1)) calc(12px * var(--bar-scale-factor, 1))',
  gap: 'calc(10px * var(--bar-scale-factor, 1))',
  minWidth: 'calc(100px * var(--bar-scale-factor, 1))',
  borderRadius: 'calc(0.75rem * var(--bar-scale-factor, 1))'
}
const FALLBACK_ICON_STYLE: CSSProperties = {
  width: 'calc(1rem * var(--bar-scale-factor, 1))',
  height: 'calc(1rem * var(--bar-scale-factor, 1))'
}

function getSafeColor(color?: string) {
  return color && isValidColor(color) ? color : DEFAULT_BAR_COLOR
}

function getAiItemLabel({
  labelOverride,
  t,
  modelKey,
  site
}: {
  labelOverride?: string
  t: (key: string) => string
  modelKey: string
  site: AiSite
}) {
  if (labelOverride) {
    return labelOverride
  }

  const translated = t(modelKey)
  if (translated && translated !== modelKey) {
    return translated
  }

  return site.displayName || site.name || modelKey.charAt(0).toUpperCase() + modelKey.slice(1)
}

function getButtonStyle({
  isSelected,
  isBeingDragged,
  isHovered,
  safeColor
}: {
  isSelected: boolean
  isBeingDragged: boolean
  isHovered: boolean
  safeColor: string
}): CSSProperties {
  if (isSelected || isBeingDragged) {
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
      background: 'linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
      border: '1px solid rgba(255,255,255,0.15)',
      boxShadow: '0 6px 16px -6px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
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
    backfaceVisibility: 'hidden'
  }
}

function getScaledAiIcon(iconKey: string) {
  const icon = getAiIcon(iconKey)
  if (!isValidElement(icon)) {
    return icon
  }

  const iconElement = icon as ReactElement<{ style?: CSSProperties }>
  return cloneElement(iconElement, {
    style: {
      ...(iconElement.props.style ?? {}),
      ...ICON_SCALE_STYLE
    }
  })
}

interface AiSite {
  color?: string
  displayName?: string
  icon?: string
  name?: string
  [key: string]: unknown
}

export interface AIItemProps {
  modelKey: string
  site: AiSite
  isSelected: boolean
  setCurrentAI: (key: string) => void
  setActiveDragItem: (key: string | null) => void
  activeDragItem: string | null
  showOnlyIcons?: boolean
  draggable?: boolean
  labelOverride?: string
  onClose?: () => void
  isPinned?: boolean
  onTogglePin?: () => void
  onRequestRename?: () => void
}

export const AIItem = memo<AIItemProps>(function AIItem({
  modelKey,
  site = {},
  isSelected,
  setCurrentAI,
  setActiveDragItem,
  activeDragItem,
  showOnlyIcons = true,
  draggable = true,
  labelOverride,
  onClose,
  isPinned = false,
  onTogglePin,
  onRequestRename
}: AIItemProps) {
  const { t } = useLanguageStrings()
  const isDraggingRef = useRef(false)
  const dragEndTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isHovered, setIsHovered] = useState(false)
  const safeColor = getSafeColor(site.color)

  const isBeingDragged = activeDragItem === modelKey
  const hasTabControls = Boolean(onClose || onTogglePin)
  const shouldShowPin = Boolean(onTogglePin) && (isPinned || isHovered)
  const shouldShowClose = Boolean(onClose) && isHovered

  const buttonStyle = useMemo(
    () => getButtonStyle({ isSelected, isBeingDragged, isHovered, safeColor }),
    [isSelected, isBeingDragged, isHovered, safeColor]
  )

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (isDraggingRef.current) {
        e.stopPropagation()
        return
      }
      setCurrentAI(modelKey)
    },
    [setCurrentAI, modelKey]
  )

  const handleControlClick = useCallback((e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleCloseClick = useCallback(
    (e: MouseEvent) => {
      handleControlClick(e)
      onClose?.()
    },
    [handleControlClick, onClose]
  )

  const handlePinClick = useCallback(
    (e: MouseEvent) => {
      handleControlClick(e)
      onTogglePin?.()
    },
    [handleControlClick, onTogglePin]
  )

  const handleDoubleClick = useCallback(
    (e: MouseEvent) => {
      if (!onRequestRename) return
      e.preventDefault()
      e.stopPropagation()
      onRequestRename()
    },
    [onRequestRename]
  )

  const clearDragEndTimeout = useCallback(() => {
    if (dragEndTimeoutRef.current) {
      clearTimeout(dragEndTimeoutRef.current)
      dragEndTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    return clearDragEndTimeout
  }, [clearDragEndTimeout])

  const handleDragStart = useCallback(() => {
    clearDragEndTimeout()
    isDraggingRef.current = true
    setActiveDragItem(modelKey)
  }, [clearDragEndTimeout, setActiveDragItem, modelKey])

  const handleDragEnd = useCallback(() => {
    setActiveDragItem(null)

    dragEndTimeoutRef.current = setTimeout(() => {
      isDraggingRef.current = false
      dragEndTimeoutRef.current = null
    }, 150)
  }, [setActiveDragItem])

  const translatedName = getAiItemLabel({ labelOverride, t, modelKey, site })

  const renderedIcon = useMemo(() => {
    return getScaledAiIcon(site.icon || modelKey)
  }, [site.icon, modelKey])

  const scaledButtonMetrics = showOnlyIcons ? ICON_ONLY_BUTTON_METRICS : LABEL_BUTTON_METRICS

  const content = (
    <motion.button
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{
        scale: 1.08,
        y: -2,
        transition: { type: 'spring', stiffness: 420, damping: 22, mass: 0.6 }
      }}
      whileTap={{ scale: 0.93, transition: { duration: 0.1 } }}
      className={cn(
        buttonBaseClass,
        'relative rounded-xl transition-all duration-150',
        showOnlyIcons ? 'w-[40px] h-[40px] p-2.5' : 'px-3 py-2 gap-2.5 min-w-[100px]'
      )}
      style={{
        ...buttonStyle,
        ...scaledButtonMetrics
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      title={translatedName}
    >
      {renderedIcon || (
        <div
          className="w-4 h-4 flex items-center justify-center font-bold text-[10px]"
          style={FALLBACK_ICON_STYLE}
        >
          {translatedName.charAt(0) || '?'}
        </div>
      )}

      {!showOnlyIcons && (
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]">
          {translatedName}
        </span>
      )}

      {hasTabControls && (
        <div
          className="absolute top-1 right-1 z-20 flex items-center gap-1"
          onMouseDown={handleControlClick}
        >
          {shouldShowPin && (
            <span
              role="button"
              tabIndex={-1}
              aria-label={isPinned ? t('tab_unpin') : t('tab_pin')}
              title={isPinned ? t('tab_pinned') : t('tab_pin')}
              className={`flex items-center justify-center rounded-md border px-1 py-1 transition-all duration-150 ${
                isPinned
                  ? 'text-white bg-white/18 border-white/25 shadow-sm'
                  : 'text-white/65 bg-black/35 border-white/15 hover:text-white hover:bg-white/14'
              }`}
              onClick={handlePinClick}
            >
              <Pin className="w-2.5 h-2.5" fill={isPinned ? 'currentColor' : 'none'} />
            </span>
          )}

          {shouldShowClose && (
            <span
              role="button"
              tabIndex={-1}
              aria-label={t('tab_close')}
              title={t('tab_close')}
              className="flex items-center justify-center rounded-md border border-white/15 px-1 py-1 text-white/70 bg-black/35 hover:text-white hover:bg-white/14 transition-all duration-150"
              onClick={handleCloseClick}
            >
              <X className="w-2.5 h-2.5" />
            </span>
          )}
        </div>
      )}

      {isSelected && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.9, 1, 0.9]
          }}
          transition={{
            scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
            opacity: { duration: 2, repeat: Infinity, ease: 'easeInOut' }
          }}
          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
          style={{
            background: safeColor,
            boxShadow: `0 0 8px ${safeColor}, 0 0 16px ${safeColor}60`,
            transform: 'translateZ(0)'
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
          damping: 25
        }}
        whileDrag={{ scale: 1.12, cursor: 'grabbing' }}
        className="relative cursor-grab active:cursor-grabbing"
        style={{
          filter: isBeingDragged ? `drop-shadow(0 0 18px ${safeColor}90)` : 'none',
          transform: 'translateZ(0)'
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
