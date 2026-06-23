import { SCREENSHOT_TYPES } from '@shared-core/types/system'

export const APP_CONSTANTS = {
  GITHUB_RELEASES_URL: 'https://github.com/ozymandias-get/quizlab/releases/latest',
  GITHUB_REPO_URL: 'https://github.com/ozymandias-get/quizlab',

  SCREENSHOT_TYPES,

  TOUR_TARGETS: {
    HUB_BTN: 'tour-target-hub-btn',
    TOOLS_PANEL: 'tour-target-tools-panel',
    MODELS_LIST: 'tour-target-models-list',
    TOOL_PICKER: 'tour-target-tool-picker',
    TOOL_SWAP: 'tour-target-tool-swap',
    TOOL_SETTINGS: 'tour-target-tool-settings',
    TOOL_PDF_FOCUS: 'tour-target-tool-pdf-focus',
    TOOL_AI_FOCUS: 'tour-target-tool-ai-focus',
    LEFT_PANEL: 'tour-target-left-panel',
    RIGHT_PANEL: 'tour-target-right-panel',
    PDF_VIEWER: 'tour-target-pdf-viewer',
    PDF_TOOLBAR: 'tour-target-pdf-toolbar',
    PDF_TAB_STRIP: 'tour-target-pdf-tab-strip',
    AI_PANEL: 'tour-target-ai-panel',
    AI_TAB_STRIP: 'tour-target-ai-tab-strip',
    AI_WEBVIEW: 'tour-target-ai-webview',
    AI_SEND_COMPOSER: 'tour-target-ai-send-composer',
    SETTINGS_MODAL: 'tour-target-settings-modal'
  }
} as const
