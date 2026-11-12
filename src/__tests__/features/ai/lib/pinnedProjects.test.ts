import {
  createPinnedAiProject,
  PINNED_AI_PROJECT_LIMIT,
  readPinnedAiProjects,
  removePinnedAiProject,
  sanitizePinnedAiProjects,
  savePinnedAiProject
} from '@features/ai/lib/pinnedProjects'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'

import { beforeEach, describe, expect, it } from 'vitest'

function project(name: string, url = 'https://chatgpt.com/c/1', modelId = 'chatgpt') {
  const created = createPinnedAiProject(modelId, name, url)
  if (!created) throw new Error('expected a valid pinned project')
  return created
}

describe('pinned AI projects', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEYS.PINNED_AI_PROJECTS)
  })

  it('rejects empty names and non-http links', () => {
    expect(createPinnedAiProject('chatgpt', '   ', 'https://chatgpt.com/c/1')).toBeNull()
    expect(createPinnedAiProject('chatgpt', 'Project', 'file:///tmp/x')).toBeNull()
    expect(createPinnedAiProject('', 'Project', 'https://chatgpt.com/c/1')).toBeNull()
  })

  it('normalizes whitespace in the user name and strips URL fragments', () => {
    const created = createPinnedAiProject(
      'chatgpt',
      '  Biyoloji   sunumu ',
      'https://chatgpt.com/c/abc#section'
    )
    expect(created?.name).toBe('Biyoloji sunumu')
    expect(created?.url).toBe('https://chatgpt.com/c/abc')
  })

  it('updates the name of a re-pinned URL instead of duplicating it', () => {
    const first = project('Eski ad')
    savePinnedAiProject(first)

    const renamed = project('Yeni ad')
    savePinnedAiProject(renamed)

    const stored = readPinnedAiProjects()
    expect(stored).toHaveLength(1)
    expect(stored[0].name).toBe('Yeni ad')
  })

  it(`keeps at most ${PINNED_AI_PROJECT_LIMIT} pins`, () => {
    for (let index = 0; index < PINNED_AI_PROJECT_LIMIT + 3; index++) {
      savePinnedAiProject(project(`Proje ${index}`, `https://chatgpt.com/c/${index}`))
    }
    expect(readPinnedAiProjects()).toHaveLength(PINNED_AI_PROJECT_LIMIT)
  })

  it('sanitizes bad rows and removes a pin by id', () => {
    const valid = project('Geçerli')
    savePinnedAiProject(valid)

    expect(
      sanitizePinnedAiProjects([null, { modelId: 'chatgpt', name: '' }, { nope: true }])
    ).toEqual([])

    removePinnedAiProject(valid.id)
    expect(readPinnedAiProjects()).toEqual([])
  })
})
