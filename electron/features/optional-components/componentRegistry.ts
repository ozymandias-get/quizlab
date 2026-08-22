import type { OptionalComponentDefinition } from './types.js'

/**
 * Whitelist registry of optional components. Only ids registered here can be
 * addressed over IPC — the renderer has no way to introduce new component ids,
 * paths or commands. Registration happens once at handler-registration time.
 */
const definitions = new Map<string, OptionalComponentDefinition>()

export function registerOptionalComponent(definition: OptionalComponentDefinition): void {
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(definition.id)) {
    throw new Error(`Invalid optional component id: "${definition.id}"`)
  }
  if (definitions.has(definition.id)) {
    throw new Error(`Optional component already registered: "${definition.id}"`)
  }
  definitions.set(definition.id, definition)
}

export function getOptionalComponent(id: string): OptionalComponentDefinition | null {
  return definitions.get(id) ?? null
}

export function listOptionalComponents(): OptionalComponentDefinition[] {
  return [...definitions.values()]
}

/** Test-only: clear the registry between test cases. */
export function resetOptionalComponentRegistry(): void {
  definitions.clear()
}
