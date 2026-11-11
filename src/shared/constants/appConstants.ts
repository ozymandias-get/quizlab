import { SCREENSHOT_TYPES } from '@shared-core/types/system'

export const TOAST_DURATION = {
  DEFAULT: 5000,
  LONG: 8000
} as const

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
    TOOL_AI_FOCUS: 'tour-target-tool-ai-focus'
  }
} as const
