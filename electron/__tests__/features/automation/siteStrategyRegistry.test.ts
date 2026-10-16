import {
  __resetSiteStrategiesForTests,
  findStrategiesForHostname,
  getRegisteredStrategies,
  listApplicableStrategies,
  registerSiteStrategy
} from '@electron/features/automation/automationScripts/lib/siteStrategyRegistry'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

function makeFakeProduce(label: string) {
  return (kind: 'input' | 'button') =>
    kind === 'input'
      ? {
          element: document.createElement('textarea'),
          matchedSelector: label + ':input',
          strategy: 'provider' as const
        }
      : {
          element: document.createElement('button'),
          matchedSelector: label + ':button',
          strategy: 'provider' as const
        }
}

describe('siteStrategyRegistry', () => {
  beforeEach(() => {
    __resetSiteStrategiesForTests()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    __resetSiteStrategiesForTests()
  })

  it('registers a new strategy and retrieves it', () => {
    registerSiteStrategy({
      id: 'test:foo',
      match: { hostPatterns: ['foo.example.com'] },
      produce: makeFakeProduce('test:foo')
    })

    const all = getRegisteredStrategies()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe('test:foo')
  })

  it('replaces existing strategy with the same id', () => {
    registerSiteStrategy({
      id: 'test:foo',
      match: { hostPatterns: ['foo.com'] },
      produce: makeFakeProduce('v1')
    })
    registerSiteStrategy({
      id: 'test:foo',
      match: { hostPatterns: ['foo.com'] },
      produce: makeFakeProduce('v2')
    })

    expect(getRegisteredStrategies()).toHaveLength(1)
    const match = findStrategiesForHostname('foo.com')
    expect(match).toHaveLength(1)
    const first = match[0]
    expect(first).toBeDefined()
    const candidate = first!.produce('input')
    expect(candidate).not.toBeNull()
    expect(candidate!.matchedSelector).toBe('v2:input')
  })

  it('matches hostname with multi-pattern strategy', () => {
    registerSiteStrategy({
      id: 'test:multi',
      match: { hostPatterns: ['chat', 'anthropic'] },
      produce: makeFakeProduce('multi')
    })

    expect(findStrategiesForHostname('chat.anthropic.com')).toHaveLength(1)
    expect(findStrategiesForHostname('anthropic.com')).toHaveLength(0) // missing 'chat'
    expect(findStrategiesForHostname('chat.foo.com')).toHaveLength(0) // missing 'anthropic'
    expect(findStrategiesForHostname('CHAT.ANTHROPIC.com')).toHaveLength(1) // case-insensitive
  })

  it('sorts matches by priority (highest first)', () => {
    registerSiteStrategy({
      id: 'test:low',
      match: { hostPatterns: ['claude'], priority: 1 },
      produce: makeFakeProduce('low')
    })
    registerSiteStrategy({
      id: 'test:high',
      match: { hostPatterns: ['claude'], priority: 10 },
      produce: makeFakeProduce('high')
    })
    registerSiteStrategy({
      id: 'test:mid',
      match: { hostPatterns: ['claude'], priority: 5 },
      produce: makeFakeProduce('mid')
    })

    const matches = findStrategiesForHostname('claude.ai')
    expect(matches.map((m) => m.id)).toEqual(['test:high', 'test:mid', 'test:low'])
  })

  it('returns empty array when no strategies match', () => {
    registerSiteStrategy({
      id: 'test:foo',
      match: { hostPatterns: ['foo.com'] },
      produce: makeFakeProduce('foo')
    })
    expect(findStrategiesForHostname('bar.com')).toEqual([])
  })

  it('default priority is 0 for entries that omit it', () => {
    registerSiteStrategy({
      id: 'test:default',
      match: { hostPatterns: ['bar'] },
      produce: makeFakeProduce('default')
    })
    registerSiteStrategy({
      id: 'test:high',
      match: { hostPatterns: ['bar'], priority: 5 },
      produce: makeFakeProduce('high')
    })

    const matches = findStrategiesForHostname('bar.example.com')
    expect(matches[0].id).toBe('test:high')
    expect(matches[1].id).toBe('test:default')
  })

  it('listApplicableStrategies eagerly registers built-ins on first call', () => {
    expect(getRegisteredStrategies()).toHaveLength(0)
    const matches = listApplicableStrategies('claude.ai')
    expect(matches.length).toBeGreaterThan(0)
    expect(matches.some((s) => s.id === 'builtin:claude')).toBe(true)
    // Generic fallback is registered eagerly at module load
    expect(getRegisteredStrategies().some((s) => s.id === 'builtin:generic')).toBe(true)
  })

  it('generic fallback (priority -100) loses to site-specific strategies', () => {
    listApplicableStrategies('claude.ai') // ensure builtins
    const matches = findStrategiesForHostname('claude.ai')
    const firstId = matches[0].id
    const lastId = matches[matches.length - 1].id
    expect(firstId).toBe('builtin:claude')
    expect(lastId).toBe('builtin:generic')
  })

  it('generic fallback is the only match on unknown hostnames', () => {
    listApplicableStrategies('chat.example.org') // ensure builtins
    const matches = findStrategiesForHostname('chat.example.org')
    expect(matches).toHaveLength(1)
    expect(matches[0].id).toBe('builtin:generic')
  })

  it('registers all builtin strategies for known providers', () => {
    listApplicableStrategies('chat.deepseek.com')
    listApplicableStrategies('chat.qwen.ai')
    listApplicableStrategies('kimi.moonshot.cn')
    const ids = getRegisteredStrategies().map((s) => s.id)
    expect(ids).toContain('builtin:claude')
    expect(ids).toContain('builtin:deepseek')
    expect(ids).toContain('builtin:qwen')
    expect(ids).toContain('builtin:kimi')
    expect(ids).toContain('builtin:generic')
  })

  it('user-registered strategy can be added alongside built-ins', () => {
    listApplicableStrategies('claude.ai') // ensure builtins loaded
    registerSiteStrategy({
      id: 'user:custom',
      match: { hostPatterns: ['claude.ai'], priority: 1000 },
      produce: makeFakeProduce('user:custom')
    })

    const matches = findStrategiesForHostname('claude.ai')
    expect(matches[0].id).toBe('user:custom')
  })

  describe('generic DOM-based fallback produce functions', () => {
    // JSDOM's getBoundingClientRect returns 0,0,0,0 by default. The produce
    // helpers check the rect, so we mock it on each test element.
    function mockRect(el: Element, width: number, height: number) {
      el.getBoundingClientRect = () =>
        ({
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          bottom: height,
          right: width,
          width,
          height,
          toJSON: () => ({})
        }) as DOMRect
    }

    /** Same, for every element inside a subtree written via innerHTML. */
    function mockAllRects(root: ParentNode, width = 40, height = 40) {
      root.querySelectorAll('*').forEach((el) => mockRect(el, width, height))
    }

    /** The composer-scoped button lookup is exposed through builtin:* strategies. */
    function produceButton(strategyId = 'builtin:chatgpt', hostname = 'chatgpt.com') {
      const matches = listApplicableStrategies(hostname)
      const strategy = matches.find((s) => s.id === strategyId)!
      return strategy.produce('button')
    }

    it('tryGenericInputFallback finds a visible textarea', () => {
      listApplicableStrategies('claude.ai')
      const textarea = document.createElement('textarea')
      Object.defineProperty(textarea, 'offsetWidth', { configurable: true, value: 200 })
      Object.defineProperty(textarea, 'offsetHeight', { configurable: true, value: 40 })
      mockRect(textarea, 200, 40)
      document.body.appendChild(textarea)

      const matches = findStrategiesForHostname('claude.ai')
      const claude = matches.find((s) => s.id === 'builtin:claude')!
      const result = claude.produce('input')
      expect(result).not.toBeNull()
      expect(result!.element).toBe(textarea)
      expect(result!.matchedSelector).toContain('textarea')
    })

    it('tryGenericInputFallback returns null when no input element exists', () => {
      listApplicableStrategies('claude.ai')
      const matches = findStrategiesForHostname('claude.ai')
      const claude = matches.find((s) => s.id === 'builtin:claude')!
      const result = claude.produce('input')
      expect(result).toBeNull()
    })

    it('tryGenericInputFallback skips elements that are too small (header vs composer)', () => {
      listApplicableStrategies('claude.ai')
      const tiny = document.createElement('textarea')
      Object.defineProperty(tiny, 'offsetWidth', { configurable: true, value: 10 })
      Object.defineProperty(tiny, 'offsetHeight', { configurable: true, value: 5 })
      mockRect(tiny, 10, 5)
      document.body.appendChild(tiny)

      const matches = findStrategiesForHostname('claude.ai')
      const claude = matches.find((s) => s.id === 'builtin:claude')!
      const result = claude.produce('input')
      expect(result).toBeNull()
    })

    it('tryGenericButtonFallback finds a send button with aria-label', () => {
      listApplicableStrategies('claude.ai')
      const button = document.createElement('button')
      button.setAttribute('aria-label', 'Send message')
      Object.defineProperty(button, 'offsetWidth', { configurable: true, value: 40 })
      Object.defineProperty(button, 'offsetHeight', { configurable: true, value: 20 })
      mockRect(button, 40, 20)
      document.body.appendChild(button)

      const matches = findStrategiesForHostname('claude.ai')
      const claude = matches.find((s) => s.id === 'builtin:claude')!
      const result = claude.produce('button')
      expect(result).not.toBeNull()
      expect(result!.element).toBe(button)
    })

    it('tryGenericButtonFallback returns null when no send button exists', () => {
      listApplicableStrategies('claude.ai')
      const matches = findStrategiesForHostname('claude.ai')
      const claude = matches.find((s) => s.id === 'builtin:claude')!
      const result = claude.produce('button')
      expect(result).toBeNull()
    })

    it('all builtin strategies share the same DOM-based produce functions', () => {
      listApplicableStrategies('chat.deepseek.com')
      const matches = findStrategiesForHostname('chat.deepseek.com')
      const deepseek = matches.find((s) => s.id === 'builtin:deepseek')!
      // builtin:generic de eşleşmeli
      const generic = matches.find((s) => s.id === 'builtin:generic')!
      const ta = document.createElement('textarea')
      Object.defineProperty(ta, 'offsetWidth', { configurable: true, value: 200 })
      Object.defineProperty(ta, 'offsetHeight', { configurable: true, value: 40 })
      mockRect(ta, 200, 40)
      document.body.appendChild(ta)

      const r1 = deepseek.produce('input')
      const r2 = generic.produce('input')
      expect(r1).not.toBeNull()
      expect(r2).not.toBeNull()
      expect(r1!.element).toBe(ta)
      expect(r2!.element).toBe(ta)
    })

    // ── 2026-10-17 ölçümü (canlı chatgpt.com): yeni composer'da send butonu
    // data-composer-submit taşıyor ve data-testid taşımıyor. data-testid kuralı
    // ölü; aria-label ise çevrili ("Mesaj gönder" / "Send message").
    it('ranks [data-composer-submit] above every other button rule', () => {
      document.body.innerHTML = `
        <form>
          <textarea></textarea>
          <button id="dialog-submit" type="submit" aria-label="Kapat">Kapat</button>
          <button id="composer-submit" data-composer-submit type="submit"
                  aria-label="Mesaj gönder">→</button>
        </form>
      `
      mockAllRects(document.body)

      const result = produceButton()
      expect(result).not.toBeNull()
      expect(result!.element).toBe(document.getElementById('composer-submit'))
    })

    it('does not let the unscoped [aria-label*=Send] rule outrank button[aria-label*=Send]', () => {
      // aria-label her elemanda geçerli: bir <span aria-label="Send feedback">
      // gerçek gönder butonundan önce geldiğinde kapsamsız kural onu seçerdi.
      document.body.innerHTML = `
        <div class="composer">
          <span id="not-a-button" aria-label="Send feedback"></span>
          <textarea></textarea>
          <button id="real-send" aria-label="Send message">→</button>
        </div>
      `
      mockAllRects(document.body)

      const result = produceButton()
      expect(result).not.toBeNull()
      expect(result!.element).toBe(document.getElementById('real-send'))
    })

    it('looks for the send button inside the composer before searching the whole page', () => {
      // Aynı kuralı karşılayan iki buton: sayfa genelindeki arama (querySelector)
      // DOM sırasına göre header'dakini seçerdi; composer kapsaması içerideki seçer.
      document.body.innerHTML = `
        <header>
          <button id="header-send" aria-label="Send message">→</button>
        </header>
        <form class="composer-form">
          <textarea></textarea>
          <button id="composer-send" aria-label="Send message">→</button>
        </form>
      `
      mockAllRects(document.body)

      const result = produceButton()
      expect(result).not.toBeNull()
      expect(result!.element).toBe(document.getElementById('composer-send'))
    })

    it('falls back to the page-wide search when the composer holds no button', () => {
      document.body.innerHTML = `
        <header>
          <button id="header-send" aria-label="Send message">→</button>
        </header>
        <form class="composer-form">
          <textarea></textarea>
        </form>
      `
      mockAllRects(document.body)

      const result = produceButton()
      expect(result).not.toBeNull()
      expect(result!.element).toBe(document.getElementById('header-send'))
    })

    it('never returns a dictation (microphone) control as the send button', () => {
      // Canlı chatgpt.com'da composer boşken görünür tek yuvarlak ikon düğmesi
      // dikte (mic) düğmesidir; bu düğmeye basmak mesajı göndermez.
      for (const attribute of [
        'data-start-dictation',
        'data-cancel-dictation',
        'data-submit-dictation'
      ]) {
        document.body.innerHTML = `
          <form>
            <textarea></textarea>
            <button id="mic" type="submit" ${attribute}
                    aria-label="Dikteyi başlatma">🎙</button>
          </form>
        `
        mockAllRects(document.body)

        const result = produceButton()
        expect(result, `${attribute} must not be resolved as the send button`).toBeNull()
      }
    })

    it('skips the dictation control and returns the real send button next to it', () => {
      document.body.innerHTML = `
        <form>
          <textarea></textarea>
          <button id="mic" type="button" data-start-dictation
                  aria-label="Dikteyi başlatma">🎙</button>
          <button id="send" data-composer-submit type="submit"
                  aria-label="Mesaj gönder">→</button>
        </form>
      `
      mockAllRects(document.body)

      const result = produceButton()
      expect(result).not.toBeNull()
      expect(result!.element).toBe(document.getElementById('send'))
    })

    it('does not resolve a send button that is still hidden (empty composer state)', () => {
      // ChatGPT gönder düğmesini composer boşken `hidden` bırakır ve o anda görünür
      // tek yuvarlak düğme dikte düğmesidir. `hidden`, tarayıcının varsayılan stil
      // sayfasında display:none'a dönüştüğü için computed-style kontrolü yeterlidir.
      document.body.innerHTML = `
        <form>
          <textarea></textarea>
          <button id="hidden-send" type="submit" hidden
                  aria-label="Mesaj gönder">→</button>
        </form>
      `
      mockAllRects(document.body)

      const result = produceButton()
      expect(result).toBeNull()
    })
  })
})
