import { describe, expect, it } from 'vitest'
import { classifyAuthProbe, sanitizeUrl } from '../../../features/gemini-web-session/authHeuristics'

const emptySnapshot = {
    hasLoginForm: false,
    hasComposer: false,
    hasChallengeText: false,
    hasSignInText: false
}

describe('gemini web auth heuristics', () => {
    it('classifies accounts redirect as login redirect', () => {
        const result = classifyAuthProbe('https://accounts.google.com/signin/v2', emptySnapshot, false)
        expect(result.kind).toBe('login_redirect')
        expect(result.healthy).toBe(false)
    })

    it('keeps normal google password step as login redirect', () => {
        const result = classifyAuthProbe('https://accounts.google.com/v3/signin/challenge/pwd', {
            ...emptySnapshot,
            hasLoginForm: true
        }, false)
        expect(result.kind).toBe('login_redirect')
        expect(result.healthy).toBe(false)
    })

    it('classifies challenge text as challenge', () => {
        const result = classifyAuthProbe('https://accounts.google.com', {
            ...emptySnapshot,
            hasChallengeText: true
        }, false)
        expect(result.kind).toBe('challenge')
    })

    it('classifies gemini composer as authenticated', () => {
        const result = classifyAuthProbe('https://gemini.google.com/app', {
            ...emptySnapshot,
            hasComposer: true
        }, false)
        expect(result.kind).toBe('authenticated')
        expect(result.healthy).toBe(true)
    })

    it('classifies network failures as network', () => {
        const result = classifyAuthProbe('https://gemini.google.com/app', emptySnapshot, true)
        expect(result.kind).toBe('network')
    })

    it('sanitizes query and hash fragments from url logs', () => {
        const sanitized = sanitizeUrl('https://gemini.google.com/app?token=secret#fragment')
        expect(sanitized).toBe('https://gemini.google.com/app')
    })
})
