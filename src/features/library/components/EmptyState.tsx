import React from 'react'
import { useLanguage } from '@src/app/providers/LanguageContext'

interface EmptyStateProps {
    onAddPdf: () => void;
    onAddFolder: () => void;
}

/**
 * Empty library state component - Premium Design
 * Modern placeholder shown when no files are present.
 */
const EmptyState: React.FC<EmptyStateProps> = ({ onAddPdf, onAddFolder }) => {
    const { t } = useLanguage()

    return (
        <div className="flex flex-col items-center justify-center h-full py-12 px-6">


            {/* Main Icon Container */}
            <div className="relative mb-6 group">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-rose-500/20 
                                rounded-3xl blur-2xl scale-150 opacity-50 group-hover:opacity-70 transition-opacity duration-500" />

                <div className="relative w-24 h-24 rounded-3xl 
                                bg-white/5 border border-white/10
                                shadow-[0_8px_40px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]
                                backdrop-blur-xl
                                flex items-center justify-center
                                group-hover:border-amber-500/20 group-hover:shadow-[0_8px_48px_rgba(251,191,36,0.15)]
                                transition-all duration-500">

                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/[0.03] via-transparent to-transparent" />

                    <div className="relative">
                        <svg className="w-10 h-10 text-stone-500 group-hover:text-amber-400/80 
                                        transition-colors duration-500 drop-shadow-lg"
                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-3 bg-gradient-to-t from-amber-500/50 to-transparent 
                                        rounded-full opacity-0 group-hover:opacity-100 group-hover:animate-bounce transition-opacity duration-300" />
                    </div>
                </div>

                <div className="absolute -top-2 -right-2 w-3 h-3 rounded-full bg-amber-500/30 blur-sm" />
                <div className="absolute -bottom-1 -left-1 w-2 h-2 rounded-full bg-rose-500/20 blur-sm" />
            </div>

            {/* Content */}
            <div className="relative text-center space-y-3">
                <h3 className="text-base font-bold text-stone-200 tracking-tight">
                    {t('library_empty')}
                </h3>

                <div className="text-sm text-stone-500 max-w-[220px] leading-relaxed mb-6">
                    {t('drop_files_desc')}
                </div>

                {/* Aesthetic Action Buttons */}
                <div className="flex flex-col gap-3 w-full max-w-[200px] mx-auto pt-4">
                    <button
                        onClick={onAddPdf}
                        className="group/btn relative flex items-center justify-center gap-3 px-6 py-3 rounded-2xl
                                 bg-gradient-to-br from-amber-500/10 to-transparent
                                 border border-amber-500/20 hover:border-amber-500/40
                                 hover:bg-amber-500/15 transition-all duration-300 transform hover:-translate-y-0.5"
                    >
                        <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center 
                                      group-hover/btn:bg-amber-500/30 transition-colors">
                            <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </div>
                        <span className="text-sm font-semibold text-stone-200">
                            {t('add_pdf')}
                        </span>
                    </button>

                    <button
                        onClick={onAddFolder}
                        className="group/btn relative flex items-center justify-center gap-3 px-6 py-3 rounded-2xl
                                 bg-gradient-to-br from-white/[0.05] to-transparent
                                 border border-white/[0.1] hover:border-white/[0.2]
                                 hover:bg-white/[0.08] transition-all duration-300 transform hover:-translate-y-0.5"
                    >
                        <div className="w-8 h-8 rounded-xl bg-stone-800 flex items-center justify-center
                                      group-hover/btn:bg-stone-700 transition-colors">
                            <svg className="w-4 h-4 text-stone-400 group-hover/btn:text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z" />
                            </svg>
                        </div>
                        <span className="text-sm font-semibold text-stone-300">
                            {t('new_folder')}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    )
}

export default EmptyState

