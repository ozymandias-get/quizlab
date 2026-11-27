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

  /**
   * Whether an event is a real user action.
   *
   * `isTrusted` is the only signal the isolated world gets; a page script can
   * dispatch any event it likes, but it cannot make one trusted. The optional
   * test set exists because jsdom reports every dispatched event as untrusted;
   * a page can never reach this script's world to populate it.
   */
  function isUserEvent(event) {
    if (!event) return false
    if (event.isTrusted === true) return true
    const testTrusted = globalThis.__quizlabPickerTestTrustedEvents
    return Boolean(testTrusted) && typeof testTrusted.has === 'function' && testTrusted.has(event)
  }

  function elementOf(node) {
    if (!node) return null
    if (node.nodeType === 1) return node
    return node.parentElement || null
  }

  /**
   * Whether a node belongs to this picker's own UI.
   *
   * The `data-quizlab-picker-ui` attribute is not an authority: the page can
   * put the same attribute on its own element. The comparison is against the
   * live host/shadow references the session owns.
   */
  function isOwnUi(node) {
    const current = active
    if (!current || !node) return false
    const element = elementOf(node)
    if (!element) return false
    if (element === current.ui.host) return true
    try {
      if (
        typeof element.getRootNode === 'function' &&
        element.getRootNode() === current.ui.shadow
      ) {
        return true
      }
    } catch {
      // A detached tree cannot be ours; fall through.
    }
    try {
      return current.ui.host.contains(element)
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
   * CSS cannot restyle them and page scripts cannot read or click the panel
   * through its DOM. Shadow DOM is *not* a security boundary on its own — the
   * real gate is that only trusted user events drive a pick and that the worker
   * verifies the payload — but a closed root keeps the page from scripting the
   * confirmation UI directly. Every style is set from JavaScript, because an
   * injected <style> element is subject to the page's CSP.
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

    const shadow = host.attachShadow({ mode: 'closed' })

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

    const ui = {
      host,
      shadow,
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
    // A closed root cannot be reached from a test either. The content script
    // runs in its own world, so this handle is never visible to the page even
    // when a test harness opts in before loading the script.
    if (globalThis.__quizlabPickerTestHandles === true) {
      globalThis.__quizlabPickerTestUi = ui
    }
    return ui
  }

  /** Drops the running session, its listeners and its overlay. */
  function disposeSession() {
    const current = active
    if (!current) return
    active = null
    // A response that arrives after this point belongs to a dead session.
    current.sendToken += 1
    if (current.frame !== null) {
      try {
        window.cancelAnimationFrame(current.frame)
      } catch {
        // The frame already ran.
      }
      current.frame = null
    }
    current.pending = null
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
    if (globalThis.__quizlabPickerTestUi === current.ui) {
      delete globalThis.__quizlabPickerTestUi
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
    if (!element || !element.isConnected) {
      current.ui.box.style.display = 'none'
      current.ui.label.style.display = 'none'
      return
    }
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
    // The label is positioned after its text is set, so a long test id does not
    // run past the viewport (and under a side panel) on the right edge.
    const labelWidth = Math.min(320, label.offsetWidth || 200)
    const labelHeight = label.offsetHeight || 26
    const labelTop = rect.top >= labelHeight + 6 ? rect.top - labelHeight - 6 : rect.bottom + 6
    const maxLeft = Math.max(4, window.innerWidth - labelWidth - 4)
    const maxTop = Math.max(4, window.innerHeight - labelHeight - 4)
    label.style.left = `${Math.min(Math.max(4, rect.left), maxLeft)}px`
    label.style.top = `${Math.min(Math.max(4, labelTop), maxTop)}px`
  }

  function schedulePaint(current, element) {
    // Always keep the latest pointer target: returning early because a frame
    // is already queued used to drop the last element of a frame.
    current.pending = element
    if (current.frame !== null) return
    current.frame = window.requestAnimationFrame(() => {
      current.frame = null
      if (!active || active !== current || current.frozen) return
      const target = current.pending
      current.pending = null
      if (!target) return
      paintSelection(current, target)
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
    const token = (current.sendToken += 1)
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

    // The session may have been reset, cancelled or replaced while the answer
    // was on its way. That answer describes the old selection and must not
    // drive the new UI (or tear it down).
    if (active !== current || current.sendToken !== token) return

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
    const reason =
      typeof response.reason === 'string' && response.reason ? ` (${response.reason})` : ''
    const message =
      typeof response.message === 'string' && response.message
        ? response.message
        : state === 'site_not_open'
          ? TEXTS.siteNotOpen
          : state === 'verification_failed'
            ? TEXTS.verificationFailed + reason
            : state === 'unpaired'
              ? TEXTS.unpaired
              : state === 'rejected'
                ? TEXTS.rejected
                : TEXTS.retry
    if (state === 'site_not_open') current.confirmButton.textContent = 'Tekrar Gönder'
    showPanel(current, TEXTS.confirmTitle, describeElement(current.element), message, 'error')
  }

  function startHover(current, event) {
    if (current.frozen) return
    if (!isUserEvent(event)) return
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
    // Only a real pointer event picks. A page script can dispatch a synthetic
    // pointerdown on the send button, but it cannot make the event trusted.
    if (!isUserEvent(event)) {
      blockEvent(event)
      return
    }
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
    const target = elementOf(event.target)
    if (event.key === 'Escape') {
      if (!isUserEvent(event)) return
      blockEvent(event)
      sendToWorker({ type: 'selector_pick_cancelled', sessionId: current.sessionId })
      teardown()
      return
    }
    // Enter must not reach a focused composer: the picker would send the
    // message the user only meant to select. Space activates a focused button
    // on keyup in Chrome, so it is swallowed for buttons and roles only; other
    // typing (and scrolling) stays with the page.
    const isButtonTarget =
      Boolean(target) &&
      (target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.getAttribute('role') === 'button' ||
        target.getAttribute('type') === 'submit')
    if (
      event.key === 'Enter' ||
      event.key === 'NumpadEnter' ||
      (event.key === ' ' && isButtonTarget)
    ) {
      blockEvent(event)
    }
  }

  /** Space activates a focused button on keyup; keep that from sending. */
  function onKeyUp(current, event) {
    if (isOwnUi(event.target)) return
    if (!isUserEvent(event)) return
    if (event.key !== ' ' && event.key !== 'Enter' && event.key !== 'NumpadEnter') return
    const target = elementOf(event.target)
    if (!target) return
    const isButtonTarget =
      target.tagName === 'BUTTON' ||
      target.tagName === 'A' ||
      target.getAttribute('role') === 'button' ||
      target.getAttribute('type') === 'submit'
    if (isButtonTarget) blockEvent(event)
  }

  function resetToHover(current) {
    // A reset while the transfer is in flight would detach the answer from the
    // selection; the user waits for the result or cancels the whole pick.
    if (current.sending) return
    current.sendToken += 1
    current.frozen = false
    current.element = null
    current.sending = false
    hidePanel(current)
    current.ui.box.style.display = 'none'
    current.ui.label.style.display = 'none'
    current.hovered = null
    current.confirmButton.textContent = TEXTS.confirm
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
      sendToken: 0,
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
    listen(window, 'pointerup', (event) => blockEvent(event))
    listen(window, 'mousedown', (event) => blockEvent(event))
    listen(window, 'mouseup', (event) => blockEvent(event))
    listen(window, 'click', (event) => blockEvent(event))
    listen(window, 'dblclick', (event) => blockEvent(event))
    listen(window, 'auxclick', (event) => blockEvent(event))
    listen(window, 'contextmenu', (event) => blockEvent(event))
    listen(window, 'submit', (event) => blockEvent(event))
    listen(window, 'dragstart', (event) => blockEvent(event))
    listen(window, 'drop', (event) => blockEvent(event))
    listen(window, 'keydown', (event) => onKeyDown(current, event))
    listen(window, 'keyup', (event) => onKeyUp(current, event))
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

    ui.confirmButton.addEventListener('click', (event) => {
      if (!isUserEvent(event)) return
      void confirmSelection(current)
    })
    ui.reselectButton.addEventListener('click', (event) => {
      if (!isUserEvent(event)) return
      resetToHover(current)
    })
    ui.cancelButton.addEventListener('click', (event) => {
      if (!isUserEvent(event)) return
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
