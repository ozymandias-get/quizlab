import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useAi, useLanguage } from '@app/providers'
import { hexToRgba } from '@shared/lib/uiUtils'
import { getAiIcon } from '@ui/components/Icons'
import type { AiPlatform } from '@shared-core/types'
import { ArrowUpRight, Compass, Globe, Grip, Home, Layers3, Sparkles, ChevronDown } from 'lucide-react'

interface AiHomePageProps {
    onSelectTab: (tabId: string) => void
    onOpenModel: (modelId: string) => void
}

type SectionTone = 'model' | 'site'

const hexColorRegex = /^#([0-9A-F]{3}){1,2}$/i
const safeColor = (color?: string) => (color && hexColorRegex.test(color) ? color : '#6ee7b7')
const areIdsEqual = (left: string[], right: string[]) => (
    left.length === right.length && left.every((value, index) => value === right[index])
)

function useGridDragReorder(order: string[], onReorder: (newOrder: string[]) => void) {
    const dragItemRef = useRef<string | null>(null)
    const dragOverItemRef = useRef<string | null>(null)

    const handleDragStart = useCallback((id: string) => {
        dragItemRef.current = id
    }, [])

    const handleDragOver = useCallback((event: React.DragEvent, id: string) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        dragOverItemRef.current = id
    }, [])

    const handleDrop = useCallback((event: React.DragEvent) => {
        event.preventDefault()
        const from = dragItemRef.current
        const to = dragOverItemRef.current
        if (!from || !to || from === to) return

        const nextOrder = [...order]
        const fromIndex = nextOrder.indexOf(from)
        const toIndex = nextOrder.indexOf(to)
        if (fromIndex === -1 || toIndex === -1) return

        nextOrder.splice(fromIndex, 1)
        nextOrder.splice(toIndex, 0, from)
        onReorder(nextOrder)

        dragItemRef.current = null
        dragOverItemRef.current = null
    }, [onReorder, order])

    const handleDragEnd = useCallback(() => {
        dragItemRef.current = null
        dragOverItemRef.current = null
    }, [])

    return { dragItemRef, handleDragStart, handleDragOver, handleDrop, handleDragEnd }
}

function StatChip({ icon, value, label, accent }: { icon: React.ReactNode; value: string; label: string; accent: string }) {
    return (
        <div
            className="rounded-[32px] border px-4 py-3 backdrop-blur-xl"
            style={{
                borderColor: hexToRgba(accent, 0.2),
                background: `linear-gradient(160deg, ${hexToRgba(accent, 0.12)} 0%, rgba(255,255,255,0.04) 55%, rgba(0,0,0,0.16) 100%)`
            }}
        >
            <div className="flex items-center gap-3">
                <div
                    className="flex h-10 w-10 items-center justify-center rounded-full border shadow-sm"
                    style={{
                        color: accent,
                        borderColor: hexToRgba(accent, 0.24),
                        background: `linear-gradient(160deg, ${hexToRgba(accent, 0.18)} 0%, ${hexToRgba(accent, 0.05)} 100%)`,
                    }}
                >
                    {icon}
                </div>
                <div className="min-w-0">
                    <div className="truncate text-base font-semibold tracking-tight text-white/90">{value}</div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/32">{label}</div>
                </div>
            </div>
        </div>
    )
}

function CollapsibleSection({
    title,
    detail,
    icon,
    accent,
    children,
    defaultOpen = true,
    delay = 0
}: {
    title: string
    detail: string
    icon: React.ReactNode
    accent: string
    children: React.ReactNode
    defaultOpen?: boolean
    delay?: number
}) {
    const { t } = useLanguage()
    const [isOpen, setIsOpen] = useState(defaultOpen)

    return (
        <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, delay }}
            className="overflow-hidden rounded-[32px] border border-white/8 bg-[linear-gradient(145deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012)_52%,rgba(0,0,0,0.16))] backdrop-blur-2xl"
        >
            <div
                className="flex cursor-pointer select-none flex-wrap items-center gap-3.5 px-5 py-4 transition-colors hover:bg-white/[0.02]"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div
                    className="flex h-10 w-10 items-center justify-center rounded-full border shadow-sm"
                    style={{
                        color: accent,
                        borderColor: hexToRgba(accent, 0.22),
                        background: `linear-gradient(160deg, ${hexToRgba(accent, 0.16)} 0%, ${hexToRgba(accent, 0.05)} 100%)`
                    }}
                >
                    {icon}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-[10.5px] uppercase tracking-[0.22em] text-white/35 font-medium">{title}</div>
                    <div className="mt-0.5 text-[13px] text-white/56">{detail}</div>
                </div>
                <div
                    className="flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/28 cursor-default"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Grip className="h-3.5 w-3.5" />
                    {t('ai_home.drag_drop')}
                </div>
                <div
                    className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.04] text-white/40 transition-transform duration-300"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                    <ChevronDown className="h-4 w-4" />
                </div>
            </div>

            <motion.div
                initial={false}
                animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
                <div className="px-4 pb-4">
                    {children}
                </div>
            </motion.div>
        </motion.section>
    )
}

function OpenTabCard({
    tabId,
    modelId,
    title,
    site,
    isActive,
    onClick,
    index
}: {
    tabId: string
    modelId: string
    title?: string
    site?: AiPlatform
    isActive: boolean
    onClick: () => void
    index: number
}) {
    const { t } = useLanguage()
    const accent = safeColor(site?.color)
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
            className="group relative flex w-full items-center gap-3 overflow-hidden rounded-[32px] border px-4 py-3.5 text-left backdrop-blur-xl"
            style={{
                borderColor: isActive ? hexToRgba(accent, 0.4) : 'rgba(255,255,255,0.08)',
                background: isActive
                    ? `linear-gradient(135deg, ${hexToRgba(accent, 0.16)} 0%, rgba(255,255,255,0.035) 48%, rgba(0,0,0,0.12) 100%)`
                    : 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.018) 52%, rgba(0,0,0,0.12) 100%)'
            }}
        >
            <div className="absolute inset-y-3 left-0 w-[4px] rounded-full" style={{ background: isActive ? accent : 'transparent' }} />
            <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border shadow-sm ml-1"
                style={{
                    color: accent,
                    borderColor: hexToRgba(accent, 0.28),
                    background: `linear-gradient(160deg, ${hexToRgba(accent, 0.18)} 0%, ${hexToRgba(accent, 0.05)} 100%)`
                }}
            >
                {icon || <span className="text-base font-semibold">{displayName.charAt(0)}</span>}
            </div>
            <div className="min-w-0 flex-1 ml-1">
                <div className="flex items-center gap-2">
                    <p className="truncate text-[14px] font-semibold text-white/90">{displayName}</p>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-white/35">{t('ai_home.tab')}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-white/42">
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: isActive ? accent : 'rgba(255,255,255,0.24)' }} />
                    {isActive ? t('ai_home.active_session') : t('ai_home.ready_id', { id: tabId.slice(0, 8) })}
                </div>
            </div>
            <div className="rounded-full border border-white/10 bg-black/20 p-1.5 text-white/30 transition-colors group-hover:text-white/60">
                <ArrowUpRight className="h-4 w-4" />
            </div>
        </motion.button>
    )
}

function GridCard({
    itemId,
    site,
    tone,
    isActive,
    isDragging,
    onClick,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd
}: {
    itemId: string
    site: AiPlatform
    tone: SectionTone
    isActive: boolean
    isDragging: boolean
    onClick: () => void
    onDragStart: () => void
    onDragOver: (event: React.DragEvent) => void
    onDrop: (event: React.DragEvent) => void
    onDragEnd: () => void
}) {
    const { t } = useLanguage()
    const accent = safeColor(site.color)
    const displayName = site.displayName || site.name || itemId
    const icon = getAiIcon(site.icon || itemId)
    const toneLabel = tone === 'site' ? t('ai_home.site') : t('ai_home.model')
    const subtitle = tone === 'site'
        ? (site.url?.replace(/^https?:\/\//, '').replace(/\/$/, '') || t('ai_home.custom_site'))
        : t('ai_home.ready_flow')

    return (
        <motion.button
            type="button"
            draggable
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            onClick={onClick}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: isDragging ? 0.45 : 1, y: 0, scale: isDragging ? 0.97 : 1 }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.99 }}
            className="group relative min-h-[96px] overflow-hidden rounded-[20px] border p-3 text-left backdrop-blur-2xl"
            style={{
                borderColor: isActive ? hexToRgba(accent, 0.38) : 'rgba(255,255,255,0.09)',
                background: isActive
                    ? `linear-gradient(145deg, ${hexToRgba(accent, 0.16)} 0%, rgba(255,255,255,0.035) 48%, rgba(0,0,0,0.14) 100%)`
                    : 'linear-gradient(145deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.018) 48%, rgba(0,0,0,0.16) 100%)'
            }}
        >
            <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{ background: `radial-gradient(circle at top right, ${hexToRgba(accent, 0.18)} 0%, transparent 48%)` }} />
            <div className="relative z-10 flex h-full flex-col">
                <div className="flex items-start justify-between gap-2">
                    <div className="inline-flex items-center gap-1 rounded-full border px-1.5 py-[2px] text-[7.5px] font-medium uppercase tracking-[0.18em]" style={{ color: isActive ? accent : 'rgba(255,255,255,0.4)', borderColor: isActive ? hexToRgba(accent, 0.26) : 'rgba(255,255,255,0.08)', background: isActive ? hexToRgba(accent, 0.12) : 'rgba(255,255,255,0.03)' }}>
                        {tone === 'site' ? <Globe className="h-[8px] w-[8px]" /> : <Sparkles className="h-[8px] w-[8px]" />}
                        <span className="leading-none pt-[1px]">{toneLabel}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {isActive && <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 16px ${hexToRgba(accent, 0.9)}` }} />}
                        <div className="rounded-full border border-white/8 bg-black/15 p-[2px] text-white/24 transition-colors group-hover:text-white/55">
                            <ArrowUpRight className="h-2.5 w-2.5" />
                        </div>
                    </div>
                </div>
                <div className="mt-2 flex flex-1 flex-col justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="flex items-center [&>svg]:h-5 [&>svg]:w-5 shrink-0" style={{ color: accent, filter: `drop-shadow(0 4px 12px ${hexToRgba(accent, 0.4)})` }}>
                            {icon || <span className="text-[17px] font-semibold">{displayName.charAt(0)}</span>}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="truncate text-[13px] font-semibold tracking-tight text-white/90">{displayName}</h3>
                            <p className="truncate mt-0.5 text-[10px] leading-relaxed text-white/42">{subtitle}</p>
                        </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-2.5 text-[8px] uppercase tracking-[0.18em] text-white/28 font-medium">
                        <span className="truncate">{isActive ? t('ai_home.open') : t('ai_home.ready')}</span>
                        <span className="shrink-0 rounded-full border border-white/8 bg-white/[0.03] px-2 py-0.5">{t('ai_home.new_tab')}</span>
                    </div>
                </div>
            </div>
        </motion.button>
    )
}

function EmptySitesState() {
    const { t } = useLanguage()

    return (
        <div className="rounded-[32px] border border-dashed border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.03),rgba(0,0,0,0.18))] p-8 backdrop-blur-xl">
            <div className="flex flex-col items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/28">
                    <Globe className="h-6 w-6" />
                </div>
                <div>
                    <div className="text-base font-semibold tracking-tight text-white/78">{t('ai_home.empty_sites_title')}</div>
                    <div className="mt-1.5 max-w-md text-[13px] leading-relaxed text-white/42">{t('ai_home.empty_sites_description')}</div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/28">{t('ai_home.empty_sites_hint')}</div>
            </div>
        </div>
    )
}

function OpenTabsToggle({ tabs, activeTabId, onSelectTab, aiSites }: any) {
    const { t } = useLanguage()
    const [isOpen, setIsOpen] = useState(false)
    const accent = "#6ee7b7"

    return (
        <div className="col-span-1 sm:col-span-2 flex flex-col gap-2 relative">
            <div
                className="rounded-[32px] border px-4 py-3.5 backdrop-blur-xl cursor-pointer transition-colors hover:bg-white/[0.02]"
                style={{
                    borderColor: hexToRgba(accent, 0.2),
                    background: `linear-gradient(160deg, ${hexToRgba(accent, 0.12)} 0%, rgba(255,255,255,0.04) 55%, rgba(0,0,0,0.16) 100%)`
                }}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-3.5">
                    <div
                        className="flex h-11 w-11 items-center justify-center rounded-full border shadow-sm"
                        style={{
                            color: accent,
                            borderColor: hexToRgba(accent, 0.24),
                            background: `linear-gradient(160deg, ${hexToRgba(accent, 0.18)} 0%, ${hexToRgba(accent, 0.05)} 100%)`,
                        }}
                    >
                        <Layers3 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 ml-1">
                        <div className="truncate text-base font-semibold tracking-tight text-white/90">{tabs.length}</div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-white/32">{t('ai_home.open_tab')}</div>
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
                        {tabs.map((tab: any, index: number) => (
                            <OpenTabCard key={tab.id} tabId={tab.id} modelId={tab.modelId} title={tab.title} site={aiSites[tab.modelId]} isActive={tab.id === activeTabId} onClick={() => onSelectTab(tab.id)} index={index} />
                        ))}
                    </div>
                ) : (
                    <div className="rounded-[18px] border border-white/8 bg-white/[0.02] p-3 text-center text-[11px] text-white/40 mb-1">
                        {t('ai_home.open_tabs_title')} bulunmuyor
                    </div>
                )}
            </motion.div>
        </div>
    )
}

function AiHomePage({ onSelectTab, onOpenModel }: AiHomePageProps) {
    const { t } = useLanguage()
    const { tabs, activeTabId, aiSites = {}, enabledModels = [], setEnabledModels = () => { } } = useAi()
    const pageRef = useRef<HTMLDivElement>(null)
    const [panelWidth, setPanelWidth] = useState(0)
    const aiModelIds = useMemo(() => enabledModels.filter((id) => aiSites[id] && !aiSites[id].isSite), [enabledModels, aiSites])
    const siteIds = useMemo(() => enabledModels.filter((id) => aiSites[id] && aiSites[id].isSite), [enabledModels, aiSites])
    const aiModelIdsKey = aiModelIds.join('|')
    const siteIdsKey = siteIds.join('|')
    const [modelOrder, setModelOrder] = useState<string[]>(aiModelIds)
    const [siteOrder, setSiteOrder] = useState<string[]>(siteIds)

    useEffect(() => {
        setModelOrder((prev) => {
            const next = [...prev.filter((id) => aiModelIds.includes(id)), ...aiModelIds.filter((id) => !prev.includes(id))]
            return areIdsEqual(prev, next) ? prev : next
        })
    }, [aiModelIdsKey])

    useEffect(() => {
        setSiteOrder((prev) => {
            const next = [...prev.filter((id) => siteIds.includes(id)), ...siteIds.filter((id) => !prev.includes(id))]
            return areIdsEqual(prev, next) ? prev : next
        })
    }, [siteIdsKey])

    const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeTabId), [tabs, activeTabId])
    const activeModelIds = useMemo(() => new Set(tabs.map((tab) => tab.modelId)), [tabs])
    const featured = [...modelOrder.slice(0, 3), ...siteOrder.slice(0, 2)]

    useEffect(() => {
        const node = pageRef.current
        if (!node) return

        const measure = () => {
            setPanelWidth(Math.round(node.getBoundingClientRect().width))
        }

        measure()

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', measure)
            return () => window.removeEventListener('resize', measure)
        }

        const observer = new ResizeObserver(() => measure())
        observer.observe(node)

        return () => observer.disconnect()
    }, [])

    const isCompact = panelWidth > 0 && panelWidth < 960
    const isNarrow = panelWidth > 0 && panelWidth < 760
    const isUltraNarrow = panelWidth > 0 && panelWidth < 620
    const heroColumns = isCompact ? 'minmax(0,1fr)' : 'minmax(0,1.45fr) minmax(0,0.95fr)'
    const statsColumns = isUltraNarrow ? 'minmax(0,1fr)' : 'repeat(2, minmax(0,1fr))'
    const cardColumns = panelWidth >= 1180
        ? 'repeat(3, minmax(0, 1fr))'
        : panelWidth >= 760
            ? 'repeat(2, minmax(0, 1fr))'
            : 'minmax(0, 1fr)'

    const handleModelReorder = useCallback((newOrder: string[]) => {
        setModelOrder(newOrder)
        setEnabledModels([...newOrder, ...enabledModels.filter((id) => aiSites[id]?.isSite)])
    }, [enabledModels, aiSites, setEnabledModels])

    const handleSiteReorder = useCallback((newOrder: string[]) => {
        setSiteOrder(newOrder)
        setEnabledModels([...enabledModels.filter((id) => aiSites[id] && !aiSites[id].isSite), ...newOrder])
    }, [enabledModels, aiSites, setEnabledModels])

    const modelDrag = useGridDragReorder(modelOrder, handleModelReorder)
    const siteDrag = useGridDragReorder(siteOrder, handleSiteReorder)

    return (
        <div ref={pageRef} className="absolute inset-0 overflow-y-auto overflow-x-hidden custom-scrollbar">
            <div className="relative min-h-full px-4 py-4 sm:px-5 sm:py-5">
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute left-[-12%] top-6 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(240,74,137,0.18),transparent_72%)] blur-3xl" />
                    <div className="absolute right-[-8%] top-0 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(0,194,255,0.14),transparent_72%)] blur-3xl" />
                    <div className="absolute bottom-12 left-[34%] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(91,113,255,0.12),transparent_74%)] blur-3xl" />
                </div>

                <div className="relative z-10 flex flex-col gap-4">
                    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38 }} className="overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015)_48%,rgba(0,0,0,0.16))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_34px_80px_-46px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:p-6">
                        <div className="flex flex-col gap-5">
                            <div className={`flex gap-4 ${isCompact ? 'flex-col' : 'flex-row items-start justify-between'}`}>
                                <div className={isCompact ? 'max-w-none' : 'max-w-2xl'}>
                                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] text-emerald-200/65">
                                        <Home className="h-3.5 w-3.5" />
                                        {t('ai_home.badge')}
                                    </div>
                                    <h1
                                        className={`mt-4 font-semibold tracking-tight text-white/92 ${isUltraNarrow
                                            ? 'text-[22px] leading-[1.18]'
                                            : isNarrow
                                                ? 'text-[26px] leading-[1.16]'
                                                : 'text-[24px] sm:text-[30px]'
                                            }`}
                                    >
                                        {t('ai_home.title')}
                                    </h1>
                                    <p className={`mt-3 text-[13.5px] leading-relaxed text-white/48 ${isCompact ? 'max-w-none' : 'max-w-xl'} sm:text-[14.5px]`}>
                                        {t('ai_home.description')}
                                    </p>
                                </div>
                                <div className="flex flex-col gap-3" style={{ width: isCompact ? '100%' : undefined, minWidth: isCompact ? undefined : 340 }}>
                                    <OpenTabsToggle tabs={tabs} activeTabId={activeTabId} onSelectTab={onSelectTab} aiSites={aiSites} />
                                    <div className="grid gap-3" style={{ gridTemplateColumns: statsColumns }}>
                                        <StatChip icon={<Sparkles className="h-4 w-4" />} value={String(modelOrder.length)} label={t('ai_home.ready_model')} accent="#7c8cff" />
                                        <StatChip icon={<Globe className="h-4 w-4" />} value={String(siteOrder.length)} label={t('ai_home.custom_site_count')} accent="#f3b24f" />
                                    </div>
                                </div>
                            </div>
                            <div className="grid gap-3" style={{ gridTemplateColumns: heroColumns }}>
                                <div className="rounded-[32px] border border-white/8 bg-black/20 p-4 px-5 backdrop-blur-xl">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/65 shadow-sm">
                                            <Compass className="h-[18px] w-[18px]" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[14.5px] font-semibold text-white/84">
                                                {activeTab
                                                    ? t('ai_home.active_ready_title', { name: aiSites[activeTab.modelId]?.displayName || activeTab.modelId })
                                                    : t('ai_home.home_state')}
                                            </div>
                                            <div className="mt-1 text-[12.5px] leading-relaxed text-white/42">
                                                {activeTab ? t('ai_home.active_ready_description') : t('ai_home.home_state_description')}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-[32px] border border-white/8 bg-black/20 p-4 px-5 backdrop-blur-xl flex flex-col justify-center">
                                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/32">{t('ai_home.featured')}</div>
                                    <div className="mt-3 flex flex-wrap gap-2.5">
                                        {featured.map((id) => (
                                            <button key={id} type="button" onClick={() => onOpenModel(id)} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white/90">
                                                {aiSites[id]?.displayName || id}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.section>



                    <CollapsibleSection title={t('ai_home.models_title')} detail={t('ai_home.models_detail')} icon={<Sparkles className="h-4 w-4" />} accent="#7c8cff" delay={0.09} defaultOpen={true}>
                        <div className="grid gap-3" style={{ gridTemplateColumns: cardColumns }}>
                            {modelOrder.map((id) => {
                                const site = aiSites[id]
                                if (!site) return null
                                return <GridCard key={id} itemId={id} site={site} tone="model" isActive={activeModelIds.has(id)} isDragging={modelDrag.dragItemRef.current === id} onDragStart={() => modelDrag.handleDragStart(id)} onDragOver={(event) => modelDrag.handleDragOver(event, id)} onDrop={modelDrag.handleDrop} onDragEnd={modelDrag.handleDragEnd} onClick={() => onOpenModel(id)} />
                            })}
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection title={t('ai_home.sites_title')} detail={t('ai_home.sites_detail')} icon={<Globe className="h-4 w-4" />} accent="#f3b24f" delay={0.13} defaultOpen={false}>
                        <div>
                            {siteOrder.length > 0 ? (
                                <div className="grid gap-3" style={{ gridTemplateColumns: cardColumns }}>
                                    {siteOrder.map((id) => {
                                        const site = aiSites[id]
                                        if (!site) return null
                                        return <GridCard key={id} itemId={id} site={site} tone="site" isActive={activeModelIds.has(id)} isDragging={siteDrag.dragItemRef.current === id} onDragStart={() => siteDrag.handleDragStart(id)} onDragOver={(event) => siteDrag.handleDragOver(event, id)} onDrop={siteDrag.handleDrop} onDragEnd={siteDrag.handleDragEnd} onClick={() => onOpenModel(id)} />
                                    })}
                                </div>
                            ) : <EmptySitesState />}
                        </div>
                    </CollapsibleSection>
                </div>
            </div>
        </div>
    )
}

export default memo(AiHomePage)







