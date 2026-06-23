export default {
  id: 'm365',
  name: 'M365 Copilot',
  url: 'https://m365.cloud.microsoft/chat',
  partition: 'persist:ai_m365',
  icon: 'copilot',
  color: '#00a4ef',
  selectors: {
    input: null,
    button: null,
    waitFor: null
  },
  meta: {
    displayName: 'M365 Copilot',
    submitMode: 'mixed',
    domainRegex: '^https://m365\\.cloud\\.microsoft/chat(/.*)?(\\?.*)?$',
    imageWaitTime: 2000
  }
}
