import { registerSystemHandlers } from '../core/systemHandlers'
import { registerAiConfigHandlers } from '../features/ai/aiConfigHandlers'
import { registerAiRegistryHandlers } from '../features/ai/aiRegistryHandlers'
import { registerApiChatHandlers } from '../features/ai/apiChatHandlers'
import { registerAutomationHandlers } from '../features/automation/automationHandlers'
import { registerGeminiWebSessionHandlers } from '../features/gemini-web-session/handlers'
import { registerNativeMessagingHandlers } from '../features/native-messaging/nativeMessagingHandlers'
import { nativeMessagingManager } from '../features/native-messaging/nativeMessagingManager'
import { registerPdfHandlers } from '../features/pdf/pdfHandlers'
import { registerScreenshotHandlers } from '../features/screenshot/screenshotHandlers'

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
