import { getAiIcon } from '@ui/components/Icons'

import { ArrowUpRight } from 'lucide-react'
import { type DragEvent, memo, Suspense } from 'react'
import { useTranslation } from 'react-i18next'

import type { AiSiteMap, SectionTone } from '../../../model/home'
import { safeAiAccentColor } from '../../../model/home'

interface GridCardProps {
  isActive: boolean
  isDragging: boolean
  itemId: string
  onClick: (itemId: string) => void
  onDragEnd: () => void
  onDragOver: (itemId: string, event: DragEvent) => void
  onDragStart: (itemId: string) => void
  onDrop: (event: DragEvent) => void
  site: NonNullable<AiSiteMap[string]>
  tone: SectionTone
}

const GridCard = memo<GridCardProps>(function GridCard({
  isActive,
  isDragging,
  itemId,
  onClick,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  site,
  tone
}: GridCardProps) {
  const { t } = useTranslation()
  const accent = safeAiAccentColor(site.color)
  const displayName = site.displayName || site.name || itemId
  const icon = getAiIcon(site.icon || itemId)
  // Sites carry a real subtitle (their host). Models are pure launchers, so
  // repeating "ready flow" on every card is noise — they render name only.
  const subtitle =
    tone === 'site'
      ? site.url?.replace(/^https?:\/\//, '').replace(/\/$/, '') || t('ai_home.custom_site')
      : null

  const letterFallback = <span className="text-ql-13 font-medium">{displayName.charAt(0)}</span>

  return (
    <div
      role="presentation"
      draggable
      onDragStart={() => onDragStart(itemId)}
      onDragOver={(event) => onDragOver(itemId, event)}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <div className="relative rounded-xl">
        <button
          type="button"
          onClick={() => onClick(itemId)}
          className={`group hover:shadow-ambient-sm motion-normal relative w-full cursor-pointer rounded-xl border p-3 text-left shadow-xs transition-colors ${
            isActive ? 'border-ring/50 bg-accent/30' : 'border-border/60 bg-card hover:bg-muted/60'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className="border-border/60 bg-muted/60 motion-normal flex size-8 shrink-0 items-center justify-center rounded-lg border transition-transform group-hover:scale-105 motion-reduce:scale-100"
              style={{ color: accent }}
            >
              {icon ? <Suspense fallback={letterFallback}>{icon}</Suspense> : letterFallback}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-ql-13 text-foreground truncate font-semibold">{displayName}</h3>
              {subtitle && (
                <p className="text-ql-11 text-muted-foreground mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
            {isActive && (
              <span
                className="size-2 shrink-0 rounded-full"
                style={{
                  background: accent
                }}
              />
            )}
            <div className="text-muted-foreground/60 group-hover:text-foreground opacity-0 transition-opacity group-focus-visible:opacity-100 focus-visible:opacity-100 motion-reduce:opacity-100">
              <ArrowUpRight className="motion-normal h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none" />
            </div>
          </div>
        </button>
      </div>
    </div>
  )
})

export default GridCard
