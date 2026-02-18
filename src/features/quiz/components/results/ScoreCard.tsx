
import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trophy, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react'
import ConfettiCanvas from '@src/components/ui/ConfettiCanvas'
import { QuizSettings } from '@features/quiz/api'

interface QuizStats {
    total: number;
    correct: number;
    wrong: number;
    empty: number;
    percentage: number;
    timeStr: string;
}

interface ScoreCardProps {
    stats: QuizStats;
    settings: QuizSettings;
    t: (key: string) => string;
}

export const ScoreCard: React.FC<ScoreCardProps> = ({ stats, settings, t }) => {
    const [displayScore, setDisplayScore] = useState(0)

    // Grade based on score (Moved from parent or re-implemented)
    const getGradeInfo = () => {
        if (stats.percentage >= 90) return { text: t('quiz_grade_perfect'), className: 'bg-emerald-500/20 text-emerald-400' }
        if (stats.percentage >= 70) return { text: t('quiz_grade_good'), className: 'bg-green-500/20 text-green-400' }
        if (stats.percentage >= 50) return { text: t('quiz_grade_average'), className: 'bg-amber-500/20 text-amber-400' }
        return { text: t('quiz_grade_poor'), className: 'bg-red-500/20 text-red-400' }
    }
    const grade = getGradeInfo()

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
            const easeOutQuart = 1 - Math.pow(1 - progress, 4)

            const current = Math.floor(easeOutQuart * (end - start) + start)
            setDisplayScore(current)

            if (progress < 1) {
                requestAnimationFrame(animate)
            }
        }
        requestAnimationFrame(animate)
    }, [stats.percentage]) // Dependencies adjusted

    return (
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

                <div className="flex-1 text-center md:text-left">
                    <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold mb-2 ${grade.className}`}>
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
    )
}

