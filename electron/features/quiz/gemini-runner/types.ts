export const ALLOWED_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-3-flash-preview',
    'gemini-3-pro-preview',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
] as const

export type AllowedModel = typeof ALLOWED_MODELS[number]

export interface ExecuteGeminiOptions {
    model?: string;
    timeout?: number;
    workingDir?: string | null;
    outputFilePath?: string;
    responseType?: 'json-array' | 'json-object' | 'text';
    signal?: AbortSignal;
}

export type QuizItem = Record<string, unknown>
export type AssistantResponse = { answer: string; suggestions?: string[] }
export type CliResult = QuizItem[] | AssistantResponse | unknown

export const MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10 MB - Memory Overflow Protection
export const MAX_PAYLOAD_SIZE = 50000; // 50,000 chars - IPC Limitation
