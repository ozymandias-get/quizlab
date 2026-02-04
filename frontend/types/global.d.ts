import type { WebviewElement } from './webview'

export type SubmitMode = 'click' | 'enter_key' | 'mixed' | string

export type AiSelectorConfig = {
    input?: string | null;
    button?: string | null;
    waitFor?: string | null;
    submitMode?: SubmitMode;
    [key: string]: unknown;
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
    meta?: {
        displayName?: string;
        submitMode?: SubmitMode;
        domainRegex?: string;
        imageWaitTime?: number;
    };
    isCustom?: boolean;
    [key: string]: unknown;
}

export type AiRegistryResponse = {
    aiRegistry: Record<string, AiPlatform>;
    defaultAiId: string;
    allAiIds: string[];
    chromeUserAgent: string;
}

export type PdfSelectOptions = { filterName?: string }
export type PdfSelection = { path: string; name: string; size: number; streamUrl: string }
export type PdfStreamResult = { streamUrl: string }

export type UpdateCheckResult = { available: boolean; version?: string; releaseName?: string; releaseNotes?: string; cached?: boolean; error?: string }

export type CustomAiInput = { name: string; url: string }
export type CustomAiResult = { success: boolean; id?: string; platform?: AiPlatform; error?: string }

export type DifficultyType = 'EASY' | 'MEDIUM' | 'HARD'
export type ModelTypeEnum = 'gemini-2.5-flash' | 'gemini-2.5-flash-lite' | 'gemini-3-flash-preview' | 'gemini-3-pro-preview'
export type QuestionStyleEnum = 'CLASSIC' | 'NEGATIVE' | 'STATEMENT' | 'ORDERING' | 'FILL_BLANK' | 'REASONING' | 'MATCHING' | 'MIXED'

export type QuizSettings = { questionCount: number; difficulty: DifficultyType; model: ModelTypeEnum; style: QuestionStyleEnum[]; focusTopic: string; cliPath?: string }
export type QuizGenerateResult =
    | { success: true; data: unknown[]; count?: number }
    | { success: false; error: string }
export type QuizCliPathResult = { path: string; exists: boolean }
export type QuizAuthResult = { authenticated: boolean; account?: string | null }
export type QuizActionResult = { success: boolean; error?: string }

export type ScreenshotType = 'full-page' | 'crop' | string

declare global {
    interface Window {
        electronAPI: {
            // AI & Automation
            getAiRegistry: (forceRefresh?: boolean) => Promise<AiRegistryResponse>;
            isAuthDomain: (url: string) => Promise<boolean>;
            automation: {
                generateFocusScript: (config: AiSelectorConfig) => Promise<string | null>;
                generateClickSendScript: (config: AiSelectorConfig) => Promise<string | null>;
                generateAutoSendScript: (config: AiSelectorConfig, text: string, submit: boolean) => Promise<string | null>;
                generatePickerScript: (translations: Record<string, string>) => Promise<string | null>;
            };

            // PDF
            selectPdf: (options: PdfSelectOptions) => Promise<PdfSelection | null>;
            getPdfStreamUrl: (filePath: string) => Promise<PdfStreamResult | null>;
            registerPdfPath: (filePath: string) => Promise<PdfSelection | null>;

            // Utilities
            captureScreen: (rect?: { x: number; y: number; width: number; height: number }) => Promise<string | null>;
            copyImageToClipboard: (dataUrl: string) => Promise<boolean>;
            openExternal: (url: string) => Promise<boolean>;
            forcePaste: (webContentsId: number) => Promise<boolean>;
            showPdfContextMenu: (labels: Partial<Record<string, string>>) => void;

            // Events
            onTriggerScreenshot: (callback: (type: ScreenshotType) => void) => () => void;

            // Meta
            platform: string;

            // Updater
            checkForUpdates: () => Promise<UpdateCheckResult>;
            openReleasesPage: () => Promise<void>;
            getAppVersion: () => Promise<string>;
            clearCache: () => Promise<boolean>;

            // AI Config
            saveAiConfig: (hostname: string, config: AiSelectorConfig) => Promise<boolean>;
            getAiConfig: (hostname?: string) => Promise<AiSelectorConfig | Record<string, AiSelectorConfig> | null>;
            deleteAiConfig: (hostname: string) => Promise<boolean>;
            deleteAllAiConfigs: () => Promise<boolean>;
            addCustomAi: (data: CustomAiInput) => Promise<CustomAiResult>;
            deleteCustomAi: (id: string) => Promise<boolean>;

            // Quiz Generation API
            quiz: {
                generate: (params: Record<string, unknown>) => Promise<QuizGenerateResult>;
                getSettings: () => Promise<QuizSettings>;
                saveSettings: (settings: Partial<QuizSettings>) => Promise<boolean>;
                getCliPath: () => Promise<QuizCliPathResult>;
                openLogin: () => Promise<QuizActionResult>;
                checkAuth: () => Promise<QuizAuthResult>;
                logout: () => Promise<QuizActionResult>;
                askAssistant: (question: string, context?: string) => Promise<{ success: boolean; data?: { answer: string; suggestions?: string[] }; error?: string }>;
            };
        };
    }

    // Electron Webview element type declaration for JSX
    namespace JSX {
        interface IntrinsicElements {
            webview: React.DetailedHTMLProps<
                React.HTMLAttributes<WebviewElement> & {
                    src?: string;
                    partition?: string;
                    allowpopups?: boolean | string;
                    webpreferences?: string;
                    useragent?: string;
                    preload?: string;
                    httpreferrer?: string;
                    disablewebsecurity?: string;
                    nodeintegration?: string;
                    plugins?: string;
                },
                WebviewElement
            >;
        }
    }
}
