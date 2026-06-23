/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Döngüsel bağımlılıklara izin verme',
      from: {},
      to: {
        circular: true
      }
    },
    {
      name: 'no-teeny-uncrossable-boundaries',
      severity: 'error',
      comment: 'Feature modülleri birbirini iç import ile import etmemeli',
      from: {
        path: '^src/features/[^/]+/'
      },
      to: {
        path: '^src/features/[^/]+/',
        pathNot: '^src/features/[^/]+/index\\.ts'
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
      severity: 'warn',
      comment: 'Electron main process renderer alias import etmemeli',
      from: {
        path: '^electron/'
      },
      to: {
        path: '^@(app|features|shared|ui|platform)/'
      }
    },
    {
      name: 'no-nodejs-from-browser',
      severity: 'error',
      comment: 'Browser kodu Node.js modülü import etmemeli',
      from: {
        path: '^src/'
      },
      to: {
        path: '^(fs|path|child_process|os|crypto|net|http|https|stream|events|buffer|util|assert|url|querystring|zlib|tls|cluster|dgram|dns|readline|repl|vm|v8|worker_threads)$'
      }
    }
  ],
  allowed: [],
  options: {
    tsPreCompilationDeps: false,
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
