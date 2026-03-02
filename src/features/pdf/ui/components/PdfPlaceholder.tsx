import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUpDown, FileText, Play, Search } from 'lucide-react'
import { useLanguage, useToast } from '@app/providers'
import type { LastReadingInfo, ResumePdfResult } from '@features/pdf/hooks/usePdfSelection'
import { Button } from '@ui/components/button'

interface PdfPlaceholderProps {
    onSelectPdf: () => void;
    onResumePdf?: (path?: string) => Promise<ResumePdfResult> | ResumePdfResult;
    onClearResumePdf?: (path?: string) => void;
    onRestoreResumePdf?: (info: LastReadingInfo, index?: number) => void;
    lastReadingInfo?: LastReadingInfo[] | null;
}

type SortMode = 'recent' | 'name'
type RecentItemView = LastReadingInfo & { originalIndex: number }

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000

const formatRelativeTime = (timestamp: number, language: string): string => {
    const locale = language === 'en' ? 'en-US' : 'tr-TR'
    const diffMs = timestamp - Date.now()
    const absMs = Math.abs(diffMs)
    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

    if (absMs < hour) return rtf.format(Math.round(diffMs / minute), 'minute')
    if (absMs < day) return rtf.format(Math.round(diffMs / hour), 'hour')
    if (absMs < WEEK_IN_MS) return rtf.format(Math.round(diffMs / day), 'day')
    return rtf.format(Math.round(diffMs / WEEK_IN_MS), 'week')
}

const getProgressRatio = (page: number, totalPages: number): number => {
    if (!totalPages || totalPages <= 0) return 0.08
    const ratio = page / totalPages
    return Math.max(0.08, Math.min(ratio, 1))
}

/**
 * PDF yuklu olmadiginda gosterilen placeholder bileseni.
 * Son okunan PDF'ler icin "Kaldigin Yerden Devam Et" listesi sunar.
 */
function PdfPlaceholder({
    onSelectPdf,
    onResumePdf,
    onClearResumePdf,
    onRestoreResumePdf,
    lastReadingInfo
}: PdfPlaceholderProps) {
    const { t, language } = useLanguage()
    const { addToast } = useToast()
    const [searchQuery, setSearchQuery] = useState('')
    const [sortMode, setSortMode] = useState<SortMode>('recent')
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
    const [invalidPaths, setInvalidPaths] = useState<Set<string>>(new Set())

    const recentItems = useMemo(() => lastReadingInfo ?? [], [lastReadingInfo])

    useEffect(() => {
        setInvalidPaths((prev) => {
            const next = new Set<string>()
            const validPaths = new Set(recentItems.map((item) => item.path))
            prev.forEach((path) => {
                if (validPaths.has(path)) next.add(path)
            })
            return next
        })
    }, [recentItems])

    const processedItems = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        const baseItems: RecentItemView[] = recentItems.map((item, originalIndex) => ({
            ...item,
            originalIndex
        }))

        const filtered = query.length > 0
            ? baseItems.filter((item) => item.name.toLowerCase().includes(query))
            : baseItems

        return filtered.sort((a, b) => {
            if (sortMode === 'name') {
                return a.name.localeCompare(b.name, language)
            }

            const aTs = a.lastOpenedAt || 0
            const bTs = b.lastOpenedAt || 0
            if (aTs === bTs) return a.originalIndex - b.originalIndex
            return bTs - aTs
        })
    }, [recentItems, searchQuery, sortMode, language])

    const groupedItems = useMemo(() => {
        const hasTimestamp = processedItems.some((item) => typeof item.lastOpenedAt === 'number' && item.lastOpenedAt > 0)
        if (!hasTimestamp) {
            return [{ id: 'all', labelKey: null as string | null, items: processedItems }]
        }

        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const todayStartMs = todayStart.getTime()
        const weekStartMs = todayStartMs - WEEK_IN_MS

        const today: RecentItemView[] = []
        const week: RecentItemView[] = []
        const older: RecentItemView[] = []

        processedItems.forEach((item) => {
            const ts = item.lastOpenedAt || 0
            if (ts >= todayStartMs) {
                today.push(item)
            } else if (ts >= weekStartMs) {
                week.push(item)
            } else {
                older.push(item)
            }
        })

        return [
            { id: 'today', labelKey: 'recent_group_today', items: today },
            { id: 'week', labelKey: 'recent_group_week', items: week },
            { id: 'older', labelKey: 'recent_group_older', items: older }
        ].filter((group) => group.items.length > 0)
    }, [processedItems])

    const handleResume = useCallback(async (item: RecentItemView) => {
        if (!onResumePdf) return
        const result = await onResumePdf(item.path)

        setInvalidPaths((prev) => {
            const next = new Set(prev)
            if (result === 'not_found') next.add(item.path)
            if (result === 'success') next.delete(item.path)
            return next
        })
    }, [onResumePdf])

    const handleRemove = useCallback((item: RecentItemView) => {
        if (!onClearResumePdf) return

        onClearResumePdf(item.path)
        setInvalidPaths((prev) => {
            const next = new Set(prev)
            next.delete(item.path)
            return next
        })

        addToast({
            type: 'info',
            message: 'recent_entry_removed',
            params: { fileName: item.name },
            duration: 7000,
            ...(onRestoreResumePdf
                ? {
                    actionLabel: 'undo',
                    onAction: () => onRestoreResumePdf(item, item.originalIndex)
                }
                : {})
        })
    }, [addToast, onClearResumePdf, onRestoreResumePdf])

    const handleClearAll = useCallback(() => {
        if (!onClearResumePdf) return
        onClearResumePdf()
        setInvalidPaths(new Set<string>())
        addToast({ type: 'info', message: 'recent_list_cleared' })
    }, [addToast, onClearResumePdf])

    const shouldShowAdvancedControls = recentItems.length > 6
    const shouldEnableScroll = processedItems.length > 8

    return (
        <div className="h-full flex flex-col items-center justify-center gap-6 p-10 text-center bg-transparent animate-in fade-in zoom-in duration-700">
            <div className="w-28 h-28 rounded-3xl bg-white/5 backdrop-blur-xl border-2 border-dashed border-white/10 flex items-center justify-center text-stone-500 transition-all duration-300 hover:border-amber-500/50 hover:text-amber-500/70 hover:bg-white/10 hover:shadow-2xl hover:shadow-amber-500/10">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                        d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M14 2V8H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                        strokeLinejoin="round" />
                    <path d="M9 13H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M9 17H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            </div>

            <div className="space-y-3">
                <h2 className="font-display text-2xl font-semibold text-stone-200">{t('no_pdf_loaded')}</h2>
                <p className="text-stone-500 text-sm max-w-[200px]">{t('drop_pdf_here')}</p>
            </div>

            <Button
                type="button"
                onClick={onSelectPdf}
                className="flex items-center gap-3 px-7 py-3.5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-stone-950 font-semibold hover:from-amber-400 hover:to-orange-400 shadow-[0_8px_28px_rgba(245,158,11,0.35)]"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                        d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M17 8L12 3L7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                        strokeLinejoin="round" />
                    <path d="M12 3V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{t('select_pdf')}</span>
            </Button>

            <div className="w-full max-w-[680px] flex flex-col gap-2 relative">
                <div className="flex items-start justify-between gap-3 px-1">
                    <div className="min-w-0 text-left">
                        <h3 className="text-sm font-semibold text-stone-200">{t('resume_reading')}</h3>
                        <p className="mt-0.5 text-[11px] text-stone-500">
                            {t('resume_reading_desc')}
                        </p>
                    </div>
                    {recentItems.length > 0 && onClearResumePdf && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleClearAll}
                            className="h-8 px-2.5 rounded-lg text-[11px] text-stone-300/80 hover:text-stone-100 hover:bg-white/10 border border-white/10"
                            aria-label={t('clear_recent')}
                        >
                            {t('clear_recent')}
                        </Button>
                    )}
                </div>

                {shouldShowAdvancedControls && recentItems.length > 0 && (
                    <div className="flex items-center justify-between gap-2 px-1">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setIsMobileSearchOpen((prev) => !prev)}
                                className="sm:hidden h-8 w-8 rounded-lg border border-white/10 bg-white/5 text-stone-300 hover:text-stone-100 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                                aria-label={t('search_recent')}
                            >
                                <Search className="w-4 h-4 mx-auto" />
                            </button>

                            <label
                                className={`${isMobileSearchOpen ? 'flex' : 'hidden'} sm:flex items-center gap-2 h-8 px-2 rounded-lg border border-white/10 bg-white/5`}
                            >
                                <Search className="w-3.5 h-3.5 text-stone-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder={t('search_recent_placeholder')}
                                    className="w-36 sm:w-44 bg-transparent text-xs text-stone-200 placeholder:text-stone-500 focus:outline-none"
                                    aria-label={t('search_recent')}
                                />
                            </label>
                        </div>

                        <label className="relative flex items-center">
                            <ArrowUpDown className="absolute left-2 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
                            <select
                                value={sortMode}
                                onChange={(event) => setSortMode(event.target.value as SortMode)}
                                className="h-8 pl-7 pr-7 rounded-lg border border-white/10 bg-white/5 text-xs text-stone-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 appearance-none"
                                aria-label={t('sort_recent_list')}
                            >
                                <option value="recent">{t('sort_recent')}</option>
                                <option value="name">{t('sort_name')}</option>
                            </select>
                        </label>
                    </div>
                )}

                {recentItems.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-4 text-left">
                        <div className="text-sm font-semibold text-stone-300">{t('resume_empty_title')}</div>
                        <p className="mt-1 text-xs text-stone-500">{t('resume_empty_desc')}</p>
                    </div>
                )}

                {recentItems.length > 0 && processedItems.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-4 text-left text-xs text-stone-400">
                        {t('search_no_results')}
                    </div>
                )}

                {processedItems.length > 0 && onResumePdf && (
                    <div className={`${shouldEnableScroll ? 'max-h-[380px] overflow-y-auto custom-scrollbar pr-1' : ''} space-y-2`}>
                        {groupedItems.map((group) => (
                            <div key={group.id} className="space-y-2">
                                {group.labelKey && (
                                    <div className="px-1 text-[10px] uppercase tracking-[0.08em] text-stone-500">
                                        {t(group.labelKey)}
                                    </div>
                                )}

                                {group.items.map((item) => {
                                    const pageMeta = `${t('page')} ${item.page}${item.totalPages ? ` / ${item.totalPages}` : ''}`
                                    const progress = getProgressRatio(item.page, item.totalPages)
                                    const openedMeta = item.lastOpenedAt
                                        ? formatRelativeTime(item.lastOpenedAt, language)
                                        : t('last_opened_unknown')
                                    const isInvalid = invalidPaths.has(item.path)

                                    return (
                                        <div
                                            key={item.path}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => void handleResume(item)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault()
                                                    void handleResume(item)
                                                }
                                                if (event.key === 'Delete') {
                                                    event.preventDefault()
                                                    event.stopPropagation()
                                                    handleRemove(item)
                                                }
                                            }}
                                            aria-label={`${t('continue_reading')}: ${item.name}`}
                                            className={`
                                                group w-full text-left rounded-2xl border px-3 py-2.5
                                                backdrop-blur-md shadow-[0_8px_20px_rgba(0,0,0,0.2)]
                                                transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80
                                                ${isInvalid
            ? 'bg-red-500/[0.07] border-red-500/30 text-stone-300/80'
            : 'bg-white/[0.05] border-white/10 text-stone-200 hover:bg-white/[0.09] hover:border-amber-500/30 hover:shadow-[0_10px_24px_rgba(245,158,11,0.08)]'}
                                            `}
                                            title={item.name}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="relative w-11 h-11 rounded-xl border border-white/10 overflow-hidden flex-shrink-0 bg-black/10">
                                                    <div className="absolute inset-0 bg-gradient-to-br from-amber-400/25 via-orange-400/10 to-sky-300/20" />
                                                    <FileText className="relative z-10 w-5 h-5 m-3 text-amber-300/80" />
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-[15px] font-semibold">{item.name}</div>
                                                    <div className={`mt-0.5 flex flex-wrap items-center gap-1 text-[11px] ${isInvalid ? 'text-red-200/80' : 'text-stone-400'}`}>
                                                        <span>{t('resume_last_page')}: {pageMeta}</span>
                                                        <span aria-hidden>&middot;</span>
                                                        <span>{t('last_opened')}: {openedMeta}</span>
                                                    </div>
                                                    <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${isInvalid ? 'bg-red-300/40' : 'bg-amber-300/45'}`}
                                                            style={{ width: `${Math.round(progress * 100)}%` }}
                                                        />
                                                    </div>
                                                    {isInvalid && (
                                                        <div className="mt-1.5 text-[11px] text-red-200/80">
                                                            {t('recent_invalid_hint')}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            void handleResume(item)
                                                        }}
                                                        className="h-8 px-2.5 rounded-lg border border-white/10 bg-white/5 text-stone-200 hover:bg-amber-500/20 hover:text-amber-100 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity"
                                                        aria-label={t('continue_reading')}
                                                    >
                                                        <Play className="w-3.5 h-3.5" />
                                                        <span className="hidden sm:inline text-xs">{t('continue_reading_short')}</span>
                                                    </Button>

                                                    {onClearResumePdf && (
                                                        <button
                                                            type="button"
                                                            className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 text-stone-400 hover:text-red-200 hover:bg-red-500/20 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/80"
                                                            onClick={(event) => {
                                                                event.stopPropagation()
                                                                handleRemove(item)
                                                            }}
                                                            aria-label={t('remove_from_history')}
                                                            title={t('remove_from_history')}
                                                        >
                                                            <svg className="w-4 h-4 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M3 6h18" />
                                                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                )}
                </div>
        </div>
    )
}

export default memo(PdfPlaceholder)
