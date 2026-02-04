/**
 * AI Automation Script Generator
 * Generates safe JavaScript code for webview execution
 */
export interface AutomationConfig {
    input?: string | null;
    button?: string | null;
    waitFor?: string | null;
    submitMode?: 'click' | 'enter_key' | 'mixed' | string;
    [key: string]: unknown;
}
export declare const generateFocusScript: (config: AutomationConfig) => string;
export declare const generateAutoSendScript: (config: AutomationConfig, text: string, shouldSubmit?: boolean) => string;
export declare const generateClickSendScript: (config: AutomationConfig) => string;
