export default {
    id: 'claude',
    name: 'Claude',
    url: 'https://claude.ai',
    partition: 'persist:ai_claude',
    icon: 'claude',
    color: '#d97757',
    selectors: {
        input: null,
        button: null,
        waitFor: null
    },
    meta: {
        displayName: 'Claude',
        submitMode: 'click',
        domainRegex: '^https://claude\\.ai/(chat|new)(/[a-zA-Z0-9-]+)?/?$'
    }
}
