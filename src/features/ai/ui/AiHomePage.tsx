import { memo, useMemo, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { useAi } from '@app/providers'
import { getAiIcon } from '@ui/components/Icons'
import type { AiPlatform } from '@shared-core/types'
import { Globe } from 'lucide-react'

interface AiHomePageProps {
    onSelectTab: (tabId: string) => void
    onOpenModel: (modelId: string) => void
}

const hexColorRegex = /^#([0-9A-F]{3}){1,2}$/i
const isValidColor = (color: string) => hexColorRegex.test(color)
const safeColor = (color?: string) =>
    color && isValidColor(color) ? color : '#6ee7b7'

/* ═══════════════════════════════════════════════
   useGridDragReorder — Grid drag & drop hook
   ═══════════════════════════════════════════════ */
function useGridDragReorder(
    order: string[],
    onReorder: (newOrder: string[]) => void
) {
    const dragItemRef = useRef<string | null>(null)
    const dragOverItemRef = useRef<string | null>(null)

    const handleDragStart = useCallback((id: string) => {
        dragItemRef.current = id
    }, [])

    const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        dragOverItemRef.current = id
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        const from = dragItemRef.current
        const to = dragOverItemRef.current
        if (!from || !to || from === to) return

        const newOrder = [...order]
        const fromIdx = newOrder.indexOf(from)
        const toIdx = newOrder.indexOf(to)
        if (fromIdx === -1 || toIdx === -1) return

        newOrder.splice(fromIdx, 1)
        newOrder.splice(toIdx, 0, from)
        onReorder(newOrder)

        dragItemRef.current = null
        dragOverItemRef.current = null
    }, [order, onReorder])

    const handleDragEnd = useCallback(() => {
        dragItemRef.current = null
        dragOverItemRef.current = null
    }, [])

    return { handleDragStart, handleDragOver, handleDrop, handleDragEnd, dragItemRef }
}

/* ═══════════════════════════════════════════════
   GridCard — Sürüklenebilir grid kartı
   ═══════════════════════════════════════════════ */
function GridCard({
    itemId,
    site,
    onClick,
    isActive,
    isSite,
    isDragging,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
}: {
    itemId: string
    site: AiPlatform
    onClick: () => void
    isActive?: boolean
    isSite?: boolean
    isDragging: boolean
    onDragStart: () => void
    onDragOver: (e: React.DragEvent) => void
    onDrop: (e: React.DragEvent) => void
    onDragEnd: () => void
}) {
    const color = safeColor(site.color)
    const displayName = site.displayName || site.name || itemId
    const icon = getAiIcon(site.icon || itemId)

    return (
        <motion.div
            draggable
            onDragStart={onDragStart}
            onDragOver={(e) => onDragOver(e as unknown as React.DragEvent)}
            onDrop={(e) => onDrop(e as unknown as React.DragEvent)}
            onDragEnd={onDragEnd}
            initial={{ opacity: 0, y: 16, scale: 0.94 }}
            animate={{
                opacity: isDragging ? 0.5 : 1,
                y: 0,
                scale: isDragging ? 0.95 : 1,
            }}
            whileHover={{
                scale: isDragging ? 0.95 : 1.04,
                y: isDragging ? 0 : -3,
                transition: { type: 'spring', stiffness: 400, damping: 20 }
            }}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.3 }}
            className="relative flex flex-col items-center gap-3 rounded-2xl border p-5 text-center group overflow-hidden cursor-grab active:cursor-grabbing"
            style={{
                background: isActive
                    ? `linear-gradient(160deg, ${color}18 0%, ${color}08 50%, transparent 100%)`
                    : 'linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
                borderColor: isActive ? `${color}45` : 'rgba(255,255,255,0.07)',
                boxShadow: isActive
                    ? `0 8px 32px -8px ${color}30, inset 0 1px 0 ${color}15`
                    : 'inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
            onClick={onClick}
        >
            {/* Hover glow */}
            <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                    background: `radial-gradient(circle at 50% 30%, ${color}12 0%, transparent 70%)`,
                }}
            />

            {/* Active indicator dot */}
            {isActive && (
                <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full"
                    style={{ background: color, boxShadow: `0 0 10px ${color}, 0 0 20px ${color}40` }}
                />
            )}

            {/* Site badge */}
            {isSite && (
                <div className="absolute top-2 left-2">
                    <Globe className="w-2.5 h-2.5 text-white/25" />
                </div>
            )}

            {/* Icon */}
            <div
                className="relative w-12 h-12 flex items-center justify-center rounded-[14px] transition-transform duration-300 group-hover:scale-110"
                style={{
                    background: `linear-gradient(145deg, ${color}20, ${color}08)`,
                    border: `1px solid ${color}25`,
                    boxShadow: `0 4px 16px -4px ${color}20`,
                    color: color,
                }}
            >
                {icon || (
                    <span className="text-lg font-bold">{displayName.charAt(0)}</span>
                )}
            </div>

            {/* Name */}
            <span className="text-[11px] font-semibold text-white/65 group-hover:text-white/90 truncate max-w-full transition-colors duration-200">
                {displayName}
            </span>
        </motion.div>
    )
}

/* ═══════════════════════════════════════════════
   Open Tab Card — Açık sekmeler listesi
   ═══════════════════════════════════════════════ */
function OpenTabCard({
    modelId,
    title,
    site,
    isActive,
    onClick,
    index,
}: {
    modelId: string
    title?: string
    site: AiPlatform | undefined
    isActive: boolean
    onClick: () => void
    index: number
}) {
    const color = safeColor(site?.color)
    const displayName = title || site?.displayName || site?.name || modelId
    const icon = getAiIcon(site?.icon || modelId)

    return (
        <motion.button
            type="button"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.06 + index * 0.04, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{
                scale: 1.015,
                x: 4,
                transition: { type: 'spring', stiffness: 500, damping: 26 }
            }}
            whileTap={{ scale: 0.985 }}
            onClick={onClick}
            className="relative flex items-center gap-3.5 rounded-xl border px-4 py-3 cursor-pointer text-left group w-full overflow-hidden"
            style={{
                background: isActive
                    ? `linear-gradient(135deg, ${color}18 0%, ${color}06 60%, transparent 100%)`
                    : 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))',
                borderColor: isActive ? `${color}40` : 'rgba(255,255,255,0.06)',
                boxShadow: isActive
                    ? `0 4px 20px -6px ${color}25, inset 0 1px 0 ${color}12`
                    : 'inset 0 1px 0 rgba(255,255,255,0.03)',
            }}
        >
            {/* Left color accent bar */}
            <div
                className="absolute left-0 top-[20%] bottom-[20%] w-[2px] rounded-full transition-opacity duration-200"
                style={{
                    background: isActive ? color : 'transparent',
                    opacity: isActive ? 0.7 : 0,
                    boxShadow: isActive ? `0 0 8px ${color}50` : 'none',
                }}
            />

            {/* Icon */}
            <div
                className="w-9 h-9 flex items-center justify-center rounded-[10px] shrink-0 transition-all duration-200 group-hover:scale-105"
                style={{
                    background: `linear-gradient(145deg, ${color}18, ${color}08)`,
                    border: `1px solid ${color}22`,
                    color: color,
                }}
            >
                {icon || (
                    <span className="text-xs font-bold">{displayName.charAt(0)}</span>
                )}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-white/80 group-hover:text-white truncate transition-colors duration-200">
                    {displayName}
                </p>
                {isActive && (
                    <p className="text-[10px] font-medium mt-0.5" style={{ color: `${color}cc` }}>● Aktif</p>
                )}
            </div>

            {/* Right arrow on hover */}
            <svg
                className="w-3.5 h-3.5 text-white/0 group-hover:text-white/40 transition-all duration-200 shrink-0 group-hover:translate-x-0.5"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
                <polyline points="9 18 15 12 9 6" />
            </svg>
        </motion.button>
    )
}

/* ═══════════════════════════════════════════════
   AiHomePage — Ana bileşen
   ═══════════════════════════════════════════════ */
function AiHomePage({ onSelectTab, onOpenModel }: AiHomePageProps) {
    const { tabs, activeTabId, aiSites, enabledModels, setEnabledModels } = useAi()

    // AI modelleri (isSite !== true)
    const aiModelIds = useMemo(() => {
        return enabledModels.filter((id) => aiSites[id] && !aiSites[id].isSite)
    }, [enabledModels, aiSites])

    // Siteler (isSite === true)
    const siteIds = useMemo(() => {
        return enabledModels.filter((id) => aiSites[id] && aiSites[id].isSite)
    }, [enabledModels, aiSites])

    const [modelOrder, setModelOrder] = useState<string[]>(aiModelIds)
    const [siteOrder, setSiteOrder] = useState<string[]>(siteIds)

    // Sync with enabledModels changes
    useMemo(() => {
        setModelOrder((prev) => {
            const currentSet = new Set(aiModelIds)
            const filtered = prev.filter((id) => currentSet.has(id))
            const newIds = aiModelIds.filter((id) => !filtered.includes(id))
            return [...filtered, ...newIds]
        })
    }, [aiModelIds])

    useMemo(() => {
        setSiteOrder((prev) => {
            const currentSet = new Set(siteIds)
            const filtered = prev.filter((id) => currentSet.has(id))
            const newIds = siteIds.filter((id) => !filtered.includes(id))
            return [...filtered, ...newIds]
        })
    }, [siteIds])

    const activeModelIds = useMemo(() => new Set(tabs.map((t) => t.modelId)), [tabs])

    const handleModelReorder = useCallback((newOrder: string[]) => {
        setModelOrder(newOrder)
        const currentSites = enabledModels.filter((id) => aiSites[id]?.isSite)
        setEnabledModels([...newOrder, ...currentSites])
    }, [enabledModels, aiSites, setEnabledModels])

    const handleSiteReorder = useCallback((newOrder: string[]) => {
        setSiteOrder(newOrder)
        const currentModels = enabledModels.filter((id) => aiSites[id] && !aiSites[id].isSite)
        setEnabledModels([...currentModels, ...newOrder])
    }, [enabledModels, aiSites, setEnabledModels])

    const modelDrag = useGridDragReorder(modelOrder, handleModelReorder)
    const siteDrag = useGridDragReorder(siteOrder, handleSiteReorder)

    return (
        <div className="absolute inset-0 overflow-y-auto overflow-x-hidden">

            <div className="relative min-h-full px-6 py-7 flex flex-col gap-6">

                {/* ─── Header ─── */}
                <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-center gap-3.5"
                >
                    <div className="relative">
                        <div
                            className="w-10 h-10 rounded-[12px] flex items-center justify-center"
                            style={{
                                background: 'linear-gradient(145deg, rgba(110,231,183,0.15), rgba(52,211,153,0.05))',
                                border: '1px solid rgba(110,231,183,0.2)',
                                boxShadow: '0 4px 16px -4px rgba(110,231,183,0.15)',
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                <polyline points="9 22 9 12 15 12 15 22" />
                            </svg>
                        </div>
                        <div className="absolute -inset-1 rounded-2xl opacity-20 blur-md"
                            style={{ background: 'linear-gradient(135deg, #6ee7b7, #34d399)' }} />
                    </div>
                    <div>
                        <h1 className="text-[15px] font-bold text-white/90 tracking-tight">AI Anasayfa</h1>
                        <p className="text-[10px] text-white/30 font-medium mt-0.5">
                            {modelOrder.length} model · {siteOrder.length} site · {tabs.length} açık sekme
                        </p>
                    </div>
                </motion.div>

                {/* ─── Open Tabs Section ─── */}
                {tabs.length > 0 && (
                    <motion.section
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-1 h-3.5 rounded-full bg-emerald-400/50" />
                            <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
                                Açık Sekmeler
                            </h2>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            {tabs.map((tab, i) => (
                                <OpenTabCard
                                    key={tab.id}
                                    modelId={tab.modelId}
                                    title={tab.title}
                                    site={aiSites[tab.modelId]}
                                    isActive={tab.id === activeTabId}
                                    onClick={() => onSelectTab(tab.id)}
                                    index={i}
                                />
                            ))}
                        </div>
                    </motion.section>
                )}

                {/* ─── Divider ─── */}
                <div className="relative">
                    <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
                </div>

                {/* ─── AI Models Section (Draggable Grid) ─── */}
                <motion.section
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                >
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-3.5 rounded-full bg-indigo-400/50" />
                        <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
                            AI Modeller
                        </h2>
                        <span className="text-[9px] text-white/20 ml-auto">sürükle &amp; bırak</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                        {modelOrder.map((id) => {
                            const site = aiSites[id]
                            if (!site) return null
                            return (
                                <GridCard
                                    key={id}
                                    itemId={id}
                                    site={site}
                                    isActive={activeModelIds.has(id)}
                                    isDragging={modelDrag.dragItemRef.current === id}
                                    onDragStart={() => modelDrag.handleDragStart(id)}
                                    onDragOver={(e) => modelDrag.handleDragOver(e, id)}
                                    onDrop={modelDrag.handleDrop}
                                    onDragEnd={modelDrag.handleDragEnd}
                                    onClick={() => onOpenModel(id)}
                                />
                            )
                        })}
                    </div>
                </motion.section>

                {/* ─── Sites Section (Draggable Grid) ─── */}
                <>
                    <div className="relative">
                        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
                    </div>

                    <motion.section
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-1 h-3.5 rounded-full bg-amber-400/50" />
                            <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
                                Siteler
                            </h2>
                            <Globe className="w-3 h-3 text-white/20 ml-1" />
                            {siteOrder.length > 0 && (
                                <span className="text-[9px] text-white/20 ml-auto">sürükle &amp; bırak</span>
                            )}
                        </div>

                        {siteOrder.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2.5">
                                {siteOrder.map((id) => {
                                    const site = aiSites[id]
                                    if (!site) return null
                                    return (
                                        <GridCard
                                            key={id}
                                            itemId={id}
                                            site={site}
                                            isActive={activeModelIds.has(id)}
                                            isSite
                                            isDragging={siteDrag.dragItemRef.current === id}
                                            onDragStart={() => siteDrag.handleDragStart(id)}
                                            onDragOver={(e) => siteDrag.handleDragOver(e, id)}
                                            onDrop={siteDrag.handleDrop}
                                            onDragEnd={siteDrag.handleDragEnd}
                                            onClick={() => onOpenModel(id)}
                                        />
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 rounded-2xl border border-dashed border-white/[0.07]"
                                style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.02), transparent)' }}
                            >
                                <Globe className="w-7 h-7 text-white/10 mb-2.5" />
                                <p className="text-[11px] text-white/25 font-medium">Henüz site eklenmedi</p>
                                <p className="text-[9px] text-white/15 mt-1">Ayarlar → Siteler kısmından ekleyebilirsiniz</p>
                            </div>
                        )}
                    </motion.section>
                </>

            </div>
        </div>
    )
}

export default memo(AiHomePage)
