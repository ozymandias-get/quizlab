/**
 * Quiz Types
 */

export type DifficultyType = 'EASY' | 'MEDIUM' | 'HARD'
export type ModelTypeEnum =
  | 'gemini-2.5-flash'
  | 'gemini-2.5-flash-lite'
  | 'gemini-3-flash-preview'
  | 'gemini-3-pro-preview'
  | 'gemini-2.0-flash'
  | 'gemini-1.5-flash'
  | 'gemini-1.5-pro'
export type QuestionStyleEnum =
  | 'CLASSIC'
  | 'NEGATIVE'
  | 'STATEMENT'
  | 'ORDERING'
  | 'FILL_BLANK'
  | 'REASONING'
  | 'MATCHING'
  | 'MIXED'

export type QuizSettings = {
  questionCount: number
  difficulty: DifficultyType
  model: string
  style: QuestionStyleEnum[]
  focusTopic: string
  cliPath?: string
}
export type QuizGenerateResult =
  | { success: true; data: unknown[]; count?: number }
  | { success: false; error: string }
export type QuizCliPathResult = { path: string; exists: boolean }
export type QuizAuthResult = { authenticated: boolean; account?: string | null }
export type QuizActionResult = { success: boolean; error?: string }
