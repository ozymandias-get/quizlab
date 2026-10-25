import { readFileSync } from 'node:fs'
import vm from 'node:vm'

import { describe, expect, it, vi } from 'vitest'

const source = readFileSync('extensions/quizlab-session-extension/popup.js', 'utf8')
const html = readFileSync('extensions/quizlab-session-extension/popup.html', 'utf8')

async function popup(response: { success: boolean }, lastError?: { message: string }) {
  document.body.innerHTML = html
  const stored: Record<string, unknown> = {
    profileSlot: 2,
    autoSync: false,
    knownTargets: [{ siteId: 'claude', cookieDomains: ['.claude.ai'] }]
  }
  const area = {
    get: async () => stored,
    set: async (values: Record<string, unknown>) => Object.assign(stored, values)
  }
  const sendMessage = vi.fn((_message, callback) => callback(response))
  vm.runInNewContext(source, {
    document,
    console,
    chrome: {
      storage: { local: area, session: area },
      runtime: { sendMessage, lastError },
      permissions: { contains: async () => true }
    }
  })
  await vi.waitFor(() =>
    expect(document.getElementById('status')?.textContent).toContain('izin verilmiş')
  )
  return { sendMessage, stored }
}

describe('extension popup import feedback', () => {
  it('selects a destination without importing, then imports the chosen site and slot once', async () => {
    const { sendMessage } = await popup({ success: true })
    expect(document.getElementById('slot-select')).toBeNull()
    expect(sendMessage).not.toHaveBeenCalled()
    const site = document.getElementById('site-select') as HTMLSelectElement
    site.value = 'claude'
    document.getElementById('sync-btn')!.click()
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith(
      { type: 'sync_now', slot: 1, targetId: 'claude' },
      expect.any(Function)
    )
    expect(document.getElementById('sync-feedback')?.textContent).toContain('Oturumlar aktarıldı')
    expect((document.getElementById('auto-sync') as HTMLInputElement).checked).toBe(false)
  })

  it.each([undefined, { message: 'Receiving end does not exist' }])(
    'never reports a failed request as successful (%s)',
    async (lastError) => {
      await popup({ success: false }, lastError)
      document.getElementById('sync-btn')!.click()
      expect(document.getElementById('sync-feedback')?.textContent).toContain(
        'Aktarım tamamlanamadı'
      )
      expect((document.getElementById('sync-btn') as HTMLButtonElement).disabled).toBe(false)
    }
  )
})
