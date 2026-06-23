# Settings 3-Column Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the 2-column settings modal to a 3-column layout with category sidebar (220px), settings list (260px), and detail panel (flex-1).

**Architecture:** Keep the same modal overlay and all 16 existing tab components. Change only the navigation layout: narrow the sidebar, add a middle list panel, simplify the content panel. Remove the overview mode.

**Tech Stack:** React 19, TypeScript 5.9, Tailwind CSS 4, motion (framer-motion), Zustand

## Global Constraints

- Use `motion` from `motion/react` for animations
- Use Tailwind CSS v4 OKLCH colors
- Follow existing dark theme conventions: `bg-[--color-bg-primary]`, `border-white/[0.05-0.12]`
- All 16 tab components remain unchanged
- i18n keys remain unchanged
- No new dependencies

---

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

### Task 2: Compact Sidebar (220px)

**Files:**
- Modify: `src/features/settings/ui/modal/SettingsModalSidebar.tsx`

**Interfaces:**
- Consumes: same props (selectedGroup, selectGroup, sidebarScrollRef, sidebarSections, t) minus unused ones
- Produces: compact 220px sidebar with icon + label per category

- [ ] **Step 1: Read current file**

- [ ] **Step 2: Rewrite sidebar as compact category list**

```typescript
import { hexToRgba } from '@shared/lib/uiUtils'
import { SettingsIcon } from '@ui/components/Icons'

import { motion } from 'motion/react'
import { memo, type RefObject, useCallback } from 'react'

import {
  QUICK_SETTINGS_GROUP,
  type SettingsSidebarSection,
  type SettingsTabGroup
} from './settingsModalTabs'

interface SettingsModalSidebarProps {
  selectedGroup: SettingsTabGroup | null
  selectGroup: (group: SettingsTabGroup) => void
  sidebarScrollRef: RefObject<HTMLDivElement | null>
  sidebarSections: SettingsSidebarSection[]
  t: (key: string) => string
}

const categoryIcons: Record<string, string> = {
  [QUICK_SETTINGS_GROUP]: '⚡',
  workspace: '🧩',
  integration: '🔗',
  preferences: '🎨',
  app: '📦'
}

const SettingsModalSidebar = memo(function SettingsModalSidebar({
  selectedGroup,
  selectGroup,
  sidebarScrollRef,
  sidebarSections,
  t
}: SettingsModalSidebarProps) {
  const isQuickActive = selectedGroup === QUICK_SETTINGS_GROUP
  const handleQuickClick = useCallback(() => selectGroup(QUICK_SETTINGS_GROUP), [selectGroup])
  const handleSectionClick = useCallback(
    (sectionId: SettingsTabGroup) => () => selectGroup(sectionId),
    [selectGroup]
  )

  return (
    <aside className="border-border bg-muted/20 relative flex w-[220px] shrink-0 flex-col border-r max-[900px]:hidden">
      <div className="relative flex h-full min-h-0 flex-col p-3">
        <div className="relative min-h-0 flex-1">
          <div ref={sidebarScrollRef} className="custom-scrollbar h-full overflow-y-auto pr-1">
            <nav aria-label={t('settings_title')} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={handleQuickClick}
                className={`group focus-visible:ring-ring focus-visible:ring-offset-background relative isolate overflow-hidden rounded-lg border p-2.5 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  isQuickActive
                    ? 'border-ring/30 bg-accent'
                    : 'border-border hover:border-border hover:bg-accent/50 bg-transparent'
                }`}
                style={
                  isQuickActive
                    ? {
                        background:
                          'linear-gradient(145deg, oklch(0.74 0.15 85 / 0.08) 0%, oklch(1 0 0 / 0.03) 42%, oklch(0 0 0 / 0.1) 100%)'
                      }
                    : undefined
                }
              >
                {isQuickActive && (
                  <motion.div
                    layoutId="active-sidebar-indicator"
                    className="pointer-events-none absolute inset-y-2 left-0 w-[2px] rounded-full"
                    style={{
                      background:
                        'linear-gradient(180deg, oklch(0.74 0.15 85 / 0.9) 0%, oklch(0.74 0.15 85 / 0.3) 100%)'
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{categoryIcons[QUICK_SETTINGS_GROUP]}</span>
                  <span
                    className={`block text-xs font-semibold tracking-wide transition-colors duration-200 ${
                      isQuickActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground/70'
                    }`}
                  >
                    {t('quick_settings')}
                  </span>
                </div>
              </button>

              <div className="bg-border my-1 h-px" />

              {sidebarSections.map((section) => {
                const isActive = selectedGroup === section.id
                const firstGlow = section.tabs[0]?.glow ?? '#94a3b8'

                return (
                  <button
                    type="button"
                    key={section.id}
                    onClick={handleSectionClick(section.id)}
                    className={`group focus-visible:ring-ring focus-visible:ring-offset-background relative isolate overflow-hidden rounded-lg border p-2.5 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                      isActive
                        ? 'border-ring/30 bg-accent'
                        : 'border-border hover:border-border hover:bg-accent/50 bg-transparent'
                    }`}
                    style={
                      isActive
                        ? {
                            background: `linear-gradient(145deg, ${hexToRgba(firstGlow, 0.08)} 0%, rgba(255,255,255,0.03) 42%, rgba(0,0,0,0.1) 100%)`
                          }
                        : undefined
                    }
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-sidebar-indicator"
                        className="pointer-events-none absolute inset-y-2 left-0 w-[2px] rounded-full"
                        style={{
                          background: `linear-gradient(180deg, ${hexToRgba(firstGlow, 0.9)} 0%, ${hexToRgba(firstGlow, 0.3)} 100%)`
                        }}
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{categoryIcons[section.id] ?? '📄'}</span>
                      <span
                        className={`block text-xs font-semibold tracking-wide transition-colors duration-200 ${
                          isActive
                            ? 'text-foreground'
                            : 'text-muted-foreground group-hover:text-foreground/70'
                        }`}
                      >
                        {section.label}
                      </span>
                    </div>
                  </button>
                )
              })}
            </nav>
          </div>
          <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-8 bg-gradient-to-t from-[var(--color-card)] to-transparent" />
        </div>
      </div>
    </aside>
  )
})

export default SettingsModalSidebar
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String -Pattern "SettingsModalSidebar"`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/settings/ui/modal/SettingsModalSidebar.tsx
git commit -m "refactor(settings): compact sidebar to 220px with icon+label"
```

---

### Task 3: Create Settings List Panel (Middle Column)

**Files:**
- Create: `src/features/settings/ui/modal/SettingsListPanel.tsx`

**Interfaces:**
- Consumes: `selectedGroup`, `activeTab`, `tabDefs`, `sidebarSections`, `setActiveTab`, `t`
- Produces: Rendered middle column with Quick Settings or settings list

- [ ] **Step 1: Create SettingsListPanel component**

```typescript
import { hexToRgba } from '@shared/lib/uiUtils'
import { ScrollArea } from '@app/components/ui/scroll-area'

import { AnimatePresence, motion } from 'motion/react'
import { lazy, memo, Suspense } from 'react'

import {
  QUICK_SETTINGS_GROUP,
  type SettingsSidebarSection,
  type SettingsTabGroup,
  type SettingsTabId,
  type TabDef
} from './settingsModalTabs'

const QuickSettings = lazy(() => import('../QuickSettings'))

interface SettingsListPanelProps {
  selectedGroup: SettingsTabGroup | null
  activeTab: SettingsTabId | null
  tabDefs: TabDef[]
  sidebarSections: SettingsSidebarSection[]
  setActiveTab: (id: string) => void
  selectGroup: (group: SettingsTabGroup) => void
  t: (key: string) => string
}

const SettingsListPanel = memo(function SettingsListPanel({
  selectedGroup,
  activeTab,
  tabDefs,
  sidebarSections,
  setActiveTab,
  selectGroup,
  t
}: SettingsListPanelProps) {
  const isQuickSettings = selectedGroup === QUICK_SETTINGS_GROUP
  const activeSection = sidebarSections.find((s) => s.id === selectedGroup)

  return (
    <div className="border-border relative flex w-[260px] shrink-0 flex-col border-r max-[1100px]:hidden">
      <ScrollArea className="min-h-0 flex-1 px-3 py-3">
        <AnimatePresence mode="wait">
          {isQuickSettings ? (
            <motion.div
              key="quick-settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <div className="mb-3 px-1">
                <div className="text-muted-foreground text-ql-10 font-semibold tracking-widest uppercase">
                  {t('quick_settings')}
                </div>
              </div>
              <Suspense
                fallback={
                  <div className="flex items-center justify-center p-8">
                    <div className="border-border border-t-foreground/50 h-5 w-5 animate-spin rounded-full border-2" />
                  </div>
                }
              >
                <QuickSettings t={t} setActiveTab={setActiveTab} />
              </Suspense>
            </motion.div>
          ) : activeSection ? (
            <motion.div
              key={`list-${selectedGroup}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <div className="text-muted-foreground text-ql-10 font-semibold tracking-widest uppercase">
                  {activeSection.label}
                  <span className="text-muted-foreground/50 ml-1.5 font-normal">
                    · {activeSection.tabs.length}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                {activeSection.tabs.map((tab) => {
                  const isSelected = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`group focus-visible:ring-ring focus-visible:ring-offset-background relative flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                        isSelected
                          ? 'border-ring/30 bg-accent'
                          : 'border-border hover:border-border hover:bg-accent/50 bg-transparent'
                      }`}
                      style={
                        isSelected
                          ? {
                              background: `linear-gradient(145deg, ${hexToRgba(tab.glow, 0.08)} 0%, rgba(255,255,255,0.03) 42%, rgba(0,0,0,0.1) 100%)`
                            }
                          : undefined
                      }
                    >
                      <div
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: tab.glow }}
                      />
                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-xs font-medium leading-tight transition-colors ${
                            isSelected
                              ? 'text-foreground'
                              : 'text-muted-foreground group-hover:text-foreground/70'
                          }`}
                        >
                          {tab.label}
                        </div>
                        {tab.description && (
                          <div className="text-muted-foreground/60 mt-0.5 truncate text-[11px] leading-tight">
                            {tab.description}
                          </div>
                        )}
                      </div>
                      <span className="text-muted-foreground/30 text-xs">›</span>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </ScrollArea>
    </div>
  )
})

export default SettingsListPanel
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String -Pattern "SettingsListPanel"`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/settings/ui/modal/SettingsListPanel.tsx
git commit -m "feat(settings): add middle column settings list panel"
```

---

### Task 4: Simplify Settings Modal Content (Right Panel)

**Files:**
- Modify: `src/features/settings/ui/modal/SettingsModalContent.tsx`

**Interfaces:**
- Consumes: same props minus `isOverviewMode`, `sidebarSections`, `selectGroup`
- Produces: Right panel that shows only the selected tab content (or empty state)

- [ ] **Step 1: Read current file**

- [ ] **Step 2: Simplify content to only render tab detail**

```typescript
import { ScrollArea } from '@app/components/ui/scroll-area'

import { AnimatePresence, motion } from 'motion/react'
import { lazy, memo, Suspense, useEffect, useState } from 'react'

import {
  QUICK_SETTINGS_GROUP,
  SETTINGS_MODAL_MAIN_PANEL_ID,
  SETTINGS_TAB_COMPONENTS,
  type SettingsState,
  settingsTabButtonId,
  type SettingsTabGroup,
  type SettingsTabId,
  type TabDef
} from './settingsModalTabs'

interface SettingsModalContentProps {
  activeTab: SettingsTabId | null
  selectedGroup: SettingsTabGroup | null
  onClose: () => void
  settings: SettingsState
  t: (key: string) => string
  tabDefs: TabDef[]
}

export default memo(function SettingsModalContent({
  activeTab,
  selectedGroup,
  onClose,
  settings,
  t,
  tabDefs
}: SettingsModalContentProps) {
  const [visitedTabs, setVisitedTabs] = useState<Set<SettingsTabId>>(new Set())

  useEffect(() => {
    if (!activeTab) return
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev
      const next = new Set(prev)
      next.add(activeTab)
      return next
    })
  }, [activeTab])

  const activeTabMeta = activeTab ? tabDefs.find((tab) => tab.id === activeTab) : null

  return (
    <main
      id={SETTINGS_MODAL_MAIN_PANEL_ID}
      data-tour-id="tour-target-settings-modal"
      className="flex min-w-0 flex-1 flex-col overflow-hidden"
    >
      <ScrollArea className="min-h-0 flex-1 px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 lg:px-10">
        <AnimatePresence mode="wait">
          {!activeTab || !activeTabMeta ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="flex h-full min-h-[300px] items-center justify-center"
            >
              <div className="text-center">
                <p className="text-muted-foreground/40 text-xs">
                  Select a setting from the list to configure
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={`tab-${activeTab}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <div className="mb-5 space-y-0.5 px-1">
                <div className="text-muted-foreground/50 text-ql-10 font-semibold tracking-widest uppercase">
                  {activeTabMeta.group === QUICK_SETTINGS_GROUP
                    ? t('quick_settings')
                    : tabDefs.find((t) => t.group === activeTabMeta.group)?.group ?? ''}
                </div>
                <h3 className="text-foreground text-base font-semibold tracking-tight">
                  {activeTabMeta.label}
                </h3>
                <p className="text-muted-foreground text-xs tracking-wide">
                  {activeTabMeta.description}
                </p>
              </div>

              {[...visitedTabs].map((tabId) => {
                const isActive = activeTab === tabId
                const TabComponent = SETTINGS_TAB_COMPONENTS[tabId]
                return (
                  <div
                    key={tabId}
                    role="presentation"
                    inert={!isActive ? true : undefined}
                    style={{ display: isActive ? 'block' : 'none' }}
                  >
                    {isActive && (
                      <Suspense
                        fallback={
                          <div className="flex h-full items-center justify-center p-12">
                            <div className="border-border border-t-foreground/50 h-5 w-5 animate-spin rounded-full border-2" />
                          </div>
                        }
                      >
                        <TabComponent onClose={onClose} settings={settings} t={t} />
                      </Suspense>
                    )}
                  </div>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>
    </main>
  )
})
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String -Pattern "SettingsModalContent"`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/settings/ui/modal/SettingsModalContent.tsx
git commit -m "refactor(settings): simplify content panel to show only tab detail"
```

---

### Task 5: Wire Up 3-Column Layout in SettingsModal

**Files:**
- Modify: `src/features/settings/ui/SettingsModal.tsx`

**Interfaces:**
- Consumes: all previous tasks' outputs
- Produces: the final 3-column modal

- [ ] **Step 1: Read current file**

- [ ] **Step 2: Update SettingsModal to use 3-column layout**

```typescript
import { Button } from '@app/components/ui/button'
import { Separator } from '@app/components/ui/separator'
import { CloseIcon, SettingsIcon } from '@ui/components/Icons'

import { motion } from 'motion/react'
import { memo } from 'react'

import SettingsListPanel from './modal/SettingsListPanel'
import SettingsModalContent from './modal/SettingsModalContent'
import SettingsModalSidebar from './modal/SettingsModalSidebar'
import { useSettingsModalState } from './modal/useSettingsModalState'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: string
}

const SettingsModal = memo(function SettingsModal({
  isOpen,
  onClose,
  initialTab
}: SettingsModalProps) {
  const {
    activeTab,
    selectedGroup,
    setActiveTab,
    selectGroup,
    settings,
    sidebarScrollRef,
    sidebarSections,
    t,
    tabDefs
  } = useSettingsModalState({
    initialTab,
    isOpen,
    onClose
  })

  if (!isOpen) {
    return null
  }

  return (
    <div className="z-overlay bg-background fixed inset-0 flex flex-col">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="flex h-full flex-col"
      >
        <header className="flex shrink-0 items-center justify-between px-3 py-3 sm:px-5 sm:py-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="border-border bg-card flex h-8 w-8 items-center justify-center rounded-xl border">
              <SettingsIcon className="text-muted-foreground h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <h1 className="text-foreground text-sm font-semibold tracking-tight">
                {t('settings_title')}
              </h1>
              <p className="text-muted-foreground hidden text-xs sm:block">
                {t('settings_header_description')}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t('tab_close') || 'Close'}
            className="border-border bg-card text-muted-foreground hover:bg-accent h-8 w-8 rounded-lg border"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </Button>
        </header>

        <Separator />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <SettingsModalSidebar
            selectedGroup={selectedGroup}
            selectGroup={selectGroup}
            sidebarScrollRef={sidebarScrollRef}
            sidebarSections={sidebarSections}
            t={t}
          />

          <SettingsListPanel
            selectedGroup={selectedGroup}
            activeTab={activeTab}
            tabDefs={tabDefs}
            sidebarSections={sidebarSections}
            setActiveTab={setActiveTab}
            selectGroup={selectGroup}
            t={t}
          />

          <SettingsModalContent
            activeTab={activeTab}
            selectedGroup={selectedGroup}
            onClose={onClose}
            settings={settings}
            t={t}
            tabDefs={tabDefs}
          />
        </div>
      </motion.div>
    </div>
  )
})

export default SettingsModal
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-String -Pattern "SettingsModal"`
Expected: No type errors.

- [ ] **Step 4: Quick smoke test by running the app**

Run: `npx vite --mode web 2>&1`
Expected: App starts without errors. (Close after a few seconds.)

- [ ] **Step 5: Commit**

```bash
git add src/features/settings/ui/SettingsModal.tsx
git commit -m "feat(settings): wire up 3-column layout with list panel"
```

---

---

### Task 6: Remove Unused Overview Code

**Files:**
- Remove: `src/features/settings/ui/modal/SettingsOverview.tsx` (no longer imported)

- [ ] **Step 1: Delete SettingsOverview.tsx**

```bash
Remove-Item -LiteralPath "src/features/settings/ui/modal/SettingsOverview.tsx"
```

- [ ] **Step 2: Verify build still passes**

Run: `npx tsc --noEmit --pretty`
Expected: No errors. SettingsOverview was only used in the old SettingsModalContent.

- [ ] **Step 3: Commit**

```bash
git add src/features/settings/ui/modal/SettingsOverview.tsx
git commit -m "chore(settings): remove unused SettingsOverview component"
```

---

### Self-Review Checklist

- [ ] **Spec coverage:** Every requirement from the spec has a corresponding task.
  - 220px sidebar → Task 2
  - 260px middle column with list → Task 3
  - Flex-1 right panel with detail → Task 4
  - No overview mode → Task 1, 4
  - Back button removed → Task 4
  - All 16 tab components unchanged → all tasks
  - Quick Settings in middle column → Task 3

- [ ] **Placeholder scan:** No TBD, TODO, or vague patterns remain.

- [ ] **Type consistency:** `activeTab` is `SettingsTabId | null` across all files. `selectedGroup` is `SettingsTabGroup | null`. All function signatures match.
