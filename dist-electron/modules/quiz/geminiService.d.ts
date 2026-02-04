interface ExecuteGeminiOptions {
    model?: string;
    timeout?: number;
    workingDir?: string | null;
    outputFilePath: string;
    responseType?: 'json-array' | 'json-object' | 'text';
}
type QuizItem = Record<string, unknown>;
type AssistantResponse = {
    answer: string;
    suggestions?: string[];
};
type CliResult = QuizItem[] | AssistantResponse | unknown;
declare function getGeminiCliPath(): string;
/**
 * Find the actual CLI path by checking multiple locations
 * @returns {Promise<string|null>} - Path to CLI if found, null otherwise
 */
declare function findGeminiCliPath(): Promise<string | null>;
/**
 * Generate a unique output file path for quiz results
 * @param {string} workingDir - Directory where the file will be created
 * @returns {string} - Full path to the output file
 */
declare function generateOutputFilePath(workingDir: string): string;
/**
 * Execute Gemini CLI with prompt
 * CLI will write the result to a JSON file instead of stdout
 * @param {string} prompt - The prompt to send (should include file output instruction)
 * @param {Object} options - CLI options
 * @param {string} options.outputFilePath - Path where CLI should write the JSON output
 * @returns {Promise<Object>} - Parsed JSON response
 */
declare function executeGeminiCli(prompt: string, options: ExecuteGeminiOptions): Promise<CliResult>;
export { getGeminiCliPath, findGeminiCliPath, executeGeminiCli, generateOutputFilePath };
