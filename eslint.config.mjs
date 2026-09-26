import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import prettierConfig from 'eslint-config-prettier'
import electronPlugin from 'eslint-plugin-electron'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import noSecrets from 'eslint-plugin-no-secrets'
import prettierPlugin from 'eslint-plugin-prettier'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import securityPlugin from 'eslint-plugin-security'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import unicornPlugin from 'eslint-plugin-unicorn'
import globals from 'globals'

const legacySrcAliasPattern = {
  group: ['@src/*'],
  message: 'Do not use @src/* alias. Use @app, @features, @shared, @shared-core, @platform or @ui.'
}

/**
 * Sub-entrypoints a feature may expose in addition to its root barrel.
 *
 * The rule of thumb is "everything under a feature root is private except
 * the barrel", but two patterns are legitimately public and are documented
 * as such by the feature that owns them:
 *
 *   - heavy lazy-load chunks, so a dynamic import does not pull the whole
 *     feature into the caller's chunk
 *   - zero-runtime type-only modules
 *
 * Anything not listed here (hooks/, lib/, model/, store/, ui/, queries/,
 * capture/, constants/, ...) is an implementation detail and must be
 * re-exported from the feature barrel instead.
 *
 * NOTE: keep this list explicit rather than a regex on directory names.
 * A denylist of directory names silently rots — it did not cover store/,
 * queries/, constants/, capture/, text/, viewport/, interaction/ or
 * errors/, which is exactly how the deep imports below got in.
 */
const PUBLIC_FEATURE_ENTRYPOINTS = [
  'ai/webview', // lazy chunk: the <webview> host component
  'pdf/viewer', // lazy chunk: PdfViewer + tab strip + worker host
  'pdf/types', // type-only, no runtime cost
  'screenshot/tool' // lazy chunk: ScreenshotTool (depends on @app/providers)
]

const publicEntryAlternatives = PUBLIC_FEATURE_ENTRYPOINTS.map((entry) =>
  entry.replace('/', '\\/')
).join('|')

/**
 * Matches any `@features/<feature>/<sub>` that is not an approved
 * sub-entrypoint. The bare barrel `@features/<feature>` never matches,
 * which is the point: it is the public API.
 */
const featureInternalImportPattern = {
  regex: `^@features/(?!${publicEntryAlternatives}(?:/|$))[^/]+/`,
  message:
    'Feature internals are private. Import from the @features/<feature> barrel, ' +
    'or add a documented sub-entrypoint to PUBLIC_FEATURE_ENTRYPOINTS in eslint.config.mjs.'
}

/** Same scope as the static rule above, for `import()` expressions. */
const featureInternalImportSelector =
  `ImportExpression[source.value=/^@features\\/[^/]+\\//u]` +
  `:not([source.value=/^@features\\/(?:${publicEntryAlternatives})(?:\\/|$)/u])`

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
      'coverage/**',
      '*.json',
      '.dependency-cruiser.cjs'
    ]
  },
  prettierConfig,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    ignores: ['**/*.config.mjs', '**/*.config.ts', '**/*.config.cjs', '**/*.config.js'],
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
      'jsx-a11y': jsxA11y,
      'no-secrets': noSecrets,
      react: reactPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      security: securityPlugin,
      prettier: prettierPlugin,
      unicorn: unicornPlugin,
      'simple-import-sort': simpleImportSort
    },
    settings: {
      react: { version: 'detect' }
    },
    rules: {
      'no-restricted-imports': ['error', { patterns: [legacySrcAliasPattern] }],
      'react/no-danger': 'warn',
      'prettier/prettier': 'error',
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^\0'],
            ['^node:'],
            ['^@shared-core'],
            ['^@electron', '^@platform'],
            ['^@features'],
            ['^@(app|ui|shared)($|/)'],
            ['^@?\\w'],
            ['^\\.\\.', '^\\.']
          ]
        }
      ],
      'simple-import-sort/exports': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'error',
      'react/self-closing-comp': 'error',
      'react/jsx-boolean-value': 'error',
      'react/no-unescaped-entities': 'error',
      'react/hook-use-state': 'error',
      'react/jsx-key': ['error', { checkFragmentShorthand: true, checkKeyMustBeforeSpread: true }],
      'react/no-array-index-key': 'warn',
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/no-autofocus': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/no-redundant-roles': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-secrets/no-secrets': [
        'error',
        {
          tolerance: 4.5
        }
      ],
      'unicorn/consistent-destructuring': 'error',
      'unicorn/no-for-each': 'error',
      'unicorn/no-instanceof-builtins': 'error',
      'unicorn/no-typeof-undefined': 'error',
      'unicorn/no-unnecessary-polyfills': 'error',
      'unicorn/no-useless-spread': 'error',
      'unicorn/prefer-array-flat': 'error',
      'unicorn/prefer-array-some': 'error',
      'unicorn/prefer-includes': 'error',
      'unicorn/prefer-logical-operator-over-ternary': 'error',
      'unicorn/prefer-negative-index': 'error',
      'unicorn/prefer-native-coercion-functions': 'error',
      'unicorn/prefer-optional-catch-binding': 'error',
      'unicorn/prefer-set-size': 'error',
      'unicorn/prefer-spread': 'error',
      'unicorn/prefer-string-replace-all': 'warn',
      'unicorn/prefer-string-trim-start-end': 'error',
      'unicorn/throw-new-error': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  },
  {
    files: ['**/*.config.mjs', '**/*.config.ts', '**/*.config.cjs', '**/*.config.js'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'no-secrets': noSecrets,
      prettier: prettierPlugin,
      unicorn: unicornPlugin,
      'simple-import-sort': simpleImportSort
    },
    rules: {
      'prettier/prettier': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-secrets/no-secrets': ['error', { tolerance: 4.5 }],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'unicorn/consistent-destructuring': 'error',
      'unicorn/no-for-each': 'error',
      'unicorn/no-instanceof-builtins': 'error',
      'unicorn/no-typeof-undefined': 'error',
      'unicorn/no-unnecessary-polyfills': 'error',
      'unicorn/no-useless-spread': 'error',
      'unicorn/prefer-array-flat': 'error',
      'unicorn/prefer-array-some': 'error',
      'unicorn/prefer-includes': 'error',
      'unicorn/prefer-logical-operator-over-ternary': 'error',
      'unicorn/prefer-negative-index': 'error',
      'unicorn/prefer-native-coercion-functions': 'error',
      'unicorn/prefer-optional-catch-binding': 'error',
      'unicorn/prefer-set-size': 'error',
      'unicorn/prefer-spread': 'error',
      'unicorn/prefer-string-replace-all': 'warn',
      'unicorn/prefer-string-trim-start-end': 'error',
      'unicorn/throw-new-error': 'error'
    }
  },
  {
    // Single block on purpose. A second `src/**/*` block used to redefine
    // `no-restricted-imports` and silently drop the feature-internal patterns
    // (flat config replaces a rule wholesale, it does not merge options), so
    // the architecture rule looked configured but never ran.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/features/**/*', 'src/__tests__/**/*'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            legacySrcAliasPattern,
            featureInternalImportPattern,
            {
              regex: '^electron(/|$)',
              message:
                'Renderer must not import Electron directly. Use the preload bridge via @platform/electron.'
            }
          ]
        }
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: featureInternalImportSelector,
          message: featureInternalImportPattern.message
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
            featureInternalImportPattern,
            {
              group: ['electron', 'electron/*', '@electron/*'],
              message:
                'shared-core must stay platform-agnostic. Do not import Electron modules here.'
            }
          ]
        }
      ],
      'no-restricted-syntax': [
        'warn',
        {
          selector: featureInternalImportSelector,
          message: featureInternalImportPattern.message
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
  },
  {
    files: ['electron/core/logger.ts', 'src/shared/lib/logger.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  {
    files: ['src/shared/i18n/locales/_index.ts'],
    rules: {
      'no-console': ['error', { allow: ['warn'] }]
    }
  },
  {
    files: ['**/*.test.*', '**/*.spec.*', '**/__tests__/**'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'simple-import-sort/imports': 'off',
      'simple-import-sort/exports': 'off',
      'jsx-a11y/alt-text': 'off',
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      'unicorn/no-null': 'off',
      'unicorn/no-for-each': 'off',
      'unicorn/consistent-destructuring': 'off',
      'unicorn/prefer-set-size': 'off',
      'unicorn/prefer-array-some': 'off',
      'unicorn/prefer-includes': 'off'
    }
  },
  {
    files: [
      'src/features/ai/ui/AiSession.tsx',
      'src/features/pdf/ui/components/GoogleDrivePanel.tsx',
      'electron/app/index.ts',
      'src/app/components/ui/sparkles.tsx',
      'src/features/ai/lib/aiSenderSupport.ts'
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  {
    files: ['scripts/**'],
    rules: {
      'no-console': 'off'
    }
  },
  {
    files: ['src/**/*/icons/**', 'src/**/*Icon*', 'src/app/components/ui/sparkles.tsx'],
    rules: {
      'jsx-a11y/alt-text': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
      'jsx-a11y/click-events-have-key-events': 'off'
    }
  }
]
