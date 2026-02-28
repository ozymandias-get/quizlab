
import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Brain } from 'lucide-react'
import { QuizSettings, getModelConfigs } from '@features/quiz/api'

interface AIModelSelectorProps {
    settings: QuizSettings;
    setSettings: React.Dispatch<React.SetStateAction<QuizSettings>>;
    t: (key: string) => string;
}

export const AIModelSelector: React.FC<AIModelSelectorProps> = ({ settings, setSettings, t }) => {
    // Memoize models to avoid re-calculation on every render
    const models = useMemo(() => getModelConfigs(t), [t])

    return (
        <div className="quiz-glass-card p-5">
            <label className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4 block flex items-center gap-2">
                <Brain className="w-3.5 h-3.5" />
                {t('quiz_ai_model')}
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {models.map((m) => {
                    const IconComp = m.icon
                    const isSelected = settings.model === m.type
                    return (
                        <motion.button
                            key={m.type}
                            onClick={() => setSettings(s => ({ ...s, model: m.type }))}
                            whileHover={{ scale: 1.03, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            className={`quiz-model-btn ${isSelected ? 'selected' : ''}`}
                        >
                            <div className={`p-2 rounded-lg transition-all ${isSelected
                                ? `bg-gradient-to-br ${m.color} shadow-lg`
                                : 'bg-white/10'}`}>
                                <IconComp className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-white/50'}`} />
                            </div>
                            <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-white/60'}`}>{m.label}</span>
                            <span className={`text-[10px] ${isSelected ? 'text-amber-400/80' : 'text-white/30'}`}>{m.desc}</span>
                        </motion.button>
                    )
                })}
            </div>
        </div>
    )
}

