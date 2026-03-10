/**
 * Shared Types - Single Source of Truth
 * These types are used by both electron (backend) and src (frontend)
 *
 * Each domain has its own file for maintainability.
 * Import from '@shared-core/types' as before — this barrel re-exports everything.
 */

// Automation & Selector types
export type {
  SubmitMode,
  SelectorHealth,
  AutomationHostDescriptor,
  AutomationElementFingerprint,
  AiSelectorConfig,
  AutomationConfig,
  AutomationLookupStrategy,
  AutomationSelectorDiagnostics,
  AutomationExecutionDiagnostics,
  AutomationExecutionResult
} from './automation'

// AI Platform & Registry types
export type {
  AiPlatformMeta,
  AiPlatform,
  EnhancedAiPlatform,
  AiRegistry,
  InactivePlatforms,
  AiRegistryResponse,
  CustomAiInput,
  CustomAiResult
} from './ai'

// PDF types
export type { PdfSelectOptions, PdfSelection, PdfStreamResult, PdfFile } from './pdf'

// System & Update types
export type { UpdateCheckResult, ScreenshotType } from './system'

// Quiz types
export type {
  DifficultyType,
  ModelTypeEnum,
  QuestionStyleEnum,
  QuizSettings,
  QuizGenerateResult,
  QuizCliPathResult,
  QuizAuthResult,
  QuizActionResult
} from './quiz'

// Gemini Web Session types
export type {
  GeminiWebSessionState,
  GeminiWebSessionReasonCode,
  GeminiWebSessionStatus,
  GeminiWebSessionConfig,
  GeminiWebSessionActionResult
} from './gemini-web'
