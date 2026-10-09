import { spawnSync } from 'child_process'

const result = spawnSync('npx', ['vite', 'build'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, ELECTRON: '1' }
})

if (result.error) {
  console.error(`[build:renderer:electron] could not run vite build: ${result.error.message}`)
  process.exit(1)
}

process.exit(result.status ?? 1)
