import { memo, type DragEvent } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { useLanguageStrings } from '@app/providers'
import { getAiIcon } from '@ui/components/Icons'
import { safeAiAccentColor } from '../../../model/home'
import type { AiSiteMap, SectionTone } from '../../../model/home'

interface GridCardProps {
  isActive: boolean
  isDragging: boolean
  itemId: string
  onClick: () => void
  onDragEnd: () => void
  onDragOver: (event: DragEvent) => void
  onDragStart: () => void
  onDrop: (event: DragEvent) => void
  site: NonNullable<AiSiteMap[string]>
  tone: SectionTone
}

export const GridCard = memo<GridCardProps>(function GridCard({
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
  const { t } = useLanguageStrings()
  const accent = safeAiAccentColor(site.color)
  const displayName = site.displayName || site.name || itemId
  const icon = getAiIcon(site.icon || itemId)
  const toneLabel = tone === 'site' ? t('ai_home.site') : t('ai_home.model')
  const subtitle =
    tone === 'site'
      ? site.url?.replace(/^https?:\/\//, '').replace(/\/$/, '') || t('ai_home.custom_site')
      : t('ai_home.ready_flow')

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <button
        type="button"
        onClick={onClick}
        className={`group relative w-full rounded-xl border px-3 py-2.5 text-left transition-all ${
          isActive
            ? 'border-white/14 bg-white/[0.06]'
            : 'border-white/8 bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.04]'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.04]"
            style={{ color: accent }}
          >
            {icon || <span className="text-ql-14 font-medium">{displayName.charAt(0)}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-ql-13 font-semibold text-white/82">{displayName}</h3>
              <span className="rounded-full border border-white/8 bg-white/[0.02] px-1.5 py-0.5 text-[10px] text-white/35">
                {toneLabel}
              </span>
            </div>
            <p className="truncate mt-0.5 text-ql-11 text-white/40">{subtitle}</p>
          </div>
          {isActive && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
          )}
          <div className="text-white/30 transition-colors group-hover:text-white/60">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </button>
    </div>
  )
})
