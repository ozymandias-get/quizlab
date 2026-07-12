/**
 * Tüm picker DOM yardımcıları tek dosyada: userElementPicker .toString() enjeksiyonu için.
 * Vitest/SSR modül importlarını gövdeye soktuğundan, çapraz dosya importu olmamalı.
 */
import type { AutomationElementFingerprint } from '@shared-core/types'

import { isElementContentEditable } from './pickerElementInfo.js'
import type {
  LocatorBundle,
  PickerCategory,
  PickerConfidence,
  PickerElement,
  PickerElementInfo
} from './pickerTypes.js'

const GENERATED_TOKEN_REGEX = /(^--)|(^\d{5,}$)|([\da-z]{15,})|([a-z]+[_-]\d{5,}$)/i
const SAFE_CLASS_TOKEN_REGEX = /^[A-Za-z][\w-]{0,63}$/

/**
 * Escapes a string for use inside a CSS attribute value selector ("...").
 * Unlike CSS.escape (which applies CSS identifier escaping rules), this
 * applies CSS *string* escaping rules: backslash and double-quote must be
 * escaped with a backslash. This prevents malformed selectors like
 * [attr=""value""] when the attribute value contains quotes.
 */
export function escapeCssStringValue(str: string): string {
  if (typeof str !== 'string' || !str) return ''
  return str.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

export function getSafeId(el: Element) {
  const id = el.getAttribute('id')
  if (!id || GENERATED_TOKEN_REGEX.test(id)) {
    return null
  }

  return id
}

export function getSafeClassTokens(el: Element) {
  return [...el.classList]
    .map((token) => token.trim())
    .filter((token) => token && SAFE_CLASS_TOKEN_REGEX.test(token))
    .slice(0, 3)
}

export function getNthChild(el: Element) {
  const parent = el.parentElement
  if (!parent) {
    return null
  }

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
    return `#${CSS.escape(safeId)}`
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
    pushCandidate(candidates, `#${CSS.escape(safeId)}`)
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

  if (ariaLabel && ariaLabel.length < 256) {
    pushCandidate(candidates, `${tag}[aria-label="${escapeCssStringValue(ariaLabel)}"]`)
    if (role) {
      pushCandidate(
        candidates,
        `[role="${CSS.escape(role)}"][aria-label="${escapeCssStringValue(ariaLabel)}"]`
      )
    }
  }

  if (kind === 'button' && title && title.length < 256) {
    pushCandidate(candidates, `${tag}[title="${escapeCssStringValue(title)}"]`)
  }

  if (role) {
    pushCandidate(candidates, `${tag}[role="${CSS.escape(role)}"]`)
  }

  if (type) {
    pushCandidate(candidates, `${tag}[type="${escapeCssStringValue(type)}"]`)
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
    primarySelector: candidates[0] || null,
    candidates,
    fingerprint
  }
}

export { getElementInfo, inferSendLikeControl } from './pickerElementInfo.js'
