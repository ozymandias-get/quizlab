import { Logger } from '@src/utils/logger'
import type {
    DifficultyType,
    ModelTypeEnum,
    QuestionStyleEnum
} from '@shared/types'

import { MOCK_DEMO_QUESTIONS } from '../data/demo'
import type { Question, QuizSettings } from '../types'
import { Difficulty, ModelType, QuestionStyle, DEFAULT_SETTINGS, STYLE_ICONS, getModelConfigs, INITIAL_QUIZ_STATE } from '../constants'

// Re-export shared types
// We recreate the constants objects to maintain compatibility with existing frontend logic
// that uses Difficulty.EASY etc.

// Re-export types for consumers
export type { DifficultyType, ModelTypeEnum, QuestionStyleEnum, Question, QuizSettings }

// Re-export constants
export { Difficulty, ModelType, QuestionStyle, DEFAULT_SETTINGS, STYLE_ICONS, getModelConfigs, INITIAL_QUIZ_STATE }

/**
 * Check if Quiz API is available
 */
export function isQuizApiAvailable(): boolean {
    return !!(window.electronAPI?.quiz)
}

/**
 * Get quiz generation settings
 */
export async function getQuizSettings(): Promise<QuizSettings> {
    if (!isQuizApiAvailable()) {
        throw new Error('Quiz API not available')
    }
    return await window.electronAPI.quiz.getSettings()
}

/**
 * Save quiz generation settings
 */
export async function saveQuizSettings(settings: QuizSettings): Promise<boolean> {
    if (!isQuizApiAvailable()) {
        throw new Error('Quiz API not available')
    }
    return await window.electronAPI.quiz.saveSettings(settings)
}

/**
 * Generate quiz questions from PDF
 */
export async function generateQuizQuestions(
    pdfPath: string,
    settings: QuizSettings = DEFAULT_SETTINGS,
    language: string = 'tr',
    failedQuestionsContext: Question[] = [],
    previousQuestions: Question[] = []
): Promise<Question[]> {
    if (!isQuizApiAvailable()) {
        throw new Error('Quiz API not available - Are you running in Electron?')
    }

    // Handle demo mode - shorter delay for better UX
    if (pdfPath === 'DEMO') {
        await new Promise(resolve => setTimeout(resolve, 800))
        const demoLang = language === 'en' ? 'en' : 'tr'
        return MOCK_DEMO_QUESTIONS[demoLang] || MOCK_DEMO_QUESTIONS['tr']
    }

    const params: Record<string, unknown> = {
        type: 'quiz',
        pdfPath, // Now sending path, Gemini handles PDF directly
        questionCount: failedQuestionsContext.length > 0
            ? failedQuestionsContext.length
            : (settings.questionCount || 5),
        difficulty: settings.difficulty || 'MEDIUM',
        style: settings.style || ['MIXED'],
        focusTopic: settings.focusTopic || '',
        model: settings.model || DEFAULT_SETTINGS.model,
        language
    }

    // Add context for remedial mode
    if (failedQuestionsContext.length > 0) {
        // Strip HTML tags to ensure clean context for AI
        params.remedialTopics = failedQuestionsContext.map(q =>
            q.text.replace(/<[^>]*>/g, '').substring(0, 100)
        )
    }

    // Add context to avoid duplicate questions
    // Use more characters and more questions for better avoidance
    if (previousQuestions.length > 0) {
        params.avoidTopics = previousQuestions
            .slice(-25) // Last 25 questions
            .map(q => {
                // Strip HTML and take first 100 chars for better identification
                const cleanText = q.text.replace(/<[^>]*>/g, '').trim()
                return cleanText.substring(0, 100)
            })
            .filter(text => text.length > 10) // Filter out empty/short entries
    }

    try {
        const result = await window.electronAPI.quiz.generate(params)

        if (!result.success) {
            throw new Error(result.error || 'Quiz generation failed')
        }

        return result.data as Question[]
    } catch (error) {
        Logger.error('[QuizAPI] Generation error:', error)
        throw error
    }
}


/**
 * Ask question assistant (chat about a question)
 */
export async function askQuestionAssistant(question: Question, _history: unknown[], newMessage: string, _language: string = 'tr'): Promise<string> {
    if (!window.electronAPI?.quiz?.askAssistant) {
        return 'Assistant API not available.'
    }

    try {
        // Construct context from question
        const context = `
        QUESTION TEXT: ${question.text}
        OPTIONS: ${question.options.join(', ')}
        CORRECT ANSWER INDEX: ${question.correctAnswerIndex}
        EXPLANATION: ${question.explanation}
        `

        const result = await window.electronAPI.quiz.askAssistant(newMessage, context)

        if (result.success && result.data?.answer) {
            // result.data.answer is guaranteed by the API contract for success case
            return result.data.answer
        } else {
            return result.error || 'Failed to get answer.'
        }
    } catch (error) {
        Logger.error('Assistant Error:', error)
        return 'Error communicating with assistant.'
    }
}

export default {
    generateQuizQuestions,
    askQuestionAssistant,
    getQuizSettings,
    saveQuizSettings,
    isQuizApiAvailable,
    Difficulty,
    ModelType,
    QuestionStyle,
    DEFAULT_SETTINGS
}
