import { memo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Quote, X, ChevronDown, ChevronUp } from 'lucide-react'
import { useLanguageStrings } from '@app/providers'

const ITEM_ENTER = { type: 'spring' as const, stiffness: 500, damping: 32, mass: 0.5 }
const ITEM_ENTER_REDUCED = { duration: 0.12 }

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
        prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -6, transition: { duration: 0.1 } }
      }
      transition={itemTransition}
      className="group relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.05]"
      style={{ willChange: 'transform, opacity' }}
    >
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{
          background: `linear-gradient(180deg, ${accentStrong} 0%, ${accentStrong} 40%, transparent 100%)`,
          borderRadius: '12px 0 0 12px'
        }}
      />
      <div className="flex items-start gap-3 px-3.5 py-3">
        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: `linear-gradient(135deg, ${accentStrong} 0%, rgba(45,212,191,0.6) 100%)`,
            boxShadow: `0 2px 8px ${accentStrong}30`
          }}
        >
          <Quote className="h-4 w-4 text-white" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[11px] font-semibold text-white/90">
              {t('ai_send_selection_item', { index: String(ordinal) })}
            </span>
            <span className="rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-medium text-white/60">
              {text.length} chr
            </span>
          </div>
          <p
            className="mt-1.5 text-[11px] leading-relaxed text-white/75"
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
        </div>
        <div className="flex shrink-0 items-start gap-0.5">
          {isLong && (
            <button
              type="button"
              onClick={() => onToggleExpand(id)}
              className="rounded-lg p-1.5 text-white/50 transition-all hover:bg-white/[0.08] hover:text-white/80"
              title={isExpanded ? t('ai_send_show_less') : t('ai_send_show_more')}
              aria-label={isExpanded ? t('ai_send_show_less') : t('ai_send_show_more')}
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" strokeWidth={2} />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove(id)}
            className="rounded-lg p-1.5 text-white/45 transition-all hover:bg-red-500/12 hover:text-red-400"
            title={t('ai_send_remove_item')}
            aria-label={t('ai_send_remove_item')}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export default memo(QueueTextItem)
