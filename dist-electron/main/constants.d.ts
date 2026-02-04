/**
 * Shared constants for the Main Process
 */
export declare const APP_CONFIG: {
    PARTITIONS: {
        AI: string;
        PDF: string;
    };
    GITHUB: {
        OWNER: string;
        REPO: string;
    };
    CHROME_USER_AGENT: string;
    WINDOW: {
        MIN_WIDTH: number;
        MIN_HEIGHT: number;
        DEFAULT_WIDTH: number;
        DEFAULT_HEIGHT: number;
    };
    IPC_CHANNELS: {
        SELECT_PDF: string;
        GET_PDF_STREAM_URL: string;
        CAPTURE_SCREEN: string;
        COPY_IMAGE: string;
        OPEN_EXTERNAL: string;
        SHOW_PDF_CONTEXT_MENU: string;
        TRIGGER_SCREENSHOT: string;
        CHECK_FOR_UPDATES: string;
        OPEN_RELEASES: string;
        GET_APP_VERSION: string;
        FORCE_PASTE: string;
        SAVE_AI_CONFIG: string;
        GET_AI_CONFIG: string;
        DELETE_AI_CONFIG: string;
        DELETE_ALL_AI_CONFIGS: string;
        GET_AI_REGISTRY: string;
        GET_AUTOMATION_SCRIPTS: string;
        ADD_CUSTOM_AI: string;
        DELETE_CUSTOM_AI: string;
        IS_AUTH_DOMAIN: string;
        GENERATE_QUIZ_CLI: string;
        ASK_AI: string;
        GET_QUIZ_SETTINGS: string;
        SAVE_QUIZ_SETTINGS: string;
        CLEAR_CACHE: string;
        GET_GEMINI_CLI_PATH: string;
        OPEN_GEMINI_LOGIN: string;
        CHECK_GEMINI_AUTH: string;
        GEMINI_LOGOUT: string;
    };
    SCREENSHOT_TYPES: {
        FULL: string;
        CROP: string;
    };
};
