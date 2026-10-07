/**
 * Application-level consent UI for ambient web permissions.
 *
 * The browser's own permission prompt is not available inside an embedded remote view
 * guest, so an unprompted grant would be invisible to the user. hhis module
 * renders a modal native dialog and records the answer in the central policy
 * so the decision is remembered for the rest of the app run.
 */
import { type BrowserWindow, dialog } from 'electron'

import { Logger } from '../../core/logger.js'
import {
  describePermission,
  recordConsentDecision,
  type WebPermissionDecision,
  type WebPermissionRequest
} from './permissionPolicy.js'

export type MainWindowResolver = () => BrowserWindow | null

const promptsInFlight = new Map<string, Promise<boolean>>()

export function resetConsentPromptsForTesting(): void {
  promptsInFlight.clear()
}

/**
 * Shows the consent prompt and returns the user's answer.
 *
 * Concurrent requests for the same capability on the same host and partition
 * are coalesced onto one dialog: a page calling getUserMedia twice must not
 * stack two modals, while distinct origins receive isolated prompts.
 */
async function askForConsent(
  partition: string,
  host: string,
  capability: string,
  getMainWindow: MainWindowResolver
): Promise<boolean> {
  const promptKey = `${partition}\0${host}\0${capability}`
  const existingPrompt = promptsInFlight.get(promptKey)
  if (existingPrompt) return existingPrompt

  const parent = getMainWindow()

  const promptPromise = (async () => {
    try {
      const options: Electron.MessageBoxOptions = {
        type: 'warning',
        buttons: ['Block', 'Allow'],
        defaultId: 0,
        cancelId: 0,
        title: 'Permission request',
        message: `Allow ${capability}?`,
        detail:
          `The embedded AI site ${host} is asking to use your ${capability}.\n\n` +
          `Allow only if you trust this site.`,
        noLink: true
      }
      const { response } = parent
        ? await dialog.showMessageBox(parent, options)
        : await dialog.showMessageBox(options)
      // cancelId points at "Block", so dismissing the dialog blocks.
      return response === 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      Logger.error('[Permissions] Consent dialog failed:', message)
      return false
    } finally {
      promptsInFlight.delete(promptKey)
    }
  })()

  promptsInFlight.set(promptKey, promptPromise)
  return promptPromise
}

/**
 * Resolves a policy decision that requires consent by asking the user.
 *
 * Denials are fail-closed: any error, dialog failure, or missing parent
 * window results in "not granted".
 */
export async function resolveWebPermission(
  request: WebPermissionRequest,
  decision: WebPermissionDecision,
  getMainWindow: MainWindowResolver
): Promise<boolean> {
  if (decision.granted) return true
  if (!decision.requiresConsent) return false

  let host = request.requestingOrigin ?? ''
  try {
    host = new URL(request.requestingUrl ?? request.requestingOrigin ?? '').hostname
  } catch {
    // Keep the raw string; the policy already validated it, so this is
    // only a display concern.
  }

  const granted = await askForConsent(
    request.partition,
    host,
    describePermission(request.permission),
    getMainWindow
  )
  recordConsentDecision(request.partition, host, request.permission, granted)
  if (!granted) {
    Logger.warn(
      `[Permissions] User denied ${request.permission} for ${host} in ${request.partition}`
    )
  }
  return granted
}
