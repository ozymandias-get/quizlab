import { readFileSync } from 'node:fs'
import vm from 'node:vm'

import { afterEach, describe, expect, it, vi } from 'vitest'

const sidepanelSource = readFileSync('extensions/quizlab-session-extension/sidepanel.js', 'utf8')
const sidepanelHtml = readFileSync('extensions/quizlab-session-extension/sidepanel.html', 'utf8')
const engineSource = readFileSync(
  'extensions/quizlab-session-extension/content/selector-engine.js',
  'utf8'
)
const pickerSource = readFileSync('extensions/quizlab-session-extension/content/picker.js', 'utf8')

interface PanelSetupOptions {
  stored?: Record<string, unknown>
  activeTabId?: number | null | (() => number | null)
  selectorState?: Record<string, unknown> | ((tabId: number) => Record<string, unknown>)
  onMessage?: (message: Record<string, unknown>) => Record<string, unknown> | undefined
  permissionGranted?: boolean
}

async function setupSidePanel(options: PanelSetupOptions = {}) {
  document.body.innerHTML = sidepanelHtml
  const stored: Record<string, unknown> = {
    autoSync: true,
    profileName: 'Ana Chrome',
    bridgeSecret: 'a'.repeat(64),
    knownTargets: [{ siteId: 'chatgpt', cookieDomains: ['.chatgpt.com'] }],
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

  const sendMessage = vi.fn(
    (message: Record<string, unknown>, callback?: (value: unknown) => void) => {
      let response: Record<string, unknown> = { success: true }
      if (message.type === 'selector_state') {
        const state =
          typeof options.selectorState === 'function'
            ? options.selectorState(message.tabId as number)
            : (options.selectorState ?? {
                connection: 'ok',
                supported: 'selectors',
                host: 'chatgpt.com',
                permission: true,
                ambiguous: false,
                site: {
                  siteId: 'chatgpt',
                  displayName: 'ChatGPT',
                  hostname: 'chatgpt.com',
                  fields: ['input', 'button'],
                  status: { input: 'missing', button: 'missing' }
                },
                activeSession: null,
                lastOutcome: null
              })
        response = { success: true, ...state }
      } else if (options.onMessage) {
        response = options.onMessage(message) ?? { success: true }
      }
      callback?.(response)
    }
  )

  const permissionsRequest = vi.fn(async () => options.permissionGranted ?? true)
  const tabListeners: Array<() => void> = []
  const runtimeListeners: Array<(msg: unknown) => void> = []

  vm.runInNewContext(sidepanelSource, {
    document,
    console,
    CustomEvent,
    chrome: {
      storage: { local: area, session: area },
      runtime: {
        sendMessage,
        onMessage: {
          addListener: (fn: (msg: unknown) => void) => runtimeListeners.push(fn)
        }
      },
      tabs: {
        query: (_query: unknown, cb: (tabs: Array<{ id: number }>) => void) => {
          const id =
            typeof options.activeTabId === 'function'
              ? options.activeTabId()
              : (options.activeTabId ?? 10)
          cb(id === null ? [] : [{ id }])
        },
        onActivated: { addListener: (fn: () => void) => tabListeners.push(fn) },
        onUpdated: { addListener: () => {} }
      },
      permissions: {
        contains: async () => true,
        request: permissionsRequest
      }
    }
  })

  await vi.waitFor(() => {
    const tone = document.getElementById('connection-pill')?.dataset.tone
    expect(tone).toBeDefined()
    expect(tone).not.toBe('idle')
  })

  return { sendMessage, permissionsRequest, tabListeners, runtimeListeners }
}

describe('Side Panel Magic Selector UI & state consistency', () => {
  it('collapses settings drawer when paired and auto-opens when unpaired', async () => {
    await setupSidePanel({ stored: { bridgeSecret: 'b'.repeat(64) } })
    expect(document.getElementById('settings-drawer')?.hidden).toBe(true)

    await setupSidePanel({
      stored: { bridgeSecret: undefined },
      selectorState: { connection: 'unpaired', supported: 'selectors', site: null }
    })
    expect(document.getElementById('settings-drawer')?.hidden).toBe(false)
    expect(document.getElementById('selector-empty-state')?.hidden).toBe(false)
    expect(document.getElementById('selector-empty-desc')?.textContent).toContain('eşleştir')
  })

  it('switches between Sihirli Seçici and Oturumlar tabs via click and keyboard', async () => {
    await setupSidePanel()
    const tabSelector = document.getElementById('tab-selector')!
    const tabSessions = document.getElementById('tab-sessions')!
    const panelSelector = document.getElementById('panel-selector')!
    const panelSessions = document.getElementById('panel-sessions')!

    expect(panelSelector.hidden).toBe(false)
    expect(panelSessions.hidden).toBe(true)

    tabSelector.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(panelSelector.hidden).toBe(true)
    expect(panelSessions.hidden).toBe(false)
    expect(tabSessions.getAttribute('aria-selected')).toBe('true')

    tabSessions.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(panelSelector.hidden).toBe(false)
    expect(panelSessions.hidden).toBe(true)
  })

  it('renders direct field cards with 1/2 progress and disables unsupported fields', async () => {
    const { sendMessage } = await setupSidePanel({
      selectorState: {
        connection: 'ok',
        supported: 'selectors',
        host: 'chatgpt.com',
        permission: true,
        site: {
          siteId: 'chatgpt',
          displayName: 'ChatGPT',
          hostname: 'chatgpt.com',
          fields: ['input'],
          status: { input: 'ready', button: 'missing' }
        }
      }
    })

    expect(document.getElementById('selector-progress')?.textContent).toBe('1/1 alan kayıtlı')
    const inputBtn = document.getElementById('pick-input-btn') as HTMLButtonElement
    const buttonBtn = document.getElementById('pick-button-btn') as HTMLButtonElement
    expect(inputBtn.disabled).toBe(false)
    expect(inputBtn.textContent).toBe('Alanı Yeniden Seç')
    expect(buttonBtn.disabled).toBe(true)

    inputBtn.click()
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        { type: 'selector_start', tabId: 10, field: 'input' },
        expect.any(Function)
      )
    )
  })

  it('shows next-step guidance after saving first field without auto-starting', async () => {
    const { sendMessage } = await setupSidePanel({
      selectorState: {
        connection: 'ok',
        supported: 'selectors',
        host: 'chatgpt.com',
        permission: true,
        site: {
          siteId: 'chatgpt',
          displayName: 'ChatGPT',
          hostname: 'chatgpt.com',
          fields: ['input', 'button'],
          status: { input: 'ready', button: 'missing' }
        },
        lastOutcome: {
          state: 'saved',
          hostname: 'chatgpt.com',
          field: 'input',
          selector: '#prompt-textarea'
        }
      }
    })

    expect(document.getElementById('selector-next-step')?.hidden).toBe(false)
    expect(document.getElementById('selector-next-text')?.textContent).toContain(
      'gönderme butonunu seç'
    )
    expect(
      sendMessage.mock.calls.some(([m]) => (m as { type: string }).type === 'selector_start')
    ).toBe(false)
  })

  it('prevents stale host start when active tab changes before click', async () => {
    let activeTab = 10
    const { sendMessage } = await setupSidePanel({
      activeTabId: () => activeTab,
      selectorState: (tabId) =>
        tabId === 10
          ? {
              connection: 'ok',
              supported: 'selectors',
              host: 'chatgpt.com',
              permission: true,
              site: {
                siteId: 'chatgpt',
                displayName: 'ChatGPT',
                hostname: 'chatgpt.com',
                fields: ['input', 'button'],
                status: { input: 'missing', button: 'missing' }
              }
            }
          : {
              connection: 'ok',
              supported: 'selectors',
              host: 'example.com',
              permission: true,
              site: null
            }
    })

    // User switches tab before clicking the button
    activeTab = 20
    document.getElementById('pick-input-btn')!.click()

    await vi.waitFor(() =>
      expect(document.getElementById('selector-empty-state')?.hidden).toBe(false)
    )
    expect(
      sendMessage.mock.calls.some(([m]) => (m as { type: string }).type === 'selector_start')
    ).toBe(false)
  })
})

describe('In-page Magic Selector (content/picker.js)', () => {
  const cleanups: Array<() => void> = []
  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.()
    }
  })

  function setupPicker(
    field: 'input' | 'button' = 'input',
    sendResponse?: (msg: unknown) => unknown
  ) {
    document.body.innerHTML = `
      <main>
        <textarea id="prompt-textarea" placeholder="Mesaj yazın..."></textarea>
        <button id="send-btn" type="button" aria-label="Gönder">Gönder</button>
        <div id="noise-box">Sadece metin</div>
      </main>
    `
    const textarea = document.getElementById('prompt-textarea')!
    const sendBtn = document.getElementById('send-btn')!
    const noiseBox = document.getElementById('noise-box')!

    // Give elements realistic bounding rects in jsdom
    vi.spyOn(textarea, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 600,
      right: 500,
      bottom: 680,
      width: 400,
      height: 80,
      x: 100,
      y: 600,
      toJSON: () => ({})
    })
    vi.spyOn(sendBtn, 'getBoundingClientRect').mockReturnValue({
      left: 510,
      top: 620,
      right: 560,
      bottom: 660,
      width: 50,
      height: 40,
      x: 510,
      y: 620,
      toJSON: () => ({})
    })
    vi.spyOn(noiseBox, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 120,
      right: 300,
      bottom: 160,
      width: 200,
      height: 40,
      x: 100,
      y: 120,
      toJSON: () => ({})
    })

    const trustedEvents = new WeakSet<Event>()
    const listeners: Array<(msg: unknown) => void> = []
    const sendMessage = vi.fn((msg: unknown, cb?: (res: unknown) => void) => {
      cb?.(sendResponse ? sendResponse(msg) : { ok: true })
    })

    const ctx: Record<string, unknown> = {
      window,
      document,
      console,
      AbortController,
      URL,
      HTMLElement,
      Element,
      Node,
      __quizlabPickerTestHandles: true,
      __quizlabPickerTestTrustedEvents: trustedEvents,
      chrome: {
        runtime: {
          sendMessage,
          onMessage: {
            addListener: (fn: (m: unknown) => void) => listeners.push(fn),
            removeListener: () => {}
          }
        }
      }
    }
    vm.runInNewContext(`${engineSource}\n${pickerSource}`, ctx)
    if (typeof ctx.__quizlabPickerCleanup === 'function') {
      cleanups.push(ctx.__quizlabPickerCleanup as () => void)
    }

    for (const fn of listeners) {
      fn({
        type: 'quizlab_selector_init',
        sessionId: 'sess-1',
        field,
        startHref: window.location.href
      })
    }

    const ui = ctx.__quizlabPickerTestUi as {
      toolbar: HTMLElement
      toolbarHint: HTMLElement
      panel: HTMLElement
      panelTitle: HTMLElement
      panelMessage: HTMLElement
      techDetails: HTMLDetailsElement
      confirmButton: HTMLButtonElement
      reselectButton: HTMLButtonElement
      cancelButton: HTMLButtonElement
      box: HTMLElement
      label: HTMLElement
      host: HTMLElement
    }

    const trust = <T extends Event>(ev: T) => {
      trustedEvents.add(ev)
      return ev
    }

    return { textarea, sendBtn, noiseBox, ui, trust, sendMessage }
  }

  it('shows top toolbar, rejects incompatible click without closing, and positions panel away from bottom composer', () => {
    const { textarea, noiseBox, ui, trust } = setupPicker('input')

    expect(ui.toolbar.style.display).toBe('flex')
    expect(ui.panel.style.display).toBe('none')

    // Clicking incompatible div keeps picker open and warns in toolbar
    noiseBox.dispatchEvent(trust(new Event('pointerdown', { bubbles: true })))
    expect(ui.panel.style.display).toBe('none')
    expect(ui.toolbarHint.textContent).toContain('uygun değil')

    // Clicking compatible textarea freezes and places panel at top (away from bottom composer)
    textarea.dispatchEvent(trust(new Event('pointerdown', { bubbles: true })))
    expect(ui.panel.style.display).toBe('block')
    expect(ui.panel.style.top).toBe('72px')
    expect(ui.techDetails.open).toBe(false)
  })

  it('keeps selection on site_not_open and allows retry', async () => {
    const { textarea, ui, trust, sendMessage } = setupPicker('input', () => ({
      ok: false,
      state: 'site_not_open'
    }))

    textarea.dispatchEvent(trust(new Event('pointerdown', { bubbles: true })))
    ui.confirmButton.dispatchEvent(trust(new MouseEvent('click', { bubbles: true })))

    await vi.waitFor(() => expect(ui.panelMessage.textContent).toContain('QuizLab’da aç'))
    expect(ui.confirmButton.textContent).toBe('Tekrar Gönder')
    expect(sendMessage).toHaveBeenCalledTimes(1)
  })

  it('cancels on Escape and removes picker host from DOM', () => {
    const { ui, trust, sendMessage } = setupPicker('button')
    window.dispatchEvent(trust(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(sendMessage).toHaveBeenCalledWith(
      { type: 'selector_pick_cancelled', sessionId: 'sess-1' },
      expect.any(Function)
    )
    expect(ui.host.isConnected).toBe(false)
  })
})
