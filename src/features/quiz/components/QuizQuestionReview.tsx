
import { motion, AnimatePresence } from 'framer-motion'
import {
    CheckCircle, XCircle, AlertCircle, ChevronDown
} from 'lucide-react'
import { formatQuizText } from '@src/utils/uiUtils'
import { Question } from '../types'

interface QuizQuestionReviewProps {
    question: Question;
    index: number;
    userAnswer?: number;
    isExpanded: boolean;
    onToggle: () => void;
    t: (key: string) => string;
}

export function QuizQuestionReview({
    question: q,
    index: idx,
    userAnswer,
    isExpanded,
    onToggle,
    t
}: QuizQuestionReviewProps) {
    const isAnswered = userAnswer !== undefined
    const isCorrect = isAnswered && userAnswer === q.correctAnswerIndex
    const isEmpty = !isAnswered

    return (
        <motion.div
            layout
            className={`rounded-2xl border overflow-hidden ${isCorrect
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : isEmpty
                    ? 'bg-stone-500/10 border-stone-500/20'
                    : 'bg-red-500/10 border-red-500/20'
                }`}
        >
            {/* Question Header */}
            <button
                onClick={onToggle}
                className="w-full p-4 flex items-start gap-3 text-left hover:bg-white/5 transition-colors"
                aria-expanded={isExpanded}
            >
                <div className={`p-2 rounded-xl shrink-0 ${isCorrect
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : isEmpty
                        ? 'bg-stone-500/20 text-stone-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                    {isCorrect ? <CheckCircle className="w-4 h-4" /> : isEmpty ? <AlertCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                    <div
                        className="text-sm font-medium text-white/80 line-clamp-2"
                        dangerouslySetInnerHTML={{ __html: `${idx + 1}. ${formatQuizText(q.text)}` }}
                    />
                </div>
                <ChevronDown className={`w-4 h-4 text-white/40 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>

            {/* Expanded Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 space-y-3">
                            {/* Options */}
                            <div className="space-y-2">
                                {q.options.map((opt, optIdx) => {
                                    const isUserChoice = userAnswer === optIdx
                                    const isCorrectAnswer = q.correctAnswerIndex === optIdx

                                    return (
                                        <div
                                            key={optIdx}
                                            className={`p-3 rounded-xl text-sm flex items-start gap-2 ${isCorrectAnswer
                                                ? 'bg-emerald-500/20 border border-emerald-500/30'
                                                : isUserChoice
                                                    ? 'bg-red-500/20 border border-red-500/30'
                                                    : 'bg-white/5 border border-white/10'
                                                }`}
                                        >
                                            <span className={`font-bold shrink-0 ${isCorrectAnswer ? 'text-emerald-400' : isUserChoice ? 'text-red-400' : 'text-white/40'}`}>
                                                {String.fromCharCode(65 + optIdx)}.
                                            </span>
                                            <div
                                                className={isCorrectAnswer ? 'text-emerald-300' : isUserChoice ? 'text-red-300' : 'text-white/60'}
                                                dangerouslySetInnerHTML={{ __html: formatQuizText(opt) }}
                                            />
                                            {isCorrectAnswer && (
                                                <CheckCircle className="w-4 h-4 text-emerald-400 ml-auto shrink-0" />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Explanation */}
                            {q.explanation && (
                                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                    <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">{t('quiz_explanation')}</p>
                                    <div
                                        className="text-sm text-white/70 leading-relaxed"
                                        dangerouslySetInnerHTML={{ __html: formatQuizText(q.explanation) }}
                                    />
                                </div>
                            )}

                            {/* Source Quote */}
                            {q.sourceQuote && (
                                <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
                                    <p className="text-xs text-amber-400 italic">"{q.sourceQuote}"</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
