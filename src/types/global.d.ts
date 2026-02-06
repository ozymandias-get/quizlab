import type { WebviewElement } from '@shared/types/webview';
import type {
    SubmitMode,
    AiSelectorConfig,
    AiPlatform,
    AiRegistryResponse,
    PdfSelectOptions,
    PdfSelection,
    PdfStreamResult,
    UpdateCheckResult,
    CustomAiInput,
    CustomAiResult,
    DifficultyType,
    ModelTypeEnum,
    QuestionStyleEnum,
    QuizSettings,
    QuizGenerateResult,
    QuizCliPathResult,
    QuizAuthResult,
    QuizActionResult,
    ScreenshotType,
    AutomationConfig,
    PdfFile
} from '@shared/types'

// Re-export types for usage in other files
export type {
    SubmitMode,
    AiSelectorConfig,
    AiPlatform,
    AiRegistryResponse,
    PdfSelectOptions,
    PdfSelection,
    PdfStreamResult,
    UpdateCheckResult,
    CustomAiInput,
    CustomAiResult,
    DifficultyType,
    ModelTypeEnum,
    QuestionStyleEnum,
    QuizSettings,
    QuizGenerateResult,
    QuizCliPathResult,
    QuizAuthResult,
    QuizActionResult,
    ScreenshotType,
    AutomationConfig,
    PdfFile
}

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

            // Library Management (New v1.0)
            library: {
                getFileSystem: () => Promise<Array<any>>; // Define strict type if possible, usually TreeNode[]
                createFolder: (name: string, parentId: string | null) => Promise<any>;
                deleteItem: (id: string) => Promise<boolean>;
                importFile: (sourcePath: string, folderId?: string | null) => Promise<{ success: boolean; file?: any; error?: string }>;
                moveItem: (id: string, newParentId: string | null) => Promise<boolean>;
                search: (query: string) => Promise<any[]>;

                // Notes
                getNotes: (fileId: string) => Promise<any[]>;
                saveNote: (params: any) => Promise<any>;
                deleteNote: (id: string) => Promise<boolean>;
            };

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
