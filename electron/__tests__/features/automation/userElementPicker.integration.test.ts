import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generatePickerScript } from '@electron/features/automation/userElementPicker'

type PickerWindow = Window & {
    _aiPickerResult?: { input: string | null; button: string | null } | null
    _aiPickerCleanup?: () => void
}

describe('userElementPicker integration', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        document.body.innerHTML = ''
        document.head.innerHTML = ''
    })

    afterEach(() => {
        vi.useRealTimers()
        const w = window as PickerWindow
        if (w._aiPickerCleanup) {
            try {
                w._aiPickerCleanup()
            } catch {
                // no-op
            }
        }
        delete w._aiPickerResult
    })

    it('captures input and send button on Gemini-like shadow DOM composer', async () => {
        const host = document.createElement('div')
        const shadow = host.attachShadow({ mode: 'open' })
        document.body.appendChild(host)

        const richTextarea = document.createElement('rich-textarea')
        const textbox = document.createElement('div')
        textbox.setAttribute('role', 'textbox')
        textbox.setAttribute('contenteditable', 'true')
        richTextarea.appendChild(textbox)

        const sendButton = document.createElement('button')
        sendButton.setAttribute('aria-label', 'Send message')

        shadow.appendChild(richTextarea)
        shadow.appendChild(sendButton)

        const script = generatePickerScript()
        // execute generated in-page picker script
        // eslint-disable-next-line no-eval
        eval(script)

        textbox.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, composed: true }))
        textbox.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }))

        const nextBtn = document.getElementById('_ai_picker_next_btn')
        expect(nextBtn).not.toBeNull()
        nextBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

        sendButton.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, composed: true }))
        sendButton.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }))

        vi.advanceTimersByTime(900)
        await Promise.resolve()

        const pickerResult = (window as PickerWindow)._aiPickerResult
        expect(pickerResult).toBeTruthy()
        expect(pickerResult?.input).toBeTruthy()
        expect(pickerResult?.button).toBeTruthy()
    })
})
