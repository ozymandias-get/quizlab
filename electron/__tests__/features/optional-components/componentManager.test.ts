import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { OptionalComponentDefinition } from '../../../features/optional-components/types.js'
import {
  OptionalComponentNotFoundError,
  resetOptionalComponentsManagerForTests,
  runOptionalComponentAction
} from '../../../features/optional-components/componentManager.js'
import {
  registerOptionalComponent,
  resetOptionalComponentRegistry
} from '../../../features/optional-components/componentRegistry.js'

const storeData = new Map<
  string,
  { status: string; version: string | null; error: string | null; updatedAt: number }
>()

vi.mock('../../../core/logger', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() }
}))

vi.mock('../../../features/optional-components/componentStateStore', () => ({
  getComponentPersistedState: async (componentId: string) =>
    storeData.get(componentId) ?? {
      status: 'not_installed',
      version: null,
      error: null,
      updatedAt: 0
    },
  setComponentPersistedState: async (
    componentId: string,
    patch: Partial<{ status: string; version: string | null; error: string | null }>
  ) => {
    const current = storeData.get(componentId) ?? {
      status: 'not_installed',
      version: null,
      error: null,
      updatedAt: 0
    }
    storeData.set(componentId, { ...current, ...patch, updatedAt: Date.now() })
  }
}))

function makeDefinition(
  overrides: Partial<OptionalComponentDefinition> = {}
): OptionalComponentDefinition {
  return {
    id: 'fake',
    displayName: 'Fake Component',
    version: '1.0.0',
    install: vi.fn(async () => {}),
    uninstall: vi.fn(async () => {}),
    repair: vi.fn(async () => {}),
    update: vi.fn(async () => {}),
    healthCheck: vi.fn(async () => true),
    ...overrides
  }
}

describe('optional component manager', () => {
  beforeEach(() => {
    storeData.clear()
    resetOptionalComponentRegistry()
    resetOptionalComponentsManagerForTests()
  })

  it('install succeeds and persists the installed state with the definition version', async () => {
    const definition = makeDefinition()
    registerOptionalComponent(definition)

    const result = await runOptionalComponentAction('fake', 'install')

    expect(result.success).toBe(true)
    expect(result.component).toMatchObject({
      id: 'fake',
      status: 'installed',
      version: '1.0.0',
      installed: true,
      error: null
    })
    expect(definition.install).toHaveBeenCalledTimes(1)
    expect(storeData.get('fake')).toMatchObject({ status: 'installed', version: '1.0.0' })
  })

  it('a failing operation persists the error status with its message', async () => {
    registerOptionalComponent(
      makeDefinition({
        install: vi.fn(async () => {
          throw new Error('download_failed')
        })
      })
    )

    const result = await runOptionalComponentAction('fake', 'install')

    expect(result.success).toBe(false)
    expect(result.error).toBe('download_failed')
    expect(result.component.status).toBe('error')
    expect(storeData.get('fake')).toMatchObject({ status: 'error', error: 'download_failed' })
  })

  it('rejects actions that are not allowed from the current status without calling the definition', async () => {
    const definition = makeDefinition()
    registerOptionalComponent(definition)
    storeData.set('fake', { status: 'installed', version: '1.0.0', error: null, updatedAt: 1 })

    const reinstall = await runOptionalComponentAction('fake', 'install')

    expect(reinstall.success).toBe(false)
    expect(reinstall.error).toContain('cannot install')
    expect(definition.install).not.toHaveBeenCalled()
  })

  it('uninstall resets to not_installed and drops the recorded version', async () => {
    const definition = makeDefinition()
    registerOptionalComponent(definition)
    storeData.set('fake', { status: 'installed', version: '1.0.0', error: null, updatedAt: 1 })

    const result = await runOptionalComponentAction('fake', 'uninstall')

    expect(result.success).toBe(true)
    expect(result.component.status).toBe('not_installed')
    expect(result.component.version).toBeNull()
  })

  it('health_check verifies only installed components and downgrades damaged ones to broken', async () => {
    const definition = makeDefinition()
    registerOptionalComponent(definition)

    storeData.set('fake', { status: 'not_installed', version: null, error: null, updatedAt: 1 })
    const skipped = await runOptionalComponentAction('fake', 'health_check')
    expect(skipped.success).toBe(true)
    expect(definition.healthCheck).not.toHaveBeenCalled()

    storeData.set('fake', { status: 'installed', version: '1.0.0', error: null, updatedAt: 1 })
    const healthy = await runOptionalComponentAction('fake', 'health_check')
    expect(healthy.success).toBe(true)
    expect(storeData.get('fake')?.status).toBe('installed')

    definition.healthCheck = vi.fn(async () => false)
    const damaged = await runOptionalComponentAction('fake', 'health_check')
    expect(damaged.success).toBe(false)
    expect(damaged.error).toBe('health_check_failed')
    expect(storeData.get('fake')).toMatchObject({ status: 'broken', error: 'health_check_failed' })
  })

  it('serializes concurrent actions per component and fails fast for late callers', async () => {
    let releaseInstall!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseInstall = resolve
    })
    registerOptionalComponent(
      makeDefinition({
        install: vi.fn(() => gate)
      })
    )

    const first = runOptionalComponentAction('fake', 'install')
    const second = await runOptionalComponentAction('fake', 'install')

    expect(second.success).toBe(false)
    expect(second.error).toBe('another_operation_in_progress')

    releaseInstall()
    const finished = await first
    expect(finished.success).toBe(true)
  })

  it('throws OptionalComponentNotFoundError for unregistered ids', async () => {
    await expect(runOptionalComponentAction('ghost', 'install')).rejects.toBeInstanceOf(
      OptionalComponentNotFoundError
    )
  })
})
