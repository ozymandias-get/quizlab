import { registerScreenshotHandlers } from './handlers/screenshotHandlers'
import { registerSystemHandlers } from './handlers/systemHandlers'
import { registerPdfHandlers } from './handlers/pdfHandlers'
import { registerAiConfigHandlers } from './handlers/aiConfigHandlers'
import { registerAiRegistryHandlers } from './handlers/aiRegistryHandlers'
import { registerAutomationHandlers } from './handlers/automationHandlers'
import { registerLibraryHandlers } from './handlers/libraryHandlers'
import { registerQuizHandlers } from '../modules/quiz/quizCliHandler'

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
