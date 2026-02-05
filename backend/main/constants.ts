/**
 * Shared constants for the Main Process
 */
export const APP_CONFIG = {
    PARTITIONS: {
        AI: 'persist:ai_session',
        PDF: 'persist:pdf_viewer'
    },
    GITHUB: {
        OWNER: 'ozymandias-get',
        REPO: 'quizlab'
    },
    CHROME_USER_AGENT: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome || '122.0.0.0'} Safari/537.36`,
    WINDOW: {
        MIN_WIDTH: 1000,
        MIN_HEIGHT: 600,
        DEFAULT_WIDTH: 1400,
        DEFAULT_HEIGHT: 900
    },
    IPC_CHANNELS: {
        SELECT_PDF: 'select-pdf',
        GET_PDF_STREAM_URL: 'get-pdf-stream-url',
        PDF_REGISTER_PATH: 'pdf:register-path',
        CAPTURE_SCREEN: 'capture-screen',
        COPY_IMAGE: 'copy-image-to-clipboard',
        OPEN_EXTERNAL: 'open-external',
        SHOW_PDF_CONTEXT_MENU: 'show-pdf-context-menu',
        TRIGGER_SCREENSHOT: 'trigger-screenshot',
        CHECK_FOR_UPDATES: 'check-for-updates',
        OPEN_RELEASES: 'open-releases-page',
        GET_APP_VERSION: 'get-app-version',
        FORCE_PASTE: 'force-paste-in-webview',
        SAVE_AI_CONFIG: 'save-ai-config',
        GET_AI_CONFIG: 'get-ai-config',
        DELETE_AI_CONFIG: 'delete-ai-config',
        DELETE_ALL_AI_CONFIGS: 'delete-all-ai-configs',
        // AI Registry & Automation (Main Process Data)
        GET_AI_REGISTRY: 'get-ai-registry',
        GET_AUTOMATION_SCRIPTS: 'get-automation-scripts',
        ADD_CUSTOM_AI: 'add-custom-ai',
        DELETE_CUSTOM_AI: 'delete-custom-ai',
        IS_AUTH_DOMAIN: 'is-auth-domain',
        // Quiz CLI Generation
        GENERATE_QUIZ_CLI: 'generate-quiz-cli',
        ASK_AI: 'ask-ai-assistant',
        GET_QUIZ_SETTINGS: 'get-quiz-settings',
        SAVE_QUIZ_SETTINGS: 'save-quiz-settings',
        CLEAR_CACHE: 'clear-cache',
        // Quiz Auth & CLI - Standardized
        GET_GEMINI_CLI_PATH: 'get-gemini-cli-path',
        OPEN_GEMINI_LOGIN: 'open-gemini-login',
        CHECK_GEMINI_AUTH: 'check-gemini-auth',
        GEMINI_LOGOUT: 'gemini-logout',

        // Library Management
        DB_GET_FILE_SYSTEM: 'db:get-file-system',
        DB_CREATE_FOLDER: 'db:create-folder',
        DB_DELETE_ITEM: 'db:delete-item',
        DB_MOVE_ITEM: 'db:move-item',
        DB_SEARCH_LIBRARY: 'db:search-library',
        FILE_IMPORT: 'file:import',

        // Note Management
        DB_GET_NOTES: 'db:get-notes',
        DB_SAVE_NOTE: 'db:save-note',
        DB_DELETE_NOTE: 'db:delete-note',

        // Keep these if needed for internal or granular use, or map them
        LIBRARY_ADD_FILE: 'library-add-file', // Still needed for transient add?
        LIBRARY_GET_FOLDER_PATH: 'library-get-folder-path'
    },
    SCREENSHOT_TYPES: {
        FULL: 'full-page',
        CROP: 'crop'
    }
}
