import { spawnSync } from 'child_process'

const result = spawnSync('npx', ['vite', 'build'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, ELECTRON: '1' }
})

process.exit(result.status ?? 0)
