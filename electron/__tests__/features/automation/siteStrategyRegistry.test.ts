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

  it('registers a new strategy and replaces an existing one with the same id', () => {
    registerSiteStrategy({
      id: 'test:foo',
      match: { hostPatterns: ['foo.example.com'] },
      produce: makeFakeProduce('test:foo')
    })

    const all = getRegisteredStrategies()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe('test:foo')

    // A second registration under the same id REPLACES the first, it does not
    // append, and the newer produce() is the one that runs.
    registerSiteStrategy({
      id: 'test:foo',
      match: { hostPatterns: ['foo.com'] },
      produce: makeFakeProduce('v2')
    })

    expect(getRegisteredStrategies()).toHaveLength(1)
    const match = findStrategiesForHostname('foo.com')
    expect(match).toHaveLength(1)
    expect(match[0].produce('input')?.matchedSelector).toBe('v2:input')
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

  it('sorts matches by priority (highest first) and defaults omitted priority to 0', () => {
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
    registerSiteStrategy({
      id: 'test:default',
      match: { hostPatterns: ['claude'] },
      produce: makeFakeProduce('default')
    })

    const matches = findStrategiesForHostname('claude.ai')
    expect(matches.map((m) => m.id)).toEqual(['test:high', 'test:mid', 'test:low', 'test:default'])
  })

  it('returns empty array when no strategies match', () => {
    registerSiteStrategy({
      id: 'test:foo',
      match: { hostPatterns: ['foo.com'] },
      produce: makeFakeProduce('foo')
    })
    expect(findStrategiesForHostname('bar.com')).toEqual([])
  })

  it('registers built-ins on first call, ranks the generic fallback last, and honours user overrides', () => {
    expect(getRegisteredStrategies()).toHaveLength(0)
    const claudeMatches = listApplicableStrategies('claude.ai')
    expect(claudeMatches.length).toBeGreaterThan(0)
    expect(claudeMatches.some((s) => s.id === 'builtin:claude')).toBe(true)
    // Generic fallback is registered eagerly at module load.
    expect(getRegisteredStrategies().some((s) => s.id === 'builtin:generic')).toBe(true)

    // The site-specific built-in outranks the generic fallback.
    const ranked = findStrategiesForHostname('claude.ai')
    expect(ranked[0].id).toBe('builtin:claude')
    expect(ranked[ranked.length - 1].id).toBe('builtin:generic')

    // An unknown hostname matches the generic fallback and nothing else.
    const unknown = findStrategiesForHostname('chat.example.org')
    expect(unknown).toHaveLength(1)
    expect(unknown[0].id).toBe('builtin:generic')

    // Every known provider registers its own built-in.
    listApplicableStrategies('chat.deepseek.com')
    listApplicableStrategies('chat.qwen.ai')
    listApplicableStrategies('kimi.moonshot.cn')
    const ids = getRegisteredStrategies().map((s) => s.id)
    for (const builtin of ['claude', 'deepseek', 'qwen', 'kimi', 'generic']) {
      expect(ids, `builtin:${builtin} must be registered`).toContain(`builtin:${builtin}`)
    }

    // A user strategy outranks every built-in.
    registerSiteStrategy({
      id: 'user:custom',
      match: { hostPatterns: ['claude.ai'], priority: 1000 },
      produce: makeFakeProduce('user:custom')
    })
    expect(findStrategiesForHostname('claude.ai')[0].id).toBe('user:custom')
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

    it('returns null when nothing is findable, for input and for button', () => {
      listApplicableStrategies('claude.ai')
      const claude = findStrategiesForHostname('claude.ai').find((s) => s.id === 'builtin:claude')!

      // Boş sayfa: composer yok.
      expect(claude.produce('input')).toBeNull()

      // Composer var ama gönder butonu yok.
      const tiny = document.createElement('textarea')
      Object.defineProperty(tiny, 'offsetWidth', { configurable: true, value: 10 })
      Object.defineProperty(tiny, 'offsetHeight', { configurable: true, value: 5 })
      mockRect(tiny, 10, 5)
      document.body.appendChild(tiny)

      expect(claude.produce('input')).toBeNull()
      expect(claude.produce('button')).toBeNull()
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
      const claude = findStrategiesForHostname('claude.ai').find((s) => s.id === 'builtin:claude')!
      expect(claude.produce('button')).toBeNull()
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

    // ── 2026-10-17 ölçümü (canlı chatgpt.com, gerçek DOM kopyası):
    // data-composer-submit özniteliği sayfada YOK — bu ölçümde
    // `querySelectorAll('[data-composer-submit]').length === 0` (composer boşken
    // de, metin yazılıyken de). Tek kararlı kanca `type="submit"`.
    // Aşağıdaki test bu ölçülmüş yapıyı birebir modeller.
    it('picks the composer submit button on the measured chatgpt.com shape', () => {
      document.body.innerHTML = `
        <div data-composer-layout="single-line">
          <div class="ComposerLayoutBody" data-composer-body>
            <div data-rich-text-layout="single-line">
              <div contenteditable="true" role="textbox" class="ProseMirror"
                   data-composer-markdown="" aria-label="ChatGPT'ye sor"></div>
            </div>
            <button type="button" aria-label="Dosyaları ve daha fazlasını ekle"
                    data-composer-navigation-target="add-context"></button>
            <button type="button" aria-label="Dikte et" aria-busy="false"></button>
            <button type="button" aria-label="Sesli iletişimi başlat"></button>
            <button type="submit" aria-label="Gönder" class="size-token-button-composer"></button>
          </div>
        </div>
      `
      mockAllRects(document.body)

      const result = produceButton()
      expect(result).not.toBeNull()
      expect(result!.element!.getAttribute('aria-label')).toBe('Gönder')
    })

    it('never resolves the ChatGPT dictation button, which carries no data attribute', () => {
      // Ölçülen tam öznitelik listesi: type="button", class, aria-busy,
      // aria-label="Dikte et". data-start-dictation YOK — eski koruma bu
      // düğmeye karşı sessizce geçiyordu.
      document.body.innerHTML = `
        <div data-composer-body>
          <div contenteditable="true" role="textbox" class="ProseMirror"></div>
          <button id="dictate" type="button" aria-label="Dikte et" aria-busy="false"></button>
        </div>
      `
      mockAllRects(document.body)

      const result = produceButton()
      expect(result).toBeNull()
    })

    it('never resolves the ChatGPT voice-chat button ("Sesli iletişimi başlat")', () => {
      document.body.innerHTML = `
        <div data-composer-body>
          <div contenteditable="true" role="textbox" class="ProseMirror"></div>
          <button id="voice" type="button" aria-label="Sesli iletişimi başlat"></button>
        </div>
      `
      mockAllRects(document.body)

      const result = produceButton()
      expect(result).toBeNull()
    })

    it('scopes the send search to the composer instead of the whole page', () => {
      // Kapsam çözümü regresyonu: composer girdisinin en yakın sarmalayıcısının
      // class'ında "composer" alt dizesi geçiyordu ve o sarmalayıcı butonsuzdu
      // (ölçüm: 540x36, 0 buton). Arama bu yüzden sayfa geneline kaçıyordu.
      document.body.innerHTML = `
        <header>
          <button id="header-send" aria-label="Send message"></button>
        </header>
        <div data-composer-body>
          <div class="text-size-chat in-[[data-composer-body]:has([data-composer-expand-toggle])]">
            <div contenteditable="true" role="textbox" class="ProseMirror"
                 data-composer-markdown=""></div>
          </div>
          <button id="composer-send" type="submit" aria-label="Gönder"></button>
        </div>
      `
      mockAllRects(document.body)

      const result = produceButton()
      expect(result!.element).toBe(document.getElementById('composer-send'))
      expect(result!.matchedSelector).toBe('generic:button:composer:submit')
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

    it('injected siteStrategyRuntime registers built-in strategies and resolves composer controls', async () => {
      const { siteStrategyRuntime } =
        await import('@electron/features/automation/automationScripts/lib/siteStrategyRuntime')
      document.body.innerHTML = `
        <div data-composer-body>
          <textarea id="composer-input"></textarea>
          <button id="dictate" type="button" aria-label="Dikte et"></button>
          <button id="composer-submit" type="submit" aria-label="Gönder"></button>
        </div>
      `
      mockAllRects(document.body, 120, 40)

      const runner = new Function(`
        ${siteStrategyRuntime}
        __ensureBuiltinSiteStrategiesRegistered();
        return {
          strategies: __listApplicableStrategies('chatgpt.com').map(s => s.id),
          inputHit: __runSiteStrategy('chatgpt.com', 'input'),
          buttonHit: __runSiteStrategy('chatgpt.com', 'button')
        };
      `) as () => {
        strategies: string[]
        inputHit: { element: Element; matchedSelector: string; strategyId: string } | null
        buttonHit: { element: Element; matchedSelector: string; strategyId: string } | null
      }

      const out = runner()
      expect(out.strategies).toContain('builtin:chatgpt')
      expect(out.strategies).toContain('builtin:generic')
      expect(out.inputHit?.element).toBe(document.getElementById('composer-input'))
      expect(out.buttonHit?.element).toBe(document.getElementById('composer-submit'))
      expect(out.buttonHit?.matchedSelector).toBe('generic:button:composer:submit')
    })
  })
})
