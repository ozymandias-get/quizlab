/**
 * Tüm picker DOM yardımcıları tek dosyada: userElementPicker .toString() enjeksiyonu için.
 * Vitest/SSR modül importlarını gövdeye soktuğundan, çapraz dosya importu olmamalı.
 */
import type { AutomationElementFingerprint } from '@shared-core/types'

import type {
  LocatorBundle,
  PickerCategory,
  PickerConfidence,
  PickerElement,
  PickerElementInfo
} from './pickerTypes.js'

export function isElementContentEditable(el: Element): boolean {
  if (el instanceof HTMLElement) {
    if (el.isContentEditable) return true
  } else if ((el as { isContentEditable?: boolean }).isContentEditable) {
    return true
  }
  return el.getAttribute('contenteditable') === 'true'
}
export function inferSendLikeControl(el: Element): boolean {
  const R =
    /\b(send|gönder|submit)\b|send-?message|sendmessage|send_message|composer-?send|send-button|sendbutton|submit_message|message_send|send_/i
  const al = (el.getAttribute('aria-label') || '').toLowerCase()
  if (R.test(al)) return true
  const title = (el.getAttribute('title') || '').toLowerCase()
  if (R.test(title)) return true
  const tid = (
    el.getAttribute('data-testid') ||
    el.getAttribute('data-test-id') ||
    ''
  ).toLowerCase()
  if (R.test(tid)) return true
  if (el instanceof HTMLElement && typeof el.className === 'string') {
    const cls = el.className.toLowerCase()
    if (R.test(cls)) return true
  }
  return false
}
export function getElementInfo(el: PickerElement): PickerElementInfo {
  const tag = el.tagName.toLowerCase()
  const role = el.getAttribute('role')
  const type = el.getAttribute('type')
  const contentEditable = isElementContentEditable(el)

  if (inferSendLikeControl(el)) {
    return {
      category: 'button',
      labelEN: 'Send Button',
      labelKey: 'picker_el_submit',
      confidence: 'high',
      tag,
      hintKey: 'picker_hint_submit_correct',
      hintEN: ''
    }
  }

  const hasDictationAttr =
    el.hasAttribute('data-start-dictation') ||
    el.hasAttribute('data-cancel-dictation') ||
    el.hasAttribute('data-submit-dictation')
  const voiceSignals = [
    el.getAttribute('aria-label') || '',
    el.getAttribute('title') || '',
    el.getAttribute('data-testid') || '',
    el.getAttribute('data-test-id') || '',
    el.getAttribute('name') || ''
  ]
    .join(' ')
    .toLowerCase()
  const VOICE_CONTROL_REGEX =
    /(^|\s|-|_)(mikrofon|sesli|dikte|konuş|konus|mic|microphone|dictate|dictation|voice|speak|speech|talk|record|recording|transcribe|transcription|audio)(\s|-|_|$)/i
  if (hasDictationAttr || VOICE_CONTROL_REGEX.test(voiceSignals)) {
    return {
      category: 'unknown',
      labelEN: 'Voice / Dictation Button',
      confidence: 'low',
      tag,
      hintEN: ''
    }
  }

  let category: PickerCategory = 'unknown'
  let labelEN = 'Unknown'
  let confidence: PickerConfidence = 'low'
  let hintEN = ''
  let labelKey: string | undefined
  let hintKey: string | undefined

  if (tag === 'input') {
    if (type === 'text' || type === 'search' || !type) {
      category = 'input'
      labelEN = 'Text Input'
      labelKey = 'picker_el_input'
      confidence = 'high'
      hintKey = 'picker_hint_input_correct'
    } else if (type === 'submit' || type === 'button') {
      category = 'button'
      labelEN = 'Submit Button'
      labelKey = 'picker_el_submit'
      confidence = 'high'
      hintKey = 'picker_hint_submit_correct'
    } else {
      category = 'input'
      labelEN = 'Input Field'
      labelKey = 'picker_el_input_field'
      confidence = 'medium'
    }
  } else if (tag === 'textarea') {
    category = 'input'
    labelEN = 'Message Box'
    labelKey = 'picker_el_msg_box'
    confidence = 'high'
    hintKey = 'picker_hint_textarea_perfect'
  } else if (tag === 'button' || role === 'button') {
    category = 'button'
    labelEN = 'Button'
    labelKey = 'picker_el_button'
    confidence = 'high'
    hintKey = 'picker_hint_button_send'
  } else if (role === 'textbox' || contentEditable) {
    category = 'input'
    labelEN = 'Message Input Area'
    labelKey = 'picker_el_msg_area'
    confidence = 'high'
    hintKey = 'picker_hint_input_correct'
  } else if (tag === 'div') {
    const element = el as HTMLElement
    const hasClickHandler = typeof element.onclick === 'function'
    const isClickable =
      hasClickHandler ||
      element.getAttribute('onclick') !== null ||
      window.getComputedStyle(element).cursor === 'pointer'

    if (isClickable) {
      category = 'button'
      labelEN = 'Clickable Area'
      labelKey = 'picker_el_clickable'
      confidence = 'medium'
      hintKey = 'picker_hint_clickable'
    } else {
      category = 'container'
      labelEN = 'Container'
      labelKey = 'picker_el_container'
      confidence = 'low'
      hintKey = 'picker_hint_generic_box'
    }
  } else if (['svg', 'path', 'img', 'i'].includes(tag)) {
    category = 'icon'
    labelEN = 'Icon / Image'
    labelKey = 'picker_el_icon'
    confidence = 'low'
    hintKey = 'picker_hint_icon'
  } else if (tag === 'a') {
    category = 'button'
    labelEN = 'Link / Button'
    labelKey = 'picker_el_link'
    confidence = 'medium'
  } else if (tag === 'span') {
    category = 'text'
    labelEN = 'Text Span'
    labelKey = 'picker_el_text'
    confidence = 'low'
    hintKey = 'picker_hint_text'
  } else if (tag === 'form') {
    category = 'container'
    labelEN = 'Form Container'
    labelKey = 'picker_el_form'
    confidence = 'low'
    hintKey = 'picker_hint_form'
  }

  return { category, labelEN, labelKey, confidence, tag, hintKey, hintEN }
}
const GENERATED_TOKEN_REGEX = /(^--)|(^\d{5,}$)|([\da-z]{15,})|([a-z]+[_-]\d{5,}$)/i
const SAFE_CLASS_TOKEN_REGEX = /^[A-Za-z][\w-]{0,63}$/

export function escapeCssStringValue(str: string): string {
  if (typeof str !== 'string' || !str) return ''
  return str.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

export function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }
  return String(value).replaceAll(/[!"#$%&'()*+,.\/:;<=>?@[\]^`{|}~]/g, '\\$&')
}

export function getSafeId(el: Element) {
  const id = el.getAttribute('id')
  if (!id || GENERATED_TOKEN_REGEX.test(id)) return null
  return id
}

/**
 * Class tokens are only kept when they can plausibly survive a redeploy, i.e.
 * when they carry meaning. Three shapes are rejected:
 *
 *   1. Malformed / custom-property style names already covered by
 *      `GENERATED_TOKEN_REGEX` (`--tw-…`, 5+ digit runs, 15+ char alnum runs,
 *      `word_12345`). This filter previously consulted `SAFE_CLASS_TOKEN_REGEX`
 *      alone, so `abcdefghijklmnop` and `block_12345` slipped through.
 *   2. Hashed utility classes — the dominant shape on modern AI frontends.
 *      ChatGPT's composer build-hashes its utilities and rotates them on every
 *      frontend deploy; measured live, the send button is
 *      `<button class="x16qrm4 xxyica1 x1cpjm7i x1au5me5 x1w4defg xgkqi7n …">`.
 *      Every one of those passes `SAFE_CLASS_TOKEN_REGEX`, so all three stored
 *      "safe" tokens were build hashes: worthless as identity evidence (they
 *      break on the next deploy) and actively harmful, because the runtime
 *      scores class-token overlap and would prefer a WRONG element that happens
 *      to share a stale hash.
 *   3. Nothing else. When every token is rejected the result is an empty array,
 *      which callers already treat as "no class evidence".
 */
export function getSafeClassTokens(el: Element) {
  // Declared INSIDE the function deliberately: this helper is serialized with
  // fn.toString() into the injected picker script and into the self-healing
  // selector helper, and only the function body travels with it. A module-level
  // const would be an undefined reference inside the guest page.
  // (`GENERATED_TOKEN_REGEX` / `SAFE_CLASS_TOKEN_REGEX` are safe to reference
  // because `injectedPickerDom.ts` mirrors them into the emitted prefix.)
  //
  // Hashed-utility rule: a SHORT (≤12), SINGLE-SEGMENT, lowercase alphanumeric
  // token containing at least one digit — `x16qrm4`, `x1cpjm7i`, `xgkqi7n`.
  // Two details make it precise:
  //   - The digit is NOT anchored right after the first letter. A `^[a-z]\d`
  //     rule misses `xxyica1`, whose letter/digit split sits in the middle
  //     (`x|xyica|1`) — the real production token from the bug report.
  //   - Segmented names are exempt. Ordinary utilities put the value behind a
  //     hyphen (`px-2`, `text-2xl`, `col-2`, `mt-4`) and semantic/BEM names do
  //     too (`send-btn`, `ProseMirror-focused`, `composer-send`). Only digits
  //     INSIDE one unsplit segment read as a hash. `[a-z0-9]` also excludes
  //     `_`, leaving the word_digit shapes to `GENERATED_TOKEN_REGEX`.
  //   - Lowercase-only start keeps CamelCase semantic names (`Heading2`,
  //     `Avatar40`) even though they mix cases with digits; these hashers are
  //     always lowercase, so the tighter rule costs no real recall.
  const HASHED_UTILITY_CLASS_REGEX = /^(?=[a-z0-9]*\d)[a-z0-9]{1,12}$/

  return [...el.classList]
    .map((token) => token.trim())
    .filter(
      (token) =>
        token &&
        SAFE_CLASS_TOKEN_REGEX.test(token) &&
        !GENERATED_TOKEN_REGEX.test(token) &&
        !HASHED_UTILITY_CLASS_REGEX.test(token)
    )
    .slice(0, 3)
}

export function getNthChild(el: Element) {
  const parent = el.parentElement
  if (!parent) return null
  const children = [...parent.children]
  const index = children.indexOf(el)
  return index >= 0 ? index + 1 : null
}

export function getPrimaryAttribute(el: Element, kind: 'input' | 'button') {
  const candidates =
    kind === 'input'
      ? ['data-testid', 'name', 'placeholder', 'aria-label']
      : ['data-testid', 'aria-label', 'title', 'name']

  for (const attribute of candidates) {
    const val = el.getAttribute(attribute)
    if (val && val.trim() && val.length < 256) {
      return { attribute, value: val.trim() }
    }
  }
  return null
}

export function normalizeText(value: string | null | undefined) {
  return String(value || '')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

export function getVisibleText(el: Element) {
  const textValue = normalizeText(
    (el as HTMLElement).innerText ||
      el.textContent ||
      el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      el.getAttribute('alt')
  )

  return textValue ? textValue.slice(0, 256) : null
}

export function buildSelectorSegment(el: Element) {
  const tag = el.tagName.toLowerCase()
  const safeId = getSafeId(el)
  if (safeId) {
    return `#${cssEscape(safeId)}`
  }

  const testId = el.getAttribute('data-testid')
  if (testId && testId.length < 256) {
    return `${tag}[data-testid="${escapeCssStringValue(testId)}"]`
  }

  const nthChild = getNthChild(el)
  return nthChild ? `${tag}:nth-child(${nthChild})` : tag
}

export function buildLocalPath(el: Element) {
  const path: string[] = []
  let current: Element | null = el

  while (current) {
    path.unshift(buildSelectorSegment(current))
    current = current.parentElement
    if (path.length >= 8) break
  }

  return path
}

export function buildHostChain(el: Element) {
  const hostChain: NonNullable<AutomationElementFingerprint['hostChain']> = []
  let currentRoot = el.getRootNode()

  while (currentRoot && 'host' in currentRoot && currentRoot.host instanceof Element) {
    const host = currentRoot.host
    hostChain.unshift({
      selector: buildSelectorSegment(host),
      tag: host.tagName.toLowerCase(),
      safeId: getSafeId(host),
      dataTestId: host.getAttribute('data-testid'),
      classTokens: getSafeClassTokens(host),
      nthChild: getNthChild(host)
    })
    currentRoot = host.getRootNode()
  }

  return hostChain
}

export function pushCandidate(target: string[], selector: string | null | undefined) {
  if (!selector) return
  const normalized = selector.trim()
  if (!normalized || target.includes(normalized)) return
  target.push(normalized)
}

export function buildCssCandidates(el: Element, kind: 'input' | 'button') {
  const tag = el.tagName.toLowerCase()
  const candidates: string[] = []
  const safeId = getSafeId(el)
  const testId = el.getAttribute('data-testid')
  const name = el.getAttribute('name')
  const placeholder = el.getAttribute('placeholder')
  const ariaLabel = el.getAttribute('aria-label')
  const title = el.getAttribute('title')
  const role = el.getAttribute('role')
  const type = el.getAttribute('type')
  const classTokens = getSafeClassTokens(el)
  const isContentEditable = isElementContentEditable(el)

  if (safeId) {
    pushCandidate(candidates, `#${cssEscape(safeId)}`)
  }

  if (testId && testId.length < 256) {
    pushCandidate(candidates, `${tag}[data-testid="${escapeCssStringValue(testId)}"]`)
    pushCandidate(candidates, `[data-testid="${escapeCssStringValue(testId)}"]`)
  }

  if (name && name.length < 256) {
    pushCandidate(candidates, `${tag}[name="${escapeCssStringValue(name)}"]`)
  }

  if (placeholder && placeholder.length < 256) {
    pushCandidate(candidates, `${tag}[placeholder="${escapeCssStringValue(placeholder)}"]`)
  }

  if (kind === 'button' && el.hasAttribute('data-composer-submit')) {
    // Composer gönder düğmesi kancası (2026-10-17 canlı chatgpt.com ölçümü).
    // aria-label ÇEViriye bağlıdır ("Mesaj gönder" / "Send message"): ondan
    // üretilen locator kullanıcı dilini ya da sitenin metnini değiştirince
    // ölür. Bu öznitelik dile bağlı değildir ve yalnız gönder düğmesinde
    // bulunduğu için aria-label adayından ÖNCE gelmelidir.
    //
    // Bilerek yeni bir modül-seviyesi sabiti kullanılmadı: bu fonksiyon
    // `injectedPickerDom` tarafından `fn.toString()` ile yeniden üretiliyor ve
    // orada yalnızca GENERATED_TOKEN_REGEX/SAFE_CLASS_TOKEN_REGEX kopyalanıyor.
    pushCandidate(candidates, '[data-composer-submit]')
  }

  if (ariaLabel && ariaLabel.length < 256) {
    pushCandidate(candidates, `${tag}[aria-label="${escapeCssStringValue(ariaLabel)}"]`)
    if (role) {
      pushCandidate(
        candidates,
        `[role="${cssEscape(role)}"][aria-label="${escapeCssStringValue(ariaLabel)}"]`
      )
    }
  }

  if (kind === 'button' && title && title.length < 256) {
    pushCandidate(candidates, `${tag}[title="${escapeCssStringValue(title)}"]`)
  }

  if (role) {
    pushCandidate(candidates, `${tag}[role="${cssEscape(role)}"]`)
  }

  if (type) {
    pushCandidate(candidates, `${tag}[type="${escapeCssStringValue(type)}"]`)
  }

  if (kind === 'input' && isContentEditable) {
    pushCandidate(candidates, `${tag}[contenteditable="true"]`)
    if (role) {
      pushCandidate(candidates, `${tag}[contenteditable="true"][role="${cssEscape(role)}"]`)
    }
  }

  if (classTokens.length > 0) {
    pushCandidate(
      candidates,
      `${tag}${classTokens.map((token) => `.${cssEscape(token)}`).join('')}`
    )
    if (role) {
      pushCandidate(
        candidates,
        `${tag}[role="${cssEscape(role)}"]${classTokens.map((token) => `.${cssEscape(token)}`).join('')}`
      )
    }
  }

  // Last-resort candidate: the bare tag always describes the element itself,
  // so a picked element with no stable attributes (e.g. a bare <button>)
  // still yields a usable primary. It sorts last everywhere it matters
  // (priority 0 / fallback), and resolution still disambiguates through the
  // fingerprint or fails safe — it never silently claims uniqueness.
  if (/^[a-zA-Z][a-zA-Z0-9-]*$/.test(tag)) {
    pushCandidate(candidates, tag)
  }

  return candidates.slice(0, 12)
}

/**
 * Target-integrity verification for generated selectors.
 *
 * `buildCssCandidates` alone cannot know whether a strong-looking candidate
 * (notably `#id` or `[data-testid]`) is shared by several elements — invalid
 * pages do duplicate ids, and design systems repeat test ids. Blindly
 * persisting `candidates[0]` then resolves to the WRONG twin at runtime.
 *
 * These helpers are pure and DOM-optional: `matches` works on detached nodes,
 * and the document-uniqueness probe is skipped when no document is available
 * (unit tests, SSR). They only run at pick time — never per hover or per
 * automation run — so they cost nothing in the hot path.
 */
export function safeMatchesSelector(el: Element, selector: string): boolean {
  try {
    if (!el || typeof selector !== 'string' || !selector.trim()) return false
    if (typeof el.matches !== 'function') return false
    return el.matches(selector)
  } catch {
    return false
  }
}

export function pickVerifiedPrimary(el: Element, candidates: string[]): string | null {
  if (!el || !Array.isArray(candidates) || candidates.length === 0) return null
  const verified = candidates.filter((c) => safeMatchesSelector(el, c))
  if (verified.length === 0) return candidates[0] || null
  // Prefer a candidate that uniquely identifies `el` within its own root node
  // (Document or ShadowRoot). Querying `document` directly when `el` is inside
  // a ShadowRoot can match an unrelated outer element (e.g. a single `<button>`
  // in the light DOM) and falsely promote bare `'button'` over a specific
  // shadow-root attribute selector.
  // NOTE: inlined so fn.toString() remains self-contained in injected scripts.
  const rootNode = typeof el.getRootNode === 'function' ? el.getRootNode() : null
  const scope =
    rootNode && typeof (rootNode as ParentNode).querySelectorAll === 'function'
      ? (rootNode as ParentNode)
      : typeof document !== 'undefined' && typeof document.querySelectorAll === 'function'
        ? document
        : null
  if (scope) {
    for (const candidate of verified) {
      try {
        const matches = scope.querySelectorAll(candidate)
        if (matches.length === 1 && (!el.isConnected || matches[0] === el)) {
          return candidate
        }
      } catch {
        // Invalid selector in this scope: keep it in contention.
      }
    }
    if (el.isConnected) {
      for (const candidate of verified) {
        try {
          const matches = scope.querySelectorAll(candidate)
          if (matches.length > 0 && matches[0] === el) {
            return candidate
          }
        } catch {
          // Invalid selector in this scope: ignore.
        }
      }
    }
  }
  return verified[0] || null
}

export function generateLocatorBundle(
  el: Element | null,
  kind: 'input' | 'button'
): LocatorBundle | null {
  if (!el) return null

  const tag = el.tagName.toLowerCase()
  const primaryAttribute = getPrimaryAttribute(el, kind)
  const candidates = buildCssCandidates(el, kind)
  const role = el.getAttribute('role')
  const type = el.getAttribute('type')
  const placeholder = el.getAttribute('placeholder')
  const ariaLabel = el.getAttribute('aria-label')
  const contentEditable = isElementContentEditable(el)
  const safeId = getSafeId(el)
  const dataTestId = el.getAttribute('data-testid')
  const classTokens = getSafeClassTokens(el)
  const fingerprint: AutomationElementFingerprint = {
    tag,
    ...(role ? { role } : {}),
    ...(type ? { type } : {}),
    ...(contentEditable ? { contentEditable: true } : {}),
    ...(kind === 'button' ? { text: getVisibleText(el) } : {}),
    ...(primaryAttribute?.attribute === 'name' ? { name: primaryAttribute.value } : {}),
    ...(placeholder ? { placeholder } : {}),
    ...(ariaLabel ? { ariaLabel } : {}),
    ...(dataTestId ? { dataTestId } : {}),
    ...(safeId ? { safeId } : {}),
    ...(classTokens.length > 0 ? { classTokens } : {}),
    localPath: buildLocalPath(el),
    hostChain: buildHostChain(el)
  }

  return {
    primarySelector: pickVerifiedPrimary(el, candidates),
    candidates,
    fingerprint
  }
}
