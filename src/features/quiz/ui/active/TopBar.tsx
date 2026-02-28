
import React from 'react'
import { motion } from 'framer-motion'
import { Clock, CheckCircle } from 'lucide-react'

interface TopBarProps {
    questionNumber: number;
    total: number;
    progress: number;
    answeredCount: number;
    elapsedTime: string;
    t: (key: string) => string;
}

export const TopBar: React.FC<TopBarProps> = ({
    questionNumber,
    total,
    progress,
    answeredCount,
    elapsedTime,
    t
}) => {
    return (
        <motion.div
            className="quiz-topbar"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
        >
            <div className="flex items-center gap-4">
                {/* Question Counter */}
                <div className="quiz-counter-badge">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
                        {questionNumber}
                    </span>
                    <span className="text-white/30 mx-1.5">/</span>
                    <span className="text-white/60">{total}</span>
                </div>

                {/* Progress bar */}
                <div className="hidden sm:block quiz-progress-track">
                    <motion.div
                        className="quiz-progress-bar"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                    />
                </div>

                {/* Answered indicator */}
                <div className="hidden md:flex items-center gap-1.5 text-xs text-white/40">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{answeredCount} {t('quiz_answered')}</span>
                </div>
            </div>

            {/* Timer */}
            <div className="quiz-timer">
                <Clock className="w-4 h-4" />
                <span className="font-mono">{elapsedTime}</span>
            </div>
        </motion.div>
    )
}
