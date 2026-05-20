import { memo, useState, type DragEvent, type ReactNode } from 'react'
import { ArrowUpRight, ChevronDown, Layers3 } from 'lucide-react'
import { useAppearance, useLanguageStrings } from '@app/providers'
import type { Tab } from '@app/providers/AiContext'
import { getAiIcon } from '@ui/components/Icons'
import type { GridDragReorderState } from '@features/ai/hooks/useGridDragReorder'
import { safeAiAccentColor, type AiSiteMap, type SectionTone } from '../../model/home'

interface OpenTabCardProps {
  index: number
  isActive: boolean
  modelId: string
  onClick: () => void
  site?: AiSiteMap[string]
  tabId: string
  title?: string
}

const OpenTabCard = memo<OpenTabCardProps>(function OpenTabCard({
  isActive,
  modelId,
  onClick,
  site,
  tabId,
  title
}: OpenTabCardProps) {
  const { t } = useLanguageStrings()
  const accent = safeAiAccentColor(site?.color)
  const displayName = title || site?.displayName || site?.name || modelId
  const icon = getAiIcon(site?.icon || modelId)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
        isActive
          ? 'border-white/14 bg-white/[0.06]'
          : 'border-white/8 bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.04]'
      }`}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.04]"
        style={{ color: accent }}
      >
        {icon || <span className="text-ql-14 font-medium">{displayName.charAt(0)}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-ql-13 font-semibold text-white/82">{displayName}</p>
        <div className="mt-0.5 flex items-center gap-1.5 text-ql-11 text-white/40">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: isActive ? accent : 'rgba(255,255,255,0.25)' }}
          />
          {isActive
            ? t('ai_home.active_session')
            : t('ai_home.ready_id', { id: tabId.slice(0, 8) })}
        </div>
      </div>
      <div className="text-white/35 transition-colors group-hover:text-white/60">
        <ArrowUpRight className="h-3.5 w-3.5" />
      </div>
    </button>
  )
})

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

export function StatChip({
  accent,
  compact,
  icon,
  label,
  value
}: {
  accent: string
  compact?: boolean
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div
      className={`rounded-lg border border-white/6 bg-white/[0.01] ${compact ? 'flex-1 min-w-[100px] px-2.5 py-2' : 'px-3 py-3'}`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`flex shrink-0 items-center justify-center rounded-md ${compact ? 'h-7 w-7' : 'h-8 w-8'}`}
          style={{ color: accent }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div
            className={`truncate font-medium text-white/70 ${compact ? 'text-ql-13' : 'text-ql-14'}`}
          >
            {value}
          </div>
          <div className="text-[10px] text-white/25">{label}</div>
        </div>
      </div>
    </div>
  )
}

export function EmptySitesState() {
  const { t } = useLanguageStrings()

  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <p className="text-ql-13 text-white/45">{t('ai_home.empty_sites_description')}</p>
    </div>
  )
}

interface OpenTabsToggleProps {
  activeTabId: string
  aiSites: AiSiteMap
  onSelectTab: (tabId: string) => void
  tabs: Tab[]
}

export const OpenTabsToggle = memo<OpenTabsToggleProps>(function OpenTabsToggle({
  activeTabId,
  aiSites,
  onSelectTab,
  tabs
}: OpenTabsToggleProps) {
  const { t } = useLanguageStrings()
  const [isOpen, setIsOpen] = useState(false)
  const performanceMode = useAppearance((s) => s.performanceMode)
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const animate = !performanceMode && !prefersReducedMotion
  const hasTabs = (tabs || []).length > 0

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        aria-expanded={isOpen}
        className="flex w-full items-center gap-2.5 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-left transition-all hover:border-white/12 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
        onClick={() => setIsOpen((current) => !current)}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.03] text-white/45">
          <Layers3 className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-ql-13 font-medium text-white/65">
            {(tabs || []).length} {t('ai_home.open_tab')}
          </div>
        </div>
        <div
          className="flex h-5 w-5 items-center justify-center text-white/35 transition-transform"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transitionDuration: animate ? '200ms' : '0ms',
            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <ChevronDown className="h-3 w-3" />
        </div>
      </button>

      <div
        className="overflow-hidden"
        style={{
          display: 'grid',
          gridTemplateRows: isOpen && hasTabs ? '1fr' : '0fr',
          opacity: isOpen && hasTabs ? 1 : 0,
          transition: animate
            ? 'grid-template-rows 200ms cubic-bezier(0.4, 0, 0.2, 1), opacity 160ms ease-out'
            : 'none'
        }}
      >
        <div className="min-h-0">
          {isOpen && hasTabs ? (
            <div className="grid gap-1.5 pb-1">
              {tabs.map((tab, index) => (
                <OpenTabCard
                  key={tab.id}
                  index={index}
                  isActive={tab.id === activeTabId}
                  modelId={tab.modelId}
                  onClick={() => onSelectTab(tab.id)}
                  site={aiSites[tab.modelId]}
                  tabId={tab.id}
                  title={tab.title}
                />
              ))}
            </div>
          ) : (
            <div className="pointer-events-none invisible" aria-hidden>
              {hasTabs && (
                <div className="grid gap-1.5 pb-1">
                  {tabs.map((tab, index) => (
                    <OpenTabCard
                      key={tab.id}
                      index={index}
                      isActive={tab.id === activeTabId}
                      modelId={tab.modelId}
                      onClick={() => onSelectTab(tab.id)}
                      site={aiSites[tab.modelId]}
                      tabId={tab.id}
                      title={tab.title}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

interface AiHomeCardGridProps {
  activeModelIds: Set<string>
  aiSites: AiSiteMap
  cardColumns: string
  dragState: GridDragReorderState
  ids: string[]
  onOpenModel: (id: string) => void
  tone: SectionTone
}

export const AiHomeCardGrid = memo<AiHomeCardGridProps>(function AiHomeCardGrid({
  activeModelIds,
  aiSites,
  cardColumns,
  dragState,
  ids,
  onOpenModel,
  tone
}: AiHomeCardGridProps) {
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: cardColumns }}>
      {ids.map((id) => {
        const site = aiSites[id]
        if (!site) {
          return null
        }

        return (
          <GridCard
            key={id}
            isActive={activeModelIds.has(id)}
            isDragging={dragState.dragItemRef.current === id}
            itemId={id}
            onClick={() => onOpenModel(id)}
            onDragEnd={dragState.handleDragEnd}
            onDragOver={(event) => dragState.handleDragOver(event, id)}
            onDragStart={() => dragState.handleDragStart(id)}
            onDrop={dragState.handleDrop}
            site={site}
            tone={tone}
          />
        )
      })}
    </div>
  )
})
