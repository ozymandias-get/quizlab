/**
 * Quiz Feature API — Types, Constants & Utilities
 *
 * NOTE: This file intentionally does NOT contain any window.electronAPI calls.
 * All async data operations (fetch/mutate) are handled by React Query hooks in:
 *   src/platform/electron/api/useQuizApi.ts
 *   src/platform/electron/api/usePdfApi.ts
 *
 * This file is the single source of truth for:
 *   - Type re-exports from @shared/types
 *   - Frontend constants (Difficulty, ModelType, QuestionStyle, etc.)
 *   - Pure utility functions (no side effects, no API calls)
 */

import type {
    DifficultyType,
    ModelTypeEnum,
    QuestionStyleEnum
} from '@shared/types'

import type { Question, QuizSettings } from '../types'
import { Difficulty, ModelType, QuestionStyle, DEFAULT_SETTINGS, STYLE_ICONS, getModelConfigs, INITIAL_QUIZ_STATE } from '../constants'

// Re-export shared types
export type { DifficultyType, ModelTypeEnum, QuestionStyleEnum, Question, QuizSettings }

// Re-export constants
export { Difficulty, ModelType, QuestionStyle, DEFAULT_SETTINGS, STYLE_ICONS, getModelConfigs, INITIAL_QUIZ_STATE }

export default {
    Difficulty,
    ModelType,
    QuestionStyle,
    DEFAULT_SETTINGS
}
