export default {
    id: 'qwen',
    name: 'Qwen',
    url: 'https://chat.qwenlm.ai',
    partition: 'persist:ai_qwen',
    icon: 'qwen',
    color: '#6366f1',
    selectors: {
        input: null,
        button: null,
        waitFor: null
    },
    meta: {
        displayName: 'Qwen',
        submitMode: 'click',
        domainRegex: '^https://chat\\.(qwenlm|qwen)\\.ai(/chat(/[a-zA-Z0-9]+)?)?/?$'
    }
}
