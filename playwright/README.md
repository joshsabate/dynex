## Canvas Playwright Workflow

Canvas browser tests use stable seeded estimate data from [canvasTestUtils.js](/C:/Users/Miguel/estimator-app/playwright/support/canvasTestUtils.js) and open Canvas with:

- `canvasDebug=1`
- `canvasTest=1`

That gives you:

- deterministic Canvas rows/stages/stacks
- reduced Canvas motion for drag stability
- visible active-target debug output in the UI

### Stable Selectors

Canvas browser tests should use these `data-testid` surfaces:

- stage lanes: `canvas-stage-<stageId>`
- primary insertion slots: `canvas-primary-slot-<stageId>-<index>`
- stack insertion slots: `canvas-stack-slot-<parentId>-<index>`
- stack containers: `canvas-stack-zone-<parentId>`
- cards: `canvas-card-<rowId>`
- active target display: `canvas-debug-active-target`
- debug inspector: `canvas-debug-inspector`

### Run Focused Canvas Suite

Headless:

```powershell
npm run test:e2e:canvas
```

Headed:

```powershell
npm run test:e2e:canvas:headed
```

Direct Playwright equivalents:

```powershell
npm run test:e2e -- playwright/canvas-view.spec.js
npm run test:e2e:headed -- playwright/canvas-view.spec.js
```

### Failure Artifacts

Playwright is configured to retain failure diagnostics in `test-results/playwright/`:

- screenshot: `only-on-failure`
- trace: `retain-on-failure`
- video: `retain-on-failure`

Open traces with:

```powershell
npx playwright show-trace test-results/playwright/<test-folder>/trace.zip
```

### Debugging Tip

When a drag fails, watch the on-screen `Active target` debug bar in Canvas. It should match the visible slot or stack target under the pointer. If it does not, inspect the relevant `canvas-primary-slot-*` or `canvas-stack-slot-*` element in the browser and compare it with the active target display.

### Canvas Grid browser testing

This flow covers the new Canvas grid model: stage rows, column insertion, track placement, cross-stage moves, persistence, and debug-target visibility.

Run:

```powershell
npm run test:e2e:canvas-grid
npm run test:e2e:canvas-grid:headed
npm run test:e2e:canvas-grid:debug
```

Use these query params during manual verification:

- `?canvasTest=1` disables Canvas motion for more stable drag behavior
- `?canvasDebug=1` shows the active drag target and debug metadata

Failure artifacts are stored in `test-results/playwright/`.

Playwright test files must match the configured patterns, such as `*.spec.js` or `*.test.js`.
