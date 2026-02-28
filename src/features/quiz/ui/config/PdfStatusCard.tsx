
import React from 'react'
import { motion } from 'framer-motion'
import { Upload, Loader2, FileText, Rabbit } from 'lucide-react'

interface PdfStatusCardProps {
    hasPdf: boolean;
    isDemoMode: boolean;
    isLoadingPdf: boolean;
    fileName?: string;
    onLoadPdf: () => void;
    t: (key: string) => string;
}

export const PdfStatusCard: React.FC<PdfStatusCardProps> = ({
    hasPdf,
    isDemoMode,
    isLoadingPdf,
    fileName,
    onLoadPdf,
    t
}) => {
    return (
        <motion.div
            className={`quiz-glass-card p-5 ${hasPdf ? '' : 'quiz-pdf-card empty'}`}
            whileHover={{ scale: 1.01 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
            <div className="flex items-center gap-4">
                <div className={`p-3.5 rounded-2xl transition-all duration-300 ${hasPdf
                    ? 'bg-gradient-to-br from-emerald-500/20 to-green-500/10 text-emerald-400 shadow-lg shadow-emerald-500/10'
                    : isDemoMode
                        ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/10 text-blue-400 shadow-lg shadow-blue-500/10'
                        : 'bg-gradient-to-br from-stone-500/20 to-stone-600/10 text-stone-400'}`}
                >
                    {isLoadingPdf ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : hasPdf ? (
                        <FileText className="w-6 h-6" />
                    ) : isDemoMode ? (
                        <Rabbit className="w-6 h-6" />
                    ) : (
                        <Upload className="w-6 h-6" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${hasPdf ? 'text-emerald-400' : isDemoMode ? 'text-blue-400' : 'text-stone-400'}`}>
                        {isLoadingPdf ? t('quiz_pdf_loading') :
                            hasPdf ? t('quiz_pdf_ready') :
                                isDemoMode ? t('quiz_demo_active') :
                                    t('quiz_pdf_select')}
                    </p>
                    <p className="text-xs text-white/40 truncate mt-0.5">
                        {hasPdf
                            ? `${fileName || t('quiz_pdf_file')} • Gemini AI`
                            : isDemoMode
                                ? t('quiz_demo_desc')
                                : t('quiz_pdf_upload_desc')
                        }
                    </p>
                </div>
                <motion.button
                    onClick={onLoadPdf}
                    disabled={isLoadingPdf}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all duration-300 ${hasPdf || isDemoMode
                        ? 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white hover:border-white/20'
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25'
                        }`}
                >
                    {isLoadingPdf ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Upload className="w-4 h-4" />
                    )}
                    {hasPdf ? t('quiz_pdf_change') : t('quiz_pdf_select')}
                </motion.button>
            </div>
        </motion.div>
    )
}
