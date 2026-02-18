
import React from 'react'
import { motion } from 'framer-motion'
import { QuestionStyleEnum, QuestionStyle, STYLE_ICONS, QuizSettings } from '@features/quiz/api'

interface StyleSelectorProps {
    settings: QuizSettings;
    setSettings: React.Dispatch<React.SetStateAction<QuizSettings>>;
    t: (key: string) => string;
}

export const StyleSelector: React.FC<StyleSelectorProps> = ({ settings, setSettings, t }) => {
    return (
        <div className="quiz-glass-card p-5">
            <label className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4 block flex items-center gap-2">
                <STYLE_ICONS.MIXED className="w-3.5 h-3.5" />
                {t('quiz_style')}
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {(Object.values(QuestionStyle) as QuestionStyleEnum[]).map((style) => {
                    const isSelected = settings.style.includes(style)
                    const IconComp = STYLE_ICONS[style] || STYLE_ICONS[QuestionStyle.CLASSIC]
                    const styleKey = `style_${style.toLowerCase()}`

                    return (
                        <motion.button
                            key={style}
                            onClick={() => {
                                setSettings(s => {
                                    // If clicking MIXED, set only MIXED
                                    if (style === QuestionStyle.MIXED) {
                                        return { ...s, style: [QuestionStyle.MIXED] as QuestionStyleEnum[] }
                                    }

                                    // For other styles, remove MIXED first
                                    let newStyles: QuestionStyleEnum[] = s.style.filter(x => x !== QuestionStyle.MIXED)

                                    if (isSelected) {
                                        // Deselecting this style
                                        newStyles = newStyles.filter(x => x !== style)
                                        // If no styles left, fall back to MIXED
                                        if (newStyles.length === 0) {
                                            newStyles = [QuestionStyle.MIXED] as QuestionStyleEnum[]
                                        }
                                    } else {
                                        // Selecting this style
                                        newStyles = [...newStyles, style]
                                    }
                                    return { ...s, style: newStyles }
                                })
                            }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`quiz-option-btn ${isSelected ? 'selected' : ''}`}
                        >
                            <IconComp className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-400' : 'text-white/40'}`} />
                            <span className={`text-xs font-bold truncate ${isSelected ? 'text-amber-300' : 'text-white/50'}`}>
                                {t(styleKey)}
                            </span>
                        </motion.button>
                    )
                })}
            </div>
        </div>
    )
}

