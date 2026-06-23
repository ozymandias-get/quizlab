import path from 'path'
import { fileURLToPath } from 'url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export const viteAliases: Record<string, string> = {
  '@app': path.resolve(rootDir, 'src/app'),
  '@shared': path.resolve(rootDir, 'src/shared'),
  '@shared-core': path.resolve(rootDir, 'shared'),
  '@electron': path.resolve(rootDir, 'electron'),
  '@ui': path.resolve(rootDir, 'src/shared/ui'),
  '@features': path.resolve(rootDir, 'src/features'),
  '@platform': path.resolve(rootDir, 'src/platform')
}
