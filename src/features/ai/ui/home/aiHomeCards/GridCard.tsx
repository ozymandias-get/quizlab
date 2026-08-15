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
  const subtitle =
    tone === 'site'
      ? site.url?.replace(/^https?:\/\//, '').replace(/\/$/, '') || t('ai_home.custom_site')
      : t('ai_home.ready_flow')

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
      <div className="relative rounded-lg">
        <button
          type="button"
          onClick={() => onClick(itemId)}
          className={`group relative w-full rounded-lg border p-3 text-left shadow-xs transition-colors duration-150 ${
            isActive
              ? 'border-ring/60 bg-accent/20'
              : 'border-border bg-card hover:border-border hover:bg-muted/60'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className="border-border/60 bg-muted/60 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
              style={{ color: accent }}
            >
              {icon ? <Suspense fallback={letterFallback}>{icon}</Suspense> : letterFallback}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-ql-13 text-foreground truncate font-semibold">{displayName}</h3>
              <p className="text-ql-11 text-muted-foreground mt-0.5 truncate">{subtitle}</p>
            </div>
            {isActive && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{
                  background: accent
                }}
              />
            )}
            <div className="text-muted-foreground/60 group-hover:text-foreground transition-colors">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </button>
      </div>
    </div>
  )
})

export default GridCard
