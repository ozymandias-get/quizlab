import { beforeEach, describe, expect, it, vi } from 'vitest'

import { wipeSiteSession } from '../../../features/web-session/siteSessionWipe.js'

const remove = vi.fn().mockResolvedValue({})
const clearStorageData = vi.fn().mockResolvedValue(undefined)
const flushStorageData = vi.fn()
const get = vi.fn().mockResolvedValue([
  { name: 'session', domain: '.chatgpt.com', path: '/', secure: true },
  { name: 'session', domain: '.openai.com', path: '/', secure: true }
])

const TARGET = {
  siteId: 'chatgpt',
  hostname: 'chatgpt.com',
  partition: 'persist:ai_chatgpt',
  cookieDomains: ['.chatgpt.com', '.openai.com'],
  labelKey: 'ws_target_chatgpt',
  kind: 'builtin' as const,
  memberAppIds: ['chatgpt']
}

function fakeSession() {
  return { cookies: { get, remove }, clearStorageData, flushStorageData } as never
}

describe('wipeSiteSession', () => {
  beforeEach(() => {
    remove.mockClear()
    clearStorageData.mockClear()
    flushStorageData.mockClear()
    get.mockClear()
  })

  it('removes the cookies of every listed domain', async () => {
    await wipeSiteSession({ cookies: { get, remove }, clearStorageData } as never, TARGET)
    expect(remove).toHaveBeenCalledWith('https://chatgpt.com/', 'session')
    expect(remove).toHaveBeenCalledWith('https://openai.com/', 'session')
  })

  it('clears the storage of the target origin only', async () => {
    await wipeSiteSession({ cookies: { get, remove }, clearStorageData } as never, TARGET)
    expect(clearStorageData).toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'https://chatgpt.com' })
    )
  })

  it('leaves the cookies of another site untouched', async () => {
    get.mockResolvedValue([{ name: 'other', domain: '.claude.ai', path: '/', secure: true }])
    await wipeSiteSession(fakeSession(), TARGET)
    expect(remove).not.toHaveBeenCalled()
  })

  it('removes a cookie that is not secure over http and https', async () => {
    get.mockResolvedValue([{ name: 'plain', domain: '.chatgpt.com', path: '/', secure: false }])
    await wipeSiteSession(fakeSession(), TARGET)
    expect(remove).toHaveBeenCalledWith('https://chatgpt.com/', 'plain')
    expect(remove).toHaveBeenCalledWith('http://chatgpt.com/', 'plain')
  })

  it('clears only the storages of the target origin', async () => {
    await wipeSiteSession(fakeSession(), TARGET)
    expect(clearStorageData).toHaveBeenCalledWith({
      origin: 'https://chatgpt.com',
      storages: ['localstorage', 'indexdb', 'serviceworkers', 'cachestorage']
    })
  })

  it('flushes the storage data when the session is done', async () => {
    await wipeSiteSession(fakeSession(), TARGET)
    expect(flushStorageData).toHaveBeenCalled()
  })
})
