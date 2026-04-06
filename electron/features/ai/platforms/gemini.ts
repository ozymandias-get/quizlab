import { GOOGLE_AI_WEB_SESSION_PARTITION } from '../../../../shared/constants/google-ai-web-apps'

export default {
  id: 'gemini',
  name: 'Gemini',
  url: 'https://gemini.google.com/app',
  partition: GOOGLE_AI_WEB_SESSION_PARTITION,
  icon: 'gemini',
  color: '#f9ab00',
  selectors: {
    input:
      'div.ql-editor[role=\"textbox\"], rich-textarea textarea, rich-textarea div[contenteditable=\"true\"][role=\"textbox\"], div[contenteditable=\"true\"][role=\"textbox\"], div[role=\"textbox\"], textarea[placeholder*=\"Message\" i], textarea[placeholder*=\"Ask\" i], textarea',
    button:
      'button.send-button, button[aria-label*=\"Send\" i], button[aria-label*=\"Send message\" i], button[aria-label*=\"Gönder\" i], button[aria-label*=\"Gonder\" i], [role=\"button\"][aria-label*=\"Send\" i], [role=\"button\"][aria-label*=\"Gönder\" i], [role=\"button\"][aria-label*=\"Gonder\" i], button[data-test-id*=\"send\" i], button[data-testid*=\"send\" i], [data-testid*=\"send\" i][role=\"button\"], button[mattooltip*=\"Send\" i], button[mattooltip*=\"Gonder\" i]',
    waitFor:
      'div.ql-editor[role=\"textbox\"], rich-textarea textarea, div[role=\"textbox\"], textarea'
  },
  meta: {
    displayName: 'Gemini',
    submitMode: 'mixed',
    domainRegex: '^https://(www\\.)?gemini\\.google\\.com(/.*)?$'
  }
}
