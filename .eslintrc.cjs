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
  }
]

module.exports = {
  root: true,
  env: {
    browser: true,
    es2023: true,
    node: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  settings: {
    react: {
      version: 'detect'
    },
    'import/resolver': {
      typescript: {
        project: ['./tsconfig.json', './tsconfig.app.json', './tsconfig.node.json'],
        alwaysTryTypes: true
      }
    }
  },
  plugins: ['@typescript-eslint', 'react-refresh'],
  ignorePatterns: ['dist/', 'release/', 'node_modules/', '.cache/', '.agent/'],
  rules: {
    'no-restricted-imports': ['error', { patterns: [legacySrcAliasPattern] }]
  },
  overrides: [
    {
      files: ['src/**/*.{ts,tsx}'],
      excludedFiles: ['src/features/**/*', 'src/__tests__/**/*'],
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
  ]
}
