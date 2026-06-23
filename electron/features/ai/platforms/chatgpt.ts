export default {
  id: 'chatgpt',
  name: 'ChatGPT',
  url: 'https://chatgpt.com',
  partition: 'persist:ai_chatgpt',
  icon: 'chatgpt',
  color: '#10a37f',
  selectors: {
    input: null,
    button: null,
    waitFor: null
  },
  meta: {
    displayName: 'ChatGPT',
    submitMode: 'mixed',
    domainRegex: '^https://(chat\\.)?chatgpt\\.com(/.*)?$'
  }
}
