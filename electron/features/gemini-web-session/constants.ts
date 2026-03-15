import type { DomProbeSnapshot } from './authHeuristics'
import {
  GOOGLE_AI_WEB_APPS,
  PRIMARY_GOOGLE_AI_WEB_APP
} from '../../../shared/constants/google-ai-web-apps'

export const GEMINI_HOME_URL = PRIMARY_GOOGLE_AI_WEB_APP.url
export const GOOGLE_AI_WEB_APP_URLS = GOOGLE_AI_WEB_APPS.map((app) => app.url)
export const GOOGLE_SIGNIN_URL = 'https://accounts.google.com/ServiceLogin'

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
