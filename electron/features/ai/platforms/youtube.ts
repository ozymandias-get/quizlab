import { GOOGLE_AI_WEB_SESSION_PARTITION } from '../../../../shared/constants/google-ai-web-apps'

export default {
    id: 'youtube',
    name: 'YouTube',
    url: 'https://www.youtube.com/',
    partition: GOOGLE_AI_WEB_SESSION_PARTITION,
    isSite: true,
    icon: 'youtube',
    color: '#ff0033',
    meta: {
        displayName: 'YouTube',
        domainRegex: '^https://(www\\.)?youtube\\.com(/.*)?$'
    }
}
