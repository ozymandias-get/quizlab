
import React from 'react'
import { QuizSettings } from '@features/quiz/api'

interface QuestionCountSliderProps {
    settings: QuizSettings;
    setSettings: React.Dispatch<React.SetStateAction<QuizSettings>>;
    t: (key: string) => string;
}

export const QuestionCountSlider: React.FC<QuestionCountSliderProps> = ({ settings, setSettings, t }) => {
    return (
        <div className="quiz-glass-card p-5">
            <div className="flex justify-between items-center mb-4">
                <label className="text-xs font-bold text-white/50 uppercase tracking-widest">
                    {t('quiz_question_count')}
                </label>
                <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
                    {settings.questionCount}
                </span>
            </div>
            <input
                type="range"
                min="1"
                max="30"
                value={settings.questionCount}
                onChange={(e) => setSettings(s => ({ ...s, questionCount: parseInt(e.target.value) }))}
                className="quiz-range-slider"
            />
            <div className="flex justify-between text-xs text-white/30 mt-2 px-1">
                <span>1</span>
                <span>15</span>
                <span>30</span>
            </div>
        </div>
    )
}

