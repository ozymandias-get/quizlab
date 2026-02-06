import { memo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, FileText } from 'lucide-react'
import { useLanguage } from '@src/app/providers/LanguageContext'

interface PdfSearchBarProps {
    isOpen: boolean;
    onToggle: () => void;
    keyword: string;
    onKeywordChange: (value: string) => void;
    onSearch: () => void;
    onClear: () => void;
    fileName?: string;
}

/**
 * PDF search bar component
 * Redesigned with Premium Glass Morphism
 */
function PdfSearchBar({
    isOpen,
    onToggle,
    keyword,
    onKeywordChange,
    onSearch,
    onClear,
    fileName
}: PdfSearchBarProps) {
    const { t } = useLanguage()
    const inputRef = useRef<HTMLInputElement>(null)

    // Focus input when open
    useEffect(() => {
        if (isOpen) {
            const timeout = setTimeout(() => inputRef.current?.focus(), 100)
            return () => clearTimeout(timeout)
        }
    }, [isOpen])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && keyword.trim()) {
            onSearch()
        } else if (e.key === 'Escape') {
            onClear()
        }
    }

    return (
        <div className="relative flex items-center justify-center w-full h-full">
            <AnimatePresence mode="wait">
                {isOpen ? (
                    <motion.div
                        key="search"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute inset-0 flex items-center gap-2 w-full"
                    >
                        <div className="relative flex-1 group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 group-focus-within:text-amber-400 transition-colors" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={keyword}
                                onChange={(e) => onKeywordChange(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={t('search_placeholder')}
                                className="w-full pl-9 pr-3 py-2 text-xs bg-black/40 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 focus:bg-black/60 focus:ring-1 focus:ring-amber-500/20 transition-all shadow-inner"
                                autoFocus
                            />
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="p-2 rounded-xl text-white/50 hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
                            onClick={() => keyword.trim() && onSearch()}
                            title={t('search')}
                        >
                            <Search className="w-4 h-4" />
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="p-2 rounded-xl text-white/50 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                            onClick={onClear}
                            title={t('close')}
                        >
                            <X className="w-4 h-4" />
                        </motion.button>
                    </motion.div>
                ) : (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={onToggle}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-2xl w-full max-w-[380px] min-w-0 cursor-pointer group
                                   bg-gradient-to-br from-white/[0.06] via-white/[0.03] to-transparent
                                   border border-white/[0.06]
                                   shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]
                                   hover:border-white/[0.12] hover:from-white/[0.08]
                                   transition-all duration-300"
                    >
                        {/* File Icon Box */}
                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl
                                        bg-gradient-to-br from-amber-500/15 to-amber-600/5
                                        border border-amber-500/15
                                        group-hover:border-amber-500/25
                                        transition-all duration-300">
                            <FileText className="w-4 h-4 text-amber-400 group-hover:text-amber-300 transition-colors duration-300" />
                        </div>

                        {/* Text Content */}
                        <div className="flex flex-col justify-center min-w-0 flex-1 text-left">
                            <span className="text-[9px] uppercase tracking-[0.15em] font-semibold text-white/25 leading-none mb-0.5 group-hover:text-white/40 transition-colors duration-300 truncate">
                                {t('reading_now') === 'reading_now' ? 'READING' : t('reading_now')}
                            </span>
                            <span className="text-xs font-medium text-white/70 truncate leading-tight group-hover:text-white/90 transition-colors duration-300 block w-full">
                                {fileName || 'PDF Document'}
                            </span>
                        </div>

                        {/* Divider */}
                        <div className="flex-shrink-0 w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

                        {/* Search Action */}
                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl
                                        hover:bg-white/[0.06]
                                        transition-all duration-300">
                            <Search className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors duration-300" />
                        </div>
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    )
}

export default memo(PdfSearchBar)

