const { test, expect } = require("@playwright/test");
const {
  dragCardToTarget,
  getPrimaryIds,
  getStackedIds,
  openCanvas,
  seedCanvasApp,
} = require("./support/canvasTestUtils");

test.describe("Canvas View browser drag and drop", () => {
  test("primary insertion at start", async ({ page }) => {
    await seedCanvasApp(page);
    await openCanvas(page);

    await dragCardToTarget(page, "manual-row-4", "canvas-primary-slot-stage-prelims-0");

    await expect.poll(() => getPrimaryIds(page, "stage-prelims")).toEqual([
      "manual-row-4",
      "manual-row-1",
      "manual-row-2",
      "manual-row-3",
    ]);
  });

  test("primary insertion between cards", async ({ page }) => {
    await seedCanvasApp(page);
    await openCanvas(page);

    await dragCardToTarget(page, "manual-row-4", "canvas-primary-slot-stage-prelims-1");

    await expect.poll(() => getPrimaryIds(page, "stage-prelims")).toEqual([
      "manual-row-1",
      "manual-row-4",
      "manual-row-2",
      "manual-row-3",
    ]);
  });

  test("primary insertion at end", async ({ page }) => {
    await seedCanvasApp(page);
    await openCanvas(page);

    await dragCardToTarget(page, "manual-row-1", "canvas-primary-slot-stage-demo-2");

    await expect.poll(() => getPrimaryIds(page, "stage-demo")).toEqual([
      "manual-row-4",
      "manual-row-5",
      "manual-row-1",
    ]);
  });

  test("cross-stage exact insertion", async ({ page }) => {
    await seedCanvasApp(page);
    await openCanvas(page);

    await dragCardToTarget(page, "manual-row-1", "canvas-primary-slot-stage-demo-1");

    await expect.poll(() => getPrimaryIds(page, "stage-demo")).toEqual([
      "manual-row-4",
      "manual-row-1",
      "manual-row-5",
    ]);
  });

  test("stack drop uses the visible stack box and removes the card from the primary row", async ({ page }) => {
    await seedCanvasApp(page);
    await openCanvas(page);

    await dragCardToTarget(page, "manual-row-2", "canvas-stack-slot-manual-row-1-0");

    await expect.poll(() => getPrimaryIds(page, "stage-prelims")).toEqual([
      "manual-row-1",
      "manual-row-3",
    ]);
    await expect.poll(() => getStackedIds(page, "manual-row-1")).toEqual(["manual-row-2"]);
    await expect(
      page.getByTestId("canvas-stage-stage-prelims").locator(
        '[data-card-kind="primary"][data-card-id="manual-row-2"]'
      )
    ).toHaveCount(0);
  });

  test("stacked child can move back to the primary row at an exact position", async ({ page }) => {
    await seedCanvasApp(page, {
      estimateRowOverrides: {
        "manual-row-2": {
          canvasStage: "stage-prelims",
          canvasStackParentId: "manual-row-1",
          canvasStackOrder: 10,
        },
      },
    });
    await openCanvas(page);

    await dragCardToTarget(page, "manual-row-2", "canvas-primary-slot-stage-prelims-0");

    await expect.poll(() => getPrimaryIds(page, "stage-prelims")).toEqual([
      "manual-row-2",
      "manual-row-1",
      "manual-row-3",
    ]);
    await expect.poll(() => getStackedIds(page, "manual-row-1")).toEqual([]);
  });

  test("stacked children can reorder under the same parent", async ({ page }) => {
    await seedCanvasApp(page, {
      estimateRowOverrides: {
        "manual-row-2": {
          canvasStage: "stage-prelims",
          canvasStackParentId: "manual-row-1",
          canvasStackOrder: 10,
        },
        "manual-row-3": {
          canvasStage: "stage-prelims",
          canvasStackParentId: "manual-row-1",
          canvasStackOrder: 20,
        },
      },
    });
    await openCanvas(page);

    await dragCardToTarget(page, "manual-row-3", "canvas-stack-slot-manual-row-1-0");

    await expect.poll(() => getStackedIds(page, "manual-row-1")).toEqual([
      "manual-row-3",
      "manual-row-2",
    ]);
  });

  test("swap two stacked cards by moving the top card to the bottom slot", async ({ page }) => {
    await seedCanvasApp(page, {
      estimateRowOverrides: {
        "manual-row-2": {
          canvasStage: "stage-prelims",
          canvasStackParentId: "manual-row-1",
          canvasStackOrder: 10,
        },
        "manual-row-3": {
          canvasStage: "stage-prelims",
          canvasStackParentId: "manual-row-1",
          canvasStackOrder: 20,
        },
      },
    });
    await openCanvas(page);

    await dragCardToTarget(page, "manual-row-2", "canvas-stack-slot-manual-row-1-2");

    await expect.poll(() => getStackedIds(page, "manual-row-1")).toEqual([
      "manual-row-3",
      "manual-row-2",
    ]);
  });

  test("reorder three stacked cards across all positions including slot 0", async ({ page }) => {
    await seedCanvasApp(page, {
      estimateRowOverrides: {
        "manual-row-2": {
          canvasStage: "stage-prelims",
          canvasStackParentId: "manual-row-1",
          canvasStackOrder: 10,
        },
        "manual-row-3": {
          canvasStage: "stage-prelims",
          canvasStackParentId: "manual-row-1",
          canvasStackOrder: 20,
        },
        "manual-row-4": {
          canvasStage: "stage-prelims",
          canvasStackParentId: "manual-row-1",
          canvasStackOrder: 30,
        },
      },
    });
    await openCanvas(page);

    await dragCardToTarget(page, "manual-row-4", "canvas-stack-slot-manual-row-1-0");
    await expect.poll(() => getStackedIds(page, "manual-row-1")).toEqual([
      "manual-row-4",
      "manual-row-2",
      "manual-row-3",
    ]);

    await dragCardToTarget(page, "manual-row-4", "canvas-stack-slot-manual-row-1-2");
    await expect.poll(() => getStackedIds(page, "manual-row-1")).toEqual([
      "manual-row-2",
      "manual-row-3",
      "manual-row-4",
    ]);

    await dragCardToTarget(page, "manual-row-2", "canvas-stack-slot-manual-row-1-1");
    await expect.poll(() => getStackedIds(page, "manual-row-1")).toEqual([
      "manual-row-3",
      "manual-row-2",
      "manual-row-4",
    ]);
  });

  test("primary card can insert at the top of a populated stack", async ({ page }) => {
    await seedCanvasApp(page, {
      estimateRowOverrides: {
        "manual-row-2": {
          canvasStage: "stage-prelims",
          canvasStackParentId: "manual-row-1",
          canvasStackOrder: 10,
        },
        "manual-row-3": {
          canvasStage: "stage-prelims",
          canvasStackParentId: "manual-row-1",
          canvasStackOrder: 20,
        },
      },
    });
    await openCanvas(page);

    await dragCardToTarget(page, "manual-row-4", "canvas-stack-slot-manual-row-1-0");

    await expect.poll(() => getStackedIds(page, "manual-row-1")).toEqual([
      "manual-row-4",
      "manual-row-2",
      "manual-row-3",
    ]);
  });

  test("primary card can insert in the middle of a populated stack", async ({ page }) => {
    await seedCanvasApp(page, {
      estimateRowOverrides: {
        "manual-row-2": {
          canvasStage: "stage-prelims",
          canvasStackParentId: "manual-row-1",
          canvasStackOrder: 10,
        },
        "manual-row-3": {
          canvasStage: "stage-prelims",
          canvasStackParentId: "manual-row-1",
          canvasStackOrder: 20,
        },
      },
    });
    await openCanvas(page);

    await dragCardToTarget(page, "manual-row-4", "canvas-stack-slot-manual-row-1-1");

    await expect.poll(() => getStackedIds(page, "manual-row-1")).toEqual([
      "manual-row-2",
      "manual-row-4",
      "manual-row-3",
    ]);
  });

  test("primary card can insert at the end of a populated stack", async ({ page }) => {
    await seedCanvasApp(page, {
      estimateRowOverrides: {
        "manual-row-2": {
          canvasStage: "stage-prelims",
          canvasStackParentId: "manual-row-1",
          canvasStackOrder: 10,
        },
        "manual-row-3": {
          canvasStage: "stage-prelims",
          canvasStackParentId: "manual-row-1",
          canvasStackOrder: 20,
        },
      },
    });
    await openCanvas(page);

    await dragCardToTarget(page, "manual-row-4", "canvas-stack-slot-manual-row-1-2");

    await expect.poll(() => getStackedIds(page, "manual-row-1")).toEqual([
      "manual-row-2",
      "manual-row-3",
      "manual-row-4",
    ]);
  });

  test("stacked child can move to another stack at the top position", async ({ page }) => {
    await seedCanvasApp(page, {
      estimateRowOverrides: {
        "manual-row-2": {
          canvasStage: "stage-prelims",
          canvasStackParentId: "manual-row-1",
          canvasStackOrder: 10,
        },
        "manual-row-3": {
          canvasStage: "stage-prelims",
          canvasStackParentId: "manual-row-1",
          canvasStackOrder: 20,
        },
        "manual-row-5": {
          canvasStage: "stage-demo",
          canvasStackParentId: "manual-row-4",
          canvasStackOrder: 10,
        },
      },
    });
    await openCanvas(page);

    await dragCardToTarget(page, "manual-row-3", "canvas-stack-slot-manual-row-4-0");

    await expect.poll(() => getStackedIds(page, "manual-row-1")).toEqual(["manual-row-2"]);
    await expect.poll(() => getStackedIds(page, "manual-row-4")).toEqual([
      "manual-row-3",
      "manual-row-5",
    ]);
  });

  test("layout persists after reload", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: {
        width: 1600,
        height: 1400,
      },
    });
    const page = await context.newPage();

    await seedCanvasApp(page);
    await openCanvas(page);

    await dragCardToTarget(page, "manual-row-4", "canvas-primary-slot-stage-prelims-0");
    await dragCardToTarget(page, "manual-row-2", "canvas-stack-slot-manual-row-1-0");

    await expect.poll(() => getPrimaryIds(page, "stage-prelims")).toEqual([
      "manual-row-4",
      "manual-row-1",
      "manual-row-3",
    ]);
    await expect.poll(() => getStackedIds(page, "manual-row-1")).toEqual(["manual-row-2"]);

    const storageState = await context.storageState();
    await context.close();

    const reloadedContext = await browser.newContext({
      storageState,
      viewport: {
        width: 1600,
        height: 1400,
      },
    });
    const reloadedPage = await reloadedContext.newPage();

    await reloadedPage.goto("/");
    await reloadedPage.getByTestId("workspace-view-canvas").click();

    await expect.poll(() => getPrimaryIds(reloadedPage, "stage-prelims")).toEqual([
      "manual-row-4",
      "manual-row-1",
      "manual-row-3",
    ]);
    await expect.poll(() => getStackedIds(reloadedPage, "manual-row-1")).toEqual(["manual-row-2"]);

    await reloadedContext.close();
  });
});
