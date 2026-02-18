import { useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen } from 'lucide-react'
import { Virtuoso } from 'react-virtuoso'

import { QuizSettings } from '@features/quiz/api'
import { QuizState } from '../types'
import { useQuizStats } from '../hooks/useQuizStats'
import { QuizQuestionReview } from './QuizQuestionReview'

import { ScoreCard } from './results/ScoreCard'
import { ActionButtons } from './results/ActionButtons'

interface QuizResultsProps {
    quizState: QuizState;
    settings: QuizSettings;
    onRestart: () => void;
    onRegenerate: () => void;
    onRetryMistakes: () => void;
    t: (key: string) => string;
}

function QuizResults({ quizState, settings, onRestart, onRegenerate, onRetryMistakes, t }: QuizResultsProps) {
    const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null)

    // Calculate stats
    const stats = useQuizStats(quizState)

    // Has incorrect or unanswered questions for retry
    const hasIncorrectOrEmpty = stats.wrong > 0 || stats.empty > 0

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full flex flex-col gpu-layer"
        >
            <Virtuoso
                style={{ height: '100%' }}
                totalCount={quizState.questions.length + 1}
                itemContent={(index) => {
                    // Index 0 is the Header (Score Card + Actions)
                    if (index === 0) {
                        return (
                            <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6 pb-0">
                                {/* Score Card */}
                                <ScoreCard
                                    stats={stats}
                                    settings={settings}
                                    t={t}
                                />

                                {/* Action Buttons */}
                                <ActionButtons
                                    onRestart={onRestart}
                                    onRegenerate={onRegenerate}
                                    onRetryMistakes={onRetryMistakes}
                                    hasIncorrectOrEmpty={hasIncorrectOrEmpty}
                                    t={t}
                                />

                                {/* Questions Review Header */}
                                <h3 className="text-lg font-bold text-white flex items-center gap-2 pt-2">
                                    <BookOpen className="w-5 h-5 text-amber-400 gpu-layer" />
                                    {t('quiz_review')}
                                </h3>
                            </div>
                        )
                    }

                    // Questions (Index > 0)
                    const q = quizState.questions[index - 1]
                    return (
                        <div className="max-w-4xl mx-auto px-4 md:px-6 pb-3">
                            <QuizQuestionReview
                                key={q.id}
                                question={q}
                                index={index - 1}
                                userAnswer={quizState.userAnswers[q.id]}
                                isExpanded={expandedQuestion === q.id}
                                onToggle={() => setExpandedQuestion(expandedQuestion === q.id ? null : q.id)}
                                t={t}
                            />
                        </div>
                    )
                }}
            />
        </motion.div >
    )
}

export default QuizResults


