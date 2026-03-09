import type { AutomationExecutionDiagnostics } from '@shared-core/types'

export interface AiSendStageTimings {
    queueWaitMs: number;
    configResolveMs: number;
    scriptGenerationMs?: number;
    executeJavaScriptMs?: number;
    clipboardMs?: number;
    focusScriptGenerationMs?: number;
    focusExecuteJavaScriptMs?: number;
    pasteMs?: number;
    promptScriptGenerationMs?: number;
    promptExecuteJavaScriptMs?: number;
    postPastePromptDelayMs?: number;
    imageUploadWaitMs?: number;
    clickScriptGenerationMs?: number;
    clickExecuteJavaScriptMs?: number;
    totalMs: number;
}

export interface AiSendDiagnostics {
    pipeline: 'text' | 'image';
    tabId?: string;
    currentAI: string;
    currentUrl?: string;
    autoSend: boolean;
    timings: AiSendStageTimings;
    script?: AutomationExecutionDiagnostics | null;
    focusScript?: AutomationExecutionDiagnostics | null;
    promptScript?: AutomationExecutionDiagnostics | null;
    clickScript?: AutomationExecutionDiagnostics | null;
}

export interface SendTextResult {
    success: boolean;
    error?: string;
    mode?: string;
    actualUrl?: string;
    diagnostics?: AiSendDiagnostics;
}

export interface SendImageResult {
    success: boolean;
    error?: string;
    mode?: string;
    actualUrl?: string;
    diagnostics?: AiSendDiagnostics;
}

export interface AiSendOptions {
    autoSend?: boolean;
    promptText?: string;
}

export type AiSendResult = SendTextResult | SendImageResult
