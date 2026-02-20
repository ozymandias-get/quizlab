// This file acts as a proxy to the new isolated and modularized Gemini Runner Engine.
// All functionality has been moved to the isolated 'gemini-runner' directory.
export {
    getGeminiCliPath,
    findGeminiCliPath,
    executeGeminiCli,
    generateOutputFilePath,
    ALLOWED_MODELS
} from './gemini-runner'

export type {
    ExecuteGeminiOptions,
    AllowedModel,
    QuizItem,
    AssistantResponse,
    CliResult
} from './gemini-runner'
