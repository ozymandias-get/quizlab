import { memo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Quote, X, ChevronDown, ChevronUp } from 'lucide-react'
import { useLanguageStrings } from '@app/providers'

const ITEM_ENTER = { type: 'spring' as const, stiffness: 420, damping: 30, mass: 0.55 }
const ITEM_ENTER_REDUCED = { duration: 0.15 }

interface QueueTextItemProps {
  id: string
  text: string
  ordinal: number
  accentStrong: string
  isExpanded: boolean
  onToggleExpand: (id: string) => void
  onRemove: (id: string) => void
}

function QueueTextItem({
  id,
  text,
  ordinal,
  accentStrong,
  isExpanded,
  onToggleExpand,
  onRemove
}: QueueTextItemProps) {
  const { t } = useLanguageStrings()
  const prefersReducedMotion = useReducedMotion()
  const itemTransition = prefersReducedMotion ? ITEM_ENTER_REDUCED : ITEM_ENTER
  const isLong = text.length > 180

  return (
    <motion.div
      key={id}
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={
        prefersReducedMotion
          ? { opacity: 0 }
          : { opacity: 0, x: -6, transition: { duration: 0.12 } }
      }
      transition={itemTransition}
      className="group relative overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.04] transition-colors hover:border-white/[0.14]"
    >
      <div
        className="absolute inset-y-0 left-0 w-[2px] rounded-l-lg"
        style={{ background: `linear-gradient(180deg, ${accentStrong}, transparent)` }}
      />
      <div className="flex items-center justify-between gap-1 px-3 py-2">
        <span className="flex items-center gap-1.5 pl-1">
          <Quote className="h-3 w-3" style={{ color: accentStrong }} strokeWidth={2} />
          <span className="text-[10px] font-medium text-white/60">
            {t('ai_send_selection_item', { index: String(ordinal) })}
          </span>
          <span className="text-[9px] text-white/35">{text.length} chr</span>
        </span>
        <div className="flex items-center gap-0.5">
          {isLong && (
            <button
              type="button"
              onClick={() => onToggleExpand(id)}
              className="rounded-md p-1 text-white/40 transition-colors hover:text-white/65"
              title={isExpanded ? t('ai_send_show_less') : t('ai_send_show_more')}
              aria-label={isExpanded ? t('ai_send_show_less') : t('ai_send_show_more')}
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <ChevronUp className="h-3 w-3" strokeWidth={2} />
              ) : (
                <ChevronDown className="h-3 w-3" strokeWidth={2} />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove(id)}
            className="rounded-md p-1 text-white/40 transition-colors hover:text-red-400/80 hover:bg-red-500/10"
            title={t('ai_send_remove_item')}
            aria-label={t('ai_send_remove_item')}
          >
            <X className="h-3 w-3" strokeWidth={2} />
          </button>
        </div>
      </div>
      <p
        className="px-3 pb-2 pl-3.5 text-[11px] leading-snug text-white/65"
        style={
          !isExpanded
            ? {
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
                overflow: 'hidden'
              }
            : undefined
        }
      >
        {text}
      </p>
    </motion.div>
  )
}

export default memo(QueueTextItem)
