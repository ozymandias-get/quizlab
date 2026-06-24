# Task 5: Extract PdfPageNav and PdfZoomControls from PdfToolbar.tsx

**Files:**

- Modify: `src/features/pdf/ui/components/PdfToolbar.tsx`
- Create: `src/features/pdf/ui/components/PdfPageNav.tsx`
- Create: `src/features/pdf/ui/components/PdfZoomControls.tsx`

## Steps

### Step 1: Create PdfPageNav.tsx

Extract the page navigation section (the section with ChevronLeft/ChevronRight buttons and the page number input) from PdfToolbar.tsx into a separate component.

Read PdfToolbar.tsx first. The page nav section is roughly lines 238-296 (the div with `className="flex items-center gap-2"` that contains the page navigation buttons and page counter).

Key props it needs:

- `currentPage: number`
- `totalPages: number`
- `onPreviousPage: () => void`
- `onNextPage: () => void`
- `onJumpToPage: (page: number) => void`

Use the same styling approach as PdfToolbar (glass-tier-3 classes, motion buttons, same button patterns).

### Step 2: Create PdfZoomControls.tsx

Extract the zoom controls section (the section with ZoomOut/ZoomIn buttons and CurrentScale display) from PdfToolbar.tsx into a separate component.

This is roughly lines 298-342 (the div with zoom buttons and scale display).

Key props it needs:

- `ZoomIn: ZoomComponent` (render prop component)
- `ZoomOut: ZoomComponent` (render prop component)
- `CurrentScale: CurrentScaleComponent` (render prop component)
- `t: (key: string) => string`

Use the same types:

```typescript
interface RenderChildProps {
  onClick: () => void
  scale?: number
}
type ZoomComponent = ComponentType<{ children: (props: RenderChildProps) => ReactElement }>
type CurrentScaleComponent = ComponentType<{ children: (props: { scale: number }) => ReactElement }>
```

### Step 3: Update PdfToolbar.tsx

Replace the extracted sections with imports and usage of PdfPageNav and PdfZoomControls.

### Step 4: Verify

Run: `npx tsc --noEmit` and confirm no type errors.

### Step 5: Commit

```bash
git add src/features/pdf/ui/components/PdfToolbar.tsx src/features/pdf/ui/components/PdfPageNav.tsx src/features/pdf/ui/components/PdfZoomControls.tsx
git commit -m "refactor(PdfToolbar): extract PdfPageNav and PdfZoomControls into separate files"
```
