### Task 1: Update Settings Modal State Hook

**Files:**
- Modify: `src/features/settings/ui/modal/useSettingsModalState.ts`

**Interfaces:**
- Consumes: existing `SettingsTabGroup`, `SettingsTabId`, `QUICK_SETTINGS_GROUP`
- Produces: updated hook with `activeTab` nullable (`<string | null>`), no `isOverviewMode`

- [ ] **Step 1: Read current file**

- [ ] **Step 2: Edit hook to remove overview mode and allow null active tab**

```typescript
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSettings } from '../../hooks/useSettings'
import {
  buildSettingsSidebarSections,
  buildSettingsTabDefs,
  QUICK_SETTINGS_GROUP,
  type SettingsTabGroup,
  type SettingsTabId,
  toSettingsTabId
} from './settingsModalTabs'

interface UseSettingsModalStateOptions {
  initialTab?: string
  isOpen: boolean
  onClose: () => void
}

export function useSettingsModalState({
  initialTab,
  isOpen,
  onClose
}: UseSettingsModalStateOptions) {
  const { t } = useTranslation()
  const sidebarScrollRef = useRef<HTMLDivElement>(null)
  const normalizedInitialTab = toSettingsTabId(initialTab)
  const [activeTab, setActiveTabState] = useState<SettingsTabId | null>(normalizedInitialTab)
  const [selectedGroup, setSelectedGroup] = useState<SettingsTabGroup | null>(QUICK_SETTINGS_GROUP)
  const settings = useSettings()

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    setActiveTab(normalizedInitialTab)
    setSelectedGroup(QUICK_SETTINGS_GROUP)

    if (sidebarScrollRef.current) {
      sidebarScrollRef.current.scrollTop = 0
    }
  }, [isOpen, normalizedInitialTab])

  const tabDefs = useMemo(() => buildSettingsTabDefs(t), [t])
  const sidebarSections = useMemo(() => buildSettingsSidebarSections(t), [t])
  const activeTabMeta = useMemo(
    () => tabDefs.find((tab) => tab.id === activeTab) ?? null,
    [tabDefs, activeTab]
  )

  const setActiveTab = useCallback(
    (value: string) => {
      const id = toSettingsTabId(value)
      setActiveTabState(id)

      const meta = tabDefs.find((tab) => tab.id === id)
      if (meta) {
        setSelectedGroup(meta.group as SettingsTabGroup)
      }
    },
    [tabDefs]
  )

  const selectGroup = useCallback((group: SettingsTabGroup) => {
    setSelectedGroup(group)
    setActiveTabState(null)
  }, [])

  return {
    activeTab,
    activeTabMeta,
    selectedGroup,
    setActiveTab,
    selectGroup,
    settings,
    sidebarScrollRef,
    sidebarSections,
    t,
    tabDefs
  }
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String -Pattern "useSettingsModalState"`
Expected: No type errors related to the hook.

- [ ] **Step 4: Commit**

```bash
git add src/features/settings/ui/modal/useSettingsModalState.ts
git commit -m "refactor(settings): remove overview mode, allow null active tab"
```

---


