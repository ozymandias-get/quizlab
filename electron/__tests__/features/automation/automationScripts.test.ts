import {
  generateAutoSendScript,
  generateClickSendScript,
  generateFocusScript,
  generateValidateSelectorsScript,
  generateWaitForSubmitReadyScript
} from '@electron/features/automation/automationScripts'

import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('automationScripts', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    delete (window as typeof window & { __quizlabReaderAutomationCache?: unknown })
      .__quizlabReaderAutomationCache
  })

  it('reuses cached input elements across repeated sends', async () => {
    document.body.innerHTML = `
            <textarea id="input"></textarea>
            <button id="send" type="button">Send</button>
        `

    const script = generateAutoSendScript(
      { input: '#input', button: '#send', submitMode: 'click' },
      'hello',
      false
    )
    const querySpy = vi.spyOn(document, 'querySelectorAll')

    const firstResult = await window.eval(script)
    const queryCountAfterFirstRun = querySpy.mock.calls.length
    const secondResult = await window.eval(script)

    expect(firstResult.success).toBe(true)
    expect(secondResult.success).toBe(true)
    expect(firstResult.diagnostics.input.strategy).toBe('direct')
    expect(secondResult.diagnostics.input.strategy).toBe('cache')
    expect(secondResult.diagnostics.input.cacheHits).toBeGreaterThan(0)
    expect(querySpy.mock.calls.length).toBe(queryCountAfterFirstRun)
  })

  it.each([null, '#nonexistent-selector'])(
    'falls back to fingerprint resolution inside shadow DOM (primary: %s)',
    async (primaryInput) => {
      const host = document.createElement('rich-textarea')
      host.id = 'composer-host'
      const shadowRoot = host.attachShadow({ mode: 'open' })
      const input = document.createElement('div')
      input.setAttribute('role', 'textbox')
      input.setAttribute('contenteditable', 'true')
      shadowRoot.appendChild(input)

      const sendButton = document.createElement('button')
      sendButton.setAttribute('aria-label', 'Send message')
      shadowRoot.appendChild(sendButton)

      document.body.appendChild(host)

      const focusScript = generateFocusScript({
        input: primaryInput,
        inputFingerprint: {
          tag: 'div',
          role: 'textbox',
          contentEditable: true,
          hostChain: [
            { selector: '#composer-host', tag: 'rich-textarea', safeId: 'composer-host' }
          ],
          localPath: ['div[role="textbox"]']
        }
      })

      const result = await window.eval(focusScript)

      expect(result.success).toBe(true)
      expect(result.diagnostics.input.strategy).toBe('fingerprint')
    }
  )

  it('falls back to a candidate selector when the primary does not match', async () => {
    document.body.innerHTML = `
      <div role="textbox" contenteditable="true" id="editor"></div>
      <button aria-label="Send message" id="send">Send</button>
    `

    const script = generateAutoSendScript(
      {
        input: '#nonexistent',
        inputCandidates: ['div[role="textbox"]', 'textarea'],
        button: '#send',
        submitMode: 'click'
      },
      'hello',
      false
    )

    const result = await window.eval(script)

    expect(result.success).toBe(true)
    expect(result.diagnostics.input.strategy).not.toBe('none')
  })

  it('skips an invalid selector and continues with valid candidates', async () => {
    document.body.innerHTML = `
      <textarea></textarea>
      <button type="button">Send</button>
    `

    const script = generateAutoSendScript(
      {
        input: null,
        inputCandidates: ['[aria-label="broken', 'textarea'],
        button: 'button',
        submitMode: 'click'
      },
      'hello',
      false
    )

    const result = await window.eval(script)
    expect(result.success).toBe(true)
    expect(result.diagnostics.input.matchedSelector).toBe('textarea')
  })

  it('rejects ambiguous selector matches and surfaces re-pick requirement', async () => {
    document.body.innerHTML = `
            <textarea placeholder="Ask"></textarea>
            <textarea placeholder="Ask"></textarea>
            <button>Send</button>
        `

    const validateScript = generateValidateSelectorsScript({
      inputCandidates: ['textarea[placeholder="Ask"]'],
      button: 'button',
      submitMode: 'click',
      inputFingerprint: {
        tag: 'textarea',
        placeholder: 'Ask'
      },
      health: 'needs_repick'
    })

    const result = await window.eval(validateScript)

    expect(result.success).toBe(false)
    expect(result.error).toBe('selector_repick_required')
    expect(result.diagnostics.input.strategy).not.toBe('cache')
  })

  it('keeps click-send enter fallback available when submit mode is enter_key', async () => {
    const input = document.createElement('textarea')
    document.body.appendChild(input)
    const keydownSpy = vi.fn()
    input.addEventListener('keydown', keydownSpy)

    const script = generateClickSendScript({
      input: 'textarea',
      submitMode: 'enter_key'
    })

    const result = await window.eval(script)

    // Enter gerçekten gönderiliyor (fallback korunuyor)…
    expect(keydownSpy).toHaveBeenCalled()
    // …ama bu testte sayfa sentetik olaya tepki VERMİYOR: hiçbir dinleyici
    // içeriği temizlemiyor. Bu yüzden gönderim "etki gözlemlenmedi" olarak
    // raporlanır. Eski davranış (yalnızca dispatchEvent döndüğü için başarı)
    // sessiz bir sahte başarıydı ve "metin yazıldı ama gitmedi" hatasının
    // ikinci yarısını üretiyordu.
    expect(result.success).toBe(false)
    expect(result.error).toBe('submit_unverified')
    expect(result.submitOutcome).toBe('delivery_unconfirmed')
  })

  it('reports enter_key as observed once the composer actually releases the message', async () => {
    const input = document.createElement('textarea')
    document.body.appendChild(input)
    input.value = 'merhaba'
    input.addEventListener('keydown', (event) => {
      // Gerçek bir AI sitesi Enter'ı yakalayıp composer'ı boşaltır.
      if (event.key === 'Enter') input.value = ''
    })

    const script = generateClickSendScript({
      input: 'textarea',
      submitMode: 'enter_key'
    })

    const result = await window.eval(script)

    expect(result.success).toBe(true)
    expect(result.submitMethod).toBe('enter_key')
    expect(result.submitObserved).toBe(true)
    expect(result.submitOutcome).toBe('observed')
  })

  it('waits for the send button to settle before reporting submit readiness', async () => {
    document.body.innerHTML = `
            <form id="composer">
                <textarea id="input"></textarea>
                <button id="send" type="button" disabled>Send</button>
            </form>
        `

    const sendButton = document.getElementById('send') as HTMLButtonElement
    Object.defineProperty(sendButton, 'offsetWidth', { configurable: true, value: 120 })
    Object.defineProperty(sendButton, 'offsetHeight', { configurable: true, value: 36 })
    const script = generateWaitForSubmitReadyScript(
      { input: '#input', button: '#send', submitMode: 'click' },
      { timeoutMs: 4000, settleMs: 300, minimumWaitMs: 200 }
    )

    const execution = window.eval(script)

    setTimeout(() => {
      sendButton.disabled = false
      sendButton.removeAttribute('disabled')
      sendButton.setAttribute('data-upload-state', 'complete')
    }, 500)

    const result = await execution

    expect(result.success).toBe(true)
    expect(result.action).toBe('submit_ready')
    expect(result.diagnostics.submitMs).toBeGreaterThan(0)
    // İlk hazır-olma anı da raporlanır: sabit settle beklemesinin ne kadarı
    // gerçek hazırlık, ne kadarı emniyet payı, ölçülebilir olur.
    expect(result.firstReadyAtMs).toBeGreaterThan(0)
  }, 10000)

  it('cancels a wait when the guest navigation aborts the run', async () => {
    const script = generateWaitForSubmitReadyScript(
      { input: '#missing-input', button: '#missing-send', submitMode: 'click' },
      { timeoutMs: 1500, settleMs: 50, minimumWaitMs: 50 }
    )

    const execution = window.eval(script)
    setTimeout(() => {
      const automationWindow = window as Window & {
        __quizlabAbortController?: AbortController
      }
      automationWindow.__quizlabAbortController?.abort()
    }, 50)

    const result = await execution
    expect(result.success).toBe(false)
    expect(result.diagnostics.totalMs).toBeLessThan(1000)
  })

  it.each([
    {
      label: 'input_not_found',
      html: `<button id="send" type="button">Send</button>`,
      config: { input: '#missing-input', button: '#send', submitMode: 'click' as const }
    },
    {
      label: 'button_not_found',
      html: `<textarea id="input"></textarea>`,
      config: { input: '#input', button: '#missing-send', submitMode: 'click' as const }
    }
  ])(
    'reports $label when the readiness target is missing',
    async ({ html, config }) => {
      document.body.innerHTML = html

      const script = generateWaitForSubmitReadyScript(config, {
        timeoutMs: 300,
        settleMs: 50,
        minimumWaitMs: 50
      })

      const result = await window.eval(script)

      expect(result.success).toBe(false)
      expect(result.error).toBe(
        config.input === '#missing-input' ? 'input_not_found' : 'button_not_found'
      )
    },
    15000
  )

  it('disambiguates multiple buttons using fingerprint when selector matches several', async () => {
    // Several buttons answer `[role="button"]`; only one matches the saved
    // fingerprint. `shouldSubmit=false` keeps the run off the settle checks,
    // which need box geometry jsdom does not have.
    document.body.innerHTML = `
            <div role="textbox" contenteditable="true" id="composer"></div>
            <button role="button" aria-label="New Chat">New</button>
            <button role="button" aria-label="Send message">Send</button>
            <button role="button" aria-label="Settings">Settings</button>
        `

    const script = generateAutoSendScript(
      {
        input: '#composer',
        button: '[role="button"]',
        buttonCandidates: ['[role="button"]', 'button[aria-label="Send message"]'],
        submitMode: 'click',
        buttonFingerprint: {
          tag: 'button',
          role: 'button',
          ariaLabel: 'Send message',
          text: 'Send message'
        }
      },
      'hello world',
      false
    )

    const result = await window.eval(script)

    expect(result.success).toBe(true)
    expect(result.action).toBe('input_only')
    expect(result.diagnostics.input.strategy).not.toBe('none')
  })

  it('types into the input when several threads share one send-button label', async () => {
    document.body.innerHTML = `
            <textarea id="input"></textarea>
            <button aria-label="Send">Send to Thread A</button>
            <button aria-label="Send">Send to Thread B</button>
            <button aria-label="Send">Send to Thread C</button>
        `

    const script = generateAutoSendScript(
      {
        input: '#input',
        button: 'button[aria-label="Send"]',
        submitMode: 'click',
        buttonFingerprint: { tag: 'button', ariaLabel: 'Send', text: 'Send to Thread B' }
      },
      'test',
      false
    )

    const result = await window.eval(script)

    expect(result.success).toBe(true)
    expect(result.action).toBe('input_only')
    expect((document.getElementById('input') as HTMLTextAreaElement).value).toBe('test')
  })

  // A generic "still processing" error gives no way to tell a genuinely slow
  // upload from a stale selector or a paste that attached nothing. These
  // fields are what make the difference diagnosable from the log alone.
  describe('submit_not_ready diagnostics', () => {
    function prepareDisabledButton() {
      document.body.innerHTML = `
              <textarea id="input"></textarea>
              <button id="send" type="button" disabled>Send</button>
          `
      const sendButton = document.getElementById('send') as HTMLButtonElement
      Object.defineProperty(sendButton, 'offsetWidth', { configurable: true, value: 120 })
      Object.defineProperty(sendButton, 'offsetHeight', { configurable: true, value: 36 })
      return sendButton
    }

    it('names the disabled button and reports the wait budget', async () => {
      prepareDisabledButton()

      const result = await window.eval(
        generateWaitForSubmitReadyScript(
          { input: '#input', button: '#send', submitMode: 'click' },
          { timeoutMs: 500, settleMs: 100, minimumWaitMs: 100 }
        )
      )

      expect(result.error).toBe('submit_not_ready')
      expect(result.notReadyTarget).toBe('button')
      expect(result.notReadyReason).toMatch(/disabled/)
      expect(result.budgetMs).toBe(500)
      expect(result.minimumWaitMs).toBe(100)
      expect(result.waitedMs).toBeGreaterThan(0)
      // A button that never became interactive is a different failure from the
      // stale-button flap below, which must report everReady === true.
      expect(result.everReady).toBe(false)
    }, 10000)

    it('reports everReady when the button briefly enabled then re-disabled', async () => {
      const sendButton = prepareDisabledButton()

      const execution = window.eval(
        generateWaitForSubmitReadyScript(
          { input: '#input', button: '#send', submitMode: 'click' },
          { timeoutMs: 900, settleMs: 900, minimumWaitMs: 50 }
        )
      )
      setTimeout(() => {
        sendButton.disabled = false
        sendButton.removeAttribute('disabled')
      }, 150)

      const result = await execution

      expect(result.error).toBe('submit_not_ready')
      // The stale-button flap is a different failure from "never enabled".
      expect(result.everReady).toBe(true)
      // "Ne zaman ilk kez hazır oldu" bilgisi, sabit settle gecikmesinin
      // gerçek hazırlık ihtiyacından ayrılabilmesi için ölçülür.
      expect(result.firstReadyAtMs).toBeGreaterThan(0)
      expect(result.firstReadyAtMs).toBeLessThanOrEqual(result.waitedMs)
    }, 10000)

    it.each([
      {
        reason: 'aria_disabled',
        stubSize: true,
        html: `<button id="send" type="button" aria-disabled="true">Send</button>`
      },
      {
        reason: 'display_none',
        html: `<button id="send" type="button" style="display:none">Send</button>`,
        stubSize: true
      },
      {
        reason: 'zero_size',
        html: `<button id="send" type="button">Send</button>`,
        stubSize: false
      }
    ])(
      'reports notReadyReason "$reason" instead of a generic timeout',
      async ({ html, stubSize, reason }) => {
        document.body.innerHTML = `
              <textarea id="input"></textarea>
              ${html}
          `
        const sendButton = document.getElementById('send') as HTMLButtonElement
        if (stubSize) {
          Object.defineProperty(sendButton, 'offsetWidth', { configurable: true, value: 120 })
          Object.defineProperty(sendButton, 'offsetHeight', { configurable: true, value: 36 })
        }

        const result = await window.eval(
          generateWaitForSubmitReadyScript(
            { input: '#input', button: '#send', submitMode: 'click' },
            { timeoutMs: 300, settleMs: 60, minimumWaitMs: 60 }
          )
        )

        expect(result.notReadyReason).toBe(reason)
      },
      10000
    )
  })

  /**
   * Bekleme bütçeleri GEÇERSİZ KILINABİLİR birer test kancasıdır; üretim
   * değerleri ölçümden gelir. Buradaki sözleşme şudur: hiçbir parametre
   * geçilmediğinde üretilen betik, bugünkü üretim değerlerini AYNEN taşır.
   *
   * Kanıt iki parçalıdır: (1) parametresiz çıktı, bugünkü sayıların
   * gömülü olduğu metinle bayt bayt aynıdır; (2) parametreli çağrı bu
   * sayıları gerçekten değiştirir — yani kanca etkili, sahte değil.
   */
  describe('submit wait budgets are opt-in', () => {
    const CONFIG = { input: '#input', button: '#send', submitMode: 'click' } as const
    const PRODUCTION_BUDGETS = {
      submitBudgetMs: 15000,
      unconfiguredButtonProbeMs: 1000,
      stableBlockedExitMs: 2000,
      observeAttempts: 25,
      observeIntervalMs: 120,
      rejectedControlRetryMs: 120
    }

    it('emits byte-identical scripts with no budget given as with the production budget', () => {
      // Birebir aynı metin: parametresiz çağrı, üretim değerlerinin kendisidir.
      expect(generateAutoSendScript(CONFIG, 'hello', true)).toBe(
        generateAutoSendScript(CONFIG, 'hello', true, false, 'auto', 30, PRODUCTION_BUDGETS)
      )
      expect(generateAutoSendScript(CONFIG, 'hello', true)).toBe(
        generateAutoSendScript(CONFIG, 'hello', true, false, 'auto', 30, {})
      )
      expect(generateClickSendScript(CONFIG)).toBe(
        generateClickSendScript(CONFIG, PRODUCTION_BUDGETS)
      )
    })

    it('embeds the measured production budgets in the emitted script', () => {
      const script = generateAutoSendScript(CONFIG, 'hello', true)

      expect(script).toContain('configured ? 15000 : 1000')
      expect(script).toContain('attempts = 25, intervalMs = 120')
      expect(script).toMatch(/true,\s*2000\s*\);/)
      expect(script).toContain('await wait(120);')
    })

    it('actually substitutes every budget when one is supplied', () => {
      const script = generateAutoSendScript(CONFIG, 'hello', true, false, 'auto', 30, {
        submitBudgetMs: 400,
        unconfiguredButtonProbeMs: 120,
        stableBlockedExitMs: 50,
        observeAttempts: 3,
        observeIntervalMs: 5,
        rejectedControlRetryMs: 7
      })

      expect(script).toContain('configured ? 400 : 120')
      expect(script).toContain('attempts = 3, intervalMs = 5')
      expect(script).toMatch(/true,\s*50\s*\);/)
      expect(script).toContain('await wait(7);')
      // Yanlışlıkla başka bir yerin sayısı değişmemeli.
      expect(script).toContain('diagnostics.preSubmitWaitMs = 500;')
    })

    it('falls back to production budgets when an override is unusable', () => {
      const script = generateAutoSendScript(CONFIG, 'hello', true, false, 'auto', 30, {
        submitBudgetMs: Number.NaN,
        stableBlockedExitMs: -1,
        observeAttempts: 0
      })

      expect(script).toContain('configured ? 15000 : 1000')
      // 0 deneme "hiç gözlemleme" demek; üretim sözleşmesi en az 1 tur ister.
      expect(script).toContain('attempts = 1, intervalMs = 120')
    })
  })

  /**
   * Yapıştırma doğrulaması ve topic sözleşmeleri.
   *
   * Gerçek editörler (ProseMirror/Lexical) içeriği kendi blok modeline göre
   * okur: iki paragraf arasındaki `\n\n`, gözlemlenebilir metinde tek satır
   * sonuna (bazen tamamen kaybolur) dönüşür. Ham `includes()` karşılaştırması
   * bu yüzden **yanlış negatif** üretiyordu: yapıştırma gerçekte uygulanmış
   * olsa bile doğrulama başarısız sayılıyor ve metin karakter karakter
   * yazılıyordu (30ms/karakter → uzun promptlarda dakikalar + kuyruk kilidi).
   */
  describe('paste application verification', () => {
    it('does not fall back to character typing when the editor rewrote block newlines', async () => {
      document.body.innerHTML = `
              <div role="textbox" contenteditable="true" id="composer">draft</div>
              <button id="send" type="button">Send</button>
          `
      const composer = document.getElementById('composer') as HTMLDivElement

      // Editör davranışını taklit et: blok sınırındaki çift satır sonu,
      // okunan metinde tek satır sonu olarak görünür.
      const rawTextContent = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent')
      Object.defineProperty(composer, 'textContent', {
        configurable: true,
        get() {
          const raw = (rawTextContent?.get?.call(this) as string) || ''
          return raw.replaceAll('\n\n', '\n')
        },
        set(value: string) {
          rawTextContent?.set?.call(this, value)
        }
      })

      const inputEvents: Event[] = []
      composer.addEventListener('input', (event) => inputEvents.push(event))

      const script = generateAutoSendScript(
        { input: '#composer', button: '#send', submitMode: 'click' },
        'Line one\n\nLine two',
        false,
        true // append: kullanıcının önceden yazdığı içerik korunur
      )

      const result = await window.eval(script)

      expect(result.success).toBe(true)
      // Karakter karakter yazım her karakter için bir `input` event üretir;
      // onlarca event fallback'in çalıştığının doğrudan kanıtıdır.
      expect(inputEvents.length).toBeLessThanOrEqual(3)
      expect(result.diagnostics.textInputFallback).toBeFalsy()
      expect(result.diagnostics.textInputStrategy).not.toBe('human_typing')
    })

    it('records the human-typing fallback and caps its speed when the paste is unverifiable', async () => {
      document.body.innerHTML = `
              <div role="textbox" contenteditable="true" id="composer"></div>
              <button id="send" type="button">Send</button>
          `
      const composer = document.getElementById('composer') as HTMLDivElement

      // Editör içeriği hiç gözlemlenebilir kılmıyor: doğrulama başarısız
      // kalır ve güvenli taraf (yazım fallback'i) devreye girer.
      const rawTextContent = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent')
      Object.defineProperty(composer, 'textContent', {
        configurable: true,
        get() {
          return ''
        },
        set(value: string) {
          rawTextContent?.set?.call(this, value)
        }
      })

      const script = generateAutoSendScript(
        { input: '#composer', button: '#send', submitMode: 'click' },
        'hello',
        false,
        false,
        'auto',
        100
      )

      // typingSpeed 100 olsa bile fallback hızı üretimde 30ms ile sınırlıdır:
      // yüzlerce karakterlik bir prompt'un fallback'te dakikalarca yazılması
      // engellenir. Bu davranış humanTyping.test.ts'te gerçek zamanlı olarak
      // da doğrulanır; buradaki iddia fallback'in SEÇİLDİĞİ.
      const result = await window.eval(script)

      expect(result.diagnostics.textInputFallback).toBe('human_typing')
      expect(result.diagnostics.textInputStrategy).toBe('human_typing')
    })

    it('never touches the system clipboard during a synthetic paste', async () => {
      document.body.innerHTML = `
              <div role="textbox" contenteditable="true" id="composer"></div>
              <button id="send" type="button">Send</button>
          `
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText }
      })

      // jsdom ClipboardEvent/DataTransfer'i desteklemez; sentetik yapıştırma
      // yolunun gerçek akışını çalıştırmak için minimal stub'lar kurulur.
      class StubDataTransfer {
        setData() {}
      }
      class StubClipboardEvent extends Event {
        clipboardData: unknown
        constructor(type: string, init?: EventInit & { clipboardData?: unknown }) {
          super(type, init)
          this.clipboardData = init?.clipboardData ?? null
        }
      }
      const automationWindow = window as unknown as Record<string, unknown>
      automationWindow.DataTransfer = StubDataTransfer
      automationWindow.ClipboardEvent = StubClipboardEvent

      try {
        const script = generateAutoSendScript(
          { input: '#composer', button: '#send', submitMode: 'click' },
          'x'.repeat(2500),
          false
        )

        const result = await window.eval(script)

        expect(result.success).toBe(true)
        // Kullanıcının panosu ödünç alınmaz: payload ClipboardEvent
        // üzerinden taşınır, sistem panosuna yazılmaz.
        expect(writeText).not.toHaveBeenCalled()
        // Bu stub'lu ortamda hiçbir kanal (paste / execCommand / beforeinput)
        // editör modelini kabul etmediği için düşülen yol ham DOM eklemesidir.
        // Artık bu "başarılı uygulama" sayılmaz: strateji açıkça
        // doğrulanmamış olarak raporlanır, doğrulama katmanı bunu görecek
        // ve gönder butonu pasif kalırsa `submit_not_ready` bildirecek.
        expect(result.diagnostics.textInputStrategy).toBe('dom_insert_unverified')
        expect(result.diagnostics.textVerifyResult).toBe('verified')
      } finally {
        delete automationWindow.DataTransfer
        delete automationWindow.ClipboardEvent
        delete (navigator as unknown as Record<string, unknown>).clipboard
      }
    })

    it('keeps the fixed settle only for enter_key submits', async () => {
      document.body.innerHTML = `<textarea id="input"></textarea>`
      const composer = document.getElementById('input') as HTMLTextAreaElement
      // Enter'ı gerçekten karşılayan bir editör taklidi: composer boşalır,
      // yani gönderim etkisi gözlemlenir.
      composer.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') composer.value = ''
      })

      const script = generateAutoSendScript(
        { input: '#input', submitMode: 'enter_key' },
        'hello',
        true,
        false,
        'auto',
        1
      )

      // Sabit settle, yalnızca etkileşim kapısı olmayan enter_key yolunda
      // korunur; click/mixed yolunda submit zaten "buton etkileşime hazır"
      // kapısından geçer.
      const result = await window.eval(script)

      expect(result.success).toBe(true)
      expect(result.submitObserved).toBe(true)
      expect(result.diagnostics.preSubmitWaitMs).toBe(500)
    }, 10000)
  })

  /**
   * Metin yerleştirme doğruluk bataryası.
   *
   * Eski doğrulama ("baş/son 40 karakterinden biri içerikte var mı?")
   * yanlış pozitife açıktı: metnin yalnızca ilk 40 (ya da son 40) karakteri
   * girse bile "başarılı" sayılıyor ve bozuk içerik gönderilebiliyordu. Bu
   * batarya doğrulamayı yazım mekanizmasından bağımsız senaryolarla sabitler:
   * tam başarı (append/replace), kısmi yerleştirme varyantları, yinelenen
   * metin, yok sayılan yazım, geç güncelleme ve büyük/Unicode içerik.
   */
  describe('text placement verification battery', () => {
    /** Gönder butonuna tıklanıp tıklanmadığını sayar (sessiz submit yok). */
    const countSendClicks = () => {
      const clicks = vi.fn()
      const button = document.getElementById('send')
      button?.addEventListener('click', clicks)
      return clicks
    }

    /** Textarea yazımlarını dönüştürerek editör davranışını taklit eder. */
    function installTextareaWriteTransform(
      transform: (next: string, previous: string) => string
    ): () => void {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!
      Object.defineProperty(HTMLTextAreaElement.prototype, 'value', {
        configurable: true,
        get() {
          return descriptor.get?.call(this)
        },
        set(next: string) {
          const previous = (descriptor.get?.call(this) as string) || ''
          descriptor.set?.call(this, transform(String(next), previous))
        }
      })
      return () => {
        Object.defineProperty(HTMLTextAreaElement.prototype, 'value', descriptor)
      }
    }

    /** Editörün içeriği gecikmeli "göstermesini" taklit eder. */
    function installDelayedTextareaReads(delayMs: number): () => void {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!
      let lastWriteAt = 0
      Object.defineProperty(HTMLTextAreaElement.prototype, 'value', {
        configurable: true,
        get() {
          const raw = descriptor.get?.call(this) as string
          if (lastWriteAt === 0) return raw
          return Date.now() >= lastWriteAt + delayMs ? raw : ''
        },
        set(next: string) {
          lastWriteAt = Date.now()
          descriptor.set?.call(this, next)
        }
      })
      return () => {
        Object.defineProperty(HTMLTextAreaElement.prototype, 'value', descriptor)
      }
    }

    const config = { input: '#input', button: '#send', submitMode: 'click' as const }
    const PARTIAL_PROMPT = 'The quick brown fox jumps over the lazy dog. '.repeat(5).trim()

    it('verifies a full append and preserves the previous draft', async () => {
      document.body.innerHTML = `
              <textarea id="input">draft</textarea>
              <button id="send" type="button">Send</button>
          `

      const script = generateAutoSendScript(config, 'hello', false, true)
      const result = await window.eval(script)

      expect(result.success).toBe(true)
      expect(result.action).toBe('input_only')
      const textarea = document.getElementById('input') as HTMLTextAreaElement
      expect(textarea.value).toBe('draft\n\nhello')
      expect(result.diagnostics.textVerifyResult).toBe('verified')
      expect(typeof result.diagnostics.textVerifyDelta).toBe('number')
      expect(result.diagnostics.input.operationSucceeded).toBe(true)
    })

    it('verifies a replace and removes the old draft', async () => {
      document.body.innerHTML = `
              <textarea id="input">old draft</textarea>
              <button id="send" type="button">Send</button>
          `

      const script = generateAutoSendScript(config, 'fresh text', false, false)
      const result = await window.eval(script)

      expect(result.success).toBe(true)
      const textarea = document.getElementById('input') as HTMLTextAreaElement
      expect(textarea.value).toBe('fresh text')
      expect(result.diagnostics.textVerifyResult).toBe('verified')
    })

    it.each([
      {
        label: 'Unicode/emoji and Turkish characters',
        prompt: 'Merhaba dünya 🌍 ğüşiöçİı — Привет 👩‍💻'
      },
      { label: 'a 10k+ character prompt', prompt: 'uzun satır içeriği\n'.repeat(800) + 'SON' }
    ])(
      'keeps $label intact without a typing fallback',
      async ({ prompt }) => {
        document.body.innerHTML = `
              <textarea id="input"></textarea>
              <button id="send" type="button">Send</button>
          `

        const script = generateAutoSendScript(config, prompt, false, true)
        const result = await window.eval(script)

        expect(result.success).toBe(true)
        const textarea = document.getElementById('input') as HTMLTextAreaElement
        expect(textarea.value).toBe(prompt)
        expect(result.diagnostics.textVerifyResult).toBe('verified')
        expect(result.diagnostics.textInputStrategy).toBe('value_setter')
        expect(result.diagnostics.textInputFallback).toBeFalsy()
        expect(result.diagnostics.setInputMs).toBeTypeOf('number')
      },
      15000
    )

    it('accepts editor line-ending normalization without a typing fallback', async () => {
      document.body.innerHTML = `
              <div contenteditable="true" id="composer"></div>
              <button id="send" type="button">Send</button>
          `
      const composer = document.getElementById('composer') as HTMLDivElement
      const rawTextContent = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent')
      Object.defineProperty(composer, 'textContent', {
        configurable: true,
        get() {
          const raw = (rawTextContent?.get?.call(this) as string) || ''
          return raw.replaceAll('\r\n', '\n')
        },
        set(value: string) {
          rawTextContent?.set?.call(this, value)
        }
      })
      const inputEvents: Event[] = []
      composer.addEventListener('input', (event) => inputEvents.push(event))

      const prompt = 'ilk satır\r\nikinci satır\n\nüçüncü'
      const script = generateAutoSendScript(
        { input: '#composer', button: '#send', submitMode: 'click' },
        prompt,
        false,
        true
      )
      const result = await window.eval(script)

      expect(result.success).toBe(true)
      expect(result.diagnostics.textVerifyResult).toBe('verified')
      expect(result.diagnostics.textInputFallback).toBeFalsy()
      expect(inputEvents.length).toBeLessThanOrEqual(3)
    })

    it('catches a late DOM update within the retry window without typing', async () => {
      document.body.innerHTML = `
              <textarea id="input"></textarea>
              <button id="send" type="button">Send</button>
          `
      const restore = installDelayedTextareaReads(60)
      try {
        const script = generateAutoSendScript(config, 'gecikmeli metin', false)
        const result = await window.eval(script)

        expect(result.success).toBe(true)
        expect(result.diagnostics.textVerifyResult).toBe('verified')
        expect(result.diagnostics.textInputFallback).toBeFalsy()
      } finally {
        restore()
      }
    })

    // Üç kısmi-yerleştirme biçimi tek bir davranışın varyantları: hiçbiri
    // "başarılı" sayılmamalı, hiçbiri fallback tetiklememeli ve hiçbiri
    // sessizce gönderim yapmamalı. `middle` biçimi eski baş/son-40 kontrolünün
    // yanlış pozitifini kilitler: ilk 40 ve son 40 karakter mevcut ama orta
    // kısım hiç girmemiş.
    it.each([
      { shape: 'first-40-only', placed: PARTIAL_PROMPT.slice(0, 40) },
      { shape: 'last-40-only', placed: PARTIAL_PROMPT.slice(-40) },
      {
        shape: 'head-and-tail-but-no-middle',
        placed: PARTIAL_PROMPT.slice(0, 40) + PARTIAL_PROMPT.slice(-40)
      }
    ])('rejects a paste that landed only $shape', async ({ placed }) => {
      document.body.innerHTML = `
              <textarea id="input"></textarea>
              <button id="send" type="button">Send</button>
          `
      const clicks = countSendClicks()
      const restore = installTextareaWriteTransform((next) => next.replace(PARTIAL_PROMPT, placed))
      try {
        const script = generateAutoSendScript(config, PARTIAL_PROMPT, true)
        const result = await window.eval(script)

        expect(result.success).toBe(false)
        expect(result.error).toBe('text_input_partial')
        expect(result.diagnostics.textVerifyResult).toBe('partial')
        expect(result.diagnostics.textInputFallback).toBeFalsy()
        expect(result.diagnostics.input.operationSucceeded).toBe(false)
        expect(clicks).not.toHaveBeenCalled()
        const textarea = document.getElementById('input') as HTMLTextAreaElement
        // Kısmi içerik kullanıcıya bırakılır; hiçbir fallback mükerrer ekleme yapmaz.
        expect(textarea.value).toBe(placed)
      } finally {
        restore()
      }
    })

    it('never reports success when nothing was placed, even after the typing fallback', async () => {
      document.body.innerHTML = `
              <textarea id="input"></textarea>
              <button id="send" type="button">Send</button>
          `
      const clicks = countSendClicks()
      const restore = installTextareaWriteTransform(() => '')
      try {
        const script = generateAutoSendScript(
          { input: '#input', button: '#send', submitMode: 'click' },
          'hello',
          true
        )
        const result = await window.eval(script)

        expect(result.success).toBe(false)
        expect(result.error).toBe('text_input_unverified')
        expect(result.diagnostics.textInputFallback).toBe('human_typing')
        expect(result.diagnostics.textVerifyResult).toBe('unchanged')
        expect(clicks).not.toHaveBeenCalled()
        const textarea = document.getElementById('input') as HTMLTextAreaElement
        expect(textarea.value).toBe('')
      } finally {
        restore()
      }
    })

    it('does not duplicate or submit when the composer already holds the prompt and the write is ignored', async () => {
      document.body.innerHTML = `
              <textarea id="input">hello</textarea>
              <button id="send" type="button">Send</button>
          `
      const clicks = countSendClicks()
      const restore = installTextareaWriteTransform((_next, previous) => previous)
      try {
        const script = generateAutoSendScript(config, 'hello', true, true)
        const result = await window.eval(script)

        expect(result.success).toBe(false)
        expect(result.error).toBe('text_input_unverified')
        expect(result.diagnostics.textVerifyResult).toBe('ambiguous')
        // Metin zaten alanda: fallback çalıştırmak mükerrer ekleme üretirdi.
        expect(result.diagnostics.textInputFallback).toBeFalsy()
        expect(clicks).not.toHaveBeenCalled()
        const textarea = document.getElementById('input') as HTMLTextAreaElement
        expect(textarea.value).toBe('hello')
      } finally {
        restore()
      }
    })

    it('returns an explicit error in paste-only mode instead of submitting blind', async () => {
      document.body.innerHTML = `
              <textarea id="input"></textarea>
              <button id="send" type="button">Send</button>
          `
      const clicks = countSendClicks()
      const restore = installTextareaWriteTransform((_next, previous) => previous)
      try {
        const script = generateAutoSendScript(config, 'hello', true, false, 'paste')
        const result = await window.eval(script)

        expect(result.success).toBe(false)
        expect(result.error).toBe('text_input_unverified')
        expect(result.diagnostics.textInputFallback).toBeFalsy()
        expect(clicks).not.toHaveBeenCalled()
      } finally {
        restore()
      }
    })
  })

  describe('generated script structure', () => {
    it('prevents script injection via malicious text payloads', () => {
      // SECURITY: JSON.stringify escapes all special characters so they
      // remain inside the generated string literal as data, not as code.
      // The definitive proof is that the generated script parses as valid
      // JavaScript without throwing — meaning no injection characters
      // "broke out" of the string literal.
      const config = {
        input: '#input',
        button: '#send',
        submitMode: 'click' as const
      }

      const payloads: string[] = [
        "'; alert(1);//",
        '"; alert(1);//',
        '${1+1}',
        '`backtick`',
        '"); require("child_process").execSync("evil");//',
        '{{constructor.constructor("return 1")()}}',
        '\\u005c\\u0027',
        'new Function("return 1")()'
      ]

      for (const payload of payloads) {
        const script = generateAutoSendScript(config, payload, false)
        // new Function throws SyntaxError if the escaped string
        // broke out and produced invalid JavaScript.
        expect(() => new Function(script), `Payload: ${JSON.stringify(payload)}`).not.toThrow()
      }
    })
  })
})
