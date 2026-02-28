
import React from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, CheckCircle, Eraser } from 'lucide-react'

interface QuizNavigationProps {
    isFirst: boolean;
    isLast: boolean;
    navigateQuestion: (dir: number) => void;
    onFinish: () => void;
    selectedAnswer?: number;
    handleAnswerToggle: (idx: number) => void;
    t: (key: string) => string;
}

export const QuizNavigation: React.FC<QuizNavigationProps> = ({
    isFirst,
    isLast,
    navigateQuestion,
    onFinish,
    selectedAnswer,
    handleAnswerToggle,
    t
}) => {
    return (
        <div className="quiz-nav-bar">
            {/* Previous */}
            <motion.button
                onClick={() => navigateQuestion(-1)}
                disabled={isFirst}
                whileHover={!isFirst ? { scale: 1.02 } : {}}
                whileTap={!isFirst ? { scale: 0.98 } : {}}
                className="quiz-nav-btn"
            >
                <ChevronLeft className="w-5 h-5" />
                <span className="hidden sm:inline">{t('quiz_back')}</span>
            </motion.button>

            {/* Clear Selection */}
            <motion.button
                onClick={() => selectedAnswer !== undefined && handleAnswerToggle(selectedAnswer)}
                disabled={selectedAnswer === undefined}
                whileHover={selectedAnswer !== undefined ? { scale: 1.02 } : {}}
                whileTap={selectedAnswer !== undefined ? { scale: 0.98 } : {}}
                className="quiz-clear-btn"
            >
                <Eraser className="w-4 h-4" />
                <span className="hidden sm:inline">{t('quiz_clear')}</span>
            </motion.button>

            {/* Next / Finish */}
            <motion.button
                onClick={() => isLast ? onFinish() : navigateQuestion(1)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={isLast ? 'quiz-finish-btn' : 'quiz-next-btn'}
            >
                <span>{isLast ? t('quiz_finish') : t('quiz_next')}</span>
                {isLast ? <CheckCircle className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </motion.button>
        </div>
    )
}
