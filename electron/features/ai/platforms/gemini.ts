import { GOOGLE_AI_WEB_SESSION_PARTITION } from '../../../../shared/constants/google-ai-web-apps'

export default {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com/app',
    partition: GOOGLE_AI_WEB_SESSION_PARTITION,
    icon: 'gemini',
    color: '#f9ab00',
    selectors: {
        input: 'div[contenteditable=\"true\"][role=\"textbox\"], div[role=\"textbox\"]',
        button: 'button[aria-label*=\"Send\" i], button[aria-label*=\"Gonder\" i], button[data-test-id*=\"send\" i]',
        waitFor: 'div[role=\"textbox\"], textarea'
    },
    meta: {
        displayName: 'Gemini',
        submitMode: 'mixed',
        domainRegex: '^https://gemini\\.google\\.com(/.*)?$'
    }
}
