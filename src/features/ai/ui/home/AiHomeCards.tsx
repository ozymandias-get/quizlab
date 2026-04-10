import { useState, type DragEvent, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, ChevronDown, Globe, Layers3, Sparkles } from 'lucide-react'
import { useLanguageStrings } from '@app/providers'
import type { Tab } from '@app/providers/AiContext'
import { hexToRgba } from '@shared/lib/uiUtils'
import { getAiIcon } from '@ui/components/Icons'
import type { GridDragReorderState } from '@features/ai/hooks/useGridDragReorder'
import { safeAiAccentColor, type AiSiteMap, type SectionTone } from '../../model/home'
import { EmptyState, ListItemCard, SurfaceCard, ActionRow } from '@shared/ui/components/primitives'

function OpenTabCard({
  index,
  isActive,
  modelId,
  onClick,
  site,
  tabId,
  title
}: {
  index: number
  isActive: boolean
  modelId: string
  onClick: () => void
  site?: AiSiteMap[string]
  tabId: string
  title?: string
}) {
  const { t } = useLanguageStrings()
  const accent = safeAiAccentColor(site?.color)
  const displayName = title || site?.displayName || site?.name || modelId
  const icon = getAiIcon(site?.icon || modelId)

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: 0.04 + index * 0.05 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="group relative flex w-full items-center gap-3 overflow-hidden rounded-[32px] border px-4 py-3.5 text-left backdrop-blur-2xl backdrop-saturate-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_8px_20px_rgba(0,0,0,0.2)] transition-all duration-300 ease-out hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_12px_28px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 active:scale-95 active:translate-y-0 before:absolute before:inset-0 before:z-0 before:bg-gradient-to-r before:from-transparent before:via-white/[0.04] before:to-transparent before:-translate-x-full hover:before:translate-x-full before:transition-transform before:duration-700 before:ease-in-out"
      style={{
        borderColor: isActive ? hexToRgba(accent, 0.4) : 'rgba(255,255,255,0.08)',
        background: isActive
          ? `linear-gradient(135deg, ${hexToRgba(accent, 0.16)} 0%, rgba(255,255,255,0.035) 48%, rgba(0,0,0,0.12) 100%)`
          : 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.018) 52%, rgba(0,0,0,0.12) 100%)'
      }}
    >
      <div
        className="absolute inset-y-3 left-0 w-[4px] rounded-full z-10"
        style={{ background: isActive ? accent : 'transparent' }}
      />
      <div
        className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] ml-1"
        style={{
          color: accent,
          borderColor: hexToRgba(accent, 0.28),
          background: `linear-gradient(160deg, ${hexToRgba(accent, 0.18)} 0%, ${hexToRgba(accent, 0.05)} 100%)`
        }}
      >
        {icon || <span className="text-ql-16 font-semibold">{displayName.charAt(0)}</span>}
      </div>
      <div className="relative z-10 min-w-0 flex-1 ml-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-ql-14 font-semibold text-white/90">{displayName}</p>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-ql-10 uppercase tracking-ql-standard text-white/35">
            {t('ai_home.tab')}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-ql-12 text-white/42">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: isActive ? accent : 'rgba(255,255,255,0.24)' }}
          />
          {isActive
            ? t('ai_home.active_session')
            : t('ai_home.ready_id', { id: tabId.slice(0, 8) })}
        </div>
      </div>
      <div className="relative z-10 rounded-full border border-white/10 bg-black/20 p-1.5 text-white/[0.55] transition-colors group-hover:text-white/80">
        <ArrowUpRight className="h-4 w-4" />
      </div>
    </motion.button>
  )
}

function GridCard({
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
}: {
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
}) {
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
    <motion.div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: isDragging ? 0.45 : 1, y: 0, scale: isDragging ? 0.97 : 1 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
    >
      <ListItemCard
        onClick={onClick}
        active={isActive}
        className="group relative min-h-[64px] overflow-hidden text-left shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] before:absolute before:inset-0 before:z-0 before:bg-gradient-to-r before:from-transparent before:via-white/[0.04] before:to-transparent before:-translate-x-full hover:before:translate-x-full before:transition-transform before:duration-700 before:ease-in-out p-2.5"
        style={{
          borderColor: isActive ? hexToRgba(accent, 0.38) : undefined,
          background: isActive
            ? `linear-gradient(145deg, ${hexToRgba(accent, 0.16)} 0%, rgba(255,255,255,0.035) 48%, rgba(0,0,0,0.14) 100%)`
            : undefined
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.45] transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background: `radial-gradient(circle at top right, ${hexToRgba(accent, 0.18)} 0%, transparent 48%)`
          }}
        />
        <div className="relative z-10 flex h-full flex-col">
          <div className="flex items-start justify-between gap-2">
            <div
              className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-ql-10 font-medium uppercase tracking-ql-standard"
              style={{
                color: isActive ? accent : 'rgba(255,255,255,0.4)',
                borderColor: isActive ? hexToRgba(accent, 0.26) : 'rgba(255,255,255,0.08)',
                background: isActive ? hexToRgba(accent, 0.12) : 'rgba(255,255,255,0.03)'
              }}
            >
              {tone === 'site' ? (
                <Globe className="h-[8px] w-[8px]" />
              ) : (
                <Sparkles className="h-[8px] w-[8px]" />
              )}
              <span className="leading-none pt-[1px]">{toneLabel}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {isActive && (
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: accent, boxShadow: `0 0 16px ${hexToRgba(accent, 0.9)}` }}
                />
              )}
              <div className="rounded-full border border-white/8 bg-black/15 p-[2px] text-white/[0.55] transition-colors group-hover:text-white/80">
                <ArrowUpRight className="h-2.5 w-2.5" />
              </div>
            </div>
          </div>
          <div className="mt-0.5 flex flex-1 flex-col justify-between">
            <div className="flex items-center gap-2">
              <div
                className="flex items-center [&>svg]:h-3.5 [&>svg]:w-3.5 shrink-0"
                style={{
                  color: accent,
                  filter: `drop-shadow(0 4px 12px ${hexToRgba(accent, 0.4)})`
                }}
              >
                {icon || <span className="text-ql-16 font-semibold">{displayName.charAt(0)}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-ql-12 font-semibold tracking-tight text-white/90">
                  {displayName}
                </h3>
                <p className="truncate mt-0 text-ql-10 leading-relaxed text-white/42">{subtitle}</p>
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-ql-10 uppercase tracking-ql-standard text-white/28 font-medium">
              <span className="truncate">{isActive ? t('ai_home.open') : t('ai_home.ready')}</span>
              <span className="shrink-0 rounded-full border border-white/8 bg-white/[0.03] px-1.5 py-0.5">
                {t('ai_home.new_tab')}
              </span>
            </div>
          </div>
        </div>
      </ListItemCard>
    </motion.div>
  )
}

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
    <SurfaceCard
      tier={3}
      className={`relative overflow-hidden ${compact ? 'flex-1 min-w-[120px] p-2 sm:p-2' : 'p-3 sm:p-4'}`}
      style={{
        borderColor: hexToRgba(accent, 0.2),
        background: `linear-gradient(160deg, ${hexToRgba(accent, 0.12)} 0%, rgba(255,255,255,0.04) 55%, rgba(0,0,0,0.16) 100%)`
      }}
    >
      <ActionRow contentClassName={compact ? 'gap-2' : 'gap-3'}>
        <div
          className={`flex shrink-0 items-center justify-center rounded-full border shadow-sm ${compact ? 'h-8 w-8' : 'h-10 w-10'}`}
          style={{
            color: accent,
            borderColor: hexToRgba(accent, 0.24),
            background: `linear-gradient(160deg, ${hexToRgba(accent, 0.18)} 0%, ${hexToRgba(accent, 0.05)} 100%)`
          }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div
            className={`truncate font-semibold tracking-tight text-white/90 ${compact ? 'text-ql-14' : 'text-ql-16'}`}
          >
            {value}
          </div>
          <div className="text-ql-10 uppercase tracking-ql-standard text-white/32">{label}</div>
        </div>
      </ActionRow>
    </SurfaceCard>
  )
}

export function EmptySitesState() {
  const { t } = useLanguageStrings()

  return (
    <EmptyState
      icon={Globe}
      title={t('ai_home.empty_sites_title')}
      description={t('ai_home.empty_sites_description')}
      action={
        <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-ql-10 uppercase tracking-ql-standard text-white/28">
          {t('ai_home.empty_sites_hint')}
        </div>
      }
    />
  )
}

export function OpenTabsToggle({
  activeTabId,
  aiSites,
  onSelectTab,
  tabs
}: {
  activeTabId: string
  aiSites: AiSiteMap
  onSelectTab: (tabId: string) => void
  tabs: Tab[]
}) {
  const { t } = useLanguageStrings()
  const [isOpen, setIsOpen] = useState(false)
  const accent = '#6ee7b7'

  return (
    <div className="col-span-1 sm:col-span-2 flex flex-col gap-2 relative">
      <div
        className="rounded-[32px] border px-4 py-3.5 backdrop-blur-2xl backdrop-saturate-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_8px_20px_rgba(0,0,0,0.2)] cursor-pointer transition-all duration-300 hover:brightness-110 active:scale-95"
        style={{
          borderColor: hexToRgba(accent, 0.2),
          background: `linear-gradient(160deg, ${hexToRgba(accent, 0.12)} 0%, rgba(255,255,255,0.04) 55%, rgba(0,0,0,0.16) 100%)`
        }}
        onClick={() => setIsOpen((current) => !current)}
      >
        <div className="flex items-center gap-3.5">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full border shadow-sm"
            style={{
              color: accent,
              borderColor: hexToRgba(accent, 0.24),
              background: `linear-gradient(160deg, ${hexToRgba(accent, 0.18)} 0%, ${hexToRgba(accent, 0.05)} 100%)`
            }}
          >
            <Layers3 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 ml-1">
            <div className="truncate text-ql-16 font-semibold tracking-tight text-white/90">
              {tabs.length}
            </div>
            <div className="text-ql-10 uppercase tracking-ql-standard text-white/32">
              {t('ai_home.open_tab')}
            </div>
          </div>
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.04] text-white/40 transition-transform duration-300"
            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
      </div>

      <motion.div
        initial={false}
        animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="overflow-hidden"
      >
        {tabs.length > 0 ? (
          <div className="grid gap-2 mb-1">
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
          <div className="rounded-[18px] border border-white/8 bg-white/[0.02] p-3 text-center text-ql-12 text-white/40 mb-1">
            {t('ai_home.open_tabs_title')} bulunmuyor
          </div>
        )}
      </motion.div>
    </div>
  )
}

export function AiHomeCardGrid({
  activeModelIds,
  aiSites,
  cardColumns,
  dragState,
  ids,
  onOpenModel,
  tone
}: {
  activeModelIds: Set<string>
  aiSites: AiSiteMap
  cardColumns: string
  dragState: GridDragReorderState
  ids: string[]
  onOpenModel: (id: string) => void
  tone: SectionTone
}) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: cardColumns }}>
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
}
