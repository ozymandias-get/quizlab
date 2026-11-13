import { BlurFade } from '@app/components/ui/blur-fade'
import { MagicCard } from '@app/components/ui/magic-card'
import { getAiIcon } from '@ui/components/Icons'

import { ArrowUpRight } from 'lucide-react'
import {
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  memo,
  Suspense,
  useRef
} from 'react'
import { useTranslation } from 'react-i18next'

import type { AiSiteMap, SectionTone } from '../../../model/home'
import { safeAiAccentColor } from '../../../model/home'

/**
 * A card that carries a subtitle is two text lines tall, a model launcher is
 * one. Reserving the two-line height for every card keeps the API-chat card,
 * model cards and site cards on the same baseline grid instead of letting one
 * row grow taller than the rest. `1.625rem` covers the vertical padding plus
 * the subtitle's top margin; `38px` is the fixed two-line text stack and border.
 */
export const AI_HOME_GRID_CARD_MIN_HEIGHT: CSSProperties = {
  minHeight: 'calc(1.625rem + 38px)'
}

interface GridCardProps {
  isActive: boolean
  isDragging: boolean
  isDropTarget?: boolean
  itemId: string
  onClick: (itemId: string) => void
  onDragEnd: () => void
  onDragLeave?: (itemId: string, event: DragEvent) => void
  onDragOver: (itemId: string, event: DragEvent) => void
  onDragStart: (itemId: string) => void
  onDrop: (event: DragEvent) => void
  onMove?: (itemId: string, delta: -1 | 1) => void
  site: NonNullable<AiSiteMap[string]>
  tone: SectionTone
}

const GridCard = memo<GridCardProps>(function GridCard({
  isActive,
  isDragging,
  isDropTarget = false,
  itemId,
  onClick,
  onDragEnd,
  onDragLeave,
  onDragOver,
  onDragStart,
  onDrop,
  onMove,
  site,
  tone
}: GridCardProps) {
  const { t } = useTranslation()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const accent = safeAiAccentColor(site.color)
  const displayName = site.displayName || site.name || itemId
  const icon = getAiIcon(site.icon || itemId)
  // Sites carry a real subtitle (their host). Models are pure launchers, so
  // repeating "ready flow" on every card is noise — they render name only.
  const subtitle =
    tone === 'site'
      ? site.url?.replace(/^https?:\/\//, '').replace(/\/$/, '') || t('ai_home.custom_site')
      : null

  // A missing logo becomes a deliberate monogram, not a bare letter: same
  // gradient/ring language as the rest of the card surfaces.
  const letterFallback = (
    <span
      aria-hidden
      className="border-primary/20 from-primary/20 to-primary/5 text-primary text-ql-13 flex size-full items-center justify-center rounded-[inherit] border bg-gradient-to-br font-bold uppercase"
    >
      {displayName.charAt(0)}
    </span>
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!onMove || !event.altKey || event.ctrlKey || event.metaKey) return
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      onMove(itemId, -1)
      requestAnimationFrame(() => {
        if (buttonRef.current && document.activeElement !== buttonRef.current) {
          buttonRef.current.focus()
        }
      })
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      onMove(itemId, 1)
      requestAnimationFrame(() => {
        if (buttonRef.current && document.activeElement !== buttonRef.current) {
          buttonRef.current.focus()
        }
      })
    }
  }

  return (
    <div
      role="presentation"
      draggable
      onDragStart={() => onDragStart(itemId)}
      onDragOver={(event) => onDragOver(itemId, event)}
      onDragLeave={onDragLeave ? (event) => onDragLeave(itemId, event) : undefined}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <BlurFade className="h-full">
        <MagicCard
          className={`h-full rounded-xl ${
            isDropTarget ? 'ring-primary/70 ring-2' : isActive ? 'ring-ring/40 ring-1' : ''
          }`}
          gradientColor="#18181b"
          gradientOpacity={0.35}
          gradientFrom="#27272a"
          gradientTo="#18181b"
        >
          <button
            ref={buttonRef}
            type="button"
            onClick={() => onClick(itemId)}
            onKeyDown={handleKeyDown}
            aria-keyshortcuts={
              onMove ? 'Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown' : undefined
            }
            style={AI_HOME_GRID_CARD_MIN_HEIGHT}
            className={`group motion-normal focus-visible:ring-ring/70 relative flex w-full cursor-pointer items-center rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none ${
              isDropTarget
                ? 'border-primary/40 bg-white/[0.04]'
                : isActive
                  ? 'border-ring/50 bg-accent/30'
                  : 'border-transparent bg-transparent hover:bg-white/[0.03]'
            }`}
          >
            <div className="flex w-full items-center gap-3">
              <div
                className="motion-normal flex size-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105 motion-reduce:scale-100"
                style={{
                  color: accent,
                  backgroundColor: `color-mix(in srgb, ${accent} 13%, transparent)`
                }}
              >
                {icon ? <Suspense fallback={letterFallback}>{icon}</Suspense> : letterFallback}
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  className="text-ql-13 text-foreground truncate font-semibold"
                  title={displayName}
                >
                  {displayName}
                </h3>
                {subtitle && (
                  <p className="text-ql-11 text-muted-foreground mt-0.5 truncate" title={subtitle}>
                    {subtitle}
                  </p>
                )}
              </div>
              {/* Always reserve the status slot so activating a card never
                  changes the text width or shifts the arrow. */}
              <span className="flex size-2 shrink-0 items-center justify-center">
                {isActive && (
                  <span className="size-2 rounded-full" style={{ background: accent }} />
                )}
              </span>
              <div className="text-muted-foreground/60 group-hover:text-foreground shrink-0 opacity-0 transition-opacity group-focus-visible:opacity-100 focus-visible:opacity-100 motion-reduce:opacity-100">
                <ArrowUpRight className="motion-normal h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none" />
              </div>
            </div>
          </button>
        </MagicCard>
      </BlurFade>
    </div>
  )
})

export default GridCard
