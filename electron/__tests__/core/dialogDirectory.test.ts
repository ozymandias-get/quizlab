import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/home/u/Documents')
  }
}))

describe('dialogDirectory', () => {
  // The module keeps the last used directory in memory, so every case needs a
  // fresh instance or the first-use fallback would be untestable.
  beforeEach(() => {
    vi.resetModules()
  })

  it('falls back to the documents directory before anything is remembered', async () => {
    const { getDefaultDialogDirectory } = await import('../../core/dialogDirectory.js')

    expect(getDefaultDialogDirectory()).toBe('/home/u/Documents')
  })

  it('returns the directory of the remembered selection', async () => {
    const { getDefaultDialogDirectory, rememberDialogDirectory } =
      await import('../../core/dialogDirectory.js')
    rememberDialogDirectory('/home/u/Pictures/a.pdf')

    expect(getDefaultDialogDirectory()).toBe('/home/u/Pictures')
  })

  it('returns the most recently remembered directory', async () => {
    const { getDefaultDialogDirectory, rememberDialogDirectory } =
      await import('../../core/dialogDirectory.js')
    rememberDialogDirectory('/home/u/Pictures/a.pdf')
    rememberDialogDirectory('/home/u/Downloads/b.pdf')

    expect(getDefaultDialogDirectory()).toBe('/home/u/Downloads')
  })

  it('ignores a bare filename so it cannot poison the default with "."', async () => {
    const { getDefaultDialogDirectory, rememberDialogDirectory } =
      await import('../../core/dialogDirectory.js')

    expect(() => rememberDialogDirectory('a.pdf')).not.toThrow()
    expect(getDefaultDialogDirectory()).toBe('/home/u/Documents')
  })

  it('does not carry state across module instances', async () => {
    const first = await import('../../core/dialogDirectory.js')
    first.rememberDialogDirectory('/home/u/Pictures/a.pdf')
    expect(first.getDefaultDialogDirectory()).toBe('/home/u/Pictures')

    vi.resetModules()
    const second = await import('../../core/dialogDirectory.js')

    expect(second.getDefaultDialogDirectory()).toBe('/home/u/Documents')
  })
})
