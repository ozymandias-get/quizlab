export const APP_CONSTANTS = {
    // External URLs
    GITHUB_RELEASES_URL: 'https://github.com/ozymandias-get/Quizlab-Reader/releases',
    GITHUB_REPO_URL: 'https://github.com/ozymandias-get/Quizlab-Reader',

    // App Info
    APP_NAME: 'QuizLab Reader',

    // Update Check
    UPDATE_CHECK_INTERVAL: 1000 * 60 * 60 * 24, // 24 hours

    // UI Constants
    LEFT_PANEL_TABS: {
        EXPLORER: 'explorer',
        VIEWER: 'viewer'
    },

    // IPC Channels (Sync with main process constants.js)
    IPC_CHANNELS: {
        SELECT_PDF: 'select-pdf',
        GET_PDF_STREAM_URL: 'get-pdf-stream-url',
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
        GET_AI_REGISTRY: 'get-ai-registry',
        GET_AUTOMATION_SCRIPTS: 'get-automation-scripts',
        ADD_CUSTOM_AI: 'add-custom-ai',
        DELETE_CUSTOM_AI: 'delete-custom-ai',
        IS_AUTH_DOMAIN: 'is-auth-domain',
        GENERATE_QUIZ_CLI: 'generate-quiz-cli',
        GET_QUIZ_SETTINGS: 'get-quiz-settings',
        SAVE_QUIZ_SETTINGS: 'save-quiz-settings',
        CLEAR_CACHE: 'clear-cache',
        GET_GEMINI_CLI_PATH: 'get-gemini-cli-path',
        OPEN_GEMINI_LOGIN: 'open-gemini-login',
        CHECK_GEMINI_AUTH: 'check-gemini-auth',
        GEMINI_LOGOUT: 'gemini-logout'
    },

    SCREENSHOT_TYPES: {
        FULL: 'full-page',
        CROP: 'crop'
    }
} as const

export type AppConstants = typeof APP_CONSTANTS
export default APP_CONSTANTS
