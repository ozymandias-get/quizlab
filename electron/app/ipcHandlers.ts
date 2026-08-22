import { registerSystemHandlers } from '../core/systemHandlers.js'
import { registerAiConfigHandlers } from '../features/ai/aiConfigHandlers.js'
import { registerAiRegistryHandlers } from '../features/ai/aiRegistryHandlers.js'
import { registerApiChatHandlers } from '../features/ai/apiChatHandlers.js'
import { registerAutomationHandlers } from '../features/automation/automationHandlers.js'
import {
  registerDoclingServiceHandlers,
  shutdownDoclingService
} from '../features/docling/doclingServiceHandlers.js'
import { registerGeminiWebSessionHandlers } from '../features/gemini-web-session/handlers.js'
import { registerNativeMessagingHandlers } from '../features/native-messaging/nativeMessagingHandlers.js'
import { nativeMessagingManager } from '../features/native-messaging/nativeMessagingManager.js'
import { registerOptionalComponentsHandlers } from '../features/optional-components/handlers.js'
import { registerPdfHandlers } from '../features/pdf/pdfHandlers.js'
import { registerScreenshotHandlers } from '../features/screenshot/screenshotHandlers.js'
import { registerAppSettingsHandlers } from '../features/settings/appSettingsHandlers.js'

let handlersRegistered = false

export function registerGeneralHandlers() {
  // SECURITY: Prevent duplicate registration if this function is called
  // more than once (e.g. during hot reload or test setup).
  if (handlersRegistered) return
  handlersRegistered = true

  registerScreenshotHandlers()
  registerSystemHandlers()
  registerPdfHandlers()
  registerAiConfigHandlers()
  registerAiRegistryHandlers()
  registerApiChatHandlers()
  registerAutomationHandlers()
  registerGeminiWebSessionHandlers()
  registerAppSettingsHandlers()
  registerNativeMessagingHandlers()
  registerOptionalComponentsHandlers()
  registerDoclingServiceHandlers()
}

export async function shutdownDoclingServiceHandlers(): Promise<void> {
  await shutdownDoclingService()
}

export async function initializeNativeMessaging(): Promise<void> {
  await nativeMessagingManager.initialize()
}

export async function shutdownNativeMessaging(): Promise<void> {
  nativeMessagingManager.dispose()
}
