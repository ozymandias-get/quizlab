type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
type Language = 'tr' | 'en';
export interface QuizPromptParams {
    questionCount?: number | string;
    difficulty?: Difficulty | string;
    style?: string[];
    focusTopic?: string;
    language?: Language | string;
    remedialTopics?: string[];
    avoidTopics?: string[];
    [key: string]: unknown;
}
/**
 * Build the quiz generation prompt with PDF reference
 * @param {Object} params - Quiz parameters
 * @param {string} pdfPath - Path to PDF file
 * @param {string} outputFilePath - Path where the JSON output should be written
 * @returns {string} - Formatted prompt
 */
export declare function buildQuizPrompt(params: QuizPromptParams, pdfPath: string, outputFilePath: string): string;
export {};
