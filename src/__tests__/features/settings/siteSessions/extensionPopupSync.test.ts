import { readFileSync } from 'node:fs'
import vm from 'node:vm'

import { describe, expect, it, vi } from 'vitest'

const source = readFileSync('extensions/quizlab-session-extension/popup.js', 'utf8')
const html = readFileSync('extensions/quizlab-session-extension/popup.html', 'utf8')

interface PopupOptions {
  /** The answer of the worker to a message. */
  response?:
    Record<string, unknown> | ((message: Record<string, unknown>) => Record<string, unknown>)
  lastError?: { message: string }
  stored?: Record<string, unknown>
  /** Holds every response until `resolvePending` is called. */
  deferred?: boolean
}

async function popup(options: PopupOptions = {}) {
  document.body.innerHTML = html
  const stored: Record<string, unknown> = {
    autoSync: true,
    profileName: 'Old Chrome',
    knownTargets: [{ siteId: 'claude', cookieDomains: ['.claude.ai'] }],
    ...options.stored
  }
  const area = {
    get: async (keys: string | string[]) => {
      const list = Array.isArray(keys) ? keys : [keys]
      const result: Record<string, unknown> = {}
      for (const key of list) {
        if (Object.hasOwn(stored, key)) result[key] = stored[key]
      }
      return result
    },
    set: async (values: Record<string, unknown>) => Object.assign(stored, values)
  }
  const pending: Array<() => void> = []
  const sendMessage = vi.fn(
    (message: Record<string, unknown>, callback: (value: unknown) => void) => {
      const respond = () => {
        const response =
          typeof options.response === 'function'
            ? options.response(message)
            : (options.response ?? {})
        callback(response)
      }
      if (options.deferred) pending.push(respond)
      else respond()
    }
  )
  vm.runInNewContext(source, {
    document,
    console,
    chrome: {
      storage: { local: area, session: area },
      runtime: { sendMessage, lastError: options.lastError },
      permissions: { contains: async () => true }
    }
  })
  await vi.waitFor(() =>
    expect(document.getElementById('status')?.textContent).toContain('izin verilmiş')
  )
  return {
    sendMessage,
    stored,
    resolvePending: () => {
      const responses = pending.splice(0, pending.length)
      for (const respond of responses) respond()
    }
  }
}

function autoCheckbox(): HTMLInputElement {
  return document.getElementById('auto-sync') as HTMLInputElement
}

function autoSyncMessages(sendMessage: ReturnType<typeof vi.fn>) {
  return sendMessage.mock.calls.filter(
    ([message]) => (message as Record<string, unknown>).type === 'set_auto_sync'
  )
}

describe('extension popup import feedback', () => {
  it('selects a destination without importing, then imports the chosen site once', async () => {
    const { sendMessage } = await popup({ response: { success: true, autoSync: false } })
    expect(sendMessage).not.toHaveBeenCalled()
    const site = document.getElementById('site-select') as HTMLSelectElement
    site.value = 'claude'
    document.getElementById('sync-btn')!.click()
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith(
      { type: 'sync_now', targetId: 'claude' },
      expect.any(Function)
    )
    expect(document.getElementById('sync-feedback')?.textContent).toContain('Oturumlar aktarıldı')
  })

  it('shows the preference the worker reports after a manual transfer', async () => {
    // The product contract: a delivered manual transfer stops the automatic
    // mirror, and the popup shows the value the worker really persisted.
    const { sendMessage } = await popup({ response: { success: true, autoSync: false } })
    expect(autoCheckbox().checked).toBe(true)

    document.getElementById('sync-btn')!.click()

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(autoCheckbox().checked).toBe(false)
  })

  it('does not stop the automatic mirror when the manual transfer failed', async () => {
    const { sendMessage } = await popup({ response: { success: false, autoSync: true } })

    document.getElementById('sync-btn')!.click()

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(autoCheckbox().checked).toBe(true)
  })

  it('reports a browser with no session instead of a failed transfer', async () => {
    await popup({ response: { success: false, result: 'no_cookies', autoSync: true } })

    document.getElementById('sync-btn')!.click()

    expect(document.getElementById('sync-feedback')?.textContent).toContain('oturum çerezi')
    expect(document.getElementById('sync-feedback')?.textContent).not.toContain(
      'Aktarım tamamlanamadı'
    )
  })

  it.each([undefined, { message: 'Receiving end does not exist' }])(
    'never reports a failed request as successful (%s)',
    async (lastError) => {
      await popup({ response: { success: false }, lastError })
      document.getElementById('sync-btn')!.click()
      expect(document.getElementById('sync-feedback')?.textContent).toContain(
        'Aktarım tamamlanamadı'
      )
      expect((document.getElementById('sync-btn') as HTMLButtonElement).disabled).toBe(false)
    }
  )

  it('does not turn off the displayed automatic setting when the worker is unreachable', async () => {
    await popup({
      response: { success: false },
      lastError: { message: 'Receiving end does not exist' }
    })
    const auto = autoCheckbox()
    expect(auto.checked).toBe(true)
    document.getElementById('sync-btn')!.click()
    expect(auto.checked).toBe(true)
  })
})

describe('the automatic sync switch', () => {
  it('saves the new value and keeps the checkbox on it', async () => {
    const { sendMessage, stored } = await popup({
      response: { success: true, settingsSaved: true }
    })
    const auto = autoCheckbox()
    auto.checked = false
    auto.dispatchEvent(new Event('change'))

    await vi.waitFor(() => expect(stored.autoSync).toBeDefined())
    expect(autoSyncMessages(sendMessage)).toEqual([
      [{ type: 'set_auto_sync', enabled: false }, expect.any(Function)]
    ])
    expect(auto.checked).toBe(false)
  })

  it('returns the checkbox to the stored value when its write fails', async () => {
    const { stored } = await popup({
      response: { success: false, settingsSaved: false }
    })
    const auto = autoCheckbox()
    expect(auto.checked).toBe(true)

    auto.checked = false
    auto.dispatchEvent(new Event('change'))

    // The checkbox may not show an off state that the worker never stored.
    expect(auto.checked).toBe(true)
    expect(stored.autoSync).toBe(true)
    expect(document.getElementById('sync-feedback')?.textContent).toContain('kaydedilemedi')
  })

  it('keeps a saved preference when only the transfer it triggered failed', async () => {
    const { stored } = await popup({
      response: { success: false, settingsSaved: true }
    })
    const auto = autoCheckbox()
    auto.checked = false
    auto.dispatchEvent(new Event('change'))

    expect(auto.checked).toBe(false)
    expect(stored.autoSync).toBe(true)
    expect(document.getElementById('sync-feedback')?.textContent).toContain(
      'ayarı kaydedildi ancak'
    )
  })

  it('sends one request for a switch clicked twice before the answer', async () => {
    const { sendMessage, resolvePending } = await popup({
      response: { success: true, settingsSaved: true },
      deferred: true
    })
    const auto = autoCheckbox()

    auto.checked = false
    auto.dispatchEvent(new Event('change'))
    // The second click happens while the first write is still on its way.
    auto.checked = true
    auto.dispatchEvent(new Event('change'))

    expect(autoSyncMessages(sendMessage)).toHaveLength(1)
    resolvePending()
    await vi.waitFor(() => expect(auto.disabled).toBe(false))
    expect(auto.checked).toBe(false)
  })
})

describe('the profile name form', () => {
  it('keeps the persisted name when the rename cannot be saved', async () => {
    await popup({ response: { success: false, error: 'storage_failed' } })

    const input = document.getElementById('profile-name-input') as HTMLInputElement
    input.value = 'New Chrome'
    document.getElementById('profile-name-btn')!.click()

    await vi.waitFor(() =>
      expect(document.getElementById('profile-feedback')?.textContent).toContain('kaydedilemedi')
    )
    expect(document.getElementById('profile-label')?.textContent).toContain('Old Chrome')
    expect(document.getElementById('profile-label')?.textContent).not.toContain('New Chrome')
  })
})
