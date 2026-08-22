import { doclingComponentDefinition } from '../docling/doclingComponent.js'
import { registerOptionalComponent } from './componentRegistry.js'

let builtInsRegistered = false

/**
 * Register the components that ship with the app. Called once when the IPC
 * handlers are registered; the registry itself rejects duplicate ids, which
 * keeps repeated boot paths (hot reload, tests) safe.
 */
export function ensureBuiltInComponentsRegistered(): void {
  if (builtInsRegistered) return
  builtInsRegistered = true

  registerOptionalComponent(doclingComponentDefinition)
}
