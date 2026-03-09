import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    generateAutoSendScript,
    generateClickSendScript,
    generateFocusScript
} from '@electron/features/automation/automationScripts'

describe('automationScripts', () => {
    beforeEach(() => {
        document.body.innerHTML = ''
        delete (window as typeof window & { __quizlabAutomationCache?: unknown }).__quizlabAutomationCache
    })

    it('generates auto-send script with diagnostics and cache helpers', () => {
        const script = generateAutoSendScript(
            { input: '[role="textbox"]', button: 'button[aria-label*="send" i]', submitMode: 'mixed' },
            'hello',
            true
        )

        expect(script).toContain('createDiagnostics')
        expect(script).toContain('__quizlabAutomationCache')
        expect(script).toContain('waitForElement')
        expect(script).toContain('diagnostics')
    })

    it('generates focus script that resolves inner input controls', () => {
        const script = generateFocusScript({ input: 'rich-textarea' })
        expect(script).toContain('waitForElement')
        expect(script).toContain("createDiagnostics('focus'")
    })

    it('generates click script with button fallback resolution', () => {
        const script = generateClickSendScript({ input: '[role="textbox"]', submitMode: 'mixed' })
        expect(script).toContain('performSubmit')
        expect(script).toContain("createDiagnostics('click_send'")
    })

    it('reuses cached input elements across repeated sends', async () => {
        document.body.innerHTML = `
            <textarea id="input"></textarea>
            <button id="send" type="button">Send</button>
        `

        const script = generateAutoSendScript(
            { input: '#input', button: '#send', submitMode: 'click' },
            'hello',
            false
        )
        const querySpy = vi.spyOn(document, 'querySelector')

        const firstResult = await window.eval(script)
        const queryCountAfterFirstRun = querySpy.mock.calls.length
        const secondResult = await window.eval(script)

        expect(firstResult.success).toBe(true)
        expect(secondResult.success).toBe(true)
        expect(firstResult.diagnostics.input.strategy).toBe('direct')
        expect(secondResult.diagnostics.input.strategy).toBe('cache')
        expect(secondResult.diagnostics.input.cacheHits).toBeGreaterThan(0)
        expect(querySpy.mock.calls.length).toBe(queryCountAfterFirstRun)
    })

    it('invalidates cached selectors when the old element is detached', async () => {
        document.body.innerHTML = `
            <textarea id="input"></textarea>
            <button id="send" type="button">Send</button>
        `

        const script = generateAutoSendScript(
            { input: '#input', button: '#send', submitMode: 'click' },
            'hello',
            false
        )
        const querySpy = vi.spyOn(document, 'querySelector')

        await window.eval(script)
        const previousQueryCount = querySpy.mock.calls.length

        const previousInput = document.getElementById('input')
        previousInput?.remove()
        const replacementInput = document.createElement('textarea')
        replacementInput.id = 'input'
        document.body.prepend(replacementInput)

        const secondResult = await window.eval(script)

        expect(secondResult.success).toBe(true)
        expect(secondResult.diagnostics.input.cacheInvalidations).toBeGreaterThan(0)
        expect(secondResult.diagnostics.input.strategy).toBe('direct')
        expect(querySpy.mock.calls.length).toBeGreaterThan(previousQueryCount)
    })
})
