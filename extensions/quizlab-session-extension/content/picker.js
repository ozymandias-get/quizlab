/**
 * The magic selector a user runs on a normal Chrome tab.
 *
 * This file is injected on demand, only after the user pressed the popup
 * button. It is not a declared content script: it is dormant until the service
 * worker sends `quizlab_selector_init`, and once the pick is sent (or
 * cancelled) it removes every listener, overlay and piece of state it owns.
 *
 * The selector algorithm is not implemented here. `content/selector-engine.js`
 * is generated from the picker sources the Electron app injects, and this file
 * only drives it: highlight, click capture, confirmation, transfer.
 *
 * Trust boundary: the page is untrusted. Nothing here reads page messages and
 * no value from the page is treated as a command. The pick result goes to the
 * extension service worker, which signs it in its own context; the pairing
 * secret never enters this file.
 */
;(() => {
  'use strict'

  const ENGINE = globalThis.QuizlabSelectorEngine
  /** Marks every node this file owns, so capture handlers never block our UI. */
  const UI_ATTRIBUTE = 'data-quizlab-picker-ui'
  /** The text of the confirm panel. Kept local: the page world has no i18n. */
  const TEXTS = {
    confirmTitle: 'Seçilen element',
    confirm: 'Onayla ve Gönder',
    reselect: 'Yeniden Seç',
    cancel: 'İptal',
    close: 'Kapat',
    sending: 'QuizLab’a gönderiliyor…',
    saved: 'Seçici QuizLab’a ulaştı ve kaydedildi.',
    siteNotOpen:
      'Seçici gönderildi ama QuizLab’da bu site açık değil. Siteyi QuizLab’da açıp tekrar gönderin.',
    verificationFailed:
      'QuizLab bu seçiciyi doğrulayamadı. Eski seçici korunuyor; farklı bir element deneyin.',
    unpaired: 'QuizLab bağlantısı yok veya eşleştirme geçersiz. Eklentiyi QuizLab ile eşleştirin.',
    rejected: 'Aktarım QuizLab tarafından reddedildi. Site ve hedef alanı kontrol edin.',
    retry: 'Bağlantı kurulamadı. QuizLab açık mı kontrol edip tekrar deneyin.',
    wrongKind: 'Seçilen element bu hedef alanına uymuyor. Doğru alanı seçin.',
    noSelector: 'Bu element için güvenilir bir seçici üretilemedi. Farklı bir element deneyin.',
    unsupported: 'Bu element bir gölge (Shadow DOM) ağacında. Bu biçim desteklenmiyor.',
    detached: 'Element sayfadan kaldırıldı. Yeniden seçin.',
    hostChanged: 'Sayfa adresi değişti. Seçimi yeniden başlatın.'
  }
  /** The hover/selection labels, mirrored from the picker i18n keys. */
  const ELEMENT_LABELS = {
    input: 'Metin Girişi',
    button: 'Buton',
    container: 'Kapsayıcı',
    icon: 'İkon',
    text: 'Metin',
    unknown: 'Element'
  }

  /** The pick currently being driven. */
  let active = null
  /** The init listener of this instance; removed with the session. */
  let messageListener = null

  function removeMessageListener() {
    if (!messageListener) return
    try {
      chrome.runtime.onMessage.removeListener(messageListener)
    } catch {
      // The listener was already dropped with the context.
    }
    messageListener = null
  }

  if (globalThis.__quizlabPickerCleanup) {
    try {
      globalThis.__quizlabPickerCleanup()
    } catch {
      // A previous instance that cannot clean itself up must not block this one.
    }
  }

  function elementOf(node) {
    if (!node) return null
    if (node.nodeType === 1) return node
    return node.parentElement || null
  }

  function isOwnUi(node) {
    const element = elementOf(node)
    if (!element) return false
    try {
      return element.closest(`[${UI_ATTRIBUTE}]`) !== null
    } catch {
      return false
    }
  }

  function shortValue(value, max) {
    if (typeof value !== 'string') return ''
    const trimmed = value.trim().replaceAll(/\s+/g, ' ')
    if (!trimmed) return ''
    return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed
  }

  /** The one-line identity shown under the element label. */
  function describeElement(element) {
    const tag = element.tagName.toLowerCase()
    const testId = shortValue(element.getAttribute('data-testid'), 40)
    if (testId) return `${tag} · testid=${testId}`
    const id = shortValue(element.getAttribute('id'), 40)
    if (id) return `${tag} · #${id}`
    const label = shortValue(element.getAttribute('aria-label'), 48)
    if (label) return `${tag} · ${label}`
    const text = shortValue(element.textContent, 48)
    return text ? `${tag} · ${text}` : tag
  }

  function categoryLabel(element) {
    const info = ENGINE.getElementInfo(element)
    return ELEMENT_LABELS[info.category] || ELEMENT_LABELS.unknown
  }

  /** Wraps a runtime message in a promise, tolerating a receiver-less worker. */
  function sendToWorker(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, state: 'retry', message: chrome.runtime.lastError.message })
            return
          }
          resolve(response || { ok: false, state: 'retry' })
        })
      } catch (error) {
        resolve({ ok: false, state: 'retry', message: String(error) })
      }
    })
  }

  /**
   * The overlay, the label and the confirm panel.
   *
   * They live in a closed shadow root appended to the document element: page
   * CSS cannot restyle them, page scripts cannot read the panel, and events
   * retarget to the host so the capture handlers can recognise their own UI.
   * Every style is set from JavaScript, because an injected <style> element is
   * subject to the page's CSP.
   */
  function createUi() {
    const host = document.createElement('div')
    host.setAttribute(UI_ATTRIBUTE, '')
    host.style.cssText = [
      'all: initial',
      'position: fixed',
      'inset: 0',
      'z-index: 2147483647',
      'pointer-events: none',
      'contain: layout style'
    ].join(';')

    const shadow = host.attachShadow({ mode: 'open' })

    const box = document.createElement('div')
    box.style.cssText = [
      'position: fixed',
      'display: none',
      'box-sizing: border-box',
      'border: 2px solid #2563eb',
      'border-radius: 4px',
      'background: rgba(37, 99, 235, 0.10)',
      'box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.6) inset',
      'pointer-events: none',
      'transition: none'
    ].join(';')

    const label = document.createElement('div')
    label.style.cssText = [
      'position: fixed',
      'display: none',
      'max-width: 320px',
      'padding: 4px 8px',
      'border-radius: 6px',
      'background: #111827',
      'color: #f9fafb',
      'font: 12px/1.4 system-ui, -apple-system, Segoe UI, sans-serif',
      'white-space: nowrap',
      'overflow: hidden',
      'text-overflow: ellipsis',
      'pointer-events: none'
    ].join(';')

    const panel = document.createElement('div')
    panel.style.cssText = [
      'position: fixed',
      'left: 50%',
      'bottom: 24px',
      'transform: translateX(-50%)',
      'display: none',
      'width: min(420px, calc(100vw - 32px))',
      'box-sizing: border-box',
      'padding: 14px 16px',
      'border-radius: 12px',
      'background: #0f172a',
      'color: #f8fafc',
      'box-shadow: 0 18px 45px rgba(15, 23, 42, 0.45)',
      'font: 13px/1.45 system-ui, -apple-system, Segoe UI, sans-serif',
      'pointer-events: auto'
    ].join(';')

    const panelTitle = document.createElement('div')
    panelTitle.style.cssText = 'font-weight: 600; font-size: 13px; margin-bottom: 2px;'
    const panelDetail = document.createElement('div')
    panelDetail.style.cssText = 'color: #cbd5e1; font-size: 12px; word-break: break-all;'
    const panelMessage = document.createElement('div')
    panelMessage.style.cssText = 'margin-top: 10px; color: #e2e8f0; font-size: 12.5px;'
    const buttons = document.createElement('div')
    buttons.style.cssText = 'display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;'

    const makeButton = (text, primary) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = text
      button.style.cssText = [
        'all: unset',
        'cursor: pointer',
        'padding: 7px 12px',
        'border-radius: 8px',
        `background: ${primary ? '#2563eb' : '#1e293b'}`,
        `color: ${primary ? '#ffffff' : '#e2e8f0'}`,
        'font: 600 12.5px/1 system-ui, -apple-system, Segoe UI, sans-serif',
        'border: 1px solid rgba(148, 163, 184, 0.35)'
      ].join(';')
      return button
    }

    const confirmButton = makeButton(TEXTS.confirm, true)
    const reselectButton = makeButton(TEXTS.reselect, false)
    const cancelButton = makeButton(TEXTS.cancel, false)

    buttons.append(confirmButton, reselectButton, cancelButton)
    panel.append(panelTitle, panelDetail, panelMessage, buttons)
    shadow.append(box, label, panel)
    document.documentElement.appendChild(host)

    return {
      host,
      box,
      label,
      panel,
      panelTitle,
      panelDetail,
      panelMessage,
      confirmButton,
      reselectButton,
      cancelButton
    }
  }

  /** Drops the running session, its listeners and its overlay. */
  function disposeSession() {
    const current = active
    if (!current) return
    active = null
    try {
      current.abort.abort()
    } catch {
      // An already-aborted controller is not an error.
    }
    for (const [target, type, handler, options] of current.listeners) {
      try {
        target.removeEventListener(type, handler, options)
      } catch {
        // The target may already be gone (navigation, iframe teardown).
      }
    }
    current.listeners.length = 0
    try {
      current.ui.host.remove()
    } catch {
      // Already detached.
    }
  }

  /** Ends the pick entirely: the injected script has nothing left to do. */
  function teardown() {
    disposeSession()
    removeMessageListener()
    if (globalThis.__quizlabPickerCleanup === teardown) {
      delete globalThis.__quizlabPickerCleanup
    }
  }

  function paintSelection(current, element) {
    const rect = element.getBoundingClientRect()
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      current.ui.box.style.display = 'none'
      current.ui.label.style.display = 'none'
      return
    }
    const { box, label } = current.ui
    box.style.display = 'block'
    box.style.left = `${Math.max(0, rect.left)}px`
    box.style.top = `${Math.max(0, rect.top)}px`
    box.style.width = `${Math.max(1, rect.width)}px`
    box.style.height = `${Math.max(1, rect.height)}px`

    label.style.display = 'block'
    label.textContent = `${categoryLabel(element)} — ${describeElement(element)}`
    const labelHeight = 26
    const labelTop = rect.top >= labelHeight + 6 ? rect.top - labelHeight - 6 : rect.bottom + 6
    label.style.left = `${Math.max(4, Math.min(rect.left, window.innerWidth - 200))}px`
    label.style.top = `${Math.max(4, labelTop)}px`
  }

  function schedulePaint(current, element) {
    if (current.frame !== null) return
    current.pending = element
    current.frame = window.requestAnimationFrame(() => {
      current.frame = null
      if (!active || active !== current || current.frozen) return
      if (!current.pending || !current.pending.isConnected) return
      paintSelection(current, current.pending)
    })
  }

  function showPanel(current, title, detail, message, mode) {
    const { ui } = current
    ui.panel.style.display = 'block'
    ui.panelTitle.textContent = title
    ui.panelDetail.textContent = detail
    ui.panelMessage.textContent = message
    ui.confirmButton.style.display = mode === 'done' || mode === 'hint' ? 'none' : 'block'
    ui.reselectButton.style.display = mode === 'hint' ? 'none' : 'block'
    ui.cancelButton.textContent = mode === 'done' ? TEXTS.close : TEXTS.cancel
    ui.cancelButton.style.display = 'block'
  }

  function hidePanel(current) {
    current.ui.panel.style.display = 'none'
  }

  /**
   * Re-derives the locator from the element at confirmation time.
   *
   * The DOM may have changed between the click and the confirmation. The
   * checks here are about "is this still the element the user chose, and can
   * the automation engine describe it": connected, same document, no shadow
   * tree, right category, unique primary selector.
   */
  function buildPayload(current) {
    const element = current.element
    if (!element || !element.isConnected) return { error: 'detached' }
    if (element.ownerDocument !== document) return { error: 'unsupported' }
    if (element.getRootNode() !== document) return { error: 'unsupported' }

    const expected = current.field === 'input' ? 'input' : 'button'
    let bundle = null
    try {
      const info = ENGINE.getElementInfo(element)
      if (info.category !== expected) return { error: 'wrongKind' }
      bundle = ENGINE.generateLocatorBundle(element, expected)
    } catch {
      return { error: 'noSelector' }
    }
    if (!bundle || !bundle.primarySelector || !bundle.fingerprint?.tag) {
      return { error: 'noSelector' }
    }

    const candidates = Array.isArray(bundle.candidates) ? [...bundle.candidates] : []
    if (!candidates.includes(bundle.primarySelector)) candidates.unshift(bundle.primarySelector)

    // The engine prefers a candidate that matches uniquely. Verify that claim
    // in this document before the app is asked to store anything: a selector
    // that resolves to several elements is not a description of this element.
    let primary = null
    for (const candidate of candidates) {
      try {
        const matches = document.querySelectorAll(candidate)
        if (matches.length === 1 && matches[0] === element) {
          primary = candidate
          break
        }
      } catch {
        // An invalid selector for this document cannot be the primary.
      }
    }
    if (!primary) return { error: 'noSelector' }

    return {
      payload: {
        selector: primary,
        candidates,
        fingerprint: bundle.fingerprint,
        sourceUrl: window.location.href
      }
    }
  }

  function errorText(code) {
    return TEXTS[code] || TEXTS.noSelector
  }

  async function confirmSelection(current) {
    if (current.sending) return
    const built = buildPayload(current)
    if (!built.payload) {
      showPanel(
        current,
        TEXTS.confirmTitle,
        describeElement(current.element),
        errorText(built.error),
        'error'
      )
      return
    }
    current.sending = true
    current.confirmButton.disabled = true
    current.confirmButton.style.opacity = '0.6'
    showPanel(
      current,
      TEXTS.confirmTitle,
      describeElement(current.element),
      TEXTS.sending,
      'confirm'
    )

    const response = await sendToWorker({
      type: 'selector_pick_result',
      sessionId: current.sessionId,
      field: current.field,
      payload: built.payload
    })
    current.sending = false
    current.confirmButton.disabled = false
    current.confirmButton.style.opacity = '1'

    if (response.ok === true) {
      showPanel(current, TEXTS.confirmTitle, describeElement(current.element), TEXTS.saved, 'done')
      window.setTimeout(() => {
        if (active === current) teardown()
      }, 2200)
      return
    }

    const state = typeof response.state === 'string' ? response.state : 'retry'
    const message =
      typeof response.message === 'string' && response.message
        ? response.message
        : state === 'site_not_open'
          ? TEXTS.siteNotOpen
          : state === 'verification_failed'
            ? TEXTS.verificationFailed
            : state === 'unpaired'
              ? TEXTS.unpaired
              : state === 'rejected'
                ? TEXTS.rejected
                : TEXTS.retry
    showPanel(current, TEXTS.confirmTitle, describeElement(current.element), message, 'error')
  }

  function startHover(current, event) {
    if (current.frozen) return
    if (isOwnUi(event.target)) return
    const path = typeof event.composedPath === 'function' ? event.composedPath() : []
    const raw = elementOf(path[0] || event.target)
    if (!raw || isOwnUi(raw)) return
    let resolved
    try {
      resolved = ENGINE.normalizeTargetForKind(current.field, raw, path)
    } catch {
      resolved = null
    }
    if (!resolved || resolved.nodeType !== 1) return
    if (current.hintVisible) {
      // The instruction panel must not cover the composer the user is aiming
      // at; the label and the frame carry the guidance from here on.
      current.hintVisible = false
      hidePanel(current)
    }
    if (current.hovered === resolved) return
    current.hovered = resolved
    schedulePaint(current, resolved)
  }

  function blockEvent(event) {
    if (isOwnUi(event.target)) return false
    if (typeof event.preventDefault === 'function') event.preventDefault()
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation()
    if (typeof event.stopPropagation === 'function') event.stopPropagation()
    return true
  }

  function onPointerDown(current, event) {
    if (isOwnUi(event.target)) return
    // Only the primary button picks; the rest is swallowed so the page cannot
    // react to it while the picker is up.
    const blocked = blockEvent(event)
    if (!blocked) return
    if (event.button !== undefined && event.button !== 0) return
    if (current.frozen) return
    const path = typeof event.composedPath === 'function' ? event.composedPath() : []
    const raw = elementOf(path[0] || event.target)
    if (!raw || !raw.isConnected) return
    let resolved
    try {
      resolved = ENGINE.normalizeTargetForKind(current.field, raw, path)
    } catch {
      resolved = null
    }
    if (!resolved || resolved.nodeType !== 1) return

    current.frozen = true
    current.element = resolved
    current.hovered = resolved
    paintSelection(current, resolved)
    showPanel(
      current,
      TEXTS.confirmTitle,
      `${categoryLabel(resolved)} — ${describeElement(resolved)}`,
      '',
      'confirm'
    )
  }

  function onKeyDown(current, event) {
    if (isOwnUi(event.target)) return
    if (event.key === 'Escape') {
      blockEvent(event)
      sendToWorker({ type: 'selector_pick_cancelled', sessionId: current.sessionId })
      teardown()
      return
    }
    // Enter must not reach a focused composer: the picker would send the
    // message the user only meant to select.
    if (event.key === 'Enter' || event.key === 'NumpadEnter') blockEvent(event)
  }

  function resetToHover(current) {
    current.frozen = false
    current.element = null
    current.sending = false
    hidePanel(current)
    current.ui.box.style.display = 'none'
    current.ui.label.style.display = 'none'
    current.hovered = null
    showPanel(
      current,
      'Sihirli Seçici açık',
      current.field === 'button' ? 'Hedef: Mesaj gönder butonu' : 'Hedef: Mesaj giriş alanı',
      'Elementin üzerine gelip tıklayın. ESC ile iptal edebilirsiniz.',
      'hint'
    )
    current.hintVisible = true
  }

  function initSession(config) {
    if (!ENGINE || typeof ENGINE.generateLocatorBundle !== 'function') {
      return
    }
    // A page that navigated between start and init is not the page the user
    // asked to pick on; the popup's site check would be stale.
    if (config.startHref && config.startHref !== window.location.href) {
      return
    }
    // A second init replaces the previous session, but the message listener
    // belongs to this injected script and must stay until the pick is over.
    disposeSession()
    const ui = createUi()
    const current = {
      sessionId: config.sessionId,
      field: config.field === 'button' ? 'button' : 'input',
      ui,
      listeners: [],
      abort: new AbortController(),
      hovered: null,
      element: null,
      pending: null,
      frame: null,
      frozen: false,
      sending: false,
      hintVisible: false,
      startHref: window.location.href,
      confirmButton: ui.confirmButton
    }
    active = current

    const listen = (target, type, handler, options) => {
      target.addEventListener(type, handler, { capture: true, passive: false, ...options })
      current.listeners.push([target, type, handler, { capture: true, ...options }])
    }
    const listenPassive = (target, type, handler) => {
      target.addEventListener(type, handler, { capture: true, passive: true })
      current.listeners.push([target, type, handler, { capture: true, passive: true }])
    }

    listen(window, 'pointermove', (event) => startHover(current, event))
    listen(window, 'pointerdown', (event) => onPointerDown(current, event))
    listen(window, 'mousedown', (event) => blockEvent(event))
    listen(window, 'mouseup', (event) => blockEvent(event))
    listen(window, 'click', (event) => blockEvent(event))
    listen(window, 'auxclick', (event) => blockEvent(event))
    listen(window, 'contextmenu', (event) => blockEvent(event))
    listen(window, 'submit', (event) => blockEvent(event))
    listen(window, 'keydown', (event) => onKeyDown(current, event))
    listenPassive(window, 'scroll', () => {
      if (current.frozen && current.element) paintSelection(current, current.element)
      else if (current.hovered) schedulePaint(current, current.hovered)
    })
    listenPassive(window, 'resize', () => {
      if (current.frozen && current.element) paintSelection(current, current.element)
      else if (current.hovered) schedulePaint(current, current.hovered)
    })
    const onUnload = () => {
      sendToWorker({ type: 'selector_pick_cancelled', sessionId: current.sessionId })
      teardown()
    }
    window.addEventListener('beforeunload', onUnload)
    current.listeners.push([window, 'beforeunload', onUnload, undefined])

    ui.confirmButton.addEventListener('click', () => void confirmSelection(current))
    ui.reselectButton.addEventListener('click', () => resetToHover(current))
    ui.cancelButton.addEventListener('click', () => {
      if (current.sessionId) {
        sendToWorker({ type: 'selector_pick_cancelled', sessionId: current.sessionId })
      }
      teardown()
    })

    // The instructions live on the page, not in the popup: Chrome closes the
    // popup as soon as the user clicks the page.
    showPanel(
      current,
      'Sihirli Seçici açık',
      current.field === 'button' ? 'Hedef: Mesaj gönder butonu' : 'Hedef: Mesaj giriş alanı',
      'Elementin üzerine gelip tıklayın. ESC ile iptal edebilirsiniz.',
      'hint'
    )
    current.hintVisible = true
  }

  globalThis.__quizlabPickerCleanup = teardown

  if (chrome.runtime?.onMessage?.addListener) {
    messageListener = (message) => {
      if (!message || typeof message !== 'object') return
      if (message.type !== 'quizlab_selector_init') return
      const sessionId = typeof message.sessionId === 'string' ? message.sessionId : ''
      if (!sessionId) return
      initSession({
        sessionId,
        field: message.field,
        startHref: typeof message.startHref === 'string' ? message.startHref : null
      })
    }
    chrome.runtime.onMessage.addListener(messageListener)
  }
})()
