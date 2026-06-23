import { useTutorialStore } from '@features/tutorial/store/tutorialStore'
import TutorialCenter from '@features/tutorial/ui/TutorialCenter'

import { memo, useCallback } from 'react'

interface TutorialCenterTabProps {
  onCloseSettings?: () => void
}

function TutorialCenterTab({ onCloseSettings }: TutorialCenterTabProps) {
  const startTutorial = useTutorialStore((s) => s.startTutorial)

  const handleStartTutorial = useCallback(
    (id: string) => {
      if (onCloseSettings) {
        onCloseSettings()
        window.setTimeout(() => startTutorial(id), 300)
      } else {
        startTutorial(id)
      }
    },
    [onCloseSettings, startTutorial]
  )

  return <TutorialCenter onStartTutorial={handleStartTutorial} />
}

export default memo(TutorialCenterTab)
