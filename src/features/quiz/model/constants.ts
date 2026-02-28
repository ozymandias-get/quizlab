import { QuizState, QuizSettings } from './types'

export const Difficulty = {
    EASY: 'EASY',
    MEDIUM: 'MEDIUM',
    HARD: 'HARD'
} as const

export const ModelType = {
    FLASH_2_5: 'gemini-2.5-flash',
    LITE_2_5: 'gemini-2.5-flash-lite',
    FLASH_3_0: 'gemini-3-flash-preview',
    PRO_3_0: 'gemini-3-pro-preview',
    FLASH_2_0: 'gemini-2.0-flash',
    FLASH_1_5: 'gemini-1.5-flash',
    PRO_1_5: 'gemini-1.5-pro'
} as const

export const QuestionStyle = {
    CLASSIC: 'CLASSIC',
    NEGATIVE: 'NEGATIVE',
    STATEMENT: 'STATEMENT',
    ORDERING: 'ORDERING',
    FILL_BLANK: 'FILL_BLANK',
    REASONING: 'REASONING',
    MATCHING: 'MATCHING',
    MIXED: 'MIXED'
} as const

export const DEFAULT_SETTINGS: QuizSettings = {
    questionCount: 10,
    difficulty: 'MEDIUM',
    model: 'gemini-2.5-flash',
    style: ['MIXED'],
    focusTopic: ''
}

export const INITIAL_QUIZ_STATE: QuizState = {
    questions: [],
    userAnswers: {},
    currentQuestionIndex: 0,
    score: 0,
    isFinished: false,
    startTime: null,
    endTime: null
}


