
import React from 'react'
import { motion } from 'framer-motion'
import { Difficulty, QuizSettings, DifficultyType } from '@features/quiz/api'
import { cn } from '@shared/lib/uiUtils'
import { buttonBaseClass } from '@ui/components/button'

interface DifficultySelectorProps {
    settings: QuizSettings;
    setSettings: React.Dispatch<React.SetStateAction<QuizSettings>>;
    t: (key: string) => string;
}

export const DifficultySelector: React.FC<DifficultySelectorProps> = ({ settings, setSettings, t }) => {
    return (
        <div className="quiz-glass-card glass-surface glass-surface--card p-5">
            <label className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4 block">
                {t('quiz_difficulty')}
            </label>
            <div className="quiz-difficulty-track">
                {(Object.values(Difficulty) as DifficultyType[]).map((diff) => (
                    <motion.button
                        key={diff}
                        type="button"
                        onClick={() => setSettings(s => ({ ...s, difficulty: diff }))}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                            buttonBaseClass,
                            'quiz-difficulty-btn',
                            settings.difficulty === diff ? 'selected text-white' : 'text-white/40 hover:text-white/60'
                        )}
                    >
                        {t(`difficulty_${diff.toLowerCase()}`)}
                    </motion.button>
                ))}
            </div>
        </div>
    )
}

