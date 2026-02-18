import React, { useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { SLIDE_VARIANTS } from '@src/constants/animations'
import { formatQuizText } from '@src/utils/uiUtils'
import { Question, QuizState } from '../types'
import { useQuizTimer } from '../hooks/useQuizTimer'
import { useQuizKeyboard } from '../hooks/useQuizKeyboard'
import { TopBar } from './active/TopBar'
import { QuestionContent } from './active/QuestionContent'
import { QuizNavigation } from './active/QuizNavigation'

interface QuizActiveProps {
    quizState: QuizState;
    setQuizState: React.Dispatch<React.SetStateAction<QuizState>>;
    slideDirection: number;
    setSlideDirection: (dir: number) => void;
    onFinish: () => void;
    t: (key: string) => string;
}

function QuizActive({ quizState, setQuizState, slideDirection, setSlideDirection, onFinish, t }: QuizActiveProps) {
    const { questions, currentQuestionIndex, userAnswers, startTime } = quizState
    const totalQuestions = questions.length
    const questionNumber = currentQuestionIndex + 1
    const currentQ = questions[currentQuestionIndex] as Question | undefined
    const isFirst = currentQuestionIndex === 0
    const isLast = currentQuestionIndex === totalQuestions - 1
    // Use optional chaining for safety before early return
    const selectedAnswer = currentQ ? userAnswers[currentQ.id] : undefined

    // Memoize formatted content to prevent re-calculation on every timer tick
    const formattedContent = useMemo(() => {
        if (!currentQ) return { text: '', options: [] }
        return {
            text: formatQuizText(currentQ.text),
            options: (currentQ.options || []).map(opt => formatQuizText(opt))
        }
    }, [currentQ])

    // Live timer
    const elapsedTime = useQuizTimer(startTime)

    // Handle answer toggle - safe functional update to prevent stale state
    const handleAnswerToggle = useCallback((optionIndex: number) => {
        if (!currentQ) return // Safety check

        setQuizState(prev => {
            const currentAnswer = prev.userAnswers[currentQ.id]
            const newAnswers = { ...prev.userAnswers }

            if (currentAnswer === optionIndex) {
                delete newAnswers[currentQ.id]
            } else {
                newAnswers[currentQ.id] = optionIndex
            }

            return {
                ...prev,
                userAnswers: newAnswers
            }
        })
    }, [currentQ, setQuizState])

    // Navigate questions
    const navigateQuestion = useCallback((direction: number) => {
        const newIndex = currentQuestionIndex + direction
        if (newIndex >= 0 && newIndex < totalQuestions) {
            setSlideDirection(direction)
            setQuizState(prev => ({ ...prev, currentQuestionIndex: newIndex }))
        }
    }, [currentQuestionIndex, totalQuestions, setQuizState, setSlideDirection])

    // Keep index valid when question set changes dynamically
    useEffect(() => {
        if (totalQuestions === 0) {
            if (currentQuestionIndex !== 0) {
                setQuizState(prev => {
                    if (prev.currentQuestionIndex === 0) return prev
                    return { ...prev, currentQuestionIndex: 0 }
                })
            }
            return
        }

        const clampedIndex = Math.min(Math.max(currentQuestionIndex, 0), totalQuestions - 1)
        if (clampedIndex !== currentQuestionIndex) {
            setQuizState(prev => {
                if (prev.currentQuestionIndex === clampedIndex) return prev
                return { ...prev, currentQuestionIndex: clampedIndex }
            })
        }
    }, [currentQuestionIndex, totalQuestions, setQuizState])

    // Keyboard Navigation
    useQuizKeyboard(navigateQuestion, isFirst, isLast)

    // Calculate progress
    const progress = totalQuestions > 0 ? ((currentQuestionIndex + 1) / totalQuestions) * 100 : 0
    const answeredCount = useMemo(() => {
        return questions.reduce((count, q) => {
            return userAnswers[q.id] !== undefined ? count + 1 : count
        }, 0)
    }, [questions, userAnswers])

    // Early return AFTER all hooks are called
    if (!currentQ) return null

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="quiz-active-container"
        >
            {/* Top Bar */}
            <TopBar
                questionNumber={questionNumber}
                total={questions.length}
                progress={progress}
                answeredCount={answeredCount}
                elapsedTime={elapsedTime}
                t={t}
            />

            {/* Question Card */}
            <div className="flex-1 relative min-h-0 overflow-hidden">
                <AnimatePresence mode="wait" custom={slideDirection}>
                    <motion.div
                        key={currentQ.id}
                        custom={slideDirection}
                        variants={SLIDE_VARIANTS}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                            type: 'spring',
                            stiffness: 300,
                            damping: 30
                        }}
                        className="quiz-question-card"
                    >
                        {/* Question Header */}
                        <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-white/5">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10">
                                <Sparkles className="w-4 h-4 text-amber-400" />
                            </div>
                            <span className="text-xs font-bold text-white/40 uppercase tracking-widest">
                                {t('quiz_question')} {questionNumber}
                            </span>
                        </div>

                        {/* Content */}
                        <QuestionContent
                            formattedContent={formattedContent}
                            selectedAnswer={selectedAnswer}
                            handleAnswerToggle={handleAnswerToggle}
                        />

                        {/* Navigation */}
                        <QuizNavigation
                            isFirst={isFirst}
                            isLast={isLast}
                            navigateQuestion={navigateQuestion}
                            onFinish={onFinish}
                            selectedAnswer={selectedAnswer}
                            handleAnswerToggle={handleAnswerToggle}
                            t={t}
                        />
                    </motion.div>
                </AnimatePresence>
            </div>
        </motion.div>
    )
}

export default QuizActive


