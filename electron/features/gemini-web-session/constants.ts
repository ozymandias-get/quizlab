import type { DomProbeSnapshot } from './authHeuristics'

export const GEMINI_HOME_URL = 'https://gemini.google.com/app'
export const GOOGLE_SIGNIN_URL = `https://accounts.google.com/ServiceLogin?continue=${encodeURIComponent(GEMINI_HOME_URL)}`

export const DOM_SNAPSHOT_SCRIPT = `
(() => {
  const text = (document.body?.innerText || '').toLowerCase();
  const hasLoginForm = Boolean(
    document.querySelector('input[type="email"], input[type="password"], [name="identifier"], form[action*="signin"], [aria-label*="email"]')
  );
  const hasComposer = Boolean(
    document.querySelector('textarea, [contenteditable="true"][role="textbox"], div[role="textbox"]')
  );
  const hasChallengeText = [
    'verify it\\'s you',
    'verify it is you',
    '2-step verification',
    'two-step verification',
    'captcha',
    'security key',
    '2 ad\\u0131ml\\u0131 do\\u011frulama',
    'g\\u00fcvenlik anahtar\\u0131',
    'siz oldu\\u011funuzu do\\u011frulay\\u0131n'
  ].some((token) => text.includes(token));
  const hasSignInText = text.includes('sign in') || text.includes('signin') || text.includes('log in') || text.includes('oturum a\\u00e7') || text.includes('giri\\u015f yap');
  return { hasLoginForm, hasComposer, hasChallengeText, hasSignInText };
})()
`

export const EMPTY_DOM_SNAPSHOT: DomProbeSnapshot = {
  hasLoginForm: false,
  hasComposer: false,
  hasChallengeText: false,
  hasSignInText: false
}
