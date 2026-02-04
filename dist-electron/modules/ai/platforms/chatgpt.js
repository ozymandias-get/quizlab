"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com',
    partition: 'persist:ai_chatgpt', // Isolated storage
    icon: 'chatgpt',
    color: '#10a37f',
    selectors: {
        input: null,
        button: null,
        waitFor: null
    },
    meta: {
        displayName: 'ChatGPT',
        submitMode: 'mixed', // Enter or Click
        domainRegex: '^https://(chat\\.)?chatgpt\\.com(/(c|g)/[a-zA-Z0-9-]+)?/?(\\?.*)?$'
    }
};
