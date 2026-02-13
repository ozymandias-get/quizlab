/**
 * Shared Types - Single Source of Truth
 * These types are used by both electron (backend) and src (frontend)
 */

// ============================================
// AI & Automation Types
// ============================================

export type SubmitMode = 'click' | 'enter_key' | 'mixed' | string

export type AiSelectorConfig = {
    input?: string | null;
    button?: string | null;
    waitFor?: string | null;
    submitMode?: SubmitMode;
    [key: string]: unknown;
}

export type AutomationConfig = {
    input?: string | null;
    button?: string | null;
    waitFor?: string | null;
    submitMode?: SubmitMode;
    [key: string]: unknown;
}

export type AiPlatformMeta = {
    displayName?: string;
    submitMode?: SubmitMode;
    domainRegex?: string;
    imageWaitTime?: number;
}

export type AiPlatform = {
    id: string;
    name: string;
    url: string;
    partition?: string;
    icon?: string;
    color?: string;
    displayName?: string;
    submitMode?: SubmitMode;
    domainRegex?: string;
    imageWaitTime?: number;
    input?: string | null;
    button?: string | null;
    waitFor?: string | null;
    selectors?: {
        input?: string | null;
        button?: string | null;
        waitFor?: string | null;
    };
    meta?: AiPlatformMeta;
    isCustom?: boolean;
    [key: string]: unknown;
}

export type EnhancedAiPlatform = AiPlatform & {
    displayName?: string;
    submitMode?: SubmitMode;
    domainRegex?: string;
    imageWaitTime?: number;
    input?: string | null;
    button?: string | null;
    waitFor?: string | null;
}

export type AiRegistry = Record<string, EnhancedAiPlatform>
export type InactivePlatforms = Record<string, AiPlatform>

export type AiRegistryResponse = {
    aiRegistry: Record<string, AiPlatform>;
    defaultAiId: string;
    allAiIds: string[];
    chromeUserAgent: string;
}

export type CustomAiInput = { name: string; url: string }
export type CustomAiResult = { success: boolean; id?: string; platform?: AiPlatform; error?: string }

// ============================================
// PDF Types
// ============================================

export type PdfSelectOptions = { filterName?: string }
export type PdfSelection = { path: string; name: string; size: number; streamUrl: string }
export type PdfStreamResult = { streamUrl: string }

export type PdfFile = {
    path?: string | null;
    name?: string;
    streamUrl?: string | null;
    size?: number | null;
}

// ============================================
// System & Update Types
// ============================================

export type UpdateCheckResult = { available: boolean; version?: string; releaseName?: string; releaseNotes?: string; cached?: boolean; error?: string }
export type ScreenshotType = 'full-page' | 'crop' | string

// ============================================
// Quiz Types
// ============================================

export type DifficultyType = 'EASY' | 'MEDIUM' | 'HARD'
export type ModelTypeEnum =
    | 'gemini-2.5-flash'
    | 'gemini-2.5-flash-lite'
    | 'gemini-3-flash-preview'
    | 'gemini-3-pro-preview'
    | 'gemini-2.0-flash'
    | 'gemini-1.5-flash'
    | 'gemini-1.5-pro'
export type QuestionStyleEnum = 'CLASSIC' | 'NEGATIVE' | 'STATEMENT' | 'ORDERING' | 'FILL_BLANK' | 'REASONING' | 'MATCHING' | 'MIXED'

export type QuizSettings = { questionCount: number; difficulty: DifficultyType; model: string; style: QuestionStyleEnum[]; focusTopic: string; cliPath?: string }
export type QuizGenerateResult =
    | { success: true; data: unknown[]; count?: number }
    | { success: false; error: string }
export type QuizCliPathResult = { path: string; exists: boolean }
export type QuizAuthResult = { authenticated: boolean; account?: string | null }
export type QuizActionResult = { success: boolean; error?: string }
