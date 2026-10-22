import { beforeEach, describe, expect, it, vi } from 'vitest'

const DELETED_ID = 'custom_11111111-1111-4111-8111-111111111111'
const KEPT_ID = 'custom_22222222-2222-4222-8222-222222222222'
const DELETED_SITE_ID = `custom:${DELETED_ID}`
const EXTRA_ACCOUNT_ID = 'a1'
/** The partition the extra account of the deleted site lives in. */
const EXTRA_PARTITION = `persist:ai_custom_${DELETED_ID}_${EXTRA_ACCOUNT_ID}`

const ipcHandle = vi.fn()
const forget = vi.fn()
const read = vi.fn()

const { permissionMocks, cacheMocks, removedPartitions } = vi.hoisted(() => ({
  permissionMocks: {
    registerAccountPartition: vi.fn(),
    unregisterAccountPartition: vi.fn(),
    registerCustomPlatformOrigin: vi.fn(),
    unregisterCustomPlatformOrigin: vi.fn()
  },
  cacheMocks: {
    registerDynamicPartition: vi.fn(),
    unregisterDynamicPartition: vi.fn()
  },
  removedPartitions: [] as string[]
}))

const trustedSender = { id: 1, getURL: vi.fn(() => 'http://localhost:5173') }

/** The cookie domain every partition of this test holds. */
const PARTITION_DOMAINS: Record<string, string> = {
  [`persist:ai_custom_${DELETED_ID}`]: '.deleted.example.com',
  [EXTRA_PARTITION]: '.deleted.example.com',
  [`persist:ai_custom_${KEPT_ID}`]: '.kept.example.com'
}

/** The sessions the app hands out, one per partition. */
const sessions = new Map<string, FakeSession>()

interface FakeSession {
  partition: string
  cookies: { get: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> }
  clearStorageData: ReturnType<typeof vi.fn>
  clearAuthCache: ReturnType<typeof vi.fn>
  flushStorageData: ReturnType<typeof vi.fn>
}

function makeSession(partition: string): FakeSession {
  const domain = PARTITION_DOMAINS[partition] ?? '.example.com'
  return {
    partition,
    cookies: {
      get: vi.fn(async () => [{ name: 'session', domain, path: '/', secure: true }]),
      remove: vi.fn(async () => ({}))
    },
    clearStorageData: vi.fn(async () => undefined),
    clearAuthCache: vi.fn(async () => undefined),
    flushStorageData: vi.fn()
  }
}

function sessionOf(partition: string): FakeSession {
  const existing = sessions.get(partition)
  if (existing) return existing
  const created = makeSession(partition)
  sessions.set(partition, created)
  return created
}

vi.mock('electron', () => ({
  app: {
    // A folder that does not exist: the delete path removes the partition
    // directory from disk, and `force: true` makes that a no-op.
    getPath: vi.fn(() => '/tmp/quizlab-delete-session-test'),
    getAppPath: vi.fn(() => ''),
    isPackaged: false,
    on: vi.fn()
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => null),
    getAllWindows: vi.fn(() => [])
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false),
    encryptString: vi.fn(),
    decryptString: vi.fn()
  },
  session: {
    fromPartition: vi.fn((partition: string) => sessionOf(partition))
  },
  ipcMain: {
    handle: ipcHandle
  },
  shell: {
    openExternal: vi.fn()
  }
}))

vi.mock('../../../app/windowManager', () => ({
  getMainWindow: vi.fn(() => ({
    webContents: trustedSender
  }))
}))

vi.mock('../../../features/ai/customPlatformStore.js', () => ({
  getCustomPlatformStore: () => ({
    deleteItem: vi.fn(async () => true),
    read: vi.fn(async () => ({})),
    setItem: vi.fn(async () => true)
  })
}))

vi.mock('../../../app/window/permissionPolicy.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../app/window/permissionPolicy.js')>()
  return {
    ...actual,
    ...permissionMocks
  }
})

vi.mock('../../../core/cacheRegistry.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../core/cacheRegistry.js')>()
  return {
    ...actual,
    ...cacheMocks
  }
})

vi.mock('../../../features/web-session/siteSessionConfig.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../features/web-session/siteSessionConfig.js')>()
  return {
    ...actual,
    getSiteSessionConfig: () => ({ read, forget })
  }
})

vi.mock('../../../features/web-session/siteSessionPartitions.js', () => ({
  removePartitionDirectory: async (partition: string) => {
    removedPartitions.push(partition)
  }
}))

/**
 * The real lock, captured once.
 *
 * The handler is imported again for every test, and a lock that is captured
 * again with it would be a different lock: the test and the handler have to
 * share the one they both take.
 */
const { sharedLock } = await vi.hoisted(async () => ({
  sharedLock: await vi.importActual<
    typeof import('../../../features/web-session/siteSessionLock.js')
  >('../../../features/web-session/siteSessionLock.js')
}))

vi.mock('../../../features/web-session/siteSessionLock.js', () => sharedLock)

vi.mock('../../../features/web-session/siteSessionTargets.js', () => ({
  buildSiteSessionTargets: async () => [
    {
      siteId: `custom:${DELETED_ID}`,
      hostname: 'deleted.example.com',
      origins: ['https://deleted.example.com'],
      partition: `persist:ai_custom_${DELETED_ID}`,
      cookieDomains: ['.deleted.example.com'],
      labelKey: 'ws_target_custom',
      kind: 'custom',
      memberAppIds: [DELETED_ID]
    },
    {
      siteId: `custom:${KEPT_ID}`,
      hostname: 'kept.example.com',
      origins: ['https://kept.example.com'],
      partition: `persist:ai_custom_${KEPT_ID}`,
      cookieDomains: ['.kept.example.com'],
      labelKey: 'ws_target_custom',
      kind: 'custom',
      memberAppIds: [KEPT_ID]
    }
  ]
}))

import { PRIMARY_ACCOUNT_ID } from '../../../../shared/types/siteSession.js'
import { APP_CONFIG } from '../../../app/constants.js'
import { withSiteSessionLock } from '../../../features/web-session/siteSessionLock.js'
import type {
  SiteSessionAccountState,
  SiteSessionConfigFile
} from '../../../features/web-session/siteSessionMigration.js'

/** An account that was never touched: unnamed, off, no history. */
function accountState(): SiteSessionAccountState {
  return {
    name: null,
    enabled: false,
    importedAt: null,
    lastResult: null,
    lastError: null,
    fingerprints: []
  }
}

/** A state file that was never written for a site. */
function emptyState(): SiteSessionConfigFile {
  return { version: 2, configVersion: 0, sites: {} }
}

/** The state of the deleted site with a primary and one additional account. */
function twoAccountState(): SiteSessionConfigFile {
  return {
    version: 2,
    configVersion: 0,
    sites: {
      [DELETED_SITE_ID]: {
        accounts: {
          [PRIMARY_ACCOUNT_ID]: accountState(),
          [EXTRA_ACCOUNT_ID]: accountState()
        },
        activeAccountId: EXTRA_ACCOUNT_ID
      }
    }
  }
}

describe('deleting a user-added site', () => {
  beforeEach(() => {
    ipcHandle.mockReset()
    forget.mockReset().mockResolvedValue(undefined)
    read.mockReset().mockResolvedValue(emptyState())
    sessions.clear()
    removedPartitions.length = 0
    permissionMocks.unregisterAccountPartition.mockClear()
    cacheMocks.unregisterDynamicPartition.mockClear()
  })

  async function deleteSite(id: string) {
    // The handler registers itself once per module instance, and every test
    // needs its own registration.
    vi.resetModules()
    const { registerAiRegistryHandlers } =
      await import('../../../features/ai/aiRegistryHandlers.js')
    registerAiRegistryHandlers()

    const handler = ipcHandle.mock.calls.find(
      ([channel]) => channel === APP_CONFIG.IPC_CHANNELS.DELETE_CUSTOM_AI
    )?.[1]
    if (!handler) throw new Error('the delete handler was not registered')

    return handler({ sender: trustedSender, type: 'invoke' }, id)
  }

  it('clears the session of the deleted site and leaves the other one alone', async () => {
    // Deleting the partition folder on disk is not enough: the session
    // Electron already holds would survive, and the site would still be
    // signed in the next time the app opened it.
    await deleteSite(DELETED_ID)

    const deleted = sessionOf(`persist:ai_custom_${DELETED_ID}`)
    const kept = sessionOf(`persist:ai_custom_${KEPT_ID}`)

    expect(deleted.cookies.remove).toHaveBeenCalled()
    expect(deleted.clearStorageData).toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'https://deleted.example.com' })
    )
    expect(kept.cookies.remove).not.toHaveBeenCalled()
    expect(kept.clearStorageData).not.toHaveBeenCalled()
  })

  it('removes the state of the deleted site', async () => {
    // An entry that says the site is switched on would outlive the site and
    // keep the extension pushing a site the app does not know.
    await deleteSite(DELETED_ID)

    expect(forget).toHaveBeenCalledWith(`custom:${DELETED_ID}`)
  })

  it('does not touch a site that is not deleted', async () => {
    await deleteSite(DELETED_ID)

    expect(forget).not.toHaveBeenCalledWith(`custom:${KEPT_ID}`)
  })

  it('clears every account of a deleted site and removes their partitions', async () => {
    read.mockResolvedValue(twoAccountState())

    await deleteSite(DELETED_ID)

    expect(sessionOf(`persist:ai_custom_${DELETED_ID}`).cookies.remove).toHaveBeenCalled()
    expect(sessionOf(EXTRA_PARTITION).cookies.remove).toHaveBeenCalled()
    expect(sessionOf(EXTRA_PARTITION).clearStorageData).toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'https://deleted.example.com' })
    )

    // The primary account's partition belongs to the platform. It is wiped,
    // but only the extra accounts' folders are deleted from disk.
    expect(removedPartitions).toEqual([EXTRA_PARTITION])
  })

  it('stops trusting the partitions of the deleted accounts', async () => {
    read.mockResolvedValue(twoAccountState())

    await deleteSite(DELETED_ID)

    expect(permissionMocks.unregisterAccountPartition).toHaveBeenCalledWith(EXTRA_PARTITION)
    expect(cacheMocks.unregisterDynamicPartition).toHaveBeenCalledWith(EXTRA_PARTITION)
    expect(permissionMocks.unregisterAccountPartition).not.toHaveBeenCalledWith(
      `persist:ai_custom_${DELETED_ID}`
    )
  })

  it('waits for an import into an additional account before wiping it', async () => {
    read.mockResolvedValue(twoAccountState())
    let releaseImport: () => void = () => {}
    const importGate = new Promise<void>((resolve) => {
      releaseImport = resolve
    })
    const importing = withSiteSessionLock(DELETED_SITE_ID, EXTRA_ACCOUNT_ID, async () => {
      await importGate
    })

    const deleting = deleteSite(DELETED_ID)
    await vi.waitFor(() =>
      expect(sessionOf(`persist:ai_custom_${DELETED_ID}`).cookies.remove).toHaveBeenCalled()
    )

    // Each account has its own lock: the free primary is wiped while the
    // import into the extra account is still running.
    expect(sessionOf(EXTRA_PARTITION).cookies.remove).not.toHaveBeenCalled()

    releaseImport()
    await Promise.all([importing, deleting])

    expect(sessionOf(EXTRA_PARTITION).cookies.remove).toHaveBeenCalled()
  })

  it('waits for an import that is running before it wipes the session', async () => {
    // The import holds the lock of the site's primary account: a wipe that ran
    // while the import was still writing would be undone by it, and the
    // deleted site would keep its session.
    let releaseImport: () => void = () => {}
    const importGate = new Promise<void>((resolve) => {
      releaseImport = resolve
    })
    const importing = withSiteSessionLock(`custom:${DELETED_ID}`, PRIMARY_ACCOUNT_ID, async () => {
      await importGate
    })

    const deleting = deleteSite(DELETED_ID)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(sessionOf(`persist:ai_custom_${DELETED_ID}`).cookies.remove).not.toHaveBeenCalled()

    releaseImport()
    await Promise.all([importing, deleting])

    expect(sessionOf(`persist:ai_custom_${DELETED_ID}`).cookies.remove).toHaveBeenCalled()
  })
})
