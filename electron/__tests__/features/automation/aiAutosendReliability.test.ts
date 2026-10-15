/**
 * Otomatik gönderim güvenilirliği regresyon bataryası.
 *
 * Bu dosya "metin yazıldı ama gönderilmedi" hatasının kök nedenlerini
 * kilitler:
 *   A) Etkin butonun CSS sınıfı yüzünden pasif sayılması,
 *   B) Tam metin doğrulama kapısının yanlış negatifi,
 *   C) Uzun metinde framework modeline girmeyen DOM eklemesi,
 *   D) Sentetik Enter'ın sahte başarı sayılması.
 */
import { generateAutoSendScript } from '@electron/features/automation/automationScripts'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('aiAutosendReliability', () => {
  let restoreLayout: (() => void) | null = null

  beforeEach(() => {
    document.body.innerHTML = ''
    delete (window as typeof window & { __quizlabReaderAutomationCache?: unknown })
      .__quizlabReaderAutomationCache
    restoreLayout = stubLayout()
  })

  afterEach(() => {
    restoreLayout?.()
    restoreLayout = null
  })

  /**
   * jsdom hiçbir öğeye yerleşim hesaplamaz: `offsetWidth`/`offsetHeight` her
   * zaman 0'dır ve `describeNotReady` her öğeyi "zero_size" ilan eder. Gerçek
   * Chromium'da ölçüm vardır; testlerin buton etkileşim kapısına ulaşabilmesi
   * için ölçüm burada taklit edilir.
   */
  function stubLayout(): () => void {
    const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
    const height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get: () => 32
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get: () => 32
    })
    return () => {
      if (width) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', width)
      if (height) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', height)
    }
  }

  describe('A — enabled button misclassified as disabled', () => {
    it('clicks an enabled send button that only carries a Tailwind disabled variant', async () => {
      document.body.innerHTML = `
        <div role="textbox" contenteditable="true" id="composer"></div>
        <button id="send" class="disabled:opacity-50 hover:bg-primary" type="button">Send</button>
      `
      const clicks = vi.fn()
      document.getElementById('send')?.addEventListener('click', clicks)

      const startedAt = Date.now()
      const script = generateAutoSendScript(
        { input: '#composer', button: '#send', submitMode: 'click' },
        'merhaba',
        true
      )
      const result = await window.eval(script)
      const elapsed = Date.now() - startedAt

      expect(result.success).toBe(true)
      expect(clicks).toHaveBeenCalledTimes(1)
      // 15 saniyelik buton kapısı dolanmamalı.
      expect(elapsed).toBeLessThan(5000)
    }, 20000)

    it('clicks an enabled send button that only carries an aria-disabled variant', async () => {
      document.body.innerHTML = `
        <div role="textbox" contenteditable="true" id="composer"></div>
        <button id="send" class="aria-disabled:opacity-50 aria-disabled:cursor-not-allowed" type="button">Send</button>
      `
      const clicks = vi.fn()
      document.getElementById('send')?.addEventListener('click', clicks)

      const startedAt = Date.now()
      const result = await window.eval(
        generateAutoSendScript(
          { input: '#composer', button: '#send', submitMode: 'click' },
          'merhaba',
          true
        )
      )

      expect(result.success).toBe(true)
      expect(clicks).toHaveBeenCalledTimes(1)
      expect(Date.now() - startedAt).toBeLessThan(5000)
    }, 20000)

    it('still refuses a genuinely disabled button', async () => {
      document.body.innerHTML = `
        <div role="textbox" contenteditable="true" id="composer"></div>
        <button id="send" type="button" disabled>Send</button>
      `
      const clicks = vi.fn()
      document.getElementById('send')?.addEventListener('click', clicks)

      const result = await window.eval(
        generateAutoSendScript(
          { input: '#composer', button: '#send', submitMode: 'click' },
          'merhaba',
          true
        )
      )

      expect(result.success).toBe(false)
      expect(clicks).not.toHaveBeenCalled()
      expect(result.error).toBe('submit_not_ready')
    }, 25000)
  })

  describe('D — synthetic Enter must not report unearned success', () => {
    it('does not claim success when the editor ignores the untrusted Enter', async () => {
      document.body.innerHTML = `
        <div role="textbox" contenteditable="true" id="composer"></div>
        <button id="send" type="button">Send</button>
      `
      const composer = document.getElementById('composer') as HTMLDivElement
      composer.textContent = 'merhaba'
      // Site sentetik klavye olayını yok sayıyor (isTrusted=false): içerik
      // değişmez, mesaj gönderilmez.
      composer.addEventListener('keydown', (event) => {
        if (!event.isTrusted) event.stopImmediatePropagation()
      })

      const result = await window.eval(
        generateAutoSendScript(
          { input: '#composer', button: null, submitMode: 'enter_key' },
          'merhaba',
          true
        )
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('submit_unverified')
    }, 25000)

    it('reports success when Enter really empties the composer', async () => {
      document.body.innerHTML = `
        <div role="textbox" contenteditable="true" id="composer"></div>
        <button id="send" type="button">Send</button>
      `
      const composer = document.getElementById('composer') as HTMLDivElement
      composer.textContent = 'merhaba'
      composer.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.isTrusted) composer.textContent = ''
      })

      const result = await window.eval(
        generateAutoSendScript(
          { input: '#composer', button: null, submitMode: 'enter_key' },
          'merhaba',
          true
        )
      )

      expect(result.success).toBe(true)
      expect(result.submitObserved).toBe(true)
    }, 25000)

    it('does not press Enter twice when the button is present but disabled', async () => {
      document.body.innerHTML = `
        <div role="textbox" contenteditable="true" id="composer"></div>
        <button id="send" type="button" disabled>Send</button>
      `
      const composer = document.getElementById('composer') as HTMLDivElement
      composer.textContent = 'merhaba'
      const enterKeys = vi.fn()
      composer.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') enterKeys()
      })

      const result = await window.eval(
        generateAutoSendScript(
          { input: '#composer', button: '#send', submitMode: 'mixed' },
          'merhaba',
          true
        )
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('submit_not_ready')
      // Körlemesine Enter gönderilmemeli.
      expect(enterKeys).not.toHaveBeenCalled()
    }, 30000)

    it('reports a disabled button as blocked, not as a missing selector', async () => {
      document.body.innerHTML = `
        <div role="textbox" contenteditable="true" id="composer"></div>
        <button id="send" type="button" disabled>Send</button>
      `

      const result = await window.eval(
        generateAutoSendScript(
          { input: '#composer', button: '#send', submitMode: 'click' },
          'merhaba',
          true
        )
      )

      // `button_not_found` kullanıcıyı selector'ını yeniden seçmeye yönlendirir
      // ve bu bir selector hatası DEĞİLDİR — buton bulundu, pasifti.
      expect(result.error).toBe('submit_not_ready')
      expect(result.error).not.toBe('button_not_found')
      expect(result.notReadyReason).toBeTruthy()
      expect(result.submitOutcome).toBe('blocked')
    }, 30000)

    it('exits the readiness gate early when the button stays stably disabled', async () => {
      document.body.innerHTML = `
        <div role="textbox" contenteditable="true" id="composer"></div>
        <button id="send" type="button" aria-disabled="true">Send</button>
      `

      const startedAt = Date.now()
      const result = await window.eval(
        generateAutoSendScript(
          { input: '#composer', button: '#send', submitMode: 'click' },
          'merhaba',
          true
        )
      )
      const elapsed = Date.now() - startedAt

      // Kararlı pasiflikte 15 saniye beklemenin anlamı yoktur.
      expect(result.success).toBe(false)
      expect(elapsed).toBeLessThan(10000)
    }, 30000)

    it('never dispatches Enter twice when mixed mode finds no button', async () => {
      document.body.innerHTML = `<div role="textbox" contenteditable="true" id="composer"></div>`
      const composer = document.getElementById('composer') as HTMLDivElement
      const enterKeys = vi.fn()
      composer.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') enterKeys()
      })

      await window.eval(
        generateAutoSendScript(
          { input: '#composer', button: null, submitMode: 'mixed' },
          'merhaba',
          true
        )
      )

      // Enter fallback'i bir kez denenir; doğrulanamazsa tekrar edilmez.
      expect(enterKeys.mock.calls.length).toBeLessThanOrEqual(1)
    }, 30000)
  })

  describe('C — framework model must actually receive the text', () => {
    /**
     * ProseMirror/Lexical taklidi: içerik modelini düzenleme OLAYLARINDAN
     * günceller (`insertText` ve `insertFromPaste`), modele göre DOM'u yeniden
     * çizer ve gönder butonunu modele göre açar. Ham `appendChild` modele
     * dokunmaz — bu, gerçek framework davranışının özüdür.
     */
    function installFrameworkComposer(composer: HTMLElement, send: HTMLElement) {
      const state = { model: '', events: [] as string[] }
      const render = () => {
        composer.textContent = state.model
        send.toggleAttribute('disabled', state.model.trim().length === 0)
      }
      composer.addEventListener('beforeinput', (event) => {
        state.events.push(event.inputType)
        const isText = event.inputType === 'insertText' && typeof event.data === 'string'
        const isPaste = event.inputType === 'insertFromPaste' && typeof event.data === 'string'
        if (!isText && !isPaste) return
        state.model += event.data as string
        event.preventDefault()
        render()
      })
      send.toggleAttribute('disabled', true)
      return state
    }

    it('uses the real editing channel for long text so the framework model is filled', async () => {
      document.body.innerHTML = `
        <div role="textbox" contenteditable="true" id="composer"></div>
        <button id="send" type="button">Send</button>
      `
      const composer = document.getElementById('composer') as HTMLDivElement
      const send = document.getElementById('send') as HTMLButtonElement
      const state = installFrameworkComposer(composer, send)
      const clicks = vi.fn()
      send.addEventListener('click', clicks)

      const prompt = `${'uzun satır içeriği\n'.repeat(800)}SON`
      expect(prompt.length).toBeGreaterThan(10000)

      const result = await window.eval(
        generateAutoSendScript(
          { input: '#composer', button: '#send', submitMode: 'mixed' },
          prompt,
          true
        )
      )

      // jsdom execCommand uygulamaz; bu yüzden kanıt, ham DOM'a değil
      // framework MODELİNE giren içeriktir. Metin DOM'da görünse de model
      // boş kalsaydı buton açılmaz ve gönderim yapılmazdı.
      expect(state.model.length).toBeGreaterThan(10000)
      expect(result.diagnostics.textVerifyResult).toBe('verified')
      expect(result.success).toBe(true)
      expect(clicks).toHaveBeenCalledTimes(1)
    }, 30000)

    it('flags a raw DOM insertion as unverified instead of reporting success', async () => {
      document.body.innerHTML = `
        <div role="textbox" contenteditable="true" id="composer"></div>
        <button id="send" type="button">Send</button>
      `
      // Editör hiçbir düzenleme kanalını kabul etmiyor ve metni okunamaz
      // kılıyor: hiçbir strateji doğrulanamaz.
      const composer = document.getElementById('composer') as HTMLDivElement
      Object.defineProperty(composer, 'textContent', {
        configurable: true,
        get: () => '',
        set: () => {}
      })

      const result = await window.eval(
        generateAutoSendScript(
          { input: '#composer', button: '#send', submitMode: 'mixed' },
          'merhaba',
          false
        )
      )

      // Doğrulama geçemezse submit edilmez ve neden açıkça bildirilir.
      expect(result.success).toBe(false)
      expect(['text_input_unverified', 'text_input_partial']).toContain(result.error)
      expect(result.diagnostics.textVerifyResult).not.toBe('verified')
    }, 30000)
  })

  describe('B — full-text verification has no false negatives', () => {
    it('accepts text the editor normalized with typographic punctuation', async () => {
      document.body.innerHTML = `
        <div role="textbox" contenteditable="true" id="composer"></div>
        <button id="send" type="button">Send</button>
      `
      const composer = document.getElementById('composer') as HTMLDivElement

      const script = generateAutoSendScript(
        { input: '#composer', button: '#send', submitMode: 'click' },
        'Deyin "bugun" çok güzel...',
        false
      )
      await window.eval(script)

      // Editör yapıştırılan düz tırnakları akıllı tırnaklara çevirdi:
      // gerçek bir Quill/ProseMirror davranışı.
      const raw = composer.textContent || ''
      expect(raw.length).toBeGreaterThan(0)
      const quoteIndex = raw.indexOf('"')
      expect(quoteIndex).toBeGreaterThanOrEqual(0)
      composer.textContent =
        raw.slice(0, quoteIndex) + '\u201C' + raw.slice(quoteIndex + 1).replaceAll('"', '\u201D')

      const second = await window.eval(
        generateAutoSendScript(
          { input: '#composer', button: '#send', submitMode: 'click' },
          'Deyin \u201Cbugun\u201D çok güzel\u2026',
          false
        )
      )
      expect(second.diagnostics.textVerifyResult).toBe('verified')
      expect(second.diagnostics.textInputFallback).toBeFalsy()
    }, 20000)

    it('accepts decomposed Unicode that the editor recomposed to NFC', async () => {
      document.body.innerHTML = `
        <textarea id="input"></textarea>
        <button id="send" type="button">Send</button>
      `
      // "é" = e + U+0301 (birleşik değil). Editör NFC'ye dönüştürdüğünde
      // ham kod noktası karşılaştırması yanlış negatif üretirdi.
      const decomposed = 'café'
      const script = generateAutoSendScript(
        { input: '#input', button: '#send', submitMode: 'click' },
        decomposed,
        false
      )
      const result = await window.eval(script)

      const textarea = document.getElementById('input') as HTMLTextAreaElement
      textarea.value = textarea.value.normalize('NFC')

      const second = await window.eval(
        generateAutoSendScript(
          { input: '#input', button: '#send', submitMode: 'click' },
          decomposed,
          false
        )
      )
      expect(second.diagnostics.textVerifyResult).toBe('verified')
      expect(result.success).toBe(true)
    }, 20000)

    it('still rejects partial text after the punctuation relaxation', async () => {
      document.body.innerHTML = `
        <textarea id="input"></textarea>
        <button id="send" type="button">Send</button>
      `
      const prompt = `${'tam bir cümle. '.repeat(6)}SON`

      // Alan, yazılan TAM metnin ortasından bir parçayı düşürerek yazar:
      // kısmi yerleştirme senaryosu.
      const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!
      Object.defineProperty(HTMLTextAreaElement.prototype, 'value', {
        configurable: true,
        get() {
          return descriptor.get?.call(this)
        },
        set(next: string) {
          descriptor.set?.call(this, next.replace(prompt.slice(10, 30), ''))
        }
      })

      try {
        const result = await window.eval(
          generateAutoSendScript(
            { input: '#input', button: '#send', submitMode: 'click' },
            prompt,
            false
          )
        )

        // Katlama yalnızca kabul yönünde çalışır: eksik içerik kabul edilmez.
        expect(result.success).toBe(false)
        expect(result.diagnostics.textVerifyResult).not.toBe('verified')
      } finally {
        Object.defineProperty(HTMLTextAreaElement.prototype, 'value', descriptor)
      }
    }, 20000)

    it('rejects a replace that left the previous draft in place', async () => {
      // Replace sözleşmesi: eski taslak KAYBOLDUR. Editör yeni metni ekleyip
      // eskisini silmezse içerik kirlidir ve gönderilmemelidir. Katlanmış
      // karşılaştırma bu durumu "eski taslak gitti" diye okursa yanlış
      // pozitif üretir.
      document.body.innerHTML = `
        <textarea id="input">eski taslak metni</textarea>
        <button id="send" type="button">Send</button>
      `
      const prompt = 'yeni ve tek gönderilecek metin'

      const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!
      Object.defineProperty(HTMLTextAreaElement.prototype, 'value', {
        configurable: true,
        get() {
          return descriptor.get?.call(this)
        },
        set(next: string) {
          // Editör yeni metni EKLER ama eski taslağı SİLMEZ.
          descriptor.set?.call(this, `eski taslak metni ${next}`)
        }
      })

      try {
        const result = await window.eval(
          generateAutoSendScript(
            { input: '#input', button: '#send', submitMode: 'click' },
            prompt,
            false
          )
        )

        expect(result.success).toBe(false)
        expect(result.diagnostics.textVerifyResult).not.toBe('verified')
        expect(result.error).toBe('text_input_partial')
      } finally {
        Object.defineProperty(HTMLTextAreaElement.prototype, 'value', descriptor)
      }
    }, 20000)

    it('rejects an append that dropped the previous draft', async () => {
      // Append sözleşmesi: önceki içerik KORUNUR. Kaybolduysa doğrulama
      // başarısız olmalıdır; noktalama katlaması bu korumayı gevşetmemelidir.
      document.body.innerHTML = `
        <textarea id="input">korunmasi gereken eski icerik</textarea>
        <button id="send" type="button">Send</button>
      `
      const prompt = 'eklenecek yeni icerik '.repeat(5).trim()

      const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!
      Object.defineProperty(HTMLTextAreaElement.prototype, 'value', {
        configurable: true,
        get() {
          return descriptor.get?.call(this)
        },
        set(next: string) {
          // Editör YENİ metni alır ama ESKİ taslağı siler. Yeni metin
          // eskisinden uzun olduğu için "kazanılan uzunluk" eşiği de aşılır:
          // korumanın tek gerçek sınavı, kayıp eski içeriğin yakalanmasıdır.
          descriptor.set?.call(this, next.replace('korunmasi gereken eski icerik', ''))
        }
      })

      try {
        const result = await window.eval(
          generateAutoSendScript(
            { input: '#input', button: '#send', submitMode: 'click' },
            prompt,
            false,
            true
          )
        )

        expect(result.success).toBe(false)
        expect(result.diagnostics.textVerifyResult).not.toBe('verified')
      } finally {
        Object.defineProperty(HTMLTextAreaElement.prototype, 'value', descriptor)
      }
    }, 20000)
  })

  describe('9 — auto-send preference is never overridden', () => {
    it('does not submit when auto-send is off, and still verifies the text', async () => {
      document.body.innerHTML = `
        <textarea id="input"></textarea>
        <button id="send" type="button">Send</button>
      `
      const clicks = vi.fn()
      document.getElementById('send')?.addEventListener('click', clicks)

      const result = await window.eval(
        generateAutoSendScript(
          { input: '#input', button: '#send', submitMode: 'click' },
          'merhaba',
          false
        )
      )

      expect(result.success).toBe(true)
      expect(result.action).toBe('input_only')
      expect(result.submitOutcome).toBe('input_only')
      expect(clicks).not.toHaveBeenCalled()
      const textarea = document.getElementById('input') as HTMLTextAreaElement
      expect(textarea.value).toBe('merhaba')
    }, 20000)
  })
})
