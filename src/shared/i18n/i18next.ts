import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

import enAi from './locales/en/ai.json'
import enAiChat from './locales/en/ai-chat.json'
import enAiSend from './locales/en/ai-send.json'
import enAppearance from './locales/en/appearance.json'
import enAutoSend from './locales/en/auto-send.json'
import enCommon from './locales/en/common.json'
import enCtx from './locales/en/ctx.json'
import enErrors from './locales/en/errors.json'
import enGws from './locales/en/gws.json'
import enLoader from './locales/en/loader.json'
import enNavigation from './locales/en/navigation.json'
import enNotifications from './locales/en/notifications.json'
import enPdf from './locales/en/pdf.json'
import enPdfRecent from './locales/en/pdf-recent.json'
import enPicker from './locales/en/picker.json'
import enSelectors from './locales/en/selectors.json'
import enSettings from './locales/en/settings.json'
import enToasts from './locales/en/toasts.json'
import enTutorial from './locales/en/tutorial.json'
import trAi from './locales/tr/ai.json'
import trAiChat from './locales/tr/ai-chat.json'
import trAiSend from './locales/tr/ai-send.json'
import trAppearance from './locales/tr/appearance.json'
import trAutoSend from './locales/tr/auto-send.json'
import trCommon from './locales/tr/common.json'
import trCtx from './locales/tr/ctx.json'
import trErrors from './locales/tr/errors.json'
import trGws from './locales/tr/gws.json'
import trLoader from './locales/tr/loader.json'
import trNavigation from './locales/tr/navigation.json'
import trNotifications from './locales/tr/notifications.json'
import trPdf from './locales/tr/pdf.json'
import trPdfRecent from './locales/tr/pdf-recent.json'
import trPicker from './locales/tr/picker.json'
import trSelectors from './locales/tr/selectors.json'
import trSettings from './locales/tr/settings.json'
import trToasts from './locales/tr/toasts.json'
import trTutorial from './locales/tr/tutorial.json'

const enResources = {
  ...enCommon,
  ...enNavigation,
  ...enSettings,
  ...enAppearance,
  ...enPdf,
  ...enPdfRecent,
  ...enAi,
  ...enAiSend,
  ...enAiChat,
  ...enSelectors,
  ...enPicker,
  ...enTutorial,
  ...enGws,
  ...enErrors,
  ...enToasts,
  ...enLoader,
  ...enNotifications,
  ...enAutoSend,
  ...enCtx
}

const trResources = {
  ...trCommon,
  ...trNavigation,
  ...trSettings,
  ...trAppearance,
  ...trPdf,
  ...trPdfRecent,
  ...trAi,
  ...trAiSend,
  ...trAiChat,
  ...trSelectors,
  ...trPicker,
  ...trTutorial,
  ...trGws,
  ...trErrors,
  ...trToasts,
  ...trLoader,
  ...trNotifications,
  ...trAutoSend,
  ...trCtx
}

void i18next.use(initReactI18next).init({
  resources: {
    en: { translation: enResources },
    tr: { translation: trResources }
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    prefix: '{',
    suffix: '}'
  },
  returnObjects: false,
  returnNull: false
})
