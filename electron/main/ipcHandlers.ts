import { registerScreenshotHandlers } from '../features/screenshot/screenshotHandlers'
import { registerSystemHandlers } from '../core/systemHandlers'
import { registerPdfHandlers } from '../features/pdf/pdfHandlers'
import { registerAiConfigHandlers } from '../features/ai/aiConfigHandlers'
import { registerAiRegistryHandlers } from '../features/ai/aiRegistryHandlers'
import { registerAutomationHandlers } from '../features/automation/automationHandlers'
import { registerLibraryHandlers } from '../features/library/libraryHandlers'
import { registerQuizHandlers } from '../features/quiz/quizCliHandler'

export function registerGeneralHandlers() {
    registerScreenshotHandlers()
    registerSystemHandlers()
    registerPdfHandlers()
    registerAiConfigHandlers()
    registerAiRegistryHandlers()
    registerAutomationHandlers()
    registerLibraryHandlers()
}

export { registerQuizHandlers }
