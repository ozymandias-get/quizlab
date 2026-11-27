/**
 * The magic selector a user runs on a normal Chrome tab.
 *
 * Injected on demand when the user starts a pick from the Side Panel. Lives in
 * a closed Shadow DOM with inline styles only (CSP-safe, zero external assets)
 * and removes every listener, overlay and piece of state on completion or cancel.
 *
 * Supports two modes:
 *   - `single`: pick & verify one locator (`input` or `button`) for re-picks;
 *   - `guided`: Master-parity 3-stage setup (`input` -> safe `typing` -> `submit` -> `review`)
 *     that transfers both verified locators together without ever submitting test text.
 */
;(() => {
  'use strict'

  const ENGINE = globalThis.QuizlabSelectorEngine
  const UI_ATTRIBUTE = 'data-quizlab-picker-ui'

  const TEXTS = {
    toolbarTitleInput: 'Sihirli Seçici · Mesaj giriş alanı',
    toolbarTitleButton: 'Sihirli Seçici · Gönderme butonu',
    toolbarGuidedInput: 'Adım 1/3 · Mesaj giriş alanını seçin',
    toolbarGuidedTyping: 'Adım 2/3 · Deneme metni yazın (gönderilmeyecek)',
    toolbarGuidedButton: 'Adım 3/3 · Gönderme butonunu seçin',
    toolbarHintInput: 'Mesaj yazdığınız alanın üzerine gelip tıklayın.',
    toolbarHintTyping: 'Seçilen kutuya kısa bir metin yazın; gönderme butonu görününce geçin.',
    toolbarHintButton: 'Şimdi gönderme butonunun üzerine gelip tıklayın.',
    toolbarHint: 'Alanı seçmek için üzerine gel ve tıkla.',
    toolbarIncompatible: 'Bu alan uygun değil. Lütfen doğru alanı seçin.',
    toolbarTypingOutside: 'Lütfen yalnızca seçili mesaj giriş alanına yazın.',
    nextToButton: 'Buton Seçimine Geç',
    confirmTitleInput: 'Mesaj giriş alanı seçildi',
    confirmTitleButton: 'Gönderme butonu seçildi',
    confirmTitlePair: 'Kurulum tamamlanmaya hazır',
    confirmSubtitle: 'Seçilen alanı QuizLab’a gönderip doğrulayabilirsiniz.',
    confirmSubtitlePair: 'İki seçim doğrulandıktan sonra birlikte kaydedilir.',
    confirm: 'QuizLab’a Gönder',
    confirmPair: 'QuizLab’a Aktar',
    retrySend: 'Tekrar Gönder',
    retryConnect: 'Tekrar Dene',
    reselect: 'Yeniden Seç',
    reselectInput: 'Giriş Alanını Seç',
    reselectButton: 'Butonu Seç',
    cancel: 'İptal',
    close: 'Kapat',
    sending: 'QuizLab’da doğrulanıyor…',
    savedInput: 'Mesaj giriş alanı kaydedildi.',
    savedButton: 'Gönderme butonu kaydedildi.',
    savedPair: 'Giriş alanı ve gönderme butonu kaydedildi.',
    siteNotOpen: 'Bu siteyi QuizLab’da aç ve tekrar dene.',
    verificationFailed: 'Bu element QuizLab’da doğrulanamadı. Önceki selektör korunuyor.',
    verificationNotFound:
      'Seçilen element QuizLab’daki sayfada bulunamadı. Önceki selektör korunuyor.',
    verificationEmptyComposer:
      'QuizLab’daki mesaj alanı boş olduğu için gönderme butonu henüz DOM’da görünmüyor. QuizLab’daki mesaj kutusuna deneme metni yazıp (göndermeden) tekrar deneyin.',
    verificationMismatch:
      'Chrome’daki seçim QuizLab’daki elementle uyuşmuyor (farklı buton/mikrofon/ekleme kontrolü olabilir). Önceki selektör korunuyor.',
    verificationInsufficient:
      'Elementin kimliği QuizLab’da yeterince doğrulanamadı. Daha belirgin bir alan seçin.',
    verificationAmbiguous: 'QuizLab’da birden fazla benzer element eşleşti; seçim ayırt edilemedi.',
    verificationNavigated: 'Doğrulama sırasında QuizLab sayfası değişti. Tekrar deneyin.',
    verificationCleanupFailed:
      'Doğrulama güvenli biçimde tamamlanamadı. QuizLab’daki mesaj alanını kontrol edip yeniden deneyin. Önceki selektörleriniz korundu.',
    verificationSiteMismatch: 'QuizLab’da açık sayfa bu siteyle eşleşmiyor.',
    unpaired: 'QuizLab ile eşleştirme gerekli. Yan panelden eşleştirin.',
    rejected: 'Aktarım QuizLab tarafından reddedildi.',
    retry: 'QuizLab bağlantısı kurulamadı.',
    wrongKind: 'Bu alan hedef türüyle uyumlu değil. Doğru alanı seçin.',
    noSelector: 'Bu element için güvenilir bir seçici üretilemedi. Farklı bir element deneyin.',
    unsupported: 'Bu element erişilemeyen bir çerçeve veya kapalı Shadow DOM içinde.',
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
    if (!element || element.nodeType !== 1) return ''
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
    if (!element || element.nodeType !== 1) return TEXTS.confirmSubtitle
    const aria = shortValue(element.getAttribute('aria-label'), 48)
    if (aria) return aria
    const placeholder = shortValue(element.getAttribute('placeholder'), 48)
    if (placeholder) return placeholder
    const title = shortValue(element.getAttribute('title'), 48)
    if (title) return title
    const text = shortValue(element.textContent, 40)
    if (text && field === 'button') return `“${text}”`
    return element.tagName ? element.tagName.toLowerCase() : TEXTS.confirmSubtitle
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

    // 1. Hover / Active Highlight Box (zero transition on geometry for 1:1 rAF tracking)
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

    // Persistent highlight box for the selected input during typing / submit stages
    const selectedBox = document.createElement('div')
    selectedBox.style.cssText = [
      'position: fixed',
      'display: none',
      'box-sizing: border-box',
      'border: 2px solid #10b981',
      'border-radius: 6px',
      'background: rgba(16, 185, 129, 0.08)',
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

    const styleFocus = (btn) => {
      btn.addEventListener('focus', () => {
        btn.style.outline = `2px solid ${theme.ring}`
        btn.style.outlineOffset = '2px'
      })
      btn.addEventListener('blur', () => {
        btn.style.outline = 'none'
      })
    }

    const toolbarNextBtn = document.createElement('button')
    toolbarNextBtn.type = 'button'
    toolbarNextBtn.setAttribute('data-quizlab-action', 'next')
    toolbarNextBtn.textContent = TEXTS.nextToButton
    toolbarNextBtn.style.cssText = [
      'all: unset',
      'cursor: pointer',
      'display: none',
      'padding: 5px 10px',
      'border-radius: 7px',
      `background: ${theme.primaryBg}`,
      `color: ${theme.primaryText}`,
      'font: 600 11.5px/1 Inter, system-ui, -apple-system, Segoe UI, sans-serif',
      'flex-shrink: 0',
      'white-space: nowrap'
    ].join(';')
    styleFocus(toolbarNextBtn)

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

    const toolbarCancelBtn = document.createElement('button')
    toolbarCancelBtn.type = 'button'
    toolbarCancelBtn.setAttribute('data-quizlab-action', 'toolbar-cancel')
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

    toolbar.append(toolbarIcon, toolbarTextWrap, toolbarNextBtn, escBadge, toolbarCancelBtn)

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
      'width: min(440px, calc(100vw - 24px))',
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

    const panelReviewList = document.createElement('div')
    panelReviewList.style.cssText =
      'display: none; flex-direction: column; gap: 6px; margin-top: 10px;'

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
      'word-break: break-all',
      'white-space: pre-wrap'
    ].join(';')
    techDetails.append(techSummary, techBody)

    const buttons = document.createElement('div')
    buttons.style.cssText =
      'display: flex; align-items: center; gap: 8px; margin-top: 12px; flex-wrap: wrap;'

    const makeButton = (text, variant, actionName) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = text
      button.setAttribute('data-quizlab-action', actionName)
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

    const confirmButton = makeButton(TEXTS.confirm, 'primary', 'confirm')
    const reselectButton = makeButton(TEXTS.reselect, 'secondary', 'reselect')
    const reselectButtonBtn = makeButton(TEXTS.reselectButton, 'secondary', 'reselect-button')
    reselectButtonBtn.style.display = 'none'
    const cancelButton = makeButton(TEXTS.cancel, 'ghost', 'cancel')

    buttons.append(confirmButton, reselectButton, reselectButtonBtn, cancelButton)
    panel.append(panelHead, panelDetail, panelReviewList, panelMessage, techDetails, buttons)
    shadow.append(selectedBox, box, label, toolbar, panel)
    document.documentElement.appendChild(host)

    const ui = {
      theme,
      host,
      shadow,
      selectedBox,
      box,
      label,
      toolbar,
      toolbarTitle,
      toolbarHint,
      toolbarNextBtn,
      toolbarCancelBtn,
      panel,
      panelStatusIcon,
      panelTitle,
      panelDetail,
      panelReviewList,
      panelMessage,
      techDetails,
      techBody,
      confirmButton,
      reselectButton,
      reselectButtonBtn,
      cancelButton
    }
    if (globalThis.__quizlabPickerTestHandles === true) {
      globalThis.__quizlabPickerTestUi = ui
    }
    return ui
  }

  function clearTypingTimer(current) {
    if (current && current.typingTimer !== null) {
      window.clearTimeout(current.typingTimer)
      current.typingTimer = null
    }
  }

  function disposeSession() {
    const current = active
    if (!current) return
    active = null
    current.sendToken += 1
    clearTypingTimer(current)
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

  function clipRectToViewport(element) {
    if (!element || !element.isConnected || typeof element.getBoundingClientRect !== 'function') {
      return null
    }
    const rawRect = element.getBoundingClientRect()
    if (!rawRect || rawRect.width <= 0 || rawRect.height <= 0) return null
    const vw = window.innerWidth || document.documentElement.clientWidth || 0
    const vh = window.innerHeight || document.documentElement.clientHeight || 0
    const left = Math.max(0, rawRect.left)
    const top = Math.max(0, rawRect.top)
    const right = Math.min(vw, rawRect.right)
    const bottom = Math.min(vh, rawRect.bottom)
    const width = right - left
    const height = bottom - top
    if (width <= 0 || height <= 0) return null
    return { left, top, bottom, width, height, vw, vh }
  }

  function paintPersistentInputBox(current) {
    const { selectedBox } = current.ui
    const el = current.inputElement
    if (!el || current.mode !== 'guided') {
      selectedBox.style.display = 'none'
      return
    }
    const rect = clipRectToViewport(el)
    if (!rect) {
      selectedBox.style.display = 'none'
      return
    }
    selectedBox.style.display = 'block'
    selectedBox.style.left = `${rect.left}px`
    selectedBox.style.top = `${rect.top}px`
    selectedBox.style.width = `${Math.max(1, rect.width)}px`
    selectedBox.style.height = `${Math.max(1, rect.height)}px`
  }

  function paintSelection(current, element, mode) {
    const rect = clipRectToViewport(element)
    if (!rect) {
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
    box.style.left = `${rect.left}px`
    box.style.top = `${rect.top}px`
    box.style.width = `${Math.max(1, rect.width)}px`
    box.style.height = `${Math.max(1, rect.height)}px`

    const fieldText = current.field === 'button' ? 'Gönderme butonu' : 'Mesaj giriş alanı'
    label.style.display = 'inline-flex'
    if (visualState === 'saved') label.textContent = `✓ Kaydedildi · ${fieldText}`
    else if (visualState === 'selected') label.textContent = `● Seçilen · ${fieldText}`
    else if (visualState === 'compatible') label.textContent = `✓ ${fieldText}`
    else label.textContent = '! Bu alan uygun değil'

    const labelWidth = Math.min(260, label.offsetWidth || 160)
    const labelHeight = label.offsetHeight || 24
    const preferredTop = rect.top >= labelHeight + 70 ? rect.top - labelHeight - 6 : rect.bottom + 6
    const maxLeft = Math.max(4, rect.vw - labelWidth - 4)
    const maxTop = Math.max(4, rect.vh - labelHeight - 4)
    label.style.left = `${Math.min(Math.max(4, rect.left), maxLeft)}px`
    label.style.top = `${Math.min(Math.max(4, preferredTop), maxTop)}px`
  }

  function schedulePaint(current, element) {
    current.pending = element
    if (current.frame !== null) return
    current.frame = window.requestAnimationFrame(() => {
      current.frame = null
      if (!active || active !== current || current.frozen) return
      if (current.stage === 'typing') return
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

  function renderReviewCards(current) {
    const { panelReviewList, theme } = current.ui
    if (current.mode !== 'guided' || !current.inputPayload || !current.buttonPayload) {
      panelReviewList.style.display = 'none'
      panelReviewList.replaceChildren()
      return
    }
    const makeRow = (title, summary, selector) => {
      const row = document.createElement('div')
      row.style.cssText = [
        'display: flex',
        'flex-direction: column',
        'gap: 2px',
        'padding: 8px 10px',
        'border-radius: 8px',
        `background: ${theme.surface}`,
        `border: 1px solid ${theme.border}`
      ].join(';')
      const head = document.createElement('div')
      head.style.cssText =
        'display: flex; align-items: center; justify-content: space-between; gap: 8px;'
      const labelEl = document.createElement('span')
      labelEl.textContent = title
      labelEl.style.cssText = 'font-weight: 600; font-size: 12px;'
      const sumEl = document.createElement('span')
      sumEl.textContent = summary
      sumEl.style.cssText = `font-size: 11.5px; color: ${theme.muted}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`
      head.append(labelEl, sumEl)
      const selEl = document.createElement('div')
      selEl.textContent = selector
      selEl.style.cssText = `font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10.5px; color: ${theme.muted}; word-break: break-all;`
      row.append(head, selEl)
      return row
    }
    panelReviewList.replaceChildren(
      makeRow(
        'Mesaj giriş alanı',
        humanSummary(current.inputElement, 'input'),
        current.inputPayload.selector
      ),
      makeRow(
        'Gönderme butonu',
        humanSummary(current.buttonElement, 'button'),
        current.buttonPayload.selector
      )
    )
    panelReviewList.style.display = 'flex'
  }

  function showPanel(current, { title, detail, message, messageTone, tech, mode, iconTone }) {
    const { ui } = current
    positionPanelForElement(current, current.buttonElement || current.element)
    ui.panel.style.display = 'block'
    ui.panelTitle.textContent = title
    ui.panelDetail.textContent = detail
    ui.toolbar.style.display = 'none'
    renderReviewCards(current)

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

    if (mode === 'done') {
      ui.confirmButton.style.display = 'none'
      ui.reselectButton.style.display = 'none'
      ui.reselectButtonBtn.style.display = 'none'
    } else {
      ui.confirmButton.style.display = 'inline-flex'
      ui.reselectButton.style.display = 'inline-flex'
      if (current.mode === 'guided') {
        ui.reselectButton.textContent = TEXTS.reselectInput
        ui.reselectButtonBtn.style.display = 'inline-flex'
      } else {
        ui.reselectButton.textContent = TEXTS.reselect
        ui.reselectButtonBtn.style.display = 'none'
      }
    }
    ui.cancelButton.textContent = mode === 'done' ? TEXTS.close : TEXTS.cancel
    ui.cancelButton.style.display = 'inline-flex'
  }

  function hidePanel(current) {
    current.ui.panel.style.display = 'none'
    current.ui.panelReviewList.style.display = 'none'
    current.ui.toolbar.style.display = 'flex'
  }

  function updateToolbarForStage(current, hintOverride, isWarning) {
    const { ui } = current
    if (current.mode === 'guided') {
      if (current.stage === 'input') {
        ui.toolbarTitle.textContent = TEXTS.toolbarGuidedInput
        ui.toolbarHint.textContent = hintOverride || TEXTS.toolbarHintInput
        ui.toolbarNextBtn.style.display = 'none'
      } else if (current.stage === 'typing') {
        ui.toolbarTitle.textContent = TEXTS.toolbarGuidedTyping
        ui.toolbarHint.textContent = hintOverride || TEXTS.toolbarHintTyping
        ui.toolbarNextBtn.style.display = 'inline-flex'
      } else {
        ui.toolbarTitle.textContent = TEXTS.toolbarGuidedButton
        ui.toolbarHint.textContent = hintOverride || TEXTS.toolbarHintButton
        ui.toolbarNextBtn.style.display = 'none'
      }
    } else {
      ui.toolbarTitle.textContent =
        current.field === 'button' ? TEXTS.toolbarTitleButton : TEXTS.toolbarTitleInput
      ui.toolbarHint.textContent = hintOverride || TEXTS.toolbarHint
      ui.toolbarNextBtn.style.display = 'none'
    }
    ui.toolbarHint.style.color = isWarning ? ui.theme.warnText : ui.theme.muted
  }

  function isElementVisible(el) {
    if (!el || !el.isConnected) return false
    try {
      const style = window.getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') return false
      if (typeof el.getBoundingClientRect === 'function') {
        const rect = el.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      }
    } catch {
      return false
    }
    return true
  }

  function hasDistinguishingIdentity(fp) {
    if (!fp || typeof fp !== 'object') return false
    if (fp.dataTestId || fp.safeId || fp.name || fp.ariaLabel || fp.placeholder || fp.text) {
      return true
    }
    if (fp.role || fp.type || fp.contentEditable === true) return true
    if (Array.isArray(fp.classTokens) && fp.classTokens.length > 0) return true
    if (Array.isArray(fp.localPath) && fp.localPath.length > 0) return true
    return false
  }

  function safeMatches(element, selector) {
    try {
      return Boolean(element && typeof element.matches === 'function' && element.matches(selector))
    } catch {
      return false
    }
  }

  /**
   * Builds a verified selector bundle for `element` using the shared
   * `QuizlabSelectorEngine` rules (matching Master's `generateLocatorBundle`
   * + Electron runtime lookup contract).
   */
  function buildPayloadForElement(element, field) {
    if (!element || !element.isConnected) return { error: 'detached' }
    if (element.ownerDocument !== document) return { error: 'unsupported' }
    const rootNode = typeof element.getRootNode === 'function' ? element.getRootNode() : document
    if (!rootNode || typeof rootNode.querySelectorAll !== 'function') {
      return { error: 'unsupported' }
    }

    const expected = field === 'input' ? 'input' : 'button'
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
    // 1. Prefer an exact unique selector in the element's root (document or open shadow root).
    for (const candidate of candidates) {
      try {
        const matches = rootNode.querySelectorAll(candidate)
        if (matches.length === 1 && matches[0] === element) {
          primary = candidate
          break
        }
      } catch {
        // Ignore invalid candidate.
      }
    }

    // 2. Responsive DOM fallback: if duplicates exist (e.g. hidden mobile/desktop twin),
    //    accept the first candidate where `element` is the sole visible match.
    if (!primary) {
      for (const candidate of candidates) {
        try {
          const matches = [...rootNode.querySelectorAll(candidate)]
          if (!matches.includes(element)) continue
          const visibleMatches = matches.filter(isElementVisible)
          if (visibleMatches.length === 1 && visibleMatches[0] === element) {
            primary = candidate
            break
          }
        } catch {
          // Ignore invalid candidate.
        }
      }
    }

    // 3. Master parity: if runtime fingerprint disambiguation has distinguishing identity
    //    (e.g., generic CSS selector + ProseMirror/contenteditable/localPath/ariaLabel),
    //    accept the engine's primary selector (or first matching candidate).
    if (!primary && hasDistinguishingIdentity(bundle.fingerprint)) {
      if (safeMatches(element, bundle.primarySelector)) {
        primary = bundle.primarySelector
      } else {
        primary = candidates.find((candidate) => safeMatches(element, candidate)) || null
      }
    }

    if (!primary) return { error: 'noSelector' }
    if (!candidates.includes(primary)) candidates.unshift(primary)

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

  function buildPayload(current) {
    return buildPayloadForElement(current.element, current.field)
  }

  function errorText(code) {
    return TEXTS[code] || TEXTS.noSelector
  }

  function formatTransferError(response) {
    const state = typeof response.state === 'string' ? response.state : 'retry'
    const reason = typeof response.reason === 'string' && response.reason ? response.reason : ''
    const failedField =
      response.failedField === 'input' || response.failedField === 'button'
        ? response.failedField
        : ''
    const stagePrefix =
      failedField === 'input'
        ? '[Mesaj giriş alanı] '
        : failedField === 'button'
          ? '[Gönderme butonu] '
          : ''

    if (typeof response.message === 'string' && response.message) {
      return `${stagePrefix}${response.message}`
    }
    if (state === 'site_not_open') return TEXTS.siteNotOpen
    if (state === 'unpaired') return TEXTS.unpaired
    if (state === 'rejected') return `${stagePrefix}${TEXTS.rejected}`
    if (state === 'verification_failed') {
      if (reason === 'button_not_rendered_empty_composer') {
        return `${stagePrefix}${TEXTS.verificationEmptyComposer}`
      }
      if (reason === 'not_found') return `${stagePrefix}${TEXTS.verificationNotFound}`
      if (reason === 'identity_mismatch') return `${stagePrefix}${TEXTS.verificationMismatch}`
      if (reason === 'identity_insufficient')
        return `${stagePrefix}${TEXTS.verificationInsufficient}`
      if (reason === 'ambiguous') return `${stagePrefix}${TEXTS.verificationAmbiguous}`
      if (reason === 'view_navigated') return TEXTS.verificationNavigated
      if (reason === 'probe_cleanup_failed')
        return `${stagePrefix}${TEXTS.verificationCleanupFailed}`
      if (reason === 'view_site_mismatch') return TEXTS.verificationSiteMismatch
      return `${stagePrefix}${TEXTS.verificationFailed}`
    }
    return TEXTS.retry
  }

  /**
   * Focus a picked text control deterministically, placing the caret at the end
   * so existing draft text is preserved rather than overwritten.
   */
  function focusTextEntry(el) {
    if (!el) return
    try {
      const editable =
        typeof ENGINE.findTextEntryControl === 'function'
          ? ENGINE.findTextEntryControl(el) || el
          : el
      if (typeof editable.focus === 'function') editable.focus()
      if (editable.isContentEditable && typeof document.createRange === 'function') {
        const selection = document.getSelection ? document.getSelection() : null
        if (selection) {
          const range = document.createRange()
          range.selectNodeContents(editable)
          range.collapse(false)
          selection.removeAllRanges()
          selection.addRange(range)
        }
      }
    } catch {
      // Focus may fail in restricted environments; non-fatal.
    }
  }

  function isTargetInsideSelectedInput(current, target, path) {
    const selected = current.inputElement
    if (!selected || !target) return false
    if (target === selected) return true
    if (Array.isArray(path) && path.includes(selected)) return true
    try {
      if (
        selected.isConnected &&
        typeof selected.contains === 'function' &&
        selected.contains(target)
      ) {
        return true
      }
    } catch {
      // Ignore containment errors.
    }
    // Some editors dispatch input/beforeinput on their direct wrapper instead of the editable node.
    try {
      if (
        target !== selected &&
        target.isConnected &&
        typeof target.contains === 'function' &&
        target.contains(selected) &&
        target !== document.body &&
        target !== document.documentElement
      ) {
        return true
      }
    } catch {
      // Ignore wrapper check errors.
    }
    return false
  }

  function enterSubmitStage(current) {
    clearTypingTimer(current)
    current.stage = 'submit'
    current.field = 'button'
    current.frozen = false
    current.hovered = null
    updateToolbarForStage(current)
    paintPersistentInputBox(current)
  }

  function enterTypingStage(current) {
    clearTypingTimer(current)
    current.stage = 'typing'
    current.field = 'input'
    current.frozen = false
    current.hovered = null
    current.ui.box.style.display = 'none'
    current.ui.label.style.display = 'none'
    paintPersistentInputBox(current)
    updateToolbarForStage(current)
    focusTextEntry(current.inputElement)
  }

  function enterReviewStage(current) {
    clearTypingTimer(current)
    current.stage = 'review'
    current.frozen = true
    current.element = current.buttonElement
    current.hovered = current.buttonElement
    current.confirmButton.textContent = TEXTS.confirmPair
    paintPersistentInputBox(current)
    paintSelection(current, current.buttonElement, 'selected')
    showPanel(current, {
      title: TEXTS.confirmTitlePair,
      detail: TEXTS.confirmSubtitlePair,
      message: null,
      messageTone: 'info',
      tech: `${describeElement(current.inputElement)}\n${describeElement(current.buttonElement)}`,
      mode: 'confirm',
      iconTone: 'ok'
    })
  }

  async function confirmSelection(current) {
    if (current.sending) return

    if (current.mode === 'guided') {
      const rebuiltInput = buildPayloadForElement(current.inputElement, 'input')
      if (!rebuiltInput.payload) {
        showPanel(current, {
          title: TEXTS.confirmTitlePair,
          detail: TEXTS.confirmSubtitlePair,
          message: `[Mesaj giriş alanı] ${errorText(rebuiltInput.error)}`,
          messageTone: 'error',
          tech: describeElement(current.inputElement),
          mode: 'error',
          iconTone: 'error'
        })
        return
      }
      const rebuiltButton = buildPayloadForElement(current.buttonElement, 'button')
      if (!rebuiltButton.payload) {
        showPanel(current, {
          title: TEXTS.confirmTitlePair,
          detail: TEXTS.confirmSubtitlePair,
          message: `[Gönderme butonu] ${errorText(rebuiltButton.error)}`,
          messageTone: 'error',
          tech: describeElement(current.buttonElement),
          mode: 'error',
          iconTone: 'error'
        })
        return
      }
      current.inputPayload = rebuiltInput.payload
      current.buttonPayload = rebuiltButton.payload

      current.sending = true
      const token = (current.sendToken += 1)
      current.confirmButton.disabled = true
      current.confirmButton.setAttribute('aria-busy', 'true')
      current.confirmButton.style.opacity = '0.6'
      current.reselectButton.disabled = true
      current.reselectButtonBtn.disabled = true
      showPanel(current, {
        title: TEXTS.confirmTitlePair,
        detail: TEXTS.confirmSubtitlePair,
        message: TEXTS.sending,
        messageTone: 'info',
        tech: `Giriş: ${rebuiltInput.payload.selector}\nButon: ${rebuiltButton.payload.selector}`,
        mode: 'confirm',
        iconTone: 'ok'
      })

      const response = await sendToWorker({
        type: 'selector_pick_result',
        sessionId: current.sessionId,
        field: 'pair',
        payload: {
          input: rebuiltInput.payload,
          button: rebuiltButton.payload,
          sourceUrl: rebuiltButton.payload.sourceUrl || rebuiltInput.payload.sourceUrl
        }
      })

      if (active !== current || current.sendToken !== token) return

      current.sending = false
      current.confirmButton.disabled = false
      current.confirmButton.removeAttribute('aria-busy')
      current.confirmButton.style.opacity = '1'
      current.reselectButton.disabled = false
      current.reselectButtonBtn.disabled = false

      if (response.ok === true) {
        current.stage = 'done'
        paintPersistentInputBox(current)
        paintSelection(current, current.buttonElement, 'saved')
        showPanel(current, {
          title: TEXTS.savedPair,
          detail: TEXTS.confirmSubtitlePair,
          message: null,
          messageTone: 'success',
          tech: `Giriş: ${rebuiltInput.payload.selector}\nButon: ${rebuiltButton.payload.selector}`,
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
      if (state === 'site_not_open') current.confirmButton.textContent = TEXTS.retrySend
      else if (state === 'retry' || state === 'unreachable') {
        current.confirmButton.textContent = TEXTS.retryConnect
      }

      showPanel(current, {
        title: TEXTS.confirmTitlePair,
        detail: TEXTS.confirmSubtitlePair,
        message: formatTransferError(response),
        messageTone: 'error',
        tech: reason
          ? `Giriş: ${rebuiltInput.payload.selector}\nButon: ${rebuiltButton.payload.selector}\nNeden: ${reason}`
          : `Giriş: ${rebuiltInput.payload.selector}\nButon: ${rebuiltButton.payload.selector}`,
        mode: 'error',
        iconTone: 'error'
      })
      return
    }

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

    if (state === 'site_not_open') {
      current.confirmButton.textContent = TEXTS.retrySend
    } else if (state === 'retry' || state === 'unreachable') {
      current.confirmButton.textContent = TEXTS.retryConnect
    }

    showPanel(current, {
      title: titleText,
      detail: humanSummary(current.element, current.field),
      message: formatTransferError(response),
      messageTone: 'error',
      tech: reason ? `${techSummary}\nNeden: ${reason}` : techSummary,
      mode: 'error',
      iconTone: 'error'
    })
  }

  function startHover(current, event) {
    if (current.frozen || current.stage === 'typing') return
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
    updateToolbarForStage(current)
    schedulePaint(current, resolved)
  }

  function blockEvent(event) {
    if (isOwnUi(event.target)) return false
    if (typeof event.preventDefault === 'function') event.preventDefault()
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation()
    if (typeof event.stopPropagation === 'function') event.stopPropagation()
    return true
  }

  function isButtonControlTarget(raw, path) {
    if (!raw || raw.nodeType !== 1) return false
    try {
      const resolved = ENGINE.normalizeTargetForKind('button', raw, path)
      if (!resolved) return false
      const info = ENGINE.getElementInfo(resolved)
      return info.category === 'button'
    } catch {
      return false
    }
  }

  function onPointerPassThroughOrBlock(current, event) {
    if (isOwnUi(event.target)) return
    if (current.stage === 'typing') {
      const path = typeof event.composedPath === 'function' ? event.composedPath() : []
      const raw = elementOf(path[0] || event.target)
      if (
        raw &&
        isTargetInsideSelectedInput(current, raw, path) &&
        !isButtonControlTarget(raw, path)
      ) {
        return
      }
    }
    blockEvent(event)
  }

  function commitButtonPick(current, resolved) {
    if (current.mode === 'guided') {
      const built = buildPayloadForElement(resolved, 'button')
      if (!built.payload) {
        current.hovered = resolved
        paintSelection(current, resolved, 'hover')
        updateToolbarForStage(current, errorText(built.error), true)
        return
      }
      current.buttonElement = resolved
      current.buttonPayload = built.payload
      current.reselectMode = null
      enterReviewStage(current)
      return
    }

    current.frozen = true
    current.element = resolved
    current.hovered = resolved
    current.confirmButton.textContent = TEXTS.confirm
    paintSelection(current, resolved, 'selected')
    showPanel(current, {
      title: TEXTS.confirmTitleButton,
      detail: humanSummary(resolved, 'button'),
      message: null,
      messageTone: 'info',
      tech: describeElement(resolved),
      mode: 'confirm',
      iconTone: 'ok'
    })
  }

  function onPointerDown(current, event) {
    if (isOwnUi(event.target)) return
    const path = typeof event.composedPath === 'function' ? event.composedPath() : []
    const raw = elementOf(path[0] || event.target)

    if (current.stage === 'typing') {
      if (!isUserEvent(event)) {
        blockEvent(event)
        return
      }
      if (
        raw &&
        isTargetInsideSelectedInput(current, raw, path) &&
        !isButtonControlTarget(raw, path)
      ) {
        focusTextEntry(current.inputElement)
        return
      }
      blockEvent(event)
      if (event.button !== undefined && event.button !== 0) return
      if (!raw || !raw.isConnected) return
      // Re-bind if the SPA replaced the selected input node after focus/typing.
      if (
        (!current.inputElement || current.inputElement.isConnected === false) &&
        typeof ENGINE.isTextEntryControl === 'function'
      ) {
        const entry = ENGINE.normalizeTargetForKind('input', raw, path)
        if (entry && ENGINE.getElementInfo(entry).category === 'input') {
          const rebuilt = buildPayloadForElement(entry, 'input')
          if (rebuilt.payload) {
            current.inputElement = entry
            current.inputPayload = rebuilt.payload
            paintPersistentInputBox(current)
            focusTextEntry(entry)
            return
          }
        }
      }
      // If the user clicked a valid send button directly during typing stage, capture it.
      const maybeBtn = ENGINE.normalizeTargetForKind('button', raw, path)
      if (
        maybeBtn &&
        maybeBtn.nodeType === 1 &&
        ENGINE.getElementInfo(maybeBtn).category === 'button'
      ) {
        enterSubmitStage(current)
        commitButtonPick(current, maybeBtn)
        return
      }
      updateToolbarForStage(current, TEXTS.toolbarTypingOutside, true)
      return
    }

    if (!isUserEvent(event)) {
      blockEvent(event)
      return
    }
    const blocked = blockEvent(event)
    if (!blocked) return
    if (event.button !== undefined && event.button !== 0) return
    if (current.frozen) return
    if (!raw || !raw.isConnected) return

    let resolved
    try {
      resolved = ENGINE.normalizeTargetForKind(current.field, raw, path)
    } catch {
      resolved = null
    }
    if (!resolved || resolved.nodeType !== 1) return

    const expected = current.field === 'button' ? 'button' : 'input'
    const info = ENGINE.getElementInfo(resolved)
    if (info.category !== expected) {
      current.hovered = resolved
      paintSelection(current, resolved, 'hover')
      updateToolbarForStage(current, TEXTS.toolbarIncompatible, true)
      return
    }

    if (current.mode === 'guided') {
      if (current.field === 'input') {
        const built = buildPayloadForElement(resolved, 'input')
        if (!built.payload) {
          current.hovered = resolved
          paintSelection(current, resolved, 'hover')
          updateToolbarForStage(current, errorText(built.error), true)
          return
        }
        current.inputElement = resolved
        current.inputPayload = built.payload
        if (
          current.reselectMode === 'input' &&
          current.buttonPayload &&
          current.buttonElement?.isConnected
        ) {
          current.reselectMode = null
          enterReviewStage(current)
          return
        }
        current.reselectMode = null
        enterTypingStage(current)
        return
      }
      commitButtonPick(current, resolved)
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

  function scheduleTypingAdvance(current) {
    clearTypingTimer(current)
    current.typingTimer = window.setTimeout(() => {
      current.typingTimer = null
      if (!active || active !== current || current.stage !== 'typing') return
      enterSubmitStage(current)
    }, 150)
  }

  function handleTypingSignal(current, event) {
    if (current.stage !== 'typing' || current.frozen) return
    if (isOwnUi(event.target)) return
    const path = typeof event.composedPath === 'function' ? event.composedPath() : []
    const raw = elementOf(path[0] || event.target)
    if (!raw) return

    // SPA composer hydration may replace the picked node after focus.
    if (current.inputElement && current.inputElement.isConnected === false && raw.isConnected) {
      const candidate =
        typeof ENGINE.findTextEntryControl === 'function'
          ? ENGINE.findTextEntryControl(raw) || raw
          : raw
      if (typeof ENGINE.isTextEntryControl === 'function' && ENGINE.isTextEntryControl(candidate)) {
        const rebuilt = buildPayloadForElement(candidate, 'input')
        if (rebuilt.payload) {
          current.inputElement = candidate
          current.inputPayload = rebuilt.payload
          paintPersistentInputBox(current)
        }
      }
    }

    if (!isTargetInsideSelectedInput(current, raw, path)) return
    scheduleTypingAdvance(current)
  }

  function onKeyDown(current, event) {
    if (isOwnUi(event.target)) return
    const path = typeof event.composedPath === 'function' ? event.composedPath() : []
    const target = elementOf(path[0] || event.target)

    if (event.key === 'Escape') {
      if (!isUserEvent(event)) return
      blockEvent(event)
      sendToWorker({ type: 'selector_pick_cancelled', sessionId: current.sessionId })
      teardown()
      return
    }

    // NEVER let Enter submit a draft on the AI page while the picker is open.
    if (event.key === 'Enter' || event.key === 'NumpadEnter') {
      blockEvent(event)
      if (
        current.stage === 'typing' &&
        target &&
        isTargetInsideSelectedInput(current, target, path)
      ) {
        enterSubmitStage(current)
      }
      return
    }

    if (
      current.stage === 'typing' &&
      target &&
      isTargetInsideSelectedInput(current, target, path)
    ) {
      if (
        event.key === 'Tab' ||
        /^F\d+$/i.test(event.key || '') ||
        ((event.ctrlKey || event.metaKey || event.altKey) && event.key && event.key.length > 1)
      ) {
        blockEvent(event)
        return
      }
      if (
        typeof event.key === 'string' &&
        (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        scheduleTypingAdvance(current)
      }
      return
    }

    if (current.stage === 'typing') {
      blockEvent(event)
      return
    }

    const isButtonTarget =
      Boolean(target) &&
      (target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.getAttribute('role') === 'button' ||
        target.getAttribute('type') === 'submit')
    if (event.key === ' ' && isButtonTarget) {
      blockEvent(event)
    }
  }

  function onKeyUp(current, event) {
    if (isOwnUi(event.target)) return
    if (current.stage === 'typing') {
      handleTypingSignal(current, event)
      return
    }
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

  function resetToHover(current, targetField) {
    if (current.sending) return
    clearTypingTimer(current)
    current.sendToken += 1
    current.frozen = false
    current.element = null
    current.sending = false
    hidePanel(current)
    current.ui.box.style.display = 'none'
    current.ui.label.style.display = 'none'
    current.hovered = null

    if (current.mode === 'guided') {
      const nextField = targetField === 'input' ? 'input' : 'button'
      current.reselectMode = nextField
      current.field = nextField
      current.stage = nextField === 'input' ? 'input' : 'submit'
      current.confirmButton.textContent = TEXTS.confirmPair
      paintPersistentInputBox(current)
      updateToolbarForStage(current)
      return
    }

    current.confirmButton.textContent = TEXTS.confirm
    updateToolbarForStage(current)
  }

  function initSession(config) {
    if (!ENGINE || typeof ENGINE.generateLocatorBundle !== 'function') {
      return
    }
    if (config.startHref && config.startHref !== window.location.href) {
      return
    }
    disposeSession()
    const mode = config.mode === 'guided' || config.field === 'pair' ? 'guided' : 'single'
    const field = mode === 'guided' ? 'input' : config.field === 'button' ? 'button' : 'input'
    const ui = createUi(field)
    const current = {
      sessionId: config.sessionId,
      mode,
      stage: field,
      field,
      ui,
      listeners: [],
      abort: new AbortController(),
      hovered: null,
      element: null,
      inputElement: null,
      inputPayload: null,
      buttonElement: null,
      buttonPayload: null,
      reselectMode: null,
      typingTimer: null,
      pending: null,
      frame: null,
      frozen: false,
      sending: false,
      sendToken: 0,
      startHref: window.location.href,
      confirmButton: ui.confirmButton,
      reselectButton: ui.reselectButton,
      reselectButtonBtn: ui.reselectButtonBtn
    }
    active = current
    updateToolbarForStage(current)

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
    listen(window, 'pointerup', (event) => onPointerPassThroughOrBlock(current, event))
    listen(window, 'mousedown', (event) => onPointerPassThroughOrBlock(current, event))
    listen(window, 'mouseup', (event) => onPointerPassThroughOrBlock(current, event))
    listen(window, 'click', (event) => onPointerPassThroughOrBlock(current, event))
    listen(window, 'dblclick', (event) => blockEvent(event))
    listen(window, 'auxclick', (event) => blockEvent(event))
    listen(window, 'contextmenu', (event) => blockEvent(event))
    listen(window, 'submit', (event) => blockEvent(event))
    listen(window, 'dragstart', (event) => blockEvent(event))
    listen(window, 'drop', (event) => blockEvent(event))
    listen(window, 'keydown', (event) => onKeyDown(current, event))
    listen(window, 'keyup', (event) => onKeyUp(current, event))
    listen(window, 'beforeinput', (event) => handleTypingSignal(current, event))
    listen(window, 'input', (event) => handleTypingSignal(current, event))
    listen(window, 'compositionend', (event) => handleTypingSignal(current, event))
    listen(window, 'paste', (event) => handleTypingSignal(current, event))
    listenPassive(window, 'scroll', () => {
      paintPersistentInputBox(current)
      if (current.frozen && current.element) paintSelection(current, current.element, 'selected')
      else if (current.hovered && current.stage !== 'typing')
        schedulePaint(current, current.hovered)
    })
    listenPassive(window, 'resize', () => {
      paintPersistentInputBox(current)
      if (current.frozen && current.element) paintSelection(current, current.element, 'selected')
      else if (current.hovered && current.stage !== 'typing')
        schedulePaint(current, current.hovered)
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

    ui.toolbarNextBtn.addEventListener('click', (event) => {
      if (!isUserEvent(event)) return
      if (current.stage === 'typing') enterSubmitStage(current)
    })
    ui.toolbarCancelBtn.addEventListener('click', cancelAll)
    ui.cancelButton.addEventListener('click', cancelAll)
    ui.confirmButton.addEventListener('click', (event) => {
      if (!isUserEvent(event)) return
      void confirmSelection(current)
    })
    ui.reselectButton.addEventListener('click', (event) => {
      if (!isUserEvent(event)) return
      resetToHover(current, current.mode === 'guided' ? 'input' : current.field)
    })
    ui.reselectButtonBtn.addEventListener('click', (event) => {
      if (!isUserEvent(event)) return
      resetToHover(current, 'button')
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
        mode: message.mode,
        field: message.field,
        startHref: typeof message.startHref === 'string' ? message.startHref : ''
      })
    }
    chrome.runtime.onMessage.addListener(messageListener)
  }
})()
