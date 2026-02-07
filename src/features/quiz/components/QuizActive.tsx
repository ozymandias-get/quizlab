/**
 * QuizActive - Active Quiz View
 * Premium Glass Morphism Design
 */
import React, { useMemo, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, CheckCircle, Eraser, Clock, Sparkles } from 'lucide-react'
import { formatQuizText } from '@src/utils/uiUtils'
import { Question } from '@src/features/quiz/api'

// Types (QuizState is local/module specific)
interface QuizState {
    questions: Question[];
    userAnswers: Record<string, number>;
    currentQuestionIndex: number;
    score: number;
    isFinished: boolean;
    startTime: number | null;
    endTime: number | null;
}

interface QuizActiveProps {
    quizState: QuizState;
    setQuizState: React.Dispatch<React.SetStateAction<QuizState>>;
    slideDirection: number;
    setSlideDirection: (dir: number) => void;
    onFinish: () => void;
    t: (key: string) => string;
}

// Slide animation variants
const slideVariants = {
    enter: (direction: number) => ({
        x: direction > 0 ? 60 : -60,
        opacity: 0,
        scale: 0.98
    }),
    center: {
        zIndex: 1,
        x: 0,
        opacity: 1,
        scale: 1
    },
    exit: (direction: number) => ({
        zIndex: 0,
        x: direction < 0 ? 60 : -60,
        opacity: 0,
        scale: 0.98
    })
}

function isTypingElement(element: Element | null): boolean {
    if (!(element instanceof HTMLElement)) return false
    const tag = element.tagName.toLowerCase()
    return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable
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

    // Live timer - based on Date.now() diff for accuracy
    const [elapsedTime, setElapsedTime] = useState('00:00')

    useEffect(() => {
        if (!startTime) {
            setElapsedTime('00:00')
            return
        }

        const updateElapsedTime = () => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000)
            const mins = Math.floor(elapsed / 60).toString().padStart(2, '0')
            const secs = (elapsed % 60).toString().padStart(2, '0')
            setElapsedTime(`${mins}:${secs}`)
        }

        updateElapsedTime()
        const interval = setInterval(() => {
            updateElapsedTime()
        }, 1000)

        return () => clearInterval(interval)
    }, [startTime])

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
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.defaultPrevented) return
            if (e.altKey || e.ctrlKey || e.metaKey) return
            if (e.repeat) return
            if (isTypingElement(document.activeElement)) return

            if (e.key === 'ArrowRight') {
                if (isLast) return // Optional: could trigger finish on Enter but let's stick to arrows for nav
                e.preventDefault()
                navigateQuestion(1)
            } else if (e.key === 'ArrowLeft') {
                if (isFirst) return
                e.preventDefault()
                navigateQuestion(-1)
            }
        }
        
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [navigateQuestion, isLast, isFirst])

    // Calculate progress
    const progress = totalQuestions > 0 ? ((currentQuestionIndex + 1) / totalQuestions) * 100 : 0
    const optionHtmlList = formattedContent.options
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
                        <span className="text-white/60">{questions.length}</span>
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

            {/* Question Card */}
            <div className="flex-1 relative min-h-0 overflow-hidden">
                <AnimatePresence mode="wait" custom={slideDirection}>
                    <motion.div
                        key={currentQ.id}
                        custom={slideDirection}
                        variants={slideVariants}
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

                        {/* Question Text & Options */}
                        <div className="flex-1 overflow-y-auto p-6 md:p-8">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="quiz-question-text"
                                dangerouslySetInnerHTML={{ __html: formattedContent.text }}
                            />

                            {/* Options */}
                            <div className="space-y-3 mt-6">
                                {optionHtmlList.map((optionHtml, idx) => {
                                    const isSelected = selectedAnswer === idx
                                    return (
                                        <motion.button
                                            key={idx}
                                            onClick={() => handleAnswerToggle(idx)}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.15 + idx * 0.05 }}
                                            whileHover={{ scale: 1.01, x: 4 }}
                                            whileTap={{ scale: 0.99 }}
                                            className={`quiz-answer-option ${isSelected ? 'selected' : ''}`}
                                        >
                                            {/* Option Letter */}
                                            <span className={`quiz-option-letter ${isSelected ? 'selected' : ''}`}>
                                                {String.fromCharCode(65 + idx)}
                                            </span>

                                            {/* Option Text */}
                                            <div
                                                className={`text-sm md:text-base leading-relaxed pt-0.5 flex-1 ${isSelected ? 'text-white font-medium' : 'text-white/70'}`}
                                                dangerouslySetInnerHTML={{ __html: optionHtml }}
                                            />

                                            {/* Selected indicator */}
                                            {isSelected && (
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="ml-2"
                                                >
                                                    <CheckCircle className="w-5 h-5 text-amber-400" />
                                                </motion.div>
                                            )}
                                        </motion.button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Navigation */}
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
                    </motion.div>
                </AnimatePresence>
            </div>
        </motion.div>
    )
}

export default QuizActive

