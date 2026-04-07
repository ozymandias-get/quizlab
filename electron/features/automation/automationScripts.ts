import type { AutomationConfig } from '@shared-core/types'
import { generateAutoSendScript } from './automationScripts/generators/autoSend'
import { generateClickSendScript } from './automationScripts/generators/clickSend'
import { generateFocusScript } from './automationScripts/generators/focus'
import { generateWaitForSubmitReadyScript } from './automationScripts/generators/submitReady'
import { generateValidateSelectorsScript } from './automationScripts/generators/validate'

export type { AutomationConfig }
export {
  generateFocusScript,
  generateAutoSendScript,
  generateClickSendScript,
  generateWaitForSubmitReadyScript,
  generateValidateSelectorsScript
}
