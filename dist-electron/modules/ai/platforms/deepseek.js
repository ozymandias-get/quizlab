"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com',
    partition: 'persist:ai_deepseek',
    icon: 'deepseek',
    color: '#4285f4',
    selectors: {
        input: null,
        button: null,
        waitFor: null
    },
    meta: {
        displayName: 'DeepSeek',
        submitMode: 'mixed',
        domainRegex: '^https://chat\\.deepseek\\.com(/chat(/[a-zA-Z0-9]+)?)?/?$',
        imageWaitTime: 2000
    }
};
