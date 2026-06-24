import type { AutomationConfig } from '@shared-core/types'

import { generateAutoSendScript } from './automationScripts/generators/autoSend.js'
import { generateClickSendScript } from './automationScripts/generators/clickSend.js'
import { generateFocusScript } from './automationScripts/generators/focus.js'
import { generateWaitForSubmitReadyScript } from './automationScripts/generators/submitReady.js'
import { generateValidateSelectorsScript } from './automationScripts/generators/validate.js'

export {
  generateAutoSendScript,
  generateClickSendScript,
  generateFocusScript,
  generateValidateSelectorsScript,
  generateWaitForSubmitReadyScript
}
