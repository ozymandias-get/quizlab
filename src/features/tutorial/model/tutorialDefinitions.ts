import type { TutorialDefinition } from './types'

const T = {
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
} as const

const GENERAL_TUTORIAL: TutorialDefinition = {
  id: 'general',
  titleKey: 'tutorial_general_title',
  descriptionKey: 'tutorial_general_desc',
  category: 'onboarding',
  estimatedMinutes: 3,
  steps: [
    {
      id: 'welcome',
      titleKey: 'tutorial_general_step_welcome_title',
      bodyKey: 'tutorial_general_step_welcome_body',
      placement: 'center'
    },
    {
      id: 'hub',
      titleKey: 'tutorial_general_step_hub_title',
      bodyKey: 'tutorial_general_step_hub_body',
      targetId: T.HUB_BTN,
      placement: 'left'
    },
    {
      id: 'tools',
      titleKey: 'tutorial_general_step_tools_title',
      bodyKey: 'tutorial_general_step_tools_body',
      targetId: T.TOOLS_PANEL,
      placement: 'right'
    },
    {
      id: 'models',
      titleKey: 'tutorial_general_step_models_title',
      bodyKey: 'tutorial_general_step_models_body',
      targetId: T.MODELS_LIST,
      placement: 'left'
    },
    {
      id: 'panels',
      titleKey: 'tutorial_general_step_panels_title',
      bodyKey: 'tutorial_general_step_panels_body',
      targetId: T.LEFT_PANEL,
      placement: 'auto'
    },
    {
      id: 'resize',
      titleKey: 'tutorial_general_step_resize_title',
      bodyKey: 'tutorial_general_step_resize_body',
      targetId: T.HUB_BTN,
      placement: 'auto'
    },
    {
      id: 'settings',
      titleKey: 'tutorial_general_step_settings_title',
      bodyKey: 'tutorial_general_step_settings_body',
      targetId: T.TOOL_SETTINGS,
      placement: 'right'
    }
  ]
}

const PDF_TUTORIAL: TutorialDefinition = {
  id: 'pdf',
  titleKey: 'tutorial_pdf_title',
  descriptionKey: 'tutorial_pdf_desc',
  category: 'pdf',
  estimatedMinutes: 2,
  steps: [
    {
      id: 'open',
      titleKey: 'tutorial_pdf_step_open_title',
      bodyKey: 'tutorial_pdf_step_open_body',
      targetId: T.LEFT_PANEL,
      placement: 'right'
    },
    {
      id: 'toolbar',
      titleKey: 'tutorial_pdf_step_toolbar_title',
      bodyKey: 'tutorial_pdf_step_toolbar_body',
      targetId: T.PDF_TOOLBAR,
      placement: 'bottom'
    },
    {
      id: 'tabs',
      titleKey: 'tutorial_pdf_step_tabs_title',
      bodyKey: 'tutorial_pdf_step_tabs_body',
      targetId: T.PDF_TAB_STRIP,
      placement: 'bottom'
    },
    {
      id: 'viewer',
      titleKey: 'tutorial_pdf_step_viewer_title',
      bodyKey: 'tutorial_pdf_step_viewer_body',
      targetId: T.PDF_VIEWER,
      placement: 'right'
    },
    {
      id: 'focus',
      titleKey: 'tutorial_pdf_step_focus_title',
      bodyKey: 'tutorial_pdf_step_focus_body',
      targetId: T.TOOL_PDF_FOCUS,
      placement: 'right'
    }
  ]
}

const AI_TUTORIAL: TutorialDefinition = {
  id: 'ai',
  titleKey: 'tutorial_ai_title',
  descriptionKey: 'tutorial_ai_desc',
  category: 'ai',
  estimatedMinutes: 2,
  steps: [
    {
      id: 'panel',
      titleKey: 'tutorial_ai_step_panel_title',
      bodyKey: 'tutorial_ai_step_panel_body',
      targetId: T.RIGHT_PANEL,
      placement: 'left'
    },
    {
      id: 'tabs',
      titleKey: 'tutorial_ai_step_tabs_title',
      bodyKey: 'tutorial_ai_step_tabs_body',
      targetId: T.AI_TAB_STRIP,
      placement: 'bottom'
    },
    {
      id: 'webview',
      titleKey: 'tutorial_ai_step_webview_title',
      bodyKey: 'tutorial_ai_step_webview_body',
      targetId: T.AI_WEBVIEW,
      placement: 'left'
    },
    {
      id: 'models',
      titleKey: 'tutorial_ai_step_models_title',
      bodyKey: 'tutorial_ai_step_models_body',
      targetId: T.MODELS_LIST,
      placement: 'left'
    },
    {
      id: 'composer',
      titleKey: 'tutorial_ai_step_composer_title',
      bodyKey: 'tutorial_ai_step_composer_body',
      targetId: T.AI_SEND_COMPOSER,
      placement: 'top'
    },
    {
      id: 'focus',
      titleKey: 'tutorial_ai_step_focus_title',
      bodyKey: 'tutorial_ai_step_focus_body',
      targetId: T.TOOL_AI_FOCUS,
      placement: 'right'
    }
  ]
}

const SETTINGS_TUTORIAL: TutorialDefinition = {
  id: 'settings',
  titleKey: 'tutorial_settings_title',
  descriptionKey: 'tutorial_settings_desc',
  category: 'settings',
  estimatedMinutes: 1,
  steps: [
    {
      id: 'open',
      titleKey: 'tutorial_settings_step_open_title',
      bodyKey: 'tutorial_settings_step_open_body',
      targetId: T.TOOL_SETTINGS,
      placement: 'right'
    },
    {
      id: 'sidebar',
      titleKey: 'tutorial_settings_step_sidebar_title',
      bodyKey: 'tutorial_settings_step_sidebar_body',
      targetId: T.SETTINGS_MODAL,
      placement: 'auto'
    },
    {
      id: 'appearance',
      titleKey: 'tutorial_settings_step_appearance_title',
      bodyKey: 'tutorial_settings_step_appearance_body',
      targetId: T.SETTINGS_MODAL,
      placement: 'auto'
    }
  ]
}

const MAGIC_SELECTOR_TUTORIAL: TutorialDefinition = {
  id: 'magic-selector',
  titleKey: 'tutorial_magic_selector_title',
  descriptionKey: 'tutorial_magic_selector_desc',
  category: 'automation',
  estimatedMinutes: 2,
  steps: []
}

const ALL_TUTORIALS: TutorialDefinition[] = [
  GENERAL_TUTORIAL,
  PDF_TUTORIAL,
  AI_TUTORIAL,
  SETTINGS_TUTORIAL,
  MAGIC_SELECTOR_TUTORIAL
]

export function getTutorial(id: string): TutorialDefinition | undefined {
  return ALL_TUTORIALS.find((t) => t.id === id)
}

export function getAllTutorials(): TutorialDefinition[] {
  return ALL_TUTORIALS
}

export function getTutorialsByCategory(category: string): TutorialDefinition[] {
  return ALL_TUTORIALS.filter((t) => t.category === category)
}
