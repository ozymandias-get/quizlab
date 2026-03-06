import { describe, expect, it } from 'vitest'
import { hasCompletedGoogleLogin, type ExternalBrowserCookie } from '../../../features/gemini-web-session/playwrightLogin'

const sessionCookies: ExternalBrowserCookie[] = [
    {
        name: 'SID',
        value: 'secret',
        domain: 'accounts.google.com',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax'
    }
]

describe('gemini web playwright login completion', () => {
    it('accepts myaccount landing with valid cookies even if sign-in text exists', () => {
        const completed = hasCompletedGoogleLogin(
            'https://myaccount.google.com/',
            {
                hasLoginForm: false,
                hasSignInText: true,
                hasChallengeText: false
            },
            sessionCookies
        )

        expect(completed).toBe(true)
    })

    it('accepts clean accounts landing with valid cookies', () => {
        const completed = hasCompletedGoogleLogin(
            'https://accounts.google.com/',
            {
                hasLoginForm: false,
                hasSignInText: false,
                hasChallengeText: false
            },
            sessionCookies
        )

        expect(completed).toBe(true)
    })

    it('accepts generic google landing with valid cookies', () => {
        const completed = hasCompletedGoogleLogin(
            'https://www.google.com/',
            {
                hasLoginForm: false,
                hasSignInText: true,
                hasChallengeText: false
            },
            sessionCookies
        )

        expect(completed).toBe(true)
    })

    it('still rejects accounts page when sign-in text is present', () => {
        const completed = hasCompletedGoogleLogin(
            'https://accounts.google.com/ServiceLogin',
            {
                hasLoginForm: false,
                hasSignInText: true,
                hasChallengeText: false
            },
            sessionCookies
        )

        expect(completed).toBe(false)
    })

    it('rejects post-login hosts when session cookies are missing', () => {
        const completed = hasCompletedGoogleLogin(
            'https://myaccount.google.com/',
            {
                hasLoginForm: false,
                hasSignInText: true,
                hasChallengeText: false
            },
            []
        )

        expect(completed).toBe(false)
    })

    it('rejects post-login hosts when a challenge is shown', () => {
        const completed = hasCompletedGoogleLogin(
            'https://myaccount.google.com/',
            {
                hasLoginForm: false,
                hasSignInText: false,
                hasChallengeText: true
            },
            sessionCookies
        )

        expect(completed).toBe(false)
    })
})
