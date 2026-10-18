import type { PickerElement } from '@electron/features/automation/lib/dom/pickerTypes'

import {
  buildCssCandidates,
  escapeCssStringValue,
  generateLocatorBundle,
  getElementInfo,
  getSafeClassTokens,
  inferSendLikeControl,
  isElementContentEditable
} from '@electron/features/automation/lib/dom/pickerDomRuntime'

import { describe, expect, it } from 'vitest'

describe('escapeCssStringValue', () => {
  it('escapes backslashes and double quotes, and passes plain text through', () => {
    const cases: Array<[unknown, string]> = [
      ['', ''],
      [null, ''],
      [undefined, ''],
      ['a\\b', 'a\\\\b'],
      ['a"b', 'a\\"b'],
      ['\\"hello\\"', '\\\\\\"hello\\\\\\"'],
      // Kaçış gerekmediğinde metin olduğu gibi döner.
      ['hello-world', 'hello-world']
    ]

    for (const [input, expected] of cases) {
      expect(escapeCssStringValue(input as never), `escapeCssStringValue(${String(input)})`).toBe(
        expected
      )
    }
  })
})

describe('isElementContentEditable', () => {
  it('follows the contenteditable attribute and stays false for non-HTMLElements', () => {
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    expect(isElementContentEditable(editable)).toBe(true)

    const plain = document.createElement('div')
    expect(isElementContentEditable(plain)).toBe(false)

    const cast = document.createElement('div') as unknown as SVGElement
    expect(isElementContentEditable(cast as unknown as Element)).toBe(false)
  })
})

describe('inferSendLikeControl', () => {
  it('matches send-like aria-label / data-testid / className only', () => {
    const withAriaLabel = document.createElement('button')
    withAriaLabel.setAttribute('aria-label', 'Send message')
    expect(inferSendLikeControl(withAriaLabel)).toBe(true)

    const withTestId = document.createElement('button')
    withTestId.setAttribute('data-testid', 'send-button')
    expect(inferSendLikeControl(withTestId)).toBe(true)

    const withClass = document.createElement('button')
    withClass.className = 'send-message-btn'
    expect(inferSendLikeControl(withClass)).toBe(true)

    expect(inferSendLikeControl(document.createElement('div'))).toBe(false)
  })
})

describe('getElementInfo', () => {
  it('classifies buttons, text inputs and spans with their confidence', () => {
    const sendLike = document.createElement('button')
    sendLike.setAttribute('aria-label', 'Send')
    const sendInfo = getElementInfo(sendLike as unknown as PickerElement)
    expect(sendInfo.category).toBe('button')
    expect(sendInfo.confidence).toBe('high')
    expect(sendInfo.labelEN).toBe('Send Button')

    const plainButton = document.createElement('button')
    const buttonInfo = getElementInfo(plainButton as unknown as PickerElement)
    expect(buttonInfo.category).toBe('button')
    expect(buttonInfo.confidence).toBe('high')

    const textInput = document.createElement('input')
    textInput.setAttribute('type', 'text')
    const inputInfo = getElementInfo(textInput as unknown as PickerElement)
    expect(inputInfo.category).toBe('input')
    expect(inputInfo.confidence).toBe('high')

    const spanInfo = getElementInfo(document.createElement('span') as unknown as PickerElement)
    expect(spanInfo.category).toBe('text')
    expect(spanInfo.confidence).toBe('low')
  })
})

describe('getSafeClassTokens', () => {
  it('rejects generated-token shapes (custom-property prefix, long alnum runs, word + 5-digit suffix)', () => {
    // GENERATED_TOKEN_REGEX shapes that ALSO pass SAFE_CLASS_TOKEN_REGEX, i.e.
    // the ones the old `SAFE_CLASS_TOKEN_REGEX`-only filter wrongly kept.
    const generatedShapes = [
      'abcdefghijklmnop', // 15+ char alnum run
      'block_12345', // word + separator + 5+ digits suffix
      'grid-00001', // word + hyphen + 5 digits suffix
      'sc-1234567' // styled-components style id ending in a long digit run
    ]

    for (const token of generatedShapes) {
      const el = document.createElement('button')
      el.setAttribute('class', token)
      expect(getSafeClassTokens(el), `${token} must not be kept as identity evidence`).toEqual([])
    }
  })

  it('rejects hashed utility classes (ChatGPT/Meta x… build hashes)', () => {
    // Measured live on chatgpt.com: the composer send button carries
    // `x16qrm4 xxyica1 x1cpjm7i x1au5me5 x1w4defg xgkqi7n …`. All of these
    // pass SAFE_CLASS_TOKEN_REGEX yet are rotated on every frontend deploy,
    // so they are worthless as identity evidence — and a wrong element that
    // happens to share a stale hash would win the class-overlap scoring.
    const hashedTokens = [
      'x16qrm4',
      'xxyica1', // letter-digit split sits in the middle here, not at index 1
      'x1cpjm7i',
      'x1au5me5',
      'x1w4defg',
      'xgkqi7n'
    ]

    for (const token of hashedTokens) {
      const el = document.createElement('button')
      el.setAttribute('class', token)
      expect(getSafeClassTokens(el), `${token} is a build hash, not identity`).toEqual([])
    }
  })

  it('keeps semantic classes and ordinary utility classes', () => {
    const mustKeep = [
      'ProseMirror', // editor framework class
      'ProseMirror-focused', // state modifier
      'cursor-interaction', // BEM-ish
      'size-token-button-composer', // long multi-segment semantic name
      'flex', // Tailwind utility word
      'hidden', // Tailwind utility word
      'btn', // short semantic word
      'send-btn', // BEM-ish name with a hyphen
      'px-2', // Tailwind utility: letter-digit pair split by a hyphen
      'text-2xl', // Tailwind utility: value starts with a digit
      'col-2', // digits behind a hyphen are normal in utilities
      'mt-4',
      'w-full'
    ]

    for (const token of mustKeep) {
      const el = document.createElement('button')
      el.setAttribute('class', token)
      expect(getSafeClassTokens(el), `${token} is real identity evidence`).toEqual([token])
    }
  })

  it('keeps semantic tokens and drops hashed ones from the same element', () => {
    const el = document.createElement('button')
    el.setAttribute('class', 'x16qrm4 xxyica1 send-btn xgkqi7n composer-send ProseMirror')
    expect(getSafeClassTokens(el)).toEqual(['send-btn', 'composer-send', 'ProseMirror'])
  })

  it('returns an empty array — never undefined/null — when every token is a hash', () => {
    const el = document.createElement('button')
    el.setAttribute('class', 'x16qrm4 xxyica1 xgkqi7n')

    const tokens = getSafeClassTokens(el)
    expect(Array.isArray(tokens)).toBe(true)
    expect(tokens).not.toBeUndefined()
    expect(tokens).not.toBeNull()
    expect(tokens).toHaveLength(0)
  })

  it('buildCssCandidates omits class candidates and still falls back to the bare tag', () => {
    const el = document.createElement('button')
    el.setAttribute('aria-label', 'Send message')
    el.setAttribute('class', 'x16qrm4 xxyica1 x1cpjm7i')
    document.body.appendChild(el)

    const candidates = buildCssCandidates(el, 'button')
    // No `.x16qrm4`-style candidate may survive…
    expect(candidates.some((c) => /\.\w*x\d/i.test(c))).toBe(false)
    expect(candidates).not.toContain('button.x16qrm4.xxyica1.x1cpjm7i')
    // …but the stronger non-class candidates and the bare-tag last resort
    // are still there, so the element stays pickable.
    expect(candidates).toContain('button')
    expect(candidates).toContain('button[aria-label="Send message"]')
  })

  it('generateLocatorBundle omits classTokens from the fingerprint when all are hashes', () => {
    const el = document.createElement('button')
    el.setAttribute('aria-label', 'Send message')
    el.setAttribute('data-testid', 'send-button')
    el.setAttribute('class', 'x16qrm4 xxyica1 x1cpjm7i')
    document.body.appendChild(el)

    const bundle = generateLocatorBundle(el, 'button')
    expect(bundle).not.toBeNull()
    expect(bundle!.fingerprint.classTokens).toBeUndefined()
    // Identity evidence that actually survives a redeploy is untouched.
    expect(bundle!.fingerprint.dataTestId).toBe('send-button')
    expect(bundle!.fingerprint.ariaLabel).toBe('Send message')
    expect(bundle!.primarySelector).toBe('button[data-testid="send-button"]')
  })

  it('still persists semantic classTokens alongside a hashed class soup', () => {
    const el = document.createElement('textarea')
    el.setAttribute('class', 'x16qrm4 xxyica1 ProseMirror composer-send')
    document.body.appendChild(el)

    const bundle = generateLocatorBundle(el, 'input')
    expect(bundle!.fingerprint.classTokens).toEqual(['ProseMirror', 'composer-send'])
  })
})

describe('generateLocatorBundle', () => {
  it('returns null for null element', () => {
    expect(generateLocatorBundle(null, 'input')).toBeNull()
  })

  it('generates a locator bundle for an input element', () => {
    const el = document.createElement('input')
    el.setAttribute('type', 'text')
    el.setAttribute('placeholder', 'Type here')
    const bundle = generateLocatorBundle(el, 'input')
    expect(bundle).not.toBeNull()
    expect(bundle!.candidates.length).toBeGreaterThan(0)
    expect(bundle!.fingerprint.tag).toBe('input')
  })

  it('includes contentEditable in fingerprint for contenteditable elements', () => {
    const el = document.createElement('div')
    el.setAttribute('contenteditable', 'true')
    const bundle = generateLocatorBundle(el, 'input')
    expect(bundle!.fingerprint.contentEditable).toBe(true)
  })

  it('prefers the composer submit hook over a translated aria-label', () => {
    // Canlı chatgpt.com ölçümü: gönder butonunun aria-label'i çeviriye bağlı
    // ("Mesaj gönder" / "Send message") ve data-testid'i hiç yok. Seçici
    // aria-label'e kilitlenirse kullanıcı dil değiştirdiğinde ya da site
    // metni güncelleyince locator ölür. `data-composer-submit` ise dile
    // bağlı değil ve sayfadaki tek kararlı kanca.
    //
    // `pickVerifiedPrimary` adayı BELGEDE tekil olma şartıyla seçtiği için
    // gövde önce temizlenir: bu dosyada DOM izolasyonu yok, aksi halde
    // sonucu başka testlerin bıraktığı butonlar belirler.
    document.body.innerHTML = ''
    const el = document.createElement('button')
    el.setAttribute('data-composer-submit', '')
    el.setAttribute('aria-label', 'Mesaj gönder')
    el.setAttribute('type', 'submit')
    document.body.appendChild(el)

    const bundle = generateLocatorBundle(el, 'button')
    expect(bundle!.primarySelector).toBe('[data-composer-submit]')
  })

  it('keeps the aria-label locator when there is no composer hook', () => {
    document.body.innerHTML = ''
    const el = document.createElement('button')
    el.setAttribute('aria-label', 'Send message')
    el.setAttribute('type', 'button')
    document.body.appendChild(el)

    const bundle = generateLocatorBundle(el, 'button')
    expect(bundle!.primarySelector).toBe('button[aria-label="Send message"]')
  })
})
