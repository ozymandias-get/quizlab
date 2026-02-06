/**
 * @deprecated This file is kept for backward compatibility.
 * Please import from '@src/features/quiz/api' instead.
 */
import {
    Difficulty,
    ModelType,
    QuestionStyle,
    DEFAULT_SETTINGS,
    isQuizApiAvailable,
    getQuizSettings,
    saveQuizSettings,
    generateQuizQuestions,
    askQuestionAssistant,
    type Question,
    type QuizSettings
} from '@src/features/quiz/api'

// Shared types re-export
import type { DifficultyType, ModelTypeEnum, QuestionStyleEnum } from '@shared/types'

export type { DifficultyType, ModelTypeEnum, QuestionStyleEnum, Question, QuizSettings }

export {
    Difficulty,
    ModelType,
    QuestionStyle,
    DEFAULT_SETTINGS,
    isQuizApiAvailable,
    getQuizSettings,
    saveQuizSettings,
    generateQuizQuestions,
    askQuestionAssistant
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

