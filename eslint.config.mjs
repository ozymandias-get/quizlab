import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import reactPlugin from 'eslint-plugin-react'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import securityPlugin from 'eslint-plugin-security'
import electronPlugin from 'eslint-plugin-electron'
import prettierPlugin from 'eslint-plugin-prettier'
import prettierConfig from 'eslint-config-prettier'

const legacySrcAliasPattern = {
  group: ['@src/*'],
  message: 'Do not use @src/* alias. Use @app, @features, @shared, @shared-core, @platform or @ui.'
}

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
  },
  {
    group: ['@features/*/hooks', '@features/*/hooks/*'],
    message: 'Feature internals are private. Import via @features/<feature> public API.'
  },
  {
    group: ['@features/*/lib', '@features/*/lib/*'],
    message: 'Feature internals are private. Import via @features/<feature> public API.'
  }
]

export default [
  {
    ignores: [
      'dist/**',
      'release/**',
      'node_modules/**',
      '.cache/**',
      '.agent/**',
      'out.txt',
      'build/**',
      'coverage/**'
    ]
  },
  prettierConfig,
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
        ...globals.node
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      security: securityPlugin,
      prettier: prettierPlugin
    },
    rules: {
      'no-restricted-imports': ['error', { patterns: [legacySrcAliasPattern] }],
      'react/no-danger': 'warn',
      'prettier/prettier': 'error'
    }
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
          selector:
            'ImportExpression[source.value=/^@features\\/[^/]+\\/(ui|model|api|hooks|lib)(\\/.*)?$/]',
          message:
            'Feature internals are private. Use dynamic import from @features/<feature> public API.'
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
              message:
                'shared-core must stay platform-agnostic. Do not import Electron modules here.'
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
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            legacySrcAliasPattern,
            {
              regex: '^electron(/|$)',
              message:
                'Renderer must not import Electron directly. Use the preload bridge via @platform/electron.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['electron/**/*.{js,mjs,cjs,ts,tsx}'],
    plugins: {
      electron: electronPlugin
    },
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['@features/*', '@shared/*', '@app/*', '@platform/*', '@ui/*'],
              message:
                'Electron main process must not import renderer aliases. Use relative paths or @electron.'
            }
          ]
        }
      ]
    }
  }
]
