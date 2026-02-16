import type { AiPlatform } from '@shared/types'

const kimi: AiPlatform = {
    id: 'kimi',
    name: 'Kimi',
    url: 'https://kimi.com',
    partition: 'persist:ai_kimi',
    icon: 'kimi',
    color: '#ff6b6b',
    selectors: {
        input: 'textarea[placeholder*="Message"], textarea[placeholder*="message"], div[contenteditable="true"]',
        button: 'button[type="submit"], .send-button, [data-testid="send-button"]',
        waitFor: 'textarea, div[contenteditable="true"]'
    },
    meta: {
        displayName: 'Kimi',
        submitMode: 'enter',
        domainRegex: '^https://(kimi\\.moonshot\\.cn|kimi\\.com)(/chat(/[a-zA0-9]+)?)?/?$',
        imageWaitTime: 1000
    }
}

export default kimi
