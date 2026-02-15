import { useMemo } from 'react'
import { QuizState } from '../types'

export const useQuizStats = (quizState: QuizState) => {
    return useMemo(() => {
        const total = quizState.questions.length
        const correct = quizState.score
        const answeredCount = Object.keys(quizState.userAnswers).length

        // Calculate wrong by checking each answered question
        const wrong = quizState.questions.reduce((acc, q) => {
            const answer = quizState.userAnswers[q.id]
            // Only count as wrong if answered AND incorrect
            if (answer !== undefined && answer !== q.correctAnswerIndex) {
                return acc + 1
            }
            return acc
        }, 0)

        const empty = total - answeredCount
        const percentage = total > 0 ? Math.round((correct / total) * 100) : 0

        // Calculate time
        let timeStr = '--:--'
        if (quizState.startTime && quizState.endTime) {
            const elapsed = Math.floor((quizState.endTime - quizState.startTime) / 1000)
            const mins = Math.floor(elapsed / 60).toString().padStart(2, '0')
            const secs = (elapsed % 60).toString().padStart(2, '0')
            timeStr = `${mins}:${secs}`
        }

        return { total, correct, wrong, empty, percentage, timeStr }
    }, [quizState])
}
