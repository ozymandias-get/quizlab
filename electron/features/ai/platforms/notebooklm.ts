import { GOOGLE_AI_WEB_SESSION_PARTITION } from '../../../../shared/constants/google-ai-web-apps'

export default {
    id: 'notebooklm',
    name: 'NotebookLM',
    url: 'https://notebooklm.google.com/',
    partition: GOOGLE_AI_WEB_SESSION_PARTITION,
    icon: 'notebooklm',
    color: '#34a853',
    selectors: {
        input: 'textarea, div[contenteditable=\"true\"][role=\"textbox\"], div[role=\"textbox\"]',
        button: 'button[aria-label*=\"Send\" i], button[aria-label*=\"Submit\" i], button[title*=\"Send\" i], button[aria-label*=\"Gonder\" i]',
        waitFor: 'textarea, div[role=\"textbox\"]'
    },
    meta: {
        displayName: 'NotebookLM',
        submitMode: 'mixed',
        domainRegex: '^https://notebooklm\\.google\\.com(/.*)?$'
    }
}
