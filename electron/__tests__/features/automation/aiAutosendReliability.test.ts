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
import type { SubmitMode } from '@shared-core/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('aiAutosendReliability', () => {
  let restoreLayout: (() => void) | null = null

  /**
   * Testlerin koştuğu küçük bekleme bütçeleri.
   *
   * Üretim ölçümleri (15s buton bütçesi, 3s gözlem penceresi, 2s kararlı-pasif
   * çıkışı) korunur; bu değerler yalnızca aynı YAPISAL davranışı saniyeler yerine
   * milisaniyelerle sınamak içindir (bkz. `SubmitBudgetOptions`).
   *
   * ⚠️ Güvenlik payı: bu kancayla ölçülen hiçbir davranış yükten BAĞIMSIZ
   * değildir. Aşağıdaki kontrollerin hepsi sayaç tabanlıdır ve sayaç gecikmeyi
   * AZALTIR, artırmaz — yani küçük bütçe bir testi kıramaz, yalnızca daha
   * çabuk bitmesini sağlar. `notReadyReason`/`submitOutcome` gibi alanlar da
   * bütçeden değil, gözlenen durumdan türetilir.
   */
  const FAST_BUDGET = {
    submitBudgetMs: 500,
    unconfiguredButtonProbeMs: 250,
    stableBlockedExitMs: 250,
    observeAttempts: 3,
    observeIntervalMs: 10,
    rejectedControlRetryMs: 20
  } as const

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

  /**
   * Gerçek bir gönder butonu mesajı editörden AYRILIR. Tıklamanın bir
   * teslimat kanıtı sayılması bu gözleme dayanır, bu yüzden "etkileşime
   * hazır butona tıklandı" kapılarını sınayan sahte sayfalarda butonun
   * gerçekten bir gönderim yapması sağlanır. Aksi halde `success` beklenen
   * testler, bu regresyonun tam da ortaya çıkardığı sahte başarıya
   * dayanırdı.
   */
  function makeSendButtonDeliver(send: HTMLElement, composer: HTMLElement): () => void {
    const listener = () => {
      composer.textContent = ''
    }
    send.addEventListener('click', listener)
    return () => send.removeEventListener('click', listener)
  }

  describe('A — enabled button misclassified as disabled', () => {
    it.each([
      {
        variant: 'Tailwind disabled variant',
        className: 'disabled:opacity-50 hover:bg-primary'
      },
      {
        variant: 'aria-disabled variant',
        className: 'aria-disabled:opacity-50 aria-disabled:cursor-not-allowed'
      }
    ])(
      'clicks an enabled send button that only carries a $variant',
      async ({ className }) => {
        document.body.innerHTML = `
        <div role="textbox" contenteditable="true" id="composer"></div>
        <button id="send" class="${className}" type="button">Send</button>
      `
        const clicks = vi.fn()
        const send = document.getElementById('send') as HTMLButtonElement
        send.addEventListener('click', clicks)
        makeSendButtonDeliver(send, document.getElementById('composer') as HTMLDivElement)

        const script = generateAutoSendScript(
          { input: '#composer', button: '#send', submitMode: 'click' },
          'merhaba',
          true,
          false,
          'auto',
          30,
          FAST_BUDGET
        )
        const result = await window.eval(script)

        expect(result.success).toBe(true)
        expect(clicks).toHaveBeenCalledTimes(1)
        // Etkin buton İLK turda bulunmalı: 15 saniyelik etkileşim kapısı
        // dolanmamalı. Bu sayaç yükten bağımsızdır ve daha güçlüdür — gecikmiş
        // bir tur sayısını AZALTIR, artırmaz. Kapı dolansaydı (250ms/yoklama)
        // değer ~60'a çıkardı.
        expect(result.diagnostics.button.waitIterations).toBeLessThan(3)
      },
      5000
    )

    it('still refuses a genuinely disabled button and names it blocked, not missing', async () => {
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
          true,
          false,
          'auto',
          30,
          FAST_BUDGET
        )
      )

      expect(result.success).toBe(false)
      expect(clicks).not.toHaveBeenCalled()
      // `button_not_found` kullanıcıyı selector'ını yeniden seçmeye yönlendirir
      // ve bu bir selector hatası DEĞİLDİR — buton bulundu, pasifti.
      expect(result.error).toBe('submit_not_ready')
      expect(result.error).not.toBe('button_not_found')
      expect(result.notReadyReason).toBeTruthy()
      expect(result.submitOutcome).toBe('blocked')
      // Kararlı pasiflikte kapı erken kapanmalı (üretimde 2s). Sayaç yükten
      // bağımsızdır: erken çıkış kaybolursa 250ms'lik her yoklamada bir tur
      // artar ve değer ~60'a çıkar.
      expect(result.diagnostics.button.waitIterations).toBeLessThan(30)
    }, 5000)
  })

  describe('D — synthetic Enter must not report unearned success', () => {
    // Tabloya açık tip verilir: aksi halde `submitMode` alanı `SubmitMode`
    // literal kümesi yerine `string` olarak genişler ve generateAutoSendScript'in
    // beklediği `SubmitMode | undefined` ile uyuşmaz.
    const enterTwiceCases: Array<{
      scenario: string
      body: string
      submitMode: SubmitMode
      expectedError: string | null
      maxEnterKeys: number
    }> = [
      {
        scenario: 'the button is present but disabled',
        body: `<button id="send" type="button" disabled>Send</button>`,
        submitMode: 'mixed',
        expectedError: 'submit_not_ready',
        maxEnterKeys: 0
      },
      {
        scenario: 'mixed mode finds no button at all',
        body: '',
        submitMode: 'mixed',
        expectedError: null,
        maxEnterKeys: 1
      }
    ]

    it.each(enterTwiceCases)(
      'never dispatches Enter twice when $scenario',
      async ({ body, submitMode, expectedError, maxEnterKeys }) => {
        document.body.innerHTML = `
        <div role="textbox" contenteditable="true" id="composer"></div>
        ${body}
      `
        const composer = document.getElementById('composer') as HTMLDivElement
        composer.textContent = 'merhaba'
        const enterKeys = vi.fn()
        composer.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') enterKeys()
        })

        const result = await window.eval(
          generateAutoSendScript(
            { input: '#composer', button: body ? '#send' : null, submitMode },
            'merhaba',
            true,
            false,
            'auto',
            30,
            FAST_BUDGET
          )
        )

        if (expectedError) {
          expect(result.success).toBe(false)
          expect(result.error).toBe(expectedError)
        }
        // Körlemesine Enter gönderilmemeli; fallback ise en fazla bir kez denenmeli.
        expect(enterKeys.mock.calls.length).toBeLessThanOrEqual(maxEnterKeys)
      },
      5000
    )

    it('exits the readiness gate early when the button stays stably disabled', async () => {
      document.body.innerHTML = `
        <div role="textbox" contenteditable="true" id="composer"></div>
        <button id="send" type="button" aria-disabled="true">Send</button>
      `

      const result = await window.eval(
        generateAutoSendScript(
          { input: '#composer', button: '#send', submitMode: 'click' },
          'merhaba',
          true,
          false,
          'auto',
          30,
          FAST_BUDGET
        )
      )

      // Kararlı pasiflikte 15 saniye beklemenin anlamı yoktur: buton bulundu
      // ama etkileşime hazır değil, bu bir selector hatası değildir.
      expect(result.success).toBe(false)
      expect(result.error).toBe('submit_not_ready')
      expect(result.notReadyReason).toBeTruthy()
      expect(result.submitOutcome).toBe('blocked')
      // Erken çıkış sayacı. Üretim penceresi 2s / 250ms yoklama ≈ 8 tur; erken
      // çıkış kaybolursa 15s'lik bütçe dolar ve değer ~60 olur. Sayaç yükten
      // bağımsızdır: gecikme tur sayısını yalnızca ARTIRIR.
      expect(result.diagnostics.button.waitIterations).toBeLessThan(30)
    }, 5000)
  })

  describe('C — framework model must actually receive the text', () => {
    /**
     * ProseMirror/Lexical taklidi: içerik modelini düzenleme OLAYLARINDAN
     * günceller (`insertText` ve `insertFromPaste`), modele göre DOM'u yeniden
     * çizer ve gönder butonunu modele göre açar. Ham `appendChild` modele
     * dokunmaz — bu, gerçek framework davranışının özüdür.
     *
     * Gönder butonu da gerçek davranır: modeli boşaltır ve yeniden çizer.
     * Tıklamanın teslimat kanıtı sayılması bu gözleme dayandığı için,
     * sahte sayfanın "tıklandı ama hiçbir şey olmadı" taklidi yapmaması
     * gerekir.
     */
    function installFrameworkComposer(composer: HTMLElement, send: HTMLElement) {
      const state = { model: '', modelAtSend: '', events: [] as string[] }
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
      send.addEventListener('click', () => {
        // Gönder anındaki model, uzun metnin framework'e girdiğinin kanıtıdır:
        // gönder sonrası model zaten boşalır.
        state.modelAtSend = state.model
        state.model = ''
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
          true,
          false,
          'auto',
          30,
          FAST_BUDGET
        )
      )

      // jsdom execCommand uygulamaz; bu yüzden kanıt, ham DOM'a değil
      // framework MODELİNE giren içeriktir. Metin DOM'da görünse de model
      // boş kalsaydı buton açılmaz ve gönderim yapılmazdı.
      expect(state.modelAtSend.length).toBeGreaterThan(10000)
      expect(result.diagnostics.textVerifyResult).toBe('verified')
      expect(result.success).toBe(true)
      expect(clicks).toHaveBeenCalledTimes(1)
    }, 5000)

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
      // Ölçülen en yavaş test (≈1.4s): doğrulama yeniden denemeleri gönderim
      // bütçesinden değil, metin yerleştirme zincirinden gelir.
    }, 10000)
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
    }, 5000)

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
    }, 5000)

    // Katlama (noktalama/Unicode normalleştirme) YALNIZCA kabul yönünde çalışır.
    // Eksik içerik kabul edilmez ve append/replace sözleşmeleri gevşetilmez.
    it.each([
      {
        contract: 'partial text after the punctuation relaxation',
        existingDraft: '',
        append: false,
        prompt: `${'tam bir cümle. '.repeat(6)}SON`,
        // Alan, yazılan TAM metnin ortasından bir parçayı düşürerek yazar.
        editorWrite: (next: string) => next.replace(next.slice(10, 30), ''),
        expectedError: null
      },
      {
        // Replace sözleşmesi: eski taslak KAYBOLDUR. Editör yeni metni ekleyip
        // eskisini silmezse içerik kirlidir ve gönderilmemelidir.
        contract: 'a replace that left the previous draft in place',
        existingDraft: 'eski taslak metni',
        append: false,
        prompt: 'yeni ve tek gönderilecek metin',
        // Editör yeni metni EKLER ama eski taslağı SİLMEZ.
        editorWrite: (next: string) => `eski taslak metni ${next}`,
        expectedError: 'text_input_partial'
      },
      {
        // Append sözleşmesi: önceki içerik KORUNUR. Yeni metin eskisinden
        // uzun olduğu için "kazanılan uzunluk" eşiği de aşılır: korumanın tek
        // gerçek sınavı, kayıp eski içeriğin yakalanmasıdır.
        contract: 'an append that dropped the previous draft',
        existingDraft: 'korunmasi gereken eski icerik',
        append: true,
        prompt: 'eklenecek yeni icerik '.repeat(5).trim(),
        editorWrite: (next: string) => next.replace('korunmasi gereken eski icerik', ''),
        expectedError: null
      }
    ])(
      'rejects $contract',
      async ({ existingDraft, append, prompt, editorWrite, expectedError }) => {
        document.body.innerHTML = `
        <textarea id="input">${existingDraft}</textarea>
        <button id="send" type="button">Send</button>
      `

        const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!
        Object.defineProperty(HTMLTextAreaElement.prototype, 'value', {
          configurable: true,
          get() {
            return descriptor.get?.call(this)
          },
          set(next: string) {
            descriptor.set?.call(this, editorWrite(String(next)))
          }
        })

        try {
          const result = await window.eval(
            generateAutoSendScript(
              { input: '#input', button: '#send', submitMode: 'click' },
              prompt,
              false,
              append
            )
          )

          expect(result.success).toBe(false)
          expect(result.diagnostics.textVerifyResult).not.toBe('verified')
          if (expectedError) {
            expect(result.error).toBe(expectedError)
          }
        } finally {
          Object.defineProperty(HTMLTextAreaElement.prototype, 'value', descriptor)
        }
      },
      5000
    )
  })

  /**
   * Click yolu Enter yoluyla aynı dürüstlüğe sahip olmalı.
   *
   * Gerçek hatada (chatgpt.com ölçümü) `button[type="submit"]` geniş bir
   * sorgu gönder butonu yerine MİKROFON butonuna düşüyordu. `button.click()`
   * dikteyi başlatıyor, `__observeSubmitEffect` hiçbir etki görmüyor, ama
   * `success` yine de `true` idi: kullanıcı "gönderildi" görüyordu ve
   * selector onarımı bozuk locator'ı ödüllendiriyordu.
   *
   * Buradaki sahte sayfa gönder butonuna TIKLANAMAZ bir davranış verir —
   * tıklanır ama hiçbir arayüz etkisi üretmez. Bu tam olarak "yanlış öğe
   * tıklandı" durumudur.
   */
  describe('E — a click that changes nothing must not report a delivery', () => {
    // `submit_unverified` sınıflandırıcısında `retry: 'never'` taşır: tıklama
    // denendi ama teslimat gözlemlenmedi. Tablo `submitMode` alanını literal
    // `SubmitMode` olarak tutar (aksi halde `string` olarak genişler).
    const unobservedClickCases: Array<{
      scenario: string
      submitMode: SubmitMode
      expectedError: string
    }> = [
      {
        scenario: 'click mode with no observable effect',
        submitMode: 'click',
        expectedError: 'submit_unverified'
      },
      {
        scenario: 'mixed mode must not fall back to Enter after an unobserved click',
        submitMode: 'mixed',
        expectedError: 'submit_unverified'
      }
    ]

    it.each(unobservedClickCases)(
      'reports $scenario',
      async ({ submitMode, expectedError }) => {
        document.body.innerHTML = `
        <div role="textbox" contenteditable="true" id="composer"></div>
        <button id="send" type="button">Send</button>
      `
        const clicks = vi.fn()
        document.getElementById('send')?.addEventListener('click', clicks)
        const enterKeys = vi.fn()
        document.getElementById('composer')?.addEventListener('keydown', enterKeys)

        const result = await window.eval(
          generateAutoSendScript(
            { input: '#composer', button: '#send', submitMode },
            'merhaba',
            true,
            false,
            'auto',
            30,
            FAST_BUDGET
          )
        )

        // Tıklama gerçekten denendi — bu bir "butona hiç ulaşılamadı" hatası değil.
        expect(clicks).toHaveBeenCalledTimes(1)
        expect(result.submitMethod).toBe('button_click')
        // …ama hiçbir etki gözlemlenmediği için teslimat BAŞARILI SAYILAMAZ.
        expect(result.success).toBe(false)
        expect(result.error).toBe(expectedError)
        expect(result.submitObserved).toBe(false)
        expect(result.submitOutcome).toBe('delivery_unconfirmed')
        // Üst üste ikinci gönderim mükerrer mesaj üretir: Enter yalnızca
        // gönderim HİÇ denenmediğinde denenmelidir.
        expect(enterKeys).not.toHaveBeenCalled()
        // Efektsiz bir tıklama locator'ın DOĞRU olduğunun kanıtı değildir:
        // ödüllendirilirse bozuk selector onarım zincirinde yukarı taşınır.
        expect(result.diagnostics.button.operationSucceeded).toBe(false)
      },
      5000
    )

    it('observes a real delivery when the conversation grows outside the composer shell', async () => {
      // 2026-10-17 ölçümü (canlı chatgpt.com konuşma sayfası): gönderim
      // parmakizinin kökü composer kabuğuna ([data-composer-body],
      // 768×52, içinde 0 konuşma düğümü) çözülüyordu; konuşma ise <main>
      // içindeydi. Sayacın kalıcı 0'a düşmesi teslimat tespitini tek başına
      // "metin kutudan silindi" sinyaline bağlıyordu ve gönderim YİNE DE
      // "teslimat doğrulanamadı" diye raporlanıyordu.
      //
      // Buradaki yapı bilinçli olarak ölçülendir: composer bir <form> içinde
      // (closest('main, …, form') form'u seçerdi — 0 düğüm), konuşma onun
      // DIŞINDA. Doğru genişleme "içinde konuşma düğümü bulunan ilk atastır".
      document.body.innerHTML = `
        <main id="thread">
          <div data-message-author-role="user">önceki mesaj</div>
          <form id="composer-form">
            <div role="textbox" contenteditable="true" id="composer"></div>
            <button id="send" type="submit">Gönder</button>
          </form>
        </main>
      `
      document.getElementById('send')?.addEventListener('click', () => {
        // Gerçek davranış: mesaj konuşmaya eklenir ve React composer düğümünü
        // YENİLER. Parmakizin tuttuğu `inputElement` referansı eski ( kopmuş )
        // düğümde kalır ve içindeki metin DONAR — yani "metin değişti" sinyali
        // hiç üretilemez. Teslimatı yalnızca konuşma düğümü sayacı algılayabilir;
        // bu yüzden testin metni temizlemesi kasıtlıdır.
        const msg = document.createElement('div')
        msg.setAttribute('data-message-author-role', 'user')
        msg.textContent = 'merhaba'
        document
          .getElementById('thread')
          ?.insertBefore(msg, document.getElementById('composer-form'))

        const old = document.getElementById('composer')
        if (old) {
          const fresh = document.createElement('div')
          fresh.id = 'composer'
          fresh.setAttribute('role', 'textbox')
          fresh.setAttribute('contenteditable', 'true')
          old.parentNode?.replaceChild(fresh, old)
        }
      })

      const result = await window.eval(
        generateAutoSendScript(
          { input: '#composer', button: '#send', submitMode: 'click' },
          'merhaba',
          true,
          false,
          'auto',
          30,
          FAST_BUDGET
        )
      )

      expect(result.submitMethod).toBe('button_click')
      // Mesaj GİTTİ ve bu algılanmalı: kullanıcı "gönderdim" görmeli,
      // "teslimat doğrulanamadı" görmemeli.
      expect(result.submitObserved).toBe(true)
      expect(result.success).toBe(true)
      expect(result.submitOutcome).toBe('observed')
    }, 5000)

    it('refuses to click a dictation control and names it instead', async () => {
      // 2026-10-17 KÖK NEDEN (uygulama günlüğü, canlı chatgpt.com proje sayfası):
      //   matchedSelector = "button.cursor-interaction.size-token-button-composer.flex"
      //   submitWrongControl = "voice_control:Sesli iletişim yükleniyor"
      //   durationMs = 4.5, waitIterations = 1
      // Metin editöre girer girmez arama 4.5ms'de ilk eşleşmeye duruyordu ve o
      // eşleşme SESLİ SOHBET düğmesiydi — gönder düğmesiyle aynı class ailesi.
      // Tıklamak mesajı değil sesi başlatıyor, metin kutuda kalıyordu.
      //
      // Sesli/dikte kontrolü artık bir "eşleşme" değil: bulunduğunda önbellekten
      // düşürülür, gerçek gönder düğmesi için beklemeye devam edilir ve
      // TIKLANMAZ. Sözdiziminin güçlendirilmiş hâli.
      document.body.innerHTML = `
        <div role="textbox" contenteditable="true" id="composer"></div>
        <button data-composer-submit aria-label="Mesaj gönder" type="submit" style="display:none">Mesaj gönder</button>
        <button data-start-dictation aria-label="Dikteyi başlatma" type="submit">Mikrofon</button>
      `
      const dictation = vi.fn()
      document.querySelector('[data-start-dictation]')?.addEventListener('click', dictation)

      const result = await window.eval(
        generateAutoSendScript(
          { input: '#composer', button: '[data-start-dictation]', submitMode: 'click' },
          'merhaba',
          true,
          false,
          'auto',
          30,
          FAST_BUDGET
        )
      )

      // Tıklanmaz: mikrofonu başlatmak mesajı göndermek değildir.
      expect(dictation).not.toHaveBeenCalled()
      expect(result.success).toBe(false)
      // Gerçek bir gönder düğmesi hiç bulunamadı (tek submit düğmesi gizli),
      // bu yüzden "teslimat doğrulanamadı" değil "gönder düğmesi bulunamadı".
      expect(result.error).toBe('button_not_found')
      expect(result.submitOutcome).toBe('not_attempted')
      // Görünür bir gönder düğmesi olmadığı ortaya çıktığında hangi kontrolün
      // hedef olduğu yine de yazılır — teşhis kaybolmaz.
      expect(result.diagnostics.submitWrongControl).toBe('data-start-dictation')
      expect(result.diagnostics.button.operationSucceeded).toBe(false)
    }, 5000)

    it('waits out a dictation control and clicks the real send button that appears after it', async () => {
      // Aynı kök nedenin ikinci yarısı: gönder düğmesi geç çizilir. Arama
      // ilk eşleşmede durmamalı, sesli kontrolü reddedip gerçek düğmeyi
      // beklemeli ve ONU tıklamalı.
      document.body.innerHTML = `
        <div role="textbox" contenteditable="true" id="composer"></div>
        <button data-start-dictation aria-label="Dikte et" type="button">🎙</button>
      `
      const dictation = vi.fn()
      document.querySelector('[data-start-dictation]')?.addEventListener('click', dictation)
      const realSend = vi.fn()
      const realButton = document.createElement('button')
      realButton.type = 'submit'
      realButton.id = 'real-send'
      realButton.addEventListener('click', realSend)
      document.body.appendChild(realButton)
      // Gerçek gönder düğmesi geç çizilir (React'in yeniden çizimini taklit eder)
      setTimeout(() => realButton.removeAttribute('data-pending'), 0)

      const result = await window.eval(
        generateAutoSendScript(
          { input: '#composer', button: 'button[type="submit"]', submitMode: 'click' },
          'merhaba',
          true,
          false,
          'auto',
          30,
          FAST_BUDGET
        )
      )

      expect(dictation).not.toHaveBeenCalled()
      expect(realSend).toHaveBeenCalledTimes(1)
      expect(result.diagnostics.submitWrongControl).toBeNull()
    }, 5000)

    it('keeps reporting success when the click really empties the composer', async () => {
      document.body.innerHTML = `
        <div role="textbox" contenteditable="true" id="composer"></div>
        <button id="send" type="button">Send</button>
      `
      const composer = document.getElementById('composer') as HTMLDivElement
      // Gerçek bir AI sitesi: gönder butonu mesajı editörden AYRILIR.
      document.getElementById('send')?.addEventListener('click', () => {
        composer.textContent = ''
      })

      const result = await window.eval(
        generateAutoSendScript(
          { input: '#composer', button: '#send', submitMode: 'click' },
          'merhaba',
          true,
          false,
          'auto',
          30,
          FAST_BUDGET
        )
      )

      expect(result.success).toBe(true)
      expect(result.submitObserved).toBe(true)
      expect(result.submitOutcome).toBe('observed')
    }, 5000)
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
    }, 5000)
  })
})
