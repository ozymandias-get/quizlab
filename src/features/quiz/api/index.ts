/**
 * Quiz Feature API - Types, Constants & Utilities
 *
 * NOTE: This file intentionally does NOT contain any window.electronAPI calls.
 * All async data operations (fetch/mutate) are handled by React Query hooks in:
 *   src/platform/electron/api/useQuizApi.ts
 *   src/platform/electron/api/usePdfApi.ts
 *
 * This file is the single source of truth for:
 *   - Type re-exports from @shared-core/types
 *   - Frontend constants (Difficulty, ModelType, QuestionStyle, etc.)
 *   - Pure utility functions (no side effects, no API calls)
 */

import type {
    DifficultyType,
    ModelTypeEnum,
    QuestionStyleEnum
} from '@shared-core/types'

import type { Question, QuizSettings } from '../model/types'
import { Difficulty, ModelType, QuestionStyle, DEFAULT_SETTINGS, INITIAL_QUIZ_STATE } from '../model/constants'
import { STYLE_ICONS, getModelConfigs } from '../ui/constants'

// Re-export shared types
export type { DifficultyType, ModelTypeEnum, QuestionStyleEnum, Question, QuizSettings }

// Re-export constants
export { Difficulty, ModelType, QuestionStyle, DEFAULT_SETTINGS, STYLE_ICONS, getModelConfigs, INITIAL_QUIZ_STATE }


