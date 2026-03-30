import type { AutomationElementFingerprint } from '@shared-core/types'

export type PickerCategory = 'input' | 'button' | 'container' | 'icon' | 'text' | 'unknown'
export type PickerConfidence = 'high' | 'medium' | 'low'

export interface PickerElementInfo {
  category: PickerCategory
  labelEN: string
  labelKey?: string
  confidence: PickerConfidence
  tag: string
  hintKey?: string
  hintEN?: string
}

export interface LocatorBundle {
  primarySelector: string | null
  candidates: string[]
  fingerprint: AutomationElementFingerprint
}

type PickerElement = Element & {
  isContentEditable?: boolean
  onclick?: ((this: GlobalEventHandlers, ev: MouseEvent) => unknown) | null
}

const GENERATED_TOKEN_REGEX = /(^\d{5,}$)|([a-z0-9]{15,})|(--)/i
const SAFE_CLASS_TOKEN_REGEX = /^[a-zA-Z][\w-]{0,63}$/

function getSafeId(el: Element) {
  const id = el.getAttribute('id')
  if (!id || GENERATED_TOKEN_REGEX.test(id)) {
    return null
  }

  return id
}

function getSafeClassTokens(el: Element) {
  return Array.from(el.classList)
    .map((token) => token.trim())
    .filter((token) => token && SAFE_CLASS_TOKEN_REGEX.test(token))
    .slice(0, 3)
}

function getNthChild(el: Element) {
  const parent = el.parentElement
  if (!parent) {
    return null
  }

  const children = Array.from(parent.children)
  const index = children.indexOf(el)
  return index >= 0 ? index + 1 : null
}

function getPrimaryAttribute(el: Element, kind: 'input' | 'button') {
  const candidates =
    kind === 'input'
      ? ['data-testid', 'name', 'placeholder', 'aria-label']
      : ['data-testid', 'aria-label', 'title', 'name']

  for (const attribute of candidates) {
    const value = el.getAttribute(attribute)
    if (value && value.trim() && value.length < 256) {
      return { attribute, value: value.trim() }
    }
  }

  return null
}

function normalizeText(value: string | null | undefined) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getVisibleText(el: Element) {
  const textValue = normalizeText(
    (el as HTMLElement).innerText ||
      el.textContent ||
      el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      el.getAttribute('alt')
  )

  return textValue ? textValue.slice(0, 256) : null
}

function buildSelectorSegment(el: Element) {
  const tag = el.tagName.toLowerCase()
  const safeId = getSafeId(el)
  if (safeId) {
    return `#${CSS.escape(safeId)}`
  }

  const testId = el.getAttribute('data-testid')
  if (testId && testId.length < 256) {
    return `${tag}[data-testid="${CSS.escape(testId)}"]`
  }

  const nthChild = getNthChild(el)
  return nthChild ? `${tag}:nth-child(${nthChild})` : tag
}

function buildLocalPath(el: Element) {
  const path: string[] = []
  let current: Element | null = el

  while (current) {
    path.unshift(buildSelectorSegment(current))
    current = current.parentElement
    if (path.length >= 8) break
  }

  return path
}

function buildHostChain(el: Element) {
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

function pushCandidate(target: string[], selector: string | null | undefined) {
  if (!selector) return
  const normalized = selector.trim()
  if (!normalized || target.includes(normalized)) return
  target.push(normalized)
}

function buildCssCandidates(el: Element, kind: 'input' | 'button') {
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
  const isContentEditable =
    (el as HTMLElement).isContentEditable || el.getAttribute('contenteditable') === 'true'

  if (safeId) {
    pushCandidate(candidates, `#${CSS.escape(safeId)}`)
  }

  if (testId && testId.length < 256) {
    pushCandidate(candidates, `${tag}[data-testid="${CSS.escape(testId)}"]`)
    pushCandidate(candidates, `[data-testid="${CSS.escape(testId)}"]`)
  }

  if (name && name.length < 256) {
    pushCandidate(candidates, `${tag}[name="${CSS.escape(name)}"]`)
  }

  if (placeholder && placeholder.length < 256) {
    pushCandidate(candidates, `${tag}[placeholder="${CSS.escape(placeholder)}"]`)
  }

  if (ariaLabel && ariaLabel.length < 256) {
    pushCandidate(candidates, `${tag}[aria-label="${CSS.escape(ariaLabel)}"]`)
    if (role) {
      pushCandidate(
        candidates,
        `[role="${CSS.escape(role)}"][aria-label="${CSS.escape(ariaLabel)}"]`
      )
    }
  }

  if (kind === 'button' && title && title.length < 256) {
    pushCandidate(candidates, `${tag}[title="${CSS.escape(title)}"]`)
  }

  if (role) {
    pushCandidate(candidates, `${tag}[role="${CSS.escape(role)}"]`)
  }

  if (type) {
    pushCandidate(candidates, `${tag}[type="${CSS.escape(type)}"]`)
  }

  if (kind === 'input' && isContentEditable) {
    pushCandidate(candidates, `${tag}[contenteditable="true"]`)
    if (role) {
      pushCandidate(candidates, `${tag}[contenteditable="true"][role="${CSS.escape(role)}"]`)
    }
  }

  if (classTokens.length > 0) {
    pushCandidate(
      candidates,
      `${tag}${classTokens.map((token) => `.${CSS.escape(token)}`).join('')}`
    )
    if (role) {
      pushCandidate(
        candidates,
        `${tag}[role="${CSS.escape(role)}"]${classTokens.map((token) => `.${CSS.escape(token)}`).join('')}`
      )
    }
  }

  return candidates.slice(0, 12)
}

/**
 * Gemini / Google AI gibi arayüzlerde gönder kontrolü bazen <button> veya role="button" değildir;
 * aria-label / data-testid ile tanımlanır ve geniş role=textbox kapsayıcısının içinde kalır.
 *
 * Not: Regex gövde içinde tutulur; userElementPicker enjekte ederken .toString() ile dış kapsam gerekmez.
 */
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

export const getElementInfo = (el: PickerElement): PickerElementInfo => {
  const tag = el.tagName.toLowerCase()
  const role = el.getAttribute('role')
  const type = el.getAttribute('type')
  const contentEditable = el.isContentEditable || el.getAttribute('contenteditable') === 'true'

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

export const generateLocatorBundle = (
  el: Element | null,
  kind: 'input' | 'button'
): LocatorBundle | null => {
  if (!el) return null

  const generatedTokenRegex = /(^\d{5,}$)|([a-z0-9]{15,})|(--)/i
  const safeClassTokenRegex = /^[a-zA-Z][\w-]{0,63}$/
  const getPrimaryAttributeLocal = (element: Element, targetKind: 'input' | 'button') => {
    const attributeCandidates =
      targetKind === 'input'
        ? ['data-testid', 'name', 'placeholder', 'aria-label']
        : ['data-testid', 'aria-label', 'title', 'name']

    for (const attribute of attributeCandidates) {
      const value = element.getAttribute(attribute)
      if (value && value.trim() && value.length < 256) {
        return { attribute, value: value.trim() }
      }
    }

    return null
  }
  const getSafeIdLocal = (element: Element) => {
    const id = element.getAttribute('id')
    if (!id || generatedTokenRegex.test(id)) {
      return null
    }

    return id
  }
  const getSafeClassTokensLocal = (element: Element) => {
    return Array.from(element.classList)
      .map((token) => token.trim())
      .filter((token) => token && safeClassTokenRegex.test(token))
      .slice(0, 3)
  }
  const getNthChildLocal = (element: Element) => {
    const parent = element.parentElement
    if (!parent) {
      return null
    }

    const children = Array.from(parent.children)
    const index = children.indexOf(element)
    return index >= 0 ? index + 1 : null
  }
  const buildSelectorSegmentLocal = (element: Element) => {
    const tagName = element.tagName.toLowerCase()
    const safeIdValue = getSafeIdLocal(element)
    if (safeIdValue) {
      return `#${CSS.escape(safeIdValue)}`
    }

    const testIdValue = element.getAttribute('data-testid')
    if (testIdValue && testIdValue.length < 256) {
      return `${tagName}[data-testid="${CSS.escape(testIdValue)}"]`
    }

    const nthChildValue = getNthChildLocal(element)
    return nthChildValue ? `${tagName}:nth-child(${nthChildValue})` : tagName
  }
  const buildLocalPathLocal = (element: Element) => {
    const path: string[] = []
    let current: Element | null = element

    while (current) {
      path.unshift(buildSelectorSegmentLocal(current))
      current = current.parentElement
      if (path.length >= 8) break
    }

    return path
  }
  const buildHostChainLocal = (element: Element) => {
    const hostChain: NonNullable<AutomationElementFingerprint['hostChain']> = []
    let currentRoot = element.getRootNode()

    while (currentRoot && 'host' in currentRoot && currentRoot.host instanceof Element) {
      const host = currentRoot.host
      hostChain.unshift({
        selector: buildSelectorSegmentLocal(host),
        tag: host.tagName.toLowerCase(),
        safeId: getSafeIdLocal(host),
        dataTestId: host.getAttribute('data-testid'),
        classTokens: getSafeClassTokensLocal(host),
        nthChild: getNthChildLocal(host)
      })
      currentRoot = host.getRootNode()
    }

    return hostChain
  }
  const pushCandidateLocal = (target: string[], selector: string | null | undefined) => {
    if (!selector) return
    const normalized = selector.trim()
    if (!normalized || target.includes(normalized)) return
    target.push(normalized)
  }
  const buildCssCandidatesLocal = (element: Element, targetKind: 'input' | 'button') => {
    const tagName = element.tagName.toLowerCase()
    const selectorCandidates: string[] = []
    const safeIdValue = getSafeIdLocal(element)
    const testIdValue = element.getAttribute('data-testid')
    const nameValue = element.getAttribute('name')
    const placeholderValue = element.getAttribute('placeholder')
    const ariaLabelValue = element.getAttribute('aria-label')
    const titleValue = element.getAttribute('title')
    const roleValue = element.getAttribute('role')
    const typeValue = element.getAttribute('type')
    const classTokenValues = getSafeClassTokensLocal(element)
    const isContentEditableValue =
      (element as HTMLElement).isContentEditable ||
      element.getAttribute('contenteditable') === 'true'

    if (safeIdValue) {
      pushCandidateLocal(selectorCandidates, `#${CSS.escape(safeIdValue)}`)
    }

    if (testIdValue && testIdValue.length < 256) {
      pushCandidateLocal(selectorCandidates, `${tagName}[data-testid="${CSS.escape(testIdValue)}"]`)
      pushCandidateLocal(selectorCandidates, `[data-testid="${CSS.escape(testIdValue)}"]`)
    }

    if (nameValue && nameValue.length < 256) {
      pushCandidateLocal(selectorCandidates, `${tagName}[name="${CSS.escape(nameValue)}"]`)
    }

    if (placeholderValue && placeholderValue.length < 256) {
      pushCandidateLocal(
        selectorCandidates,
        `${tagName}[placeholder="${CSS.escape(placeholderValue)}"]`
      )
    }

    if (ariaLabelValue && ariaLabelValue.length < 256) {
      pushCandidateLocal(
        selectorCandidates,
        `${tagName}[aria-label="${CSS.escape(ariaLabelValue)}"]`
      )
      if (roleValue) {
        pushCandidateLocal(
          selectorCandidates,
          `[role="${CSS.escape(roleValue)}"][aria-label="${CSS.escape(ariaLabelValue)}"]`
        )
      }
    }

    if (targetKind === 'button' && titleValue && titleValue.length < 256) {
      pushCandidateLocal(selectorCandidates, `${tagName}[title="${CSS.escape(titleValue)}"]`)
    }

    if (roleValue) {
      pushCandidateLocal(selectorCandidates, `${tagName}[role="${CSS.escape(roleValue)}"]`)
    }

    if (typeValue) {
      pushCandidateLocal(selectorCandidates, `${tagName}[type="${CSS.escape(typeValue)}"]`)
    }

    if (targetKind === 'input' && isContentEditableValue) {
      pushCandidateLocal(selectorCandidates, `${tagName}[contenteditable="true"]`)
      if (roleValue) {
        pushCandidateLocal(
          selectorCandidates,
          `${tagName}[contenteditable="true"][role="${CSS.escape(roleValue)}"]`
        )
      }
    }

    if (classTokenValues.length > 0) {
      pushCandidateLocal(
        selectorCandidates,
        `${tagName}${classTokenValues.map((token) => `.${CSS.escape(token)}`).join('')}`
      )
      if (roleValue) {
        pushCandidateLocal(
          selectorCandidates,
          `${tagName}[role="${CSS.escape(roleValue)}"]${classTokenValues.map((token) => `.${CSS.escape(token)}`).join('')}`
        )
      }
    }

    return selectorCandidates.slice(0, 12)
  }
  const normalizeTextLocal = (value: string | null | undefined) =>
    String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
  const getVisibleTextLocal = (element: Element) => {
    const textValue = normalizeTextLocal(
      (element as HTMLElement).innerText ||
        element.textContent ||
        element.getAttribute('aria-label') ||
        element.getAttribute('title') ||
        element.getAttribute('alt')
    )

    return textValue ? textValue.slice(0, 256) : null
  }

  const tag = el.tagName.toLowerCase()
  const primaryAttribute = getPrimaryAttributeLocal(el, kind)
  const candidates = buildCssCandidatesLocal(el, kind)
  const role = el.getAttribute('role')
  const type = el.getAttribute('type')
  const placeholder = el.getAttribute('placeholder')
  const ariaLabel = el.getAttribute('aria-label')
  const contentEditable =
    (el as HTMLElement).isContentEditable || el.getAttribute('contenteditable') === 'true'
  const safeId = getSafeIdLocal(el)
  const dataTestId = el.getAttribute('data-testid')
  const classTokens = getSafeClassTokensLocal(el)
  const fingerprint: AutomationElementFingerprint = {
    tag,
    ...(role ? { role } : {}),
    ...(type ? { type } : {}),
    ...(contentEditable ? { contentEditable: true } : {}),
    ...(kind === 'button' ? { text: getVisibleTextLocal(el) } : {}),
    ...(primaryAttribute?.attribute === 'name' ? { name: primaryAttribute.value } : {}),
    ...(placeholder ? { placeholder } : {}),
    ...(ariaLabel ? { ariaLabel } : {}),
    ...(dataTestId ? { dataTestId } : {}),
    ...(safeId ? { safeId } : {}),
    ...(classTokens.length > 0 ? { classTokens } : {}),
    localPath: buildLocalPathLocal(el),
    hostChain: buildHostChainLocal(el)
  }

  return {
    primarySelector: candidates[0] || null,
    candidates,
    fingerprint
  }
}

export const generateRobustSelector = (el: Element | null): string | null => {
  if (!el) return null
  const info = getElementInfo(el as PickerElement)
  const kind = info.category === 'button' ? 'button' : 'input'
  const bundle = generateLocatorBundle(el, kind)
  return bundle?.primarySelector || bundle?.fingerprint.localPath?.join(' > ') || null
}
