import { beforeEach, describe, expect, it, vi } from 'vitest'

import { wipeSiteSession } from '../../../features/web-session/siteSessionWipe.js'

const remove = vi.fn()
const clearStorageData = vi.fn()
const clearAuthCache = vi.fn()
const flushStorageData = vi.fn()
const get = vi.fn()

const TARGET = {
  siteId: 'chatgpt',
  hostname: 'chatgpt.com',
  origins: ['https://chatgpt.com'],
  partition: 'persist:ai_chatgpt',
  cookieDomains: ['.chatgpt.com', '.openai.com'],
  labelKey: 'ws_target_chatgpt',
  kind: 'builtin' as const,
  memberAppIds: ['chatgpt']
}

function fakeSession() {
  return { cookies: { get, remove }, clearStorageData, clearAuthCache, flushStorageData } as never
}

describe('wipeSiteSession', () => {
  beforeEach(() => {
    // Every test starts from a known state: `mockClear` would keep the
    // implementation the previous test left behind.
    remove.mockReset().mockResolvedValue({})
    clearStorageData.mockReset().mockResolvedValue(undefined)
    clearAuthCache.mockReset().mockResolvedValue(undefined)
    flushStorageData.mockReset()
    get.mockReset().mockResolvedValue([
      { name: 'session', domain: '.chatgpt.com', path: '/', secure: true },
      { name: 'session', domain: '.openai.com', path: '/', secure: true }
    ])
  })

  it('removes the cookies of every listed domain', async () => {
    await wipeSiteSession(fakeSession(), TARGET)
    expect(remove).toHaveBeenCalledWith('https://chatgpt.com/', 'session')
    expect(remove).toHaveBeenCalledWith('https://openai.com/', 'session')
  })

  it('clears the storage of the target origin only', async () => {
    await wipeSiteSession(fakeSession(), TARGET)
    expect(clearStorageData).toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'https://chatgpt.com' })
    )
  })

  it('clears the storage of every origin the site lives on', async () => {
    // A site may live on more than one origin: the Google group is four apps
    // on four hosts, and a wipe that missed one of them would leave the site
    // signed in.
    await wipeSiteSession(fakeSession(), {
      ...TARGET,
      siteId: 'google',
      origins: [
        'https://gemini.google.com',
        'https://aistudio.google.com',
        'https://www.youtube.com',
        'https://drive.google.com'
      ]
    })

    const clearedOrigins = clearStorageData.mock.calls.map(([options]) => options.origin)
    expect(clearedOrigins).toEqual([
      'https://gemini.google.com',
      'https://aistudio.google.com',
      'https://www.youtube.com',
      'https://drive.google.com'
    ])
  })

  it('never clears the storage of an origin the site does not live on', async () => {
    await wipeSiteSession(fakeSession(), TARGET)
    const clearedOrigins = clearStorageData.mock.calls.map(([options]) => options.origin)
    expect(clearedOrigins).not.toContain('https://accounts.google.com')
    expect(clearedOrigins).not.toContain('https://claude.ai')
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

  it('clears the auth cache of the partition', async () => {
    // A site that authenticates with HTTP basic auth keeps its credentials
    // there; without this the next visit would still be signed in.
    await wipeSiteSession(fakeSession(), TARGET)
    expect(clearAuthCache).toHaveBeenCalled()
  })

  it('clears the storage even when the cookie store cannot be read', async () => {
    get.mockRejectedValue(new Error('cookie store unavailable'))

    await wipeSiteSession(fakeSession(), TARGET)

    expect(clearStorageData).toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'https://chatgpt.com' })
    )
  })

  it('flushes the storage data when the session is done', async () => {
    await wipeSiteSession(fakeSession(), TARGET)
    expect(flushStorageData).toHaveBeenCalled()
  })
})
