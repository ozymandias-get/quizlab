/**
 * Feature modules reachable from outside a feature.
 *
 * Everything else under a feature root is private. Keep in sync with
 * PUBLIC_FEATURE_ENTRYPOINTS in eslint.config.mjs.
 */
const PUBLIC_FEATURE_ENTRYPOINTS = [
  'ai/aiViewSurface',
  'ai/viewState',
  'pdf/viewer',
  'pdf/types',
  'screenshot/tool'
]

const FEATURE_NAMES = [
  'ai',
  'automation',
  'onboarding',
  'pdf',
  'screenshot',
  'settings',
  'tutorial'
]

/**
 * One rule per ordered feature pair.
 *
 * dependency-cruiser has no backreferences, so "A must not reach into B,
 * for every A != B" cannot be written as a single regex. The previous
 * `no-teeny-uncrossable-boundaries` rule tried to express that with
 * `^src/features/[^/]+/` on both sides, which also matches A -> A: it
 * flagged 368 ordinary intra-feature imports (ui/ importing model/,
 * hooks/ importing lib/, ...) that are perfectly legitimate. Because the
 * config's `options` block replaced depcruise's default exitCode, none of
 * those were ever surfaced. Generating the pairs keeps the real constraint
 * and leaves intra-feature imports alone.
 */
const crossFeatureRules = FEATURE_NAMES.flatMap((from) =>
  FEATURE_NAMES.filter((to) => to !== from).map((to) => ({
    name: `no-cross-feature-internals:${from}->${to}`,
    severity: 'error',
    comment: `"${from}" must reach "${to}" only through @features/${to}.`,
    from: { path: `^src/features/${from}/` },
    to: { path: `^src/features/${to}/`, pathNot: `^src/features/${to}/index\\.ts$` }
  }))
)

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Döngüsel bağımlılıklara izin verme (yalnızca first-party kod)',
      // Scoped away from node_modules on purpose. A direct dependency is
      // resolved into the graph even with --do-not-follow, so a cycle inside
      // a third-party package would otherwise fail the build. That is not
      // actionable here, and a gate that cries wolf gets ignored.
      from: {
        pathNot: '(^|/)node_modules/'
      },
      to: {
        circular: true
      }
    },
    ...crossFeatureRules,
    {
      name: 'app-no-feature-internals',
      severity: 'error',
      comment:
        'Feature internals are private. app/ ve shared/ yalnızca @features/<feature> barrel veya onaylı sub-entrypoint kullanabilir.',
      from: {
        path: '^(src/(app|shared)|shared)/'
      },
      to: {
        path: `^src/features/(?!${PUBLIC_FEATURE_ENTRYPOINTS.map((entry) =>
          entry.replace('/', '\\/')
        ).join('|')})[\\w-]+/(?!index\\.ts$)`
      }
    },
    {
      name: 'shared-no-app',
      severity: 'error',
      comment:
        'src/shared app katmanına bağımlı olamaz (App → Features → Shared). Bağımlılığı option olarak al veya modülü aşağı taşı.',
      from: {
        path: '^src/shared/'
      },
      to: {
        path: '^src/app/'
      }
    },
    {
      name: 'shared-core-no-electron',
      severity: 'error',
      comment: 'shared-core Electron import etmemeli',
      from: {
        path: '^shared/'
      },
      to: {
        path: 'electron',
        pathNot: '^shared/'
      }
    },
    {
      name: 'renderer-no-electron-direct',
      severity: 'error',
      comment: 'Renderer doğrudan electron import etmemeli',
      from: {
        path: '^src/'
      },
      to: {
        path: '^electron/',
        pathNot: '^src/platform/electron'
      }
    },
    {
      name: 'electron-no-renderer',
      severity: 'error',
      comment:
        'Electron main process renderer katmanına bağımlı olamaz. `to` çözümlenmiş src/ yollarına bakar: alias yazımı (@features/…) depcruise tarafından src/features/… olarak çözümlendiği için ^@… deseni hiçbir şeyi yakalayamazdı. Tek istisna runtime-agnostik logger shimi (src/shared/lib/logger.ts); electron/core/logger.ts + diskLogger.ts onu relative path ile re-export eder, bkz. src/shared/lib/logger.ts:6.',
      from: {
        path: '^electron/'
      },
      to: {
        path: '^src/(app|features|shared|platform)/',
        pathNot: '^src/shared/lib/logger\\.ts$'
      }
    },
    {
      name: 'no-nodejs-from-browser',
      severity: 'error',
      comment: 'Browser kodu Node.js modülü import etmemeli',
      from: {
        path: '^src/',
        pathNot: '(^src/__tests__/|\\.test\\.(ts|tsx)$)'
      },
      to: {
        path: '^(fs|path|child_process|os|crypto|net|http|https|stream|events|buffer|util|assert|url|querystring|zlib|tls|cluster|dgram|dns|readline|repl|vm|v8|worker_threads)$'
      }
    }
  ],
  allowed: [],
  options: {
    // `false` would drop every pre-compilation-only edge, which is to say every
    // `import type` — and a cycle made only of type imports is invisible without
    // them. This graph held two: `shared/types/index.ts -> ipcContract.ts ->
    // electronApi.ts` and `src/shared/hooks/index.ts -> useConfirmDialog.ts ->
    // confirm-dialog.tsx -> dialog.tsx`. Turning it on grows the graph from 1131
    // to 1138 modules / 3548 to 4200 edges and keeps it green.
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json'
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types']
    },
    progress: {
      type: 'cli-feedback'
    }
  }
}
