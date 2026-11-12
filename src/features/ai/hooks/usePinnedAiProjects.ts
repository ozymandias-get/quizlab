import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { useLocalStorage } from '@shared/hooks'

import { useCallback, useMemo } from 'react'

import {
  type PinnedAiProject,
  removePinnedAiProject,
  sanitizePinnedAiProjects
} from '../lib/pinnedProjects'

/**
 * Reads pinned projects from storage. Writes happen through the pure helpers
 * (the pin dialog is not a React child of this hook), and the sync event keeps
 * every mounted home/interaction view in step.
 */
export function usePinnedAiProjects() {
  const [stored] = useLocalStorage<PinnedAiProject[]>(STORAGE_KEYS.PINNED_AI_PROJECTS, [])
  const pinnedProjects = useMemo(() => sanitizePinnedAiProjects(stored), [stored])

  const remove = useCallback((id: string) => {
    removePinnedAiProject(id)
  }, [])

  return { pinnedProjects, removePinnedProject: remove }
}
