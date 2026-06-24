### Task 1: Re-enable Site Isolation & Remove `disable-site-isolation-trials`

**Files:**

- Modify: `electron/app/index.ts:30-35`

**Interfaces:**

- Consumes: none
- Produces: Chromium Site Isolation enabled for all renderers

- [ ] **Step 1: Remove the `disable-site-isolation-trials` switch**

```typescript
// electron/app/index.ts — around line 30-36
// BEFORE:
app.commandLine.appendSwitch(
  'disable-features',
  'StorageAccessAPI,AutofillServerCommunication,VaapiVideoDecoder,VaapiVideoEncoder,CalculateNativeWinOcclusion,Vulkan'
)
app.commandLine.appendSwitch('enable-features', 'CanvasOopRasterization')
app.commandLine.appendSwitch('disable-site-isolation-trials') // ← REMOVE THIS LINE

// AFTER:
app.commandLine.appendSwitch(
  'disable-features',
  'StorageAccessAPI,AutofillServerCommunication,VaapiVideoDecoder,VaapiVideoEncoder,CalculateNativeWinOcclusion,Vulkan'
)
app.commandLine.appendSwitch('enable-features', 'CanvasOopRasterization')
```

- [ ] **Step 2: Verify build succeeds**

Run: `npx tsc -b --force`
Expected: Exit code 0, no errors

- [ ] **Step 3: Commit**

Run: `git add electron/app/index.ts && git commit -m "fix(security): re-enable Chromium Site Isolation by removing disable-site-isolation-trials"`
