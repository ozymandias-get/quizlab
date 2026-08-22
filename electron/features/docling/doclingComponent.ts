import type { OptionalComponentDefinition } from '../optional-components/types.js'

/**
 * Placeholder definition for the Docling-based Smart Reader optional
 * component. This phase only wires the management infrastructure (registry,
 * persisted lifecycle state, typed IPC); the real installation flow — an
 * isolated private Python runtime plus Docling models under the app's own
 * data directory — is implemented in a later phase.
 *
 * Every mutating operation therefore fails fast with a descriptive error so
 * the component reports an honest "error" state instead of pretending to be
 * installed.
 */

const DOCLING_COMPONENT_VERSION = '0.0.0-placeholder'

async function notYetAvailable(operation: string): Promise<never> {
  throw new Error(`The "${operation}" flow for the Docling Smart Reader is not implemented yet`)
}

export const doclingComponentDefinition: OptionalComponentDefinition = {
  id: 'docling',
  displayName: 'Docling Smart Reader',
  version: DOCLING_COMPONENT_VERSION,

  install() {
    return notYetAvailable('install')
  },

  uninstall() {
    return notYetAvailable('uninstall')
  },

  repair() {
    return notYetAvailable('repair')
  },

  update() {
    return notYetAvailable('update')
  },

  healthCheck() {
    // Nothing is provisioned yet, so an "installed" docling can never be healthy.
    return Promise.resolve(false)
  }
}
