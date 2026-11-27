import { beforeEach, describe, expect, it, vi } from 'vitest'

import { APP_CONFIG } from '../../../app/constants.js'

const ipcHandle = vi.fn()
const trustedSender = { id: 1, getURL: vi.fn(() => 'http://localhost:5173') }
const trustedEvent = { sender: trustedSender, type: 'invoke' }

const managerState: {
  data: Record<string, unknown>
  writes: Record<string, unknown>[]
} = {
  data: {},
  writes: []
}

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => '/tmp/quizlab-test')
  },
  ipcMain: {
    handle: ipcHandle
  }
}))

vi.mock('../../../core/coreHelpers', () => ({
  getAiConfigPath: vi.fn(() => '/tmp/quizlab-test/ai_custom_selectors.json')
}))

vi.mock('../../../app/windowManager', () => ({
  getMainWindow: vi.fn(() => ({
    webContents: trustedSender
  }))
}))

vi.mock('../../../core/ConfigManager', () => {
  let queue: Promise<unknown> = Promise.resolve()
  return {
    ConfigManager: class<T extends Record<string, unknown>> {
      constructor(_filePath: string) {}

      async read(): Promise<T> {
        return managerState.data as T
      }

      async write(data: T): Promise<boolean> {
        managerState.data = data
        managerState.writes.push(JSON.parse(JSON.stringify(data)) as Record<string, unknown>)
        return true
      }

      async update(updater: (current: T) => T | Promise<T>): Promise<boolean> {
        const run = queue.then(async () => {
          const current = { ...managerState.data } as T
          const updated = await updater(current)
          managerState.data = updated as Record<string, unknown>
          managerState.writes.push(JSON.parse(JSON.stringify(updated)) as Record<string, unknown>)
          return true
        })
        queue = run.catch(() => undefined)
        return run
      }

      async deleteItem(key: string): Promise<boolean> {
        const next = { ...managerState.data }
        delete next[key]
        managerState.data = next
        managerState.writes.push(JSON.parse(JSON.stringify(next)) as Record<string, unknown>)
        return true
      }
    }
  }
})

function getHandler(channel: string) {
  return ipcHandle.mock.calls.find(([registeredChannel]) => registeredChannel === channel)?.[1]
}

describe('aiConfigHandlers', () => {
  beforeEach(() => {
    vi.resetModules()
    ipcHandle.mockReset()
    managerState.data = {}
    managerState.writes = []
  })

  it('migrates legacy selector records without leaking them across subdomains', async () => {
    managerState.data = {
      'www.chat.openai.com': {
        input: '#prompt',
        button: '#send',
        submitMode: 'enter',
        timestamp: 123
      }
    }

    const { registerAiConfigHandlers } = await import('../../../features/ai/aiConfigHandlers.js')
    registerAiConfigHandlers()

    const getConfigHandler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_AI_CONFIG)

    const allConfigs = await getConfigHandler?.(trustedEvent, undefined)
    const ownConfig = await getConfigHandler?.(trustedEvent, 'www.chat.openai.com')
    // A different service under the same registrable domain. Resolving it from the
    // `canonicalHostname` **field** is what this previously did, and it handed
    // chat.openai.com's selectors to app.openai.com - automation typing into and
    // clicking a sibling product's DOM. The key has to match, not just the domain.
    const siblingConfig = await getConfigHandler?.(trustedEvent, 'app.openai.com')

    expect(managerState.writes).toHaveLength(1)
    expect(allConfigs).toMatchObject({
      ok: true,
      data: {
        'www.chat.openai.com': {
          version: 2,
          input: '#prompt',
          button: '#send',
          inputCandidates: ['#prompt'],
          buttonCandidates: ['#send'],
          canonicalHostname: 'openai.com',
          sourceHostname: 'www.chat.openai.com',
          submitMode: 'enter_key',
          health: 'migrated'
        }
      }
    })
    // The site the selectors were picked for still resolves, by its own key.
    expect(ownConfig).toMatchObject({
      ok: true,
      data: {
        input: '#prompt',
        button: '#send',
        canonicalHostname: 'openai.com',
        submitMode: 'enter_key',
        health: 'migrated'
      }
    })
    // And a sibling subdomain resolves to nothing rather than to those selectors.
    expect(siblingConfig).toMatchObject({ ok: false })
    expect(siblingConfig).not.toMatchObject({ data: { input: '#prompt' } })
  })

  it('resolves a subdomain through a config saved under the canonical key', async () => {
    // The legitimate version of canonical resolution: the user saved selectors for
    // the registrable domain itself, so any host under it inherits them. This is
    // what keeps removing the field scan from breaking real setups.
    managerState.data = {
      'openai.com': {
        version: 2,
        input: '#prompt',
        button: '#send',
        inputCandidates: ['#prompt'],
        buttonCandidates: ['#send'],
        canonicalHostname: 'openai.com',
        sourceHostname: 'openai.com',
        submitMode: 'enter_key',
        health: 'ready',
        timestamp: 123
      }
    }

    const { registerAiConfigHandlers } = await import('../../../features/ai/aiConfigHandlers.js')
    registerAiConfigHandlers()

    const getConfigHandler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_AI_CONFIG)
    const resolved = await getConfigHandler?.(trustedEvent, 'app.openai.com')

    expect(resolved).toMatchObject({
      ok: true,
      data: {
        input: '#prompt',
        button: '#send',
        canonicalHostname: 'openai.com'
      }
    })
  })

  it('marks incomplete legacy configs as needs_repick during migration', async () => {
    managerState.data = {
      'claude.ai': {
        input: '#composer',
        submitMode: 'enter'
      }
    }

    const { registerAiConfigHandlers } = await import('../../../features/ai/aiConfigHandlers.js')
    registerAiConfigHandlers()

    const getConfigHandler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_AI_CONFIG)
    const allConfigs = await getConfigHandler?.(trustedEvent, undefined)

    expect(allConfigs).toMatchObject({
      ok: true,
      data: {
        'claude.ai': {
          version: 2,
          input: '#composer',
          inputCandidates: ['#composer'],
          button: null,
          buttonCandidates: null,
          submitMode: 'enter_key',
          canonicalHostname: 'claude.ai',
          sourceHostname: 'claude.ai',
          health: 'needs_repick'
        }
      }
    })
  })

  it('merges partial saves field-by-field without dropping existing selectors', async () => {
    managerState.data = {
      'claude.ai': {
        version: 2,
        input: '#composer',
        button: '#send',
        waitFor: '#composer',
        submitMode: 'mixed',
        inputCandidates: ['#composer'],
        buttonCandidates: ['#send'],
        sourceHostname: 'claude.ai',
        canonicalHostname: 'claude.ai',
        health: 'ready',
        timestamp: 10
      }
    }

    const { registerAiConfigHandlers } = await import('../../../features/ai/aiConfigHandlers.js')
    registerAiConfigHandlers()

    const saveConfigHandler = getHandler(APP_CONFIG.IPC_CHANNELS.SAVE_AI_CONFIG)
    const getConfigHandler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_AI_CONFIG)

    const saved = await saveConfigHandler?.(trustedEvent, 'claude.ai', {
      submitMode: 'click'
    })
    const config = await getConfigHandler?.(trustedEvent, 'claude.ai')

    expect(saved).toEqual({ ok: true, data: true })
    expect(config).toMatchObject({
      ok: true,
      data: {
        version: 2,
        input: '#composer',
        button: '#send',
        waitFor: '#composer',
        inputCandidates: ['#composer'],
        buttonCandidates: ['#send'],
        submitMode: 'click',
        health: 'ready'
      }
    })
  })

  it('blocks untrusted senders via ipc security', async () => {
    const { registerAiConfigHandlers } = await import('../../../features/ai/aiConfigHandlers.js')
    registerAiConfigHandlers()

    const getConfigHandler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_AI_CONFIG)
    const result = await getConfigHandler?.({ sender: { id: 999 }, type: 'invoke' }, 'claude.ai')

    expect(result).toEqual({
      ok: false,
      error: { code: 'unauthorized', message: 'Not authorized' }
    })
  })

  it('computes per-field repair clearing atomically across concurrent input and button picks', async () => {
    managerState.data = {
      'chatgpt.com': {
        version: 2,
        input: '#old-input',
        button: '#old-button',
        health: 'needs_repick',
        repair: {
          input: {
            selector: '#repair-input',
            strategy: 'candidate',
            confidenceScore: 40,
            confidenceLevel: 'low',
            firstSeenAt: 1,
            lastSeenAt: 2,
            successCount: 1,
            consecutiveSuccessCount: 1
          },
          button: {
            selector: '#repair-button',
            strategy: 'candidate',
            confidenceScore: 40,
            confidenceLevel: 'low',
            firstSeenAt: 1,
            lastSeenAt: 2,
            successCount: 1,
            consecutiveSuccessCount: 1
          }
        },
        timestamp: 100
      }
    }

    const { saveAiConfigPatch } = await import('../../../features/ai/aiConfigHandlers.js')

    // Simulate stale pre-read patches (both computed from the same snapshot where
    // both repair.input and repair.button were still present).
    await Promise.all([
      saveAiConfigPatch(
        'chatgpt.com',
        {
          version: 2,
          input: '#new-input',
          inputCandidates: ['#new-input'],
          health: 'needs_repick',
          repair: {
            button: {
              selector: '#repair-button',
              strategy: 'candidate',
              confidenceScore: 40,
              confidenceLevel: 'low',
              firstSeenAt: 1,
              lastSeenAt: 2,
              successCount: 1,
              consecutiveSuccessCount: 1
            }
          }
        },
        { pickedField: 'input' }
      ),
      saveAiConfigPatch(
        'chatgpt.com',
        {
          version: 2,
          button: '#new-button',
          buttonCandidates: ['#new-button'],
          health: 'needs_repick',
          repair: {
            input: {
              selector: '#repair-input',
              strategy: 'candidate',
              confidenceScore: 40,
              confidenceLevel: 'low',
              firstSeenAt: 1,
              lastSeenAt: 2,
              successCount: 1,
              consecutiveSuccessCount: 1
            }
          }
        },
        { pickedField: 'button' }
      )
    ])

    const finalConfig = managerState.data['chatgpt.com'] as Record<string, unknown>
    expect(finalConfig).toMatchObject({
      input: '#new-input',
      button: '#new-button',
      health: 'ready',
      repair: null
    })
  })

  it('prevents a stale auto-repair from overwriting a newer user pick', async () => {
    const now = Date.now()
    managerState.data = {
      'chatgpt.com': {
        version: 2,
        input: '#picked-input',
        button: '#picked-button',
        health: 'ready',
        repair: null,
        timestamp: now + 5000
      }
    }

    const { saveAiConfigPatch } = await import('../../../features/ai/aiConfigHandlers.js')
    const saved = await saveAiConfigPatch('chatgpt.com', {
      version: 2,
      input: '#stale-repaired-input',
      health: 'repaired',
      lastRepair: {
        repairedAt: now,
        inputSelector: '#stale-repaired-input',
        inputStrategy: 'candidate'
      }
    })

    expect(saved).toBe(false)
    expect((managerState.data['chatgpt.com'] as Record<string, unknown>).input).toBe(
      '#picked-input'
    )
  })

  it('syncs auto-derived waitFor on new input pick while preserving custom waitFor and ignoring button picks', async () => {
    const { saveAiConfigPatch } = await import('../../../features/ai/aiConfigHandlers.js')

    await saveAiConfigPatch(
      'chatgpt.com',
      { version: 2, input: '#old-input', inputCandidates: ['#old-input'] },
      { pickedField: 'input' }
    )
    expect((managerState.data['chatgpt.com'] as Record<string, unknown>).waitFor).toBe('#old-input')

    await saveAiConfigPatch(
      'chatgpt.com',
      { version: 2, button: '#send', buttonCandidates: ['#send'] },
      { pickedField: 'button' }
    )
    expect((managerState.data['chatgpt.com'] as Record<string, unknown>).waitFor).toBe('#old-input')

    await saveAiConfigPatch(
      'chatgpt.com',
      { version: 2, input: '#new-input', inputCandidates: ['#new-input'] },
      { pickedField: 'input' }
    )
    expect((managerState.data['chatgpt.com'] as Record<string, unknown>).waitFor).toBe('#new-input')

    await saveAiConfigPatch('chatgpt.com', { version: 2, waitFor: '#custom-ready-marker' })
    await saveAiConfigPatch(
      'chatgpt.com',
      { version: 2, input: '#newer-input', inputCandidates: ['#newer-input'] },
      { pickedField: 'input' }
    )
    expect((managerState.data['chatgpt.com'] as Record<string, unknown>).waitFor).toBe(
      '#custom-ready-marker'
    )
  })

  it('rejects a stale repair with a newer timestamp when baseSelector moved, while keeping valid other-field repair', async () => {
    const now = Date.now()
    managerState.data = {
      'chatgpt.com': {
        version: 2,
        input: '#manual-new-input',
        button: '#old-button',
        health: 'ready',
        repair: null,
        timestamp: now
      }
    }

    const { saveAiConfigPatch } = await import('../../../features/ai/aiConfigHandlers.js')
    const saved = await saveAiConfigPatch('chatgpt.com', {
      version: 2,
      input: '#stale-repaired-input',
      inputCandidates: ['#stale-repaired-input'],
      health: 'repaired',
      repair: {
        input: {
          selector: '#stale-repaired-input',
          strategy: 'candidate',
          confidenceScore: 80,
          confidenceLevel: 'high',
          firstSeenAt: now - 5000,
          lastSeenAt: now + 1000,
          successCount: 3,
          consecutiveSuccessCount: 3,
          baseSelector: '#old-input'
        },
        button: {
          selector: '#valid-button-candidate',
          strategy: 'candidate',
          confidenceScore: 75,
          confidenceLevel: 'high',
          firstSeenAt: now - 1000,
          lastSeenAt: now + 1000,
          successCount: 1,
          consecutiveSuccessCount: 1,
          baseSelector: '#old-button'
        }
      },
      lastRepair: {
        repairedAt: now + 1000,
        inputSelector: '#stale-repaired-input',
        baseInputSelector: '#old-input',
        inputStrategy: 'candidate'
      }
    })

    expect(saved).toBe(true)
    const updated = managerState.data['chatgpt.com'] as Record<string, unknown>
    expect(updated.input).toBe('#manual-new-input')
    expect(updated.health).toBe('ready')
    expect(updated.repair).toMatchObject({
      button: { selector: '#valid-button-candidate', baseSelector: '#old-button' }
    })
  })

  it('transitions health to ready after initial two-step setup in either order, unless other field is broken', async () => {
    const { saveAiConfigPatch } = await import('../../../features/ai/aiConfigHandlers.js')

    await saveAiConfigPatch(
      'example.org',
      { version: 2, input: '#in', inputCandidates: ['#in'] },
      { pickedField: 'input' }
    )
    expect((managerState.data['example.org'] as Record<string, unknown>).health).toBe(
      'needs_repick'
    )
    await saveAiConfigPatch(
      'example.org',
      { version: 2, button: '#btn', buttonCandidates: ['#btn'] },
      { pickedField: 'button' }
    )
    expect((managerState.data['example.org'] as Record<string, unknown>).health).toBe('ready')

    await saveAiConfigPatch(
      'other.org',
      { version: 2, button: '#btn', buttonCandidates: ['#btn'] },
      { pickedField: 'button' }
    )
    expect((managerState.data['other.org'] as Record<string, unknown>).health).toBe('needs_repick')
    await saveAiConfigPatch(
      'other.org',
      { version: 2, input: '#in', inputCandidates: ['#in'] },
      { pickedField: 'input' }
    )
    expect((managerState.data['other.org'] as Record<string, unknown>).health).toBe('ready')
  })

  it('inherits canonical config fields when picking one locator on a subdomain without mutating canonical', async () => {
    managerState.data = {
      'example.com': {
        version: 2,
        input: '#canon-input',
        inputCandidates: ['#canon-input'],
        button: '#canon-button',
        buttonCandidates: ['#canon-button'],
        waitFor: '#custom-ready',
        submitMode: 'enter_key',
        health: 'ready',
        timestamp: 100
      }
    }

    const { saveAiConfigPatch } = await import('../../../features/ai/aiConfigHandlers.js')
    await saveAiConfigPatch(
      'chat.example.com',
      { version: 2, input: '#sub-input', inputCandidates: ['#sub-input'] },
      { pickedField: 'input' }
    )

    const exact = managerState.data['chat.example.com'] as Record<string, unknown>
    expect(exact).toMatchObject({
      input: '#sub-input',
      button: '#canon-button',
      waitFor: '#custom-ready',
      submitMode: 'enter_key',
      health: 'ready'
    })
    expect((managerState.data['example.com'] as Record<string, unknown>).input).toBe('#canon-input')
  })

  it('preserves newer repair on untouched field when another repair snapshot arrives with null, and rejects stale repair on deleted primary', async () => {
    const now = Date.now()
    managerState.data = {
      'chatgpt.com': {
        version: 2,
        input: '#old-input',
        button: '#old-button',
        health: 'ready',
        repair: {
          button: {
            selector: '#newer-btn-candidate',
            strategy: 'candidate',
            confidenceScore: 80,
            confidenceLevel: 'high',
            firstSeenAt: now + 100,
            lastSeenAt: now + 200,
            successCount: 2,
            consecutiveSuccessCount: 2,
            baseSelector: '#old-button'
          }
        },
        timestamp: now + 200
      }
    }

    const { saveAiConfigPatch } = await import('../../../features/ai/aiConfigHandlers.js')
    await saveAiConfigPatch('chatgpt.com', {
      version: 2,
      repair: {
        input: {
          selector: '#new-input-candidate',
          strategy: 'candidate',
          confidenceScore: 75,
          confidenceLevel: 'high',
          firstSeenAt: now + 300,
          lastSeenAt: now + 300,
          successCount: 1,
          consecutiveSuccessCount: 1,
          baseSelector: '#old-input'
        },
        button: null
      }
    })

    const merged = managerState.data['chatgpt.com'] as Record<string, unknown>
    expect(merged.repair).toMatchObject({
      input: { selector: '#new-input-candidate' },
      button: { selector: '#newer-btn-candidate' }
    })

    // User deleted input (primary is null) -> stale repair with baseSelector '#old-input' must be rejected
    managerState.data['deleted.example'] = {
      version: 2,
      input: null,
      button: '#btn',
      health: 'needs_repick',
      repair: null,
      timestamp: now + 500
    }
    const deletedRes = await saveAiConfigPatch('deleted.example', {
      version: 2,
      input: '#stale-promoted',
      inputCandidates: ['#stale-promoted'],
      health: 'repaired',
      lastRepair: {
        repairedAt: now + 600,
        inputSelector: '#stale-promoted',
        baseInputSelector: '#old-input',
        inputStrategy: 'candidate'
      }
    })
    expect(deletedRes).toBe(false)
    expect((managerState.data['deleted.example'] as Record<string, unknown>).input).toBeNull()
  })

  it('applies intentional repair clear via repairIntent while preserving concurrent other-field candidates on repair:null', async () => {
    const now = Date.now()
    managerState.data = {
      'chatgpt.com': {
        version: 2,
        input: '#old-in',
        button: '#old-btn',
        health: 'ready',
        repair: {
          input: {
            selector: '#untrusted-in',
            strategy: 'candidate',
            confidenceScore: 30,
            confidenceLevel: 'low',
            firstSeenAt: now - 500,
            lastSeenAt: now,
            successCount: 1,
            consecutiveSuccessCount: 1,
            baseSelector: '#old-in'
          },
          button: {
            selector: '#staged-btn',
            strategy: 'candidate',
            confidenceScore: 70,
            confidenceLevel: 'high',
            firstSeenAt: now - 500,
            lastSeenAt: now,
            successCount: 2,
            consecutiveSuccessCount: 2,
            baseSelector: '#old-btn'
          }
        },
        timestamp: now
      }
    }

    const { saveAiConfigPatch } = await import('../../../features/ai/aiConfigHandlers.js')

    // 1. Intentional clear of input keeps button intact
    await saveAiConfigPatch('chatgpt.com', {
      version: 2,
      repair: {
        input: null,
        button: (managerState.data['chatgpt.com'] as { repair: { button: never } }).repair.button
      },
      repairIntent: { input: 'clear', baseTimestamp: now }
    })
    expect(
      (managerState.data['chatgpt.com'] as { repair: Record<string, unknown> }).repair
    ).toMatchObject({
      button: { selector: '#staged-btn' }
    })
    expect(
      (managerState.data['chatgpt.com'] as { repair: Record<string, unknown> }).repair.input
    ).toBeNull()

    // 2. Concurrent repair:null from an older snapshot on input must not wipe newer button candidate
    managerState.data['race.example'] = {
      version: 2,
      input: '#in',
      button: '#btn',
      health: 'ready',
      repair: {
        button: {
          selector: '#concurrent-btn',
          strategy: 'candidate',
          confidenceScore: 75,
          confidenceLevel: 'high',
          firstSeenAt: now + 100,
          lastSeenAt: now + 200,
          successCount: 1,
          consecutiveSuccessCount: 1,
          baseSelector: '#btn'
        }
      },
      timestamp: now + 200
    }
    await saveAiConfigPatch('race.example', {
      version: 2,
      repair: null,
      repairIntent: { input: 'clear', baseTimestamp: now }
    })
    expect(
      (managerState.data['race.example'] as { repair: Record<string, unknown> }).repair
    ).toMatchObject({
      button: { selector: '#concurrent-btn' }
    })
  })
})
