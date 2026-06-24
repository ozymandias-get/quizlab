import { registerSystemHandlers } from '../core/systemHandlers.js'
import { registerAiConfigHandlers } from '../features/ai/aiConfigHandlers.js'
import { registerAiRegistryHandlers } from '../features/ai/aiRegistryHandlers.js'
import { registerApiChatHandlers } from '../features/ai/apiChatHandlers.js'
import { registerAutomationHandlers } from '../features/automation/automationHandlers.js'
import { registerGeminiWebSessionHandlers } from '../features/gemini-web-session/handlers.js'
import { registerNativeMessagingHandlers } from '../features/native-messaging/nativeMessagingHandlers.js'
import { nativeMessagingManager } from '../features/native-messaging/nativeMessagingManager.js'
import { registerPdfHandlers } from '../features/pdf/pdfHandlers.js'
import { registerScreenshotHandlers } from '../features/screenshot/screenshotHandlers.js'

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
  registerNativeMessagingHandlers()
}

export async function initializeNativeMessaging(): Promise<void> {
  await nativeMessagingManager.initialize()
}

export async function shutdownNativeMessaging(): Promise<void> {
  nativeMessagingManager.dispose()
}
