import { describe, expect, it } from 'vitest'
import { buildElectronCookiePayload } from '../../../features/gemini-web-session/sessionCookies'

describe('gemini web session cookie import', () => {
    it('preserves host-only cookies by omitting domain', () => {
        const payload = buildElectronCookiePayload({
            name: 'SID',
            value: 'secret',
            domain: 'accounts.google.com',
            path: '/',
            secure: true,
            httpOnly: true,
            sameSite: 'Lax',
            expires: 1_900_000_000
        })

        expect(payload).toMatchObject({
            url: 'https://accounts.google.com/',
            name: 'SID',
            value: 'secret',
            path: '/',
            secure: true,
            httpOnly: true,
            sameSite: 'lax',
            expirationDate: 1_900_000_000
        })
        expect(payload).not.toHaveProperty('domain')
    })

    it('keeps broad domain cookies when source already uses dot-prefixed domain', () => {
        const payload = buildElectronCookiePayload({
            name: 'SAPISID',
            value: 'secret',
            domain: '.google.com',
            path: '/',
            secure: true,
            httpOnly: false,
            sameSite: 'None'
        })

        expect(payload).toMatchObject({
            url: 'https://google.com/',
            domain: '.google.com',
            sameSite: 'no_restriction'
        })
    })

    it('uses unspecified sameSite when source does not provide one', () => {
        const payload = buildElectronCookiePayload({
            name: 'HSID',
            value: 'secret',
            domain: 'accounts.google.com',
            path: '/',
            secure: true,
            httpOnly: true
        })

        expect(payload?.sameSite).toBe('unspecified')
    })
})
