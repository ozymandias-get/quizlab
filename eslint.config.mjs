import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import reactPlugin from 'eslint-plugin-react';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

const legacySrcAliasPattern = {
    group: ['@src/*'],
    message: 'Do not use @src/* alias. Use @app, @features, @shared, @shared-core, @platform or @ui.'
};

const featureInternalImportPatterns = [
    {
        group: ['@features/*/ui', '@features/*/ui/*'],
        message: 'Feature internals are private. Import via @features/<feature> public API.'
    },
    {
        group: ['@features/*/model', '@features/*/model/*'],
        message: 'Feature internals are private. Import via @features/<feature> public API.'
    },
    {
        group: ['@features/*/api', '@features/*/api/*'],
        message: 'Feature internals are private. Import via @features/<feature> public API.'
    }
];

export default [
    {
        ignores: ['dist/**', 'release/**', 'node_modules/**', '.cache/**', '.agent/**', 'out.txt']
    },
    {
        files: ['**/*.{js,mjs,cjs,ts,tsx}'],
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2023,
            sourceType: 'module',
            parserOptions: {
                ecmaFeatures: { jsx: true }
            },
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            'react': reactPlugin,
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            'no-restricted-imports': ['error', { patterns: [legacySrcAliasPattern] }]
        },
    },
    {
        files: ['src/**/*.{ts,tsx}'],
        ignores: ['src/features/**/*', 'src/__tests__/**/*'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [legacySrcAliasPattern, ...featureInternalImportPatterns]
                }
            ],
            'no-restricted-syntax': [
                'error',
                {
                    selector: 'ImportExpression[source.value=/^@features\\/[^/]+\\/(ui|model|api)(\\/.*)?$/]',
                    message: 'Feature internals are private. Use dynamic import from @features/<feature> public API.'
                }
            ]
        }
    },
    {
        files: ['shared/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': [
                'warn',
                {
                    patterns: [
                        legacySrcAliasPattern,
                        {
                            group: ['electron', 'electron/*', '@electron/*'],
                            message: 'shared-core must stay platform-agnostic. Do not import Electron modules here.'
                        }
                    ]
                }
            ],
            'no-restricted-globals': [
                'warn',
                {
                    name: 'window',
                    message: 'shared-core should not depend on DOM globals.'
                },
                {
                    name: 'document',
                    message: 'shared-core should not depend on DOM globals.'
                }
            ]
        }
    }
];
