import type {
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
