/**
 * The magic selector a user runs on a normal Chrome tab.
 *
 * Injected on demand when the user starts a pick from the Side Panel. Lives in
 * a closed Shadow DOM with inline styles only (CSP-safe, zero external assets)
 * and removes every listener, overlay and piece of state on completion or cancel.
 */
;(() => {
  'use strict'

  const ENGINE = globalThis.QuizlabSelectorEngine
  const UI_ATTRIBUTE = 'data-quizlab-picker-ui'

  const TEXTS = {
    toolbarTitleInput: 'Sihirli Seçici · Mesaj giriş alanı',
    toolbarTitleButton: 'Sihirli Seçici · Gönderme butonu',
    toolbarHint: 'Alanı seçmek için üzerine gel ve tıkla.',
    toolbarIncompatible: 'Bu alan uygun değil. Lütfen doğru alanı seçin.',
    confirmTitleInput: 'Mesaj giriş alanı seçildi',
    confirmTitleButton: 'Gönderme butonu seçildi',
    confirmSubtitle: 'Seçilen alanı QuizLab’a gönderip doğrulayabilirsiniz.',
    confirm: 'QuizLab’a Gönder',
    retrySend: 'Tekrar Gönder',
    retryConnect: 'Tekrar Dene',
    reselect: 'Yeniden Seç',
    cancel: 'İptal',
    close: 'Kapat',
    sending: 'QuizLab’da doğrulanıyor…',
    savedInput: 'Mesaj giriş alanı kaydedildi.',
    savedButton: 'Gönderme butonu kaydedildi.',
    siteNotOpen: 'Bu siteyi QuizLab’da aç ve tekrar dene.',
    verificationFailed: 'Bu element QuizLab’da doğrulanamadı. Önceki selektör korunuyor.',
    unpaired: 'QuizLab ile eşleştirme gerekli. Yan panelden eşleştirin.',
    rejected: 'Aktarım QuizLab tarafından reddedildi.',
    retry: 'QuizLab bağlantısı kurulamadı.',
    wrongKind: 'Bu alan hedef türüyle uyumlu değil. Doğru alanı seçin.',
    noSelector: 'Bu element için güvenilir bir seçici üretilemedi. Farklı bir element deneyin.',
    unsupported: 'Bu element Shadow DOM içinde olduğu için desteklenmiyor.',
    detached: 'Seçilen element sayfadan kaldırıldı. Yeniden seçin.'
  }

  let active = null
  let messageListener = null

  function removeMessageListener() {
    if (!messageListener) return
    try {
      chrome.runtime.onMessage.removeListener(messageListener)
    } catch {
      // Listener already dropped.
    }
    messageListener = null
  }

  if (globalThis.__quizlabPickerCleanup) {
    try {
      globalThis.__quizlabPickerCleanup()
    } catch {
      // Ignore cleanup failure from previous instance.
    }
  }

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
      // Fall through.
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

  /** Technical summary placed inside collapsed <details>, never in main hover UI. */
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

  /** Human-friendly hint for the confirmation panel. */
  function humanSummary(element, field) {
    const aria = shortValue(element.getAttribute('aria-label'), 48)
    if (aria) return aria
    const placeholder = shortValue(element.getAttribute('placeholder'), 48)
    if (placeholder) return placeholder
    const title = shortValue(element.getAttribute('title'), 48)
    if (title) return title
    const text = shortValue(element.textContent, 40)
    if (text && field === 'button') return `“${text}”`
    return TEXTS.confirmSubtitle
  }

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

  function getTheme() {
    let isLight = false
    let reducedMotion = false
    try {
      isLight = window.matchMedia?.('(prefers-color-scheme: light)').matches === true
      reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    } catch {
      // Default to dark theme and normal motion.
    }
    if (isLight) {
      return {
        reducedMotion,
        bg: '#ffffff',
        surface: '#f4f4f5',
        text: '#18181b',
        muted: '#52525b',
        border: 'rgba(24, 24, 27, 0.14)',
        primaryBg: '#18181b',
        primaryText: '#fafafa',
        secondaryBg: '#f4f4f5',
        secondaryText: '#18181b',
        shadow: '0 10px 30px rgba(24, 24, 27, 0.16), 0 0 0 1px rgba(24, 24, 27, 0.08)',
        ring: '#18181b',
        okText: '#047857',
        okBg: 'rgba(16, 185, 129, 0.12)',
        warnText: '#b45309',
        warnBg: 'rgba(245, 158, 11, 0.12)',
        errText: '#b91c1c',
        errBg: 'rgba(239, 68, 68, 0.10)'
      }
    }
    return {
      reducedMotion,
      bg: '#18181b',
      surface: '#27272a',
      text: '#f4f4f5',
      muted: '#a1a1aa',
      border: 'rgba(255, 255, 255, 0.14)',
      primaryBg: '#fafafa',
      primaryText: '#18181b',
      secondaryBg: '#27272a',
      secondaryText: '#f4f4f5',
      shadow: '0 14px 36px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
      ring: '#fafafa',
      okText: '#6ee7b7',
      okBg: 'rgba(16, 185, 129, 0.14)',
      warnText: '#fcd34d',
      warnBg: 'rgba(245, 158, 11, 0.14)',
      errText: '#fca5a5',
      errBg: 'rgba(239, 68, 68, 0.14)'
    }
  }

  function createSvgIcon(pathD, size = 14) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', String(size))
    svg.setAttribute('height', String(size))
    svg.setAttribute('viewBox', '0 0 16 16')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('aria-hidden', 'true')
    svg.style.cssText = 'flex-shrink: 0; display: block;'
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', pathD)
    path.setAttribute('stroke', 'currentColor')
    path.setAttribute('stroke-width', '1.6')
    path.setAttribute('stroke-linecap', 'round')
    path.setAttribute('stroke-linejoin', 'round')
    svg.appendChild(path)
    return svg
  }

  function createUi(field) {
    const theme = getTheme()
    const transition = theme.reducedMotion ? 'none' : 'opacity 160ms ease, transform 160ms ease'

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

    // 1. Highlight Box (zero transition on geometry for 1:1 rAF tracking)
    const box = document.createElement('div')
    box.style.cssText = [
      'position: fixed',
      'display: none',
      'box-sizing: border-box',
      'border: 2px solid #3b82f6',
      'border-radius: 6px',
      'background: rgba(59, 130, 246, 0.10)',
      'pointer-events: none',
      'transition: none'
    ].join(';')

    // 2. Hover / Selection Label
    const label = document.createElement('div')
    label.style.cssText = [
      'position: fixed',
      'display: none',
      'align-items: center',
      'gap: 5px',
      'max-width: 260px',
      'padding: 4px 9px',
      'border-radius: 6px',
      `background: ${theme.bg}`,
      `color: ${theme.text}`,
      `border: 1px solid ${theme.border}`,
      'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28)',
      'font: 600 11.5px/1.3 Inter, system-ui, -apple-system, Segoe UI, sans-serif',
      'white-space: nowrap',
      'overflow: hidden',
      'text-overflow: ellipsis',
      'pointer-events: none'
    ].join(';')

    // 3. Floating Top Toolbar
    const toolbar = document.createElement('div')
    toolbar.setAttribute('role', 'region')
    toolbar.setAttribute('aria-label', 'Sihirli Seçici araç çubuğu')
    toolbar.style.cssText = [
      'position: fixed',
      'top: 14px',
      'left: 50%',
      'transform: translateX(-50%)',
      'display: flex',
      'align-items: center',
      'gap: 10px',
      'max-width: calc(100vw - 24px)',
      'padding: 8px 12px',
      'border-radius: 10px',
      `background: ${theme.bg}`,
      `color: ${theme.text}`,
      `box-shadow: ${theme.shadow}`,
      'font: 12.5px/1.35 Inter, system-ui, -apple-system, Segoe UI, sans-serif',
      'pointer-events: auto',
      `transition: ${transition}`
    ].join(';')

    const toolbarIcon = createSvgIcon(
      field === 'button'
        ? 'M14 2 7.5 8.5M14 2l-4.2 12-2.3-5.5L2 6.2 14 2Z'
        : 'M2 4.5A1.5 1.5 0 0 1 3.5 3h9A1.5 1.5 0 0 1 14 4.5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7Zm3 2h6M5 9.5h3.5',
      15
    )

    const toolbarTextWrap = document.createElement('div')
    toolbarTextWrap.style.cssText = 'display: flex; flex-direction: column; min-width: 0;'

    const toolbarTitle = document.createElement('div')
    toolbarTitle.style.cssText = 'font-weight: 600; font-size: 12.5px; white-space: nowrap;'
    toolbarTitle.textContent =
      field === 'button' ? TEXTS.toolbarTitleButton : TEXTS.toolbarTitleInput

    const toolbarHint = document.createElement('div')
    toolbarHint.setAttribute('role', 'status')
    toolbarHint.setAttribute('aria-live', 'polite')
    toolbarHint.style.cssText = `font-size: 11.5px; color: ${theme.muted};`
    toolbarHint.textContent = TEXTS.toolbarHint

    toolbarTextWrap.append(toolbarTitle, toolbarHint)

    const escBadge = document.createElement('kbd')
    escBadge.textContent = 'ESC'
    escBadge.style.cssText = [
      'padding: 2px 6px',
      'border-radius: 5px',
      `background: ${theme.surface}`,
      `border: 1px solid ${theme.border}`,
      `color: ${theme.muted}`,
      'font: 600 10px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace',
      'flex-shrink: 0'
    ].join(';')

    const styleFocus = (btn) => {
      btn.addEventListener('focus', () => {
        btn.style.outline = `2px solid ${theme.ring}`
        btn.style.outlineOffset = '2px'
      })
      btn.addEventListener('blur', () => {
        btn.style.outline = 'none'
      })
    }

    const toolbarCancelBtn = document.createElement('button')
    toolbarCancelBtn.type = 'button'
    toolbarCancelBtn.textContent = TEXTS.cancel
    toolbarCancelBtn.setAttribute('aria-label', 'Seçimi iptal et')
    toolbarCancelBtn.style.cssText = [
      'all: unset',
      'cursor: pointer',
      'padding: 5px 10px',
      'border-radius: 7px',
      `background: ${theme.secondaryBg}`,
      `color: ${theme.secondaryText}`,
      `border: 1px solid ${theme.border}`,
      'font: 600 11.5px/1 Inter, system-ui, -apple-system, Segoe UI, sans-serif',
      'flex-shrink: 0',
      `transition: ${theme.reducedMotion ? 'none' : 'background-color 120ms ease'}`
    ].join(';')
    styleFocus(toolbarCancelBtn)

    toolbar.append(toolbarIcon, toolbarTextWrap, escBadge, toolbarCancelBtn)

    // 4. Confirmation Panel (smart top/bottom placement)
    const panel = document.createElement('div')
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-label', 'Seçim onayı')
    panel.style.cssText = [
      'position: fixed',
      'left: 50%',
      'bottom: 20px',
      'transform: translateX(-50%)',
      'display: none',
      'width: min(400px, calc(100vw - 24px))',
      'box-sizing: border-box',
      'padding: 14px 16px',
      'border-radius: 12px',
      `background: ${theme.bg}`,
      `color: ${theme.text}`,
      `box-shadow: ${theme.shadow}`,
      'font: 13px/1.45 Inter, system-ui, -apple-system, Segoe UI, sans-serif',
      'pointer-events: auto',
      `transition: ${transition}`
    ].join(';')

    const panelHead = document.createElement('div')
    panelHead.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 4px;'

    const panelStatusIcon = document.createElement('span')
    panelStatusIcon.style.cssText = `display: inline-flex; color: ${theme.okText};`

    const panelTitle = document.createElement('div')
    panelTitle.style.cssText = 'font-weight: 600; font-size: 13.5px;'

    panelHead.append(panelStatusIcon, panelTitle)

    const panelDetail = document.createElement('div')
    panelDetail.style.cssText = `color: ${theme.muted}; font-size: 12px; line-height: 1.4; overflow-wrap: anywhere;`

    const panelMessage = document.createElement('div')
    panelMessage.setAttribute('role', 'status')
    panelMessage.setAttribute('aria-live', 'polite')
    panelMessage.style.cssText = [
      'display: none',
      'margin-top: 10px',
      'padding: 8px 10px',
      'border-radius: 8px',
      'font-size: 12px',
      'font-weight: 500',
      'line-height: 1.4'
    ].join(';')

    const techDetails = document.createElement('details')
    techDetails.style.cssText = `margin-top: 8px; font-size: 11px; color: ${theme.muted};`
    const techSummary = document.createElement('summary')
    techSummary.textContent = 'Teknik ayrıntılar'
    techSummary.style.cssText = 'cursor: pointer; user-select: none; font-weight: 500;'
    const techBody = document.createElement('div')
    techBody.style.cssText = [
      'margin-top: 4px',
      'padding: 6px 8px',
      'border-radius: 6px',
      `background: ${theme.surface}`,
      `border: 1px solid ${theme.border}`,
      'font-family: ui-monospace, SFMono-Regular, Menlo, monospace',
      'font-size: 10.5px',
      'word-break: break-all'
    ].join(';')
    techDetails.append(techSummary, techBody)

    const buttons = document.createElement('div')
    buttons.style.cssText =
      'display: flex; align-items: center; gap: 8px; margin-top: 12px; flex-wrap: wrap;'

    const makeButton = (text, variant) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = text
      const isPrimary = variant === 'primary'
      const isGhost = variant === 'ghost'
      button.style.cssText = [
        'all: unset',
        'cursor: pointer',
        'padding: 7px 12px',
        'border-radius: 8px',
        `background: ${isPrimary ? theme.primaryBg : isGhost ? 'transparent' : theme.secondaryBg}`,
        `color: ${isPrimary ? theme.primaryText : isGhost ? theme.muted : theme.secondaryText}`,
        `border: 1px solid ${isPrimary ? 'transparent' : isGhost ? 'transparent' : theme.border}`,
        'font: 600 12px/1 Inter, system-ui, -apple-system, Segoe UI, sans-serif',
        isGhost ? 'margin-left: auto;' : '',
        `transition: ${theme.reducedMotion ? 'none' : 'opacity 120ms ease, background-color 120ms ease'}`
      ].join(';')
      styleFocus(button)
      return button
    }

    const confirmButton = makeButton(TEXTS.confirm, 'primary')
    const reselectButton = makeButton(TEXTS.reselect, 'secondary')
    const cancelButton = makeButton(TEXTS.cancel, 'ghost')

    buttons.append(confirmButton, reselectButton, cancelButton)
    panel.append(panelHead, panelDetail, panelMessage, techDetails, buttons)
    shadow.append(box, label, toolbar, panel)
    document.documentElement.appendChild(host)

    const ui = {
      theme,
      host,
      shadow,
      box,
      label,
      toolbar,
      toolbarHint,
      toolbarCancelBtn,
      panel,
      panelStatusIcon,
      panelTitle,
      panelDetail,
      panelMessage,
      techDetails,
      techBody,
      confirmButton,
      reselectButton,
      cancelButton
    }
    if (globalThis.__quizlabPickerTestHandles === true) {
      globalThis.__quizlabPickerTestUi = ui
    }
    return ui
  }

  function disposeSession() {
    const current = active
    if (!current) return
    active = null
    current.sendToken += 1
    if (current.frame !== null) {
      try {
        window.cancelAnimationFrame(current.frame)
      } catch {
        // Frame already ran.
      }
      current.frame = null
    }
    current.pending = null
    try {
      current.abort.abort()
    } catch {
      // Already aborted.
    }
    for (const [target, type, handler, options] of current.listeners) {
      try {
        target.removeEventListener(type, handler, options)
      } catch {
        // Target already gone.
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

  function teardown() {
    disposeSession()
    removeMessageListener()
    if (globalThis.__quizlabPickerCleanup === teardown) {
      delete globalThis.__quizlabPickerCleanup
    }
  }

  function styleHighlight(current, status) {
    const { box, label } = current.ui
    if (status === 'compatible') {
      box.style.border = '2px solid #3b82f6'
      box.style.background = 'rgba(59, 130, 246, 0.12)'
      label.style.borderColor = 'rgba(59, 130, 246, 0.45)'
    } else if (status === 'incompatible') {
      box.style.border = '2px dashed #f59e0b'
      box.style.background = 'rgba(245, 158, 11, 0.08)'
      label.style.borderColor = 'rgba(245, 158, 11, 0.45)'
    } else {
      // selected or saved
      box.style.border = '2px solid #10b981'
      box.style.background = 'rgba(16, 185, 129, 0.14)'
      label.style.borderColor = 'rgba(16, 185, 129, 0.45)'
    }
  }

  function paintSelection(current, element, mode) {
    if (!element || !element.isConnected) {
      current.ui.box.style.display = 'none'
      current.ui.label.style.display = 'none'
      return
    }
    const rawRect = element.getBoundingClientRect()
    if (!rawRect || rawRect.width <= 0 || rawRect.height <= 0) {
      current.ui.box.style.display = 'none'
      current.ui.label.style.display = 'none'
      return
    }

    // Clip to visible viewport so offscreen areas do not stretch outside.
    const vw = window.innerWidth || document.documentElement.clientWidth || 0
    const vh = window.innerHeight || document.documentElement.clientHeight || 0
    const left = Math.max(0, rawRect.left)
    const top = Math.max(0, rawRect.top)
    const right = Math.min(vw, rawRect.right)
    const bottom = Math.min(vh, rawRect.bottom)
    const width = right - left
    const height = bottom - top

    if (width <= 0 || height <= 0) {
      current.ui.box.style.display = 'none'
      current.ui.label.style.display = 'none'
      return
    }

    const expected = current.field === 'button' ? 'button' : 'input'
    const info = ENGINE.getElementInfo(element)
    const isCompatible = info.category === expected

    const visualState =
      mode === 'saved'
        ? 'saved'
        : mode === 'selected'
          ? 'selected'
          : isCompatible
            ? 'compatible'
            : 'incompatible'

    styleHighlight(current, visualState)

    const { box, label } = current.ui
    box.style.display = 'block'
    box.style.left = `${left}px`
    box.style.top = `${top}px`
    box.style.width = `${Math.max(1, width)}px`
    box.style.height = `${Math.max(1, height)}px`

    const fieldText = current.field === 'button' ? 'Gönderme butonu' : 'Mesaj giriş alanı'
    label.style.display = 'inline-flex'
    if (visualState === 'saved') label.textContent = `✓ Kaydedildi · ${fieldText}`
    else if (visualState === 'selected') label.textContent = `● Seçilen · ${fieldText}`
    else if (visualState === 'compatible') label.textContent = `✓ ${fieldText}`
    else label.textContent = '! Bu alan uygun değil'

    const labelWidth = Math.min(260, label.offsetWidth || 160)
    const labelHeight = label.offsetHeight || 24
    const preferredTop = top >= labelHeight + 70 ? top - labelHeight - 6 : bottom + 6
    const maxLeft = Math.max(4, vw - labelWidth - 4)
    const maxTop = Math.max(4, vh - labelHeight - 4)
    label.style.left = `${Math.min(Math.max(4, left), maxLeft)}px`
    label.style.top = `${Math.min(Math.max(4, preferredTop), maxTop)}px`
  }

  function schedulePaint(current, element) {
    current.pending = element
    if (current.frame !== null) return
    current.frame = window.requestAnimationFrame(() => {
      current.frame = null
      if (!active || active !== current || current.frozen) return
      const target = current.pending
      current.pending = null
      if (!target) return
      paintSelection(current, target, 'hover')
    })
  }

  function positionPanelForElement(current, element) {
    const { panel } = current.ui
    const vh = window.innerHeight || document.documentElement.clientHeight || 800
    const rect = element && element.isConnected ? element.getBoundingClientRect() : null
    if (rect && rect.bottom > vh * 0.52) {
      panel.style.top = '72px'
      panel.style.bottom = 'auto'
    } else {
      panel.style.top = 'auto'
      panel.style.bottom = '20px'
    }
  }

  function showPanel(current, { title, detail, message, messageTone, tech, mode, iconTone }) {
    const { ui } = current
    positionPanelForElement(current, current.element)
    ui.panel.style.display = 'block'
    ui.panelTitle.textContent = title
    ui.panelDetail.textContent = detail
    ui.toolbar.style.display = 'none'

    if (iconTone === 'error') {
      ui.panelStatusIcon.style.color = ui.theme.errText
      ui.panelStatusIcon.replaceChildren(
        createSvgIcon('M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2Zm0 3.5v3M8 10.5h.01', 15)
      )
    } else if (iconTone === 'warn') {
      ui.panelStatusIcon.style.color = ui.theme.warnText
      ui.panelStatusIcon.replaceChildren(
        createSvgIcon('M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2Zm0 3.5v3M8 10.5h.01', 15)
      )
    } else {
      ui.panelStatusIcon.style.color = ui.theme.okText
      ui.panelStatusIcon.replaceChildren(createSvgIcon('M13 4.5 6.5 11 3 7.5', 15))
    }

    if (message) {
      ui.panelMessage.textContent = message
      ui.panelMessage.style.display = 'block'
      if (messageTone === 'success') {
        ui.panelMessage.style.background = ui.theme.okBg
        ui.panelMessage.style.color = ui.theme.okText
      } else if (messageTone === 'error') {
        ui.panelMessage.style.background = ui.theme.errBg
        ui.panelMessage.style.color = ui.theme.errText
      } else {
        ui.panelMessage.style.background = ui.theme.surface
        ui.panelMessage.style.color = ui.theme.text
      }
    } else {
      ui.panelMessage.textContent = ''
      ui.panelMessage.style.display = 'none'
    }

    if (tech) {
      ui.techBody.textContent = tech
      ui.techDetails.style.display = 'block'
    } else {
      ui.techBody.textContent = ''
      ui.techDetails.style.display = 'none'
      ui.techDetails.open = false
    }

    ui.confirmButton.style.display = mode === 'done' ? 'none' : 'inline-flex'
    ui.reselectButton.style.display = mode === 'done' ? 'none' : 'inline-flex'
    ui.cancelButton.textContent = mode === 'done' ? TEXTS.close : TEXTS.cancel
    ui.cancelButton.style.display = 'inline-flex'
  }

  function hidePanel(current) {
    current.ui.panel.style.display = 'none'
    current.ui.toolbar.style.display = 'flex'
  }

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

    let primary = null
    for (const candidate of candidates) {
      try {
        const matches = document.querySelectorAll(candidate)
        if (matches.length === 1 && matches[0] === element) {
          primary = candidate
          break
        }
      } catch {
        // Ignore invalid candidate.
      }
    }
    if (!primary) return { error: 'noSelector' }

    const fingerprint =
      expected === 'input' && bundle.fingerprint && typeof bundle.fingerprint === 'object'
        ? { ...bundle.fingerprint }
        : bundle.fingerprint
    if (expected === 'input' && fingerprint && 'text' in fingerprint) {
      delete fingerprint.text
    }

    let minimalUrl = ''
    try {
      const parsed = new URL(window.location.href)
      minimalUrl = `${parsed.origin}${parsed.pathname || '/'}`
    } catch {
      minimalUrl = `${window.location.origin}${window.location.pathname || '/'}`
    }

    return {
      payload: {
        selector: primary,
        candidates,
        fingerprint,
        sourceUrl: minimalUrl
      }
    }
  }

  function errorText(code) {
    return TEXTS[code] || TEXTS.noSelector
  }

  async function confirmSelection(current) {
    if (current.sending) return
    const titleText =
      current.field === 'button' ? TEXTS.confirmTitleButton : TEXTS.confirmTitleInput
    const techSummary = describeElement(current.element)
    const built = buildPayload(current)
    if (!built.payload) {
      showPanel(current, {
        title: titleText,
        detail: humanSummary(current.element, current.field),
        message: errorText(built.error),
        messageTone: 'error',
        tech: techSummary,
        mode: 'error',
        iconTone: 'error'
      })
      return
    }

    current.sending = true
    const token = (current.sendToken += 1)
    current.confirmButton.disabled = true
    current.confirmButton.setAttribute('aria-busy', 'true')
    current.confirmButton.style.opacity = '0.6'
    current.reselectButton.disabled = true
    current.reselectButton.style.opacity = '0.5'
    showPanel(current, {
      title: titleText,
      detail: humanSummary(current.element, current.field),
      message: TEXTS.sending,
      messageTone: 'info',
      tech: `${techSummary}\n${built.payload.selector}`,
      mode: 'confirm',
      iconTone: 'ok'
    })

    const response = await sendToWorker({
      type: 'selector_pick_result',
      sessionId: current.sessionId,
      field: current.field,
      payload: built.payload
    })

    if (active !== current || current.sendToken !== token) return

    current.sending = false
    current.confirmButton.disabled = false
    current.confirmButton.removeAttribute('aria-busy')
    current.confirmButton.style.opacity = '1'
    current.reselectButton.disabled = false
    current.reselectButton.style.opacity = '1'

    if (response.ok === true) {
      paintSelection(current, current.element, 'saved')
      showPanel(current, {
        title: current.field === 'button' ? TEXTS.savedButton : TEXTS.savedInput,
        detail: humanSummary(current.element, current.field),
        message: null,
        messageTone: 'success',
        tech: `${techSummary}\n${built.payload.selector}`,
        mode: 'done',
        iconTone: 'ok'
      })
      window.setTimeout(() => {
        if (active === current) teardown()
      }, 2200)
      return
    }

    const state = typeof response.state === 'string' ? response.state : 'retry'
    const reason = typeof response.reason === 'string' && response.reason ? response.reason : ''
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

    if (state === 'site_not_open') {
      current.confirmButton.textContent = TEXTS.retrySend
    } else if (state === 'retry') {
      current.confirmButton.textContent = TEXTS.retryConnect
    }

    showPanel(current, {
      title: titleText,
      detail: humanSummary(current.element, current.field),
      message,
      messageTone: 'error',
      tech: reason ? `${techSummary}\nNeden: ${reason}` : techSummary,
      mode: 'error',
      iconTone: 'error'
    })
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
    if (current.hovered === resolved) return
    current.hovered = resolved
    current.ui.toolbarHint.textContent = TEXTS.toolbarHint
    current.ui.toolbarHint.style.color = current.ui.theme.muted
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
    if (!isUserEvent(event)) {
      blockEvent(event)
      return
    }
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

    // Check category compatibility before freezing: keep user in selection mode
    // with a clear notice if the clicked element does not match target field.
    const expected = current.field === 'button' ? 'button' : 'input'
    const info = ENGINE.getElementInfo(resolved)
    if (info.category !== expected) {
      current.hovered = resolved
      paintSelection(current, resolved, 'hover')
      current.ui.toolbarHint.textContent = TEXTS.toolbarIncompatible
      current.ui.toolbarHint.style.color = current.ui.theme.warnText
      return
    }

    current.frozen = true
    current.element = resolved
    current.hovered = resolved
    current.confirmButton.textContent = TEXTS.confirm
    paintSelection(current, resolved, 'selected')
    showPanel(current, {
      title: current.field === 'button' ? TEXTS.confirmTitleButton : TEXTS.confirmTitleInput,
      detail: humanSummary(resolved, current.field),
      message: null,
      messageTone: 'info',
      tech: describeElement(resolved),
      mode: 'confirm',
      iconTone: 'ok'
    })
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
    current.ui.toolbarHint.textContent = TEXTS.toolbarHint
    current.ui.toolbarHint.style.color = current.ui.theme.muted
  }

  function initSession(config) {
    if (!ENGINE || typeof ENGINE.generateLocatorBundle !== 'function') {
      return
    }
    if (config.startHref && config.startHref !== window.location.href) {
      return
    }
    disposeSession()
    const field = config.field === 'button' ? 'button' : 'input'
    const ui = createUi(field)
    const current = {
      sessionId: config.sessionId,
      field,
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
      startHref: window.location.href,
      confirmButton: ui.confirmButton,
      reselectButton: ui.reselectButton
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
      if (current.frozen && current.element) paintSelection(current, current.element, 'selected')
      else if (current.hovered) schedulePaint(current, current.hovered)
    })
    listenPassive(window, 'resize', () => {
      if (current.frozen && current.element) paintSelection(current, current.element, 'selected')
      else if (current.hovered) schedulePaint(current, current.hovered)
    })
    const onUnload = () => {
      sendToWorker({ type: 'selector_pick_cancelled', sessionId: current.sessionId })
      teardown()
    }
    window.addEventListener('beforeunload', onUnload)
    current.listeners.push([window, 'beforeunload', onUnload, undefined])

    const cancelAll = (event) => {
      if (!isUserEvent(event)) return
      if (current.sessionId) {
        sendToWorker({ type: 'selector_pick_cancelled', sessionId: current.sessionId })
      }
      teardown()
    }

    ui.toolbarCancelBtn.addEventListener('click', cancelAll)
    ui.cancelButton.addEventListener('click', cancelAll)
    ui.confirmButton.addEventListener('click', (event) => {
      if (!isUserEvent(event)) return
      void confirmSelection(current)
    })
    ui.reselectButton.addEventListener('click', (event) => {
      if (!isUserEvent(event)) return
      resetToHover(current)
    })
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
        startHref: typeof message.startHref === 'string' ? message.startHref : ''
      })
    }
    chrome.runtime.onMessage.addListener(messageListener)
  }
})()
