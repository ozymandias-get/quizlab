/**
 * QuizResults - Quiz Results View
 * Shows score, correct/wrong answers, and detailed explanations
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Trophy, RotateCcw, RefreshCw, AlertCircle,
    CheckCircle, XCircle, ChevronDown, BookOpen,
    Clock, TrendingUp
} from 'lucide-react'
import { formatQuizText } from '@src/utils/uiUtils'
import { QuizSettings } from '@src/features/quiz/api'
import { QuizState } from '../types'
import { useQuizStats } from '../hooks/useQuizStats'
import ConfettiCanvas from '@src/components/ui/ConfettiCanvas'

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

    // Grade based on score
    const getGradeInfo = () => {
        if (stats.percentage >= 90) return { text: t('quiz_grade_perfect'), colorClass: 'emerald' }
        if (stats.percentage >= 70) return { text: t('quiz_grade_good'), colorClass: 'green' }
        if (stats.percentage >= 50) return { text: t('quiz_grade_average'), colorClass: 'amber' }
        return { text: t('quiz_grade_poor'), colorClass: 'red' }
    }

    const grade = getGradeInfo()

    // Has incorrect or unanswered questions for retry
    const hasIncorrectOrEmpty = stats.wrong > 0 || stats.empty > 0

    const [displayScore, setDisplayScore] = useState(0)

    // Count Up Animation
    useEffect(() => {
        let start = 0
        const end = stats.percentage
        if (start === end) return

        const duration = 1500
        const startTime = performance.now()

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime
            const progress = Math.min(elapsed / duration, 1)
            const easeOutQuart = 1 - Math.pow(1 - progress, 4) // Easing function

            const current = Math.floor(easeOutQuart * (end - start) + start)
            setDisplayScore(current)

            if (progress < 1) {
                requestAnimationFrame(animate)
            }
        }
        requestAnimationFrame(animate)
    }, [stats.percentage])





    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full overflow-y-auto p-4 md:p-6 gpu-layer"
        >
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Score Card */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 p-6 md:p-8 gpu-layer"
                >
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-full blur-3xl gpu-layer" />

                    <div className="relative flex flex-col md:flex-row items-center gap-6">
                        {/* Score Circle */}
                        <div className="relative w-32 h-32">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    cx="64"
                                    cy="64"
                                    r="56"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    className="text-white/10"
                                />
                                <motion.circle
                                    cx="64"
                                    cy="64"
                                    r="56"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    strokeLinecap="round"
                                    className="text-amber-400"
                                    initial={{ strokeDasharray: '0 352' }}
                                    animate={{ strokeDasharray: `${(stats.percentage / 100) * 352} 352` }}
                                    transition={{ duration: 1.5, ease: 'easeOut' }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <motion.span
                                    className="text-3xl font-bold text-white"
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    {displayScore}%
                                </motion.span>
                            </div>
                        </div>

                        {/* Confetti Canvas (Only if good score) */}
                        <ConfettiCanvas
                            isActive={stats.percentage >= 70}
                            className="absolute inset-0"
                        />

                        {/* Grade Info */}
                        <div className="flex-1 text-center md:text-left">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 text-amber-400 text-sm font-bold mb-2">
                                <Trophy className="w-4 h-4" />
                                {grade.text}
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-1">
                                {stats.correct} / {stats.total} {t('quiz_correct_label')}
                            </h2>
                            <p className="text-white/50 text-sm">
                                {t(`difficulty_${settings?.difficulty?.toLowerCase()}`)} {t('quiz_completed_at')}
                            </p>
                        </div>

                        {/* Stats Grid */}
                        <div className={`grid gap-3 md:gap-4 ${stats.empty > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                            <div className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
                                <CheckCircle className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                                <span className="text-lg font-bold text-white block">{stats.correct}</span>
                                <span className="text-xs text-white/40">{t('quiz_correct_label')}</span>
                            </div>
                            <div className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
                                <XCircle className="w-5 h-5 text-red-400 mx-auto mb-1" />
                                <span className="text-lg font-bold text-white block">{stats.wrong}</span>
                                <span className="text-xs text-white/40">{t('quiz_wrong_label')}</span>
                            </div>
                            {stats.empty > 0 && (
                                <div className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
                                    <AlertCircle className="w-5 h-5 text-stone-400 mx-auto mb-1" />
                                    <span className="text-lg font-bold text-white block">{stats.empty}</span>
                                    <span className="text-xs text-white/40">{t('quiz_empty_label')}</span>
                                </div>
                            )}
                            <div className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
                                <Clock className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                                <span className="text-lg font-bold text-white block">{stats.timeStr}</span>
                                <span className="text-xs text-white/40">{t('quiz_duration')}</span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                        onClick={onRestart}
                        className="py-4 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all"
                    >
                        <RotateCcw className="w-5 h-5" />
                        {t('quiz_restart')}
                    </button>

                    <button
                        onClick={onRegenerate}
                        className="py-4 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all"
                    >
                        <RefreshCw className="w-5 h-5" />
                        {t('quiz_regenerate')}
                    </button>

                    {hasIncorrectOrEmpty && (
                        <button
                            onClick={onRetryMistakes}
                            className="py-4 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20 hover:scale-[1.02] transition-all"
                        >
                            <TrendingUp className="w-5 h-5" />
                            {t('quiz_retry_mistakes')}
                        </button>
                    )}
                </div>

                {/* Questions Review */}
                <div className="space-y-3">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-amber-400 gpu-layer" />
                        {t('quiz_review')}
                    </h3>

                    {quizState.questions.map((q, idx) => {
                        const userAnswer = quizState.userAnswers[q.id]
                        const isAnswered = userAnswer !== undefined
                        const isCorrect = isAnswered && userAnswer === q.correctAnswerIndex
                        const isEmpty = !isAnswered
                        const isExpanded = expandedQuestion === q.id

                        return (
                            <motion.div
                                key={q.id}
                                layout
                                className={`rounded-2xl border overflow-hidden ${isCorrect
                                    ? 'bg-emerald-500/10 border-emerald-500/20 gpu-layer'
                                    : isEmpty
                                        ? 'bg-stone-500/10 border-stone-500/20 gpu-layer'
                                        : 'bg-red-500/10 border-red-500/20 gpu-layer'
                                    }`}
                            >
                                {/* Question Header */}
                                <button
                                    onClick={() => {
                                        setExpandedQuestion(isExpanded ? null : q.id)
                                    }}
                                    className="w-full p-4 flex items-start gap-3 text-left hover:bg-white/5 transition-colors"
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
                                    <ChevronDown className={`w-4 h-4 text-white/40 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''
                                        }`} />
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
                                                                <span className={`font-bold shrink-0 ${isCorrectAnswer ? 'text-emerald-400' : isUserChoice ? 'text-red-400' : 'text-white/40'
                                                                    }`}>
                                                                    {String.fromCharCode(65 + optIdx)}.
                                                                </span>
                                                                <span
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
                    })}
                </div>
            </div>
        </motion.div>
    )
}

export default QuizResults

