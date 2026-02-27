export const APP_CONSTANTS = {
    // External URLs
    GITHUB_RELEASES_URL: 'https://github.com/ozymandias-get/quizlab/releases',
    GITHUB_REPO_URL: 'https://github.com/ozymandias-get/quizlab',

    SCREENSHOT_TYPES: {
        FULL: 'full-page',
        CROP: 'crop'
    },

    // Tutorial / DOM Targets
    TOUR_TARGETS: {
        HUB_BTN: 'tour-target-hub-btn',
        TOOLS_PANEL: 'tour-target-tools-panel',
        MODELS_LIST: 'tour-target-models-list',
        TOOL_PICKER: 'tour-target-tool-picker',
        TOOL_SWAP: 'tour-target-tool-swap',
        TOOL_SETTINGS: 'tour-target-tool-settings'
    }
} as const
