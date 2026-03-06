import { GOOGLE_AI_WEB_SESSION_PARTITION } from '../../../../shared/constants/google-ai-web-apps'

export default {
    id: 'aistudio',
    name: 'AI Studio',
    url: 'https://aistudio.google.com/welcome',
    partition: GOOGLE_AI_WEB_SESSION_PARTITION,
    icon: 'aistudio',
    color: '#4285f4',
    selectors: {
        input: 'textarea, ms-autosize-textarea textarea, div[contenteditable=\"true\"][role=\"textbox\"], div[role=\"textbox\"]',
        button: 'button[aria-label*=\"Run\" i], button[aria-label*=\"Generate\" i], button[aria-label*=\"Send\" i], button[aria-label*=\"Submit\" i]',
        waitFor: 'textarea, ms-autosize-textarea textarea, div[role=\"textbox\"]'
    },
    meta: {
        displayName: 'AI Studio',
        submitMode: 'mixed',
        domainRegex: '^https://aistudio\\.google\\.com(/.*)?$'
    }
}
