# Settings 3-Column Layout — Design Spec

## Problem

The current settings modal uses a 2-column layout: a category sidebar on the left and a content area on the right. Navigation requires clicking a category to see an overview grid, then clicking a tab to see its content, with a back button to return. This feels deep and wastes horizontal space on wide screens.

## Layout

Full-screen modal overlay (unchanged from current). 3 columns:

```
┌─────────────────────────────────────────────────────────────┐
│  ⚙️  Settings                              [✕]             │
├──────────┬────────────────────┬─────────────────────────────┤
│          │                    │                             │
│ Categories│  Settings List     │  Detail Panel              │
│ (220px)  │  (260px)          │  (flex-1)                  │
│          │                    │                             │
│ ⚡Quick   │  ┌──────────────┐  │  CATEGORY NAME             │
│   Settings│  │ 🔷 Prompts   │  │  Setting Title             │
│          │  │ Customize...  │  │  Description...            │
│ ─────────│  ├──────────────┤  │                             │
│ 🧩Worksp. │  │ 🤖 AI Models │  │  [setting controls]        │
│ 🔗Integ. │  │ Configure... │  │                             │
│ 🎨Prefs. │  │ ...          │  │                             │
│ 📦App    │  └──────────────┘  │                             │
│          │                    │                             │
├──────────┴────────────────────┴─────────────────────────────┤
```

### Column 1 — Categories (220px)

- Compact list of 4 category groups + Quick Settings
- Each item: icon + label
- Active category gets accent glow indicator (spring animation, same as current)
- Quick Settings is shown as a button at the top of this column
- No collapse/expand — just click to select

### Column 2 — Settings List (260px)

- Shows the list of tabs within the selected category
- Initially shows Quick Settings cards when no category selected
- Each list item: colored dot indicator + title + short description + chevron
- Active item gets highlighted background + border
- Scrollable with custom scrollbar
- Always visible — user can always see which settings are in the current category

### Column 3 — Detail Panel (flex-1)

- Shows the selected tab's full settings component
- Breadcrumb indicator: uppercase category name + setting title
- Uses existing tab components unchanged (`SETTINGS_TAB_COMPONENTS`)
- No back-to-overview button (replaced by the persistent list in column 2)

## Components

### Modified — `SettingsModal.tsx`
- Change from 2-column flex to 3-column flex layout
- Remove the sidebar/content split; add middle column

### Modified — `SettingsModalSidebar.tsx`
- Narrow from 280px to 220px
- Remove decorative SurfaceCard header (just compact category list)
- Remove Quick Settings section styling (keep as simple button)
- Keep spring animation for active indicator

### New — `SettingsListPanel.tsx`
- New component for the middle column
- Receives: `selectedGroup`, `activeTab`, `tabDefs`, `sidebarSections`, `setActiveTab`
- Shows Quick Settings content when no group selected
- Shows settings list for selected group
- Each item: color dot + label + description + chevron
- Active state highlighting

### Modified — `SettingsModalContent.tsx`
- Reduce role to only rendering the right panel detail content
- Remove overview mode (`isOverviewMode`), remove `SettingsOverview` import
- Remove back-to-overview button
- Keep visited tabs lazy-loading logic
- Keep `AnimatePresence` for tab transitions

### Modified — `useSettingsModalState.ts`
- Remove `isOverviewMode` and `selectGroup` overview-toggle logic
- `selectGroup` now just sets the group (middle column shows list immediately)
- First tab of a group auto-selects when the group is clicked? Or user picks from the list?

### Removed — `SettingsOverview.tsx`
- No longer needed — the overview grid is replaced by the list panel

## State Management

```
selectedGroup: SettingsTabGroup | null  // null = Quick Settings
activeTab: SettingsTabId
```

- `selectGroup(group)` → sets `selectedGroup`, sets `activeTab` to null (middle column shows list, right column clears)
- `setActiveTab(tabId)` → sets `activeTab`, sets `selectedGroup` to match tab's group
- Quick Settings shown in middle column when `selectedGroup === null`
- Right column shows nothing when no tab selected (or shows a welcome/placeholder)

## No Changes Needed

- All 16 tab components (unchanged — they receive the same props)
- Tab definition file (`settingsModalTabs.tsx`)
- Modal entry/exit animations
- Keyboard escape handling
- i18n keys
- Quick Settings component itself (just rendered in a different location)

## Spec Self-Review

- No "TBD" or "TODO" placeholders
- All sections consistent with architecture
- Scope: single layout change, well-bounded, no unrelated refactoring
- No ambiguity: layout, dimensions, and component responsibilities are explicit
