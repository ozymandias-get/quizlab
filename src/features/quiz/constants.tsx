
import { QuizState, QuizSettings } from './types'
import {
    CheckSquare, XCircle, ListChecks, ArrowUpDown,
    MoreHorizontal, Lightbulb, ArrowLeftRight, Layers,
    Brain, Zap, Rabbit, LucideIcon
} from 'lucide-react'

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

// --- UI Constants ---

// Style icons mapping
export const STYLE_ICONS: Record<string, LucideIcon> = {
    [QuestionStyle.CLASSIC]: CheckSquare,
    [QuestionStyle.NEGATIVE]: XCircle,
    [QuestionStyle.STATEMENT]: ListChecks,
    [QuestionStyle.ORDERING]: ArrowUpDown,
    [QuestionStyle.FILL_BLANK]: MoreHorizontal,
    [QuestionStyle.REASONING]: Lightbulb,
    [QuestionStyle.MATCHING]: ArrowLeftRight,
    [QuestionStyle.MIXED]: Layers
}

// Model info helper
export const getModelConfigs = (t: (key: string) => string) => [
    { type: ModelType.PRO_3_0, label: t('model_pro_3_0'), icon: Brain, desc: t('quiz_ai_smartest'), color: 'from-purple-400 to-pink-500' },
    { type: ModelType.FLASH_3_0, label: t('model_flash_3_0'), icon: Zap, desc: t('quiz_ai_fastest'), color: 'from-yellow-400 to-orange-500' },
    { type: ModelType.FLASH_2_5, label: t('model_flash_2_5'), icon: Zap, desc: t('quiz_ai_balanced'), color: 'from-cyan-400 to-blue-500' },
    { type: ModelType.LITE_2_5, label: t('model_lite_2_5'), icon: Rabbit, desc: t('quiz_ai_economical'), color: 'from-green-400 to-emerald-500' }
]
