import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useQuizStats } from '@features/quiz/hooks/useQuizStats'
import { QuizState } from '@features/quiz/types'

describe('useQuizStats', () => {
    it('returns empty stats for empty state', () => {
        const emptyState: QuizState = {
            questions: [],
            userAnswers: {},
            score: 0,
            isFinished: false,
            currentQuestionIndex: 0,
            startTime: null,
            endTime: null
        }

        const { result } = renderHook(() => useQuizStats(emptyState))

        expect(result.current).toEqual({
            total: 0,
            correct: 0,
            wrong: 0,
            empty: 0,
            percentage: 0,
            timeStr: '--:--'
        })
    })

    it('calculates correct, wrong, empty correctly', () => {
        const questions = [
            { id: '1', correctAnswerIndex: 0 },
            { id: '2', correctAnswerIndex: 1 },
            { id: '3', correctAnswerIndex: 2 }
        ] as any

        const state: QuizState = {
            questions,
            userAnswers: {
                '1': 0, // Correct
                '2': 2, // Wrong
                // '3' is empty
            },
            score: 1, // 1 Correct
            isFinished: true,
            currentQuestionIndex: 2,
            startTime: 1000,
            endTime: 2500 // 1.5s duration
        }

        const { result } = renderHook(() => useQuizStats(state))

        expect(result.current.total).toBe(3)
        expect(result.current.correct).toBe(1)
        expect(result.current.wrong).toBe(1) // Question 2 was wrong
        expect(result.current.empty).toBe(1) // Question 3 unanswered
        expect(result.current.percentage).toBe(33) // 1/3 ~ 33%
        expect(result.current.timeStr).toBe('00:01') // 1s (floor(1.5))
    })

    it('handles perfect score', () => {
        const questions = [{ id: '1', correctAnswerIndex: 0 }] as any
        const state: QuizState = {
            questions,
            userAnswers: { '1': 0 },
            score: 1,
            isFinished: true,
            currentQuestionIndex: 0,
            startTime: null,
            endTime: null
        }

        const { result } = renderHook(() => useQuizStats(state))
        expect(result.current.percentage).toBe(100)
    })
})
