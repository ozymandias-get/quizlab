import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { RadioGroup, Radio, Label } from '@headlessui/react'
import { useLanguage } from '@src/app/providers'
import { LanguageIcon } from '@src/components/ui/Icons'

/**
 * Dil seçimi sekmesi bileşeni - Premium Redesign
 */
const LanguageTab = React.memo(() => {
    const { t, language, setLanguage, languages } = useLanguage()

    const languageList = useMemo(() => Object.values(languages), [languages])

    return (
        <div className="space-y-6">
            {/* Header */}
            <header className="px-1 mb-2">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 text-violet-400 border border-violet-500/20">
                        <LanguageIcon className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em]">
                            {t('interface_language')}
                        </p>
                        <h4 className="text-sm font-bold text-white/90 tracking-wide">
                            {t('select_language')}
                        </h4>
                    </div>
                </div>
            </header>

            {/* Açıklama */}
            <div className="px-1">
                <p className="text-xs text-white/40 leading-relaxed">
                    {t('language_description')}
                </p>
            </div>

            {/* Dil Listesi */}
            <RadioGroup value={language} onChange={setLanguage} className="grid grid-cols-1 gap-3">
                {languageList.map((lang, index) => {
                    return (
                        <Radio
                            key={lang.code}
                            value={lang.code}
                            as={motion.div}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={({ checked }) => `
                                group relative flex items-center gap-4 p-4 rounded-[20px] cursor-pointer transition-all duration-300 border
                                ${checked
                                    ? 'bg-white/[0.06] border-white/[0.12] shadow-lg'
                                    : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.08]'
                                }
                            `}
                        >
                            {({ checked }) => (
                                <>
                                    {/* Flag with status indicator */}
                                    <div className="relative">
                                        <div className={`
                                            w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border transition-all duration-300
                                            ${checked
                                                ? 'bg-gradient-to-br from-white/[0.1] to-white/[0.05] border-white/20 shadow-lg'
                                                : 'bg-white/[0.02] border-white/[0.06] grayscale opacity-50'
                                            }
                                        `}>
                                            {lang.flag}
                                        </div>
                                        {checked && (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0a0a0a] shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                                            />
                                        )}
                                    </div>

                                    {/* Language info */}
                                    <div className="flex-1 space-y-0.5">
                                        <Label className={`font-bold text-sm transition-colors duration-300 block ${checked ? 'text-white' : 'text-white/50 group-hover:text-white/70'}`}>
                                            {lang.nativeName}
                                        </Label>
                                        <span className={`text-[10px] uppercase tracking-widest font-bold block transition-colors duration-300 ${checked ? 'text-white/40' : 'text-white/20'}`}>
                                            {lang.name}
                                        </span>
                                    </div>

                                    {/* Selection Indicator */}
                                    <div className={`
                                        w-5 h-5 rounded-full border-2 transition-all duration-300 flex items-center justify-center
                                        ${checked ? 'border-emerald-500 bg-emerald-500/20' : 'border-white/10 bg-white/[0.02]'}
                                    `}>
                                        {checked && (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="w-2 h-2 rounded-full bg-emerald-500"
                                            />
                                        )}
                                    </div>
                                </>
                            )}
                        </Radio>
                    )
                })}
            </RadioGroup>

            {/* Footer */}
            <div className="px-1 pt-4 border-t border-white/[0.04]">
                <p className="text-[10px] text-white/20 uppercase tracking-widest">
                    {t('current_language')}: {languages[language]?.nativeName || language}
                </p>
            </div>
        </div>
    )
})

LanguageTab.displayName = 'LanguageTab'

export default LanguageTab

