# PDF Tab Buttons — Visual Enhancement

## Goal

Modernize PDF tab strip buttons with a cleaner, more premium aesthetic while preserving the existing glass-morphism design language.

## Changes

### 1. PdfTabItem (Tab Buttons)

- **Active tab indicator**: Replace full border glow with a subtle `linear-gradient` emerald line (2px height, centered) on the bottom of the active pill
- **Inactive tabs**: `opacity-60` by default → `hover:opacity-100`; border color darkens on hover
- **Close (X) button**: Hidden by default (`opacity-0`), visible on group hover (`group-hover:opacity-100`). Hover background: `hover:bg-red-500/20`, color: `hover:text-red-400`
- **Label color**: Inactive `text-white/70`, active `text-white`
- **Animation**: Replace spring motion with smoother `tween` transitions

### 2. PdfTabStrip (Tab Bar)

- Bottom border: `border-b` → gradient border: `from-white/[0.12] via-white/[0.06] to-transparent`
- Tab row padding: `px-2.5` → `px-3`
- Home/Add buttons: Subtle background `bg-white/[0.04]` → `hover:bg-white/[0.1]`

### 3. OverflowMenu

- Dropdown items: `hover:bg-white/10` → `hover:bg-white/15` with `hover:translate-x-0.5` shift
- Close buttons: Match tab item behavior (hidden until hover)

## Files to Modify

- `src/features/pdf/ui/components/PdfTabItem.tsx`
- `src/features/pdf/ui/components/PdfTabStrip.tsx`
- `src/features/pdf/ui/components/OverflowMenu.tsx`
- `src/shared/ui/tabStripChrome.ts`
