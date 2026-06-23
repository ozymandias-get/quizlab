import type { DomProbeSnapshot } from '@electron/features/gemini-web-session/authHeuristics'
import {
  classifyAuthProbe,
  isGoogleLoginRedirectUrl
} from '@electron/features/gemini-web-session/authHeuristics'

import { describe, expect, it } from 'vitest'

const defaultSnapshot: DomProbeSnapshot = {
  hasLoginForm: false,
  hasComposer: false,
  hasChallengeText: false,
  hasSignInText: false
}

describe('isGoogleLoginRedirectUrl', () => {
  it('should return true for accounts.google.com servicelogin', () => {
    expect(isGoogleLoginRedirectUrl('https://accounts.google.com/servicelogin')).toBe(true)
  })

  it('should return true for v3/signin path', () => {
    expect(isGoogleLoginRedirectUrl('https://accounts.google.com/v3/signin')).toBe(true)
  })

  it('should return true for checkcookie path', () => {
    expect(isGoogleLoginRedirectUrl('https://accounts.google.com/checkcookie')).toBe(true)
  })

  it('should return true for interactivelogin path', () => {
    expect(isGoogleLoginRedirectUrl('https://accounts.google.com/interactivelogin')).toBe(true)
  })

  it('should return false for non-login hostname', () => {
    expect(isGoogleLoginRedirectUrl('https://example.com/servicelogin')).toBe(false)
  })

  it('should return false for non-login path', () => {
    expect(isGoogleLoginRedirectUrl('https://accounts.google.com/other')).toBe(false)
  })

  it('should return false for invalid URL', () => {
    expect(isGoogleLoginRedirectUrl('not-a-url')).toBe(false)
  })

  it('should return false for empty string', () => {
    expect(isGoogleLoginRedirectUrl('')).toBe(false)
  })
})

describe('classifyAuthProbe', () => {
  it('should return network on network error', () => {
    const result = classifyAuthProbe('https://gemini.google.com/app', defaultSnapshot, true)
    expect(result.kind).toBe('network')
    expect(result.healthy).toBe(false)
  })

  it('should return challenge for challenge host', () => {
    const result = classifyAuthProbe('https://challenge.google.com/x', defaultSnapshot, false)
    expect(result.kind).toBe('challenge')
    expect(result.healthy).toBe(false)
  })

  it('should return challenge for sorry.google.com', () => {
    const result = classifyAuthProbe('https://sorry.google.com/x', defaultSnapshot, false)
    expect(result.kind).toBe('challenge')
  })

  it('should return login_redirect for accounts.google.com servicelogin', () => {
    const result = classifyAuthProbe(
      'https://accounts.google.com/servicelogin',
      defaultSnapshot,
      false
    )
    expect(result.kind).toBe('login_redirect')
    expect(result.healthy).toBe(false)
  })

  it('should return challenge on login URL with challenge text but no form/signin', () => {
    const snapshot = { ...defaultSnapshot, hasChallengeText: true }
    const result = classifyAuthProbe('https://accounts.google.com/servicelogin', snapshot, false)
    expect(result.kind).toBe('challenge')
  })

  it('should return challenge when URL has challenge text regardless of URL', () => {
    const snapshot = { ...defaultSnapshot, hasChallengeText: true }
    const result = classifyAuthProbe('https://random.example.com/page', snapshot, false)
    expect(result.kind).toBe('challenge')
  })

  it('should return login_redirect when app host has login form', () => {
    const snapshot = { ...defaultSnapshot, hasLoginForm: true }
    const result = classifyAuthProbe('https://gemini.google.com/app', snapshot, false)
    expect(result.kind).toBe('login_redirect')
  })

  it('should return login_redirect when app host has sign-in text', () => {
    const snapshot = { ...defaultSnapshot, hasSignInText: true }
    const result = classifyAuthProbe('https://gemini.google.com/app', snapshot, false)
    expect(result.kind).toBe('login_redirect')
  })

  it('should return authenticated for gemini with composer on health path', () => {
    const snapshot = { ...defaultSnapshot, hasComposer: true }
    const result = classifyAuthProbe('https://gemini.google.com/app', snapshot, false)
    expect(result.kind).toBe('authenticated')
    expect(result.healthy).toBe(true)
  })

  it('should return login_redirect when generic host has login form', () => {
    const snapshot = { ...defaultSnapshot, hasLoginForm: true }
    const result = classifyAuthProbe('https://example.com/page', snapshot, false)
    expect(result.kind).toBe('login_redirect')
  })

  it('should return login_redirect when generic host has sign-in text', () => {
    const snapshot = { ...defaultSnapshot, hasSignInText: true }
    const result = classifyAuthProbe('https://example.com/page', snapshot, false)
    expect(result.kind).toBe('login_redirect')
  })

  it('should return unknown for unmatched conditions', () => {
    const result = classifyAuthProbe('https://example.com/page', defaultSnapshot, false)
    expect(result.kind).toBe('unknown')
    expect(result.healthy).toBe(false)
  })

  it('should return authenticated for aistudio with composer on health path', () => {
    const snapshot = { ...defaultSnapshot, hasComposer: true }
    const result = classifyAuthProbe('https://aistudio.google.com/prompts/x', snapshot, false)
    expect(result.kind).toBe('authenticated')
    expect(result.healthy).toBe(true)
  })
})
