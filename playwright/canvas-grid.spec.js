const { test, expect } = require("@playwright/test");
const { seedCanvasApp } = require("./support/canvasTestUtils");

async function openCanvas(page) {
  await page.goto("http://localhost:3000/?canvasTest=1&canvasDebug=1");
  await page.getByTestId("workspace-view-canvas").click();
  await expect(page.getByTestId("canvas-debug-active-target")).toBeVisible();
}

async function getRect(locator) {
  return locator.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  });
}

async function dragCardToTarget(page, cardId, targetTestId) {
  const card = page.getByTestId(`canvas-card-${cardId}`);
  const rawTarget = page.getByTestId(targetTestId);
  const target = (await rawTarget.getAttribute("data-canvas-drop-type"))
    ? rawTarget
    : rawTarget.locator("[data-canvas-drop-type]").first();

  await card.evaluate((element) =>
    element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" })
  );
  await target.evaluate((element) =>
    element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" })
  );

  const source = await getRect(card);
  const destination = await getRect(target);
  const targetMeta = await target.evaluate((element) => ({
    type: element.getAttribute("data-canvas-drop-type") || "",
    stageId: element.getAttribute("data-canvas-stage-id") || "",
    columnIndex: Number(element.getAttribute("data-canvas-column-index") || 0),
    track: Number(element.getAttribute("data-canvas-track") || 0),
  }));

  const expectedLabel =
    targetMeta.type === "insert-column"
      ? `insert column / ${targetMeta.stageId} / column ${targetMeta.columnIndex} / track ${targetMeta.track}`
      : `track cell / ${targetMeta.stageId} / column ${targetMeta.columnIndex} / track ${targetMeta.track}`;

  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 24, source.y + source.height / 2 + 24, {
    steps: 5,
  });
  const candidatePoints = [
    { x: destination.x + destination.width / 2, y: destination.y + destination.height / 2 },
    { x: destination.x + Math.min(12, destination.width - 6), y: destination.y + destination.height / 2 },
    { x: destination.x + destination.width / 2, y: destination.y + Math.min(12, destination.height - 6) },
    { x: destination.x + destination.width / 2, y: destination.y + Math.max(destination.height - 12, 6) },
    { x: destination.x + Math.max(destination.width - 12, 6), y: destination.y + destination.height / 2 },
  ];

  let targetActivated = false;

  for (const point of candidatePoints) {
    await page.mouse.move(point.x, point.y, { steps: 10 });
    await page.waitForTimeout(16);

    const activeTargetText = await page.getByTestId("canvas-debug-active-target").textContent();

    if ((activeTargetText || "").includes(expectedLabel)) {
      targetActivated = true;
      break;
    }
  }

  if (!targetActivated) {
    try {
      await expect
        .poll(async () => page.getByTestId("canvas-debug-active-target").textContent(), {
          timeout: 500,
        })
        .toContain(expectedLabel);
    } catch {
      // The debug indicator is useful, but post-drop DOM assertions remain the browser source of truth.
    }
  }

  await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2, {
    steps: 2,
  });

  await page.mouse.up();
}

async function expectCellToContainCard(page, cellTestId, cardId) {
  await expect(page.getByTestId(cellTestId).getByTestId(`canvas-card-${cardId}`)).toBeVisible();
}

async function expectCellToBeEmpty(page, cellTestId) {
  await expect(page.getByTestId(cellTestId).locator('[data-testid^="canvas-card-"]')).toHaveCount(0);
}

test.describe("Canvas Grid", () => {
  test("moves a card to another column in the same stage", async ({ page }) => {
    await seedCanvasApp(page);
    await openCanvas(page);

    await dragCardToTarget(page, "manual-row-1", "canvas-column-slot-stage-prelims-2");

    await expectCellToBeEmpty(page, "canvas-track-cell-stage-prelims-0-0");
    await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-1-0", "manual-row-2");
    await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-2-0", "manual-row-1");
    await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-3-0", "manual-row-3");
  });

  test("inserts a card between two columns", async ({ page }) => {
    await seedCanvasApp(page);
    await openCanvas(page);

    await dragCardToTarget(page, "manual-row-4", "canvas-column-slot-stage-prelims-1");

    await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-0-0", "manual-row-1");
    await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-1-0", "manual-row-4");
    await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-2-0", "manual-row-2");
    await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-3-0", "manual-row-3");
  });

  test("inserts a card at the end of a row", async ({ page }) => {
    await seedCanvasApp(page);
    await openCanvas(page);

    await dragCardToTarget(page, "manual-row-4", "canvas-column-slot-stage-prelims-3");

    await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-3-0", "manual-row-4");
  });

  test("inserts above the top-most card in a column", async ({ page }) => {
    await seedCanvasApp(page);
    await openCanvas(page);

    await dragCardToTarget(page, "manual-row-2", "canvas-track-slot-stage-prelims-0-0");

    await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-0-0", "manual-row-2");
    await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-0-1", "manual-row-1");
    await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-2-0", "manual-row-3");
  });

  test("inserts between two cards in a column and shifts lower cards down", async ({ page }) => {
    await seedCanvasApp(page);
    await openCanvas(page);

    await dragCardToTarget(page, "manual-row-2", "canvas-track-slot-stage-prelims-0-1");
    await dragCardToTarget(page, "manual-row-3", "canvas-track-slot-stage-prelims-0-1");

    await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-0-0", "manual-row-1");
    await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-0-1", "manual-row-3");
    await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-0-2", "manual-row-2");
    await expectCellToBeEmpty(page, "canvas-track-cell-stage-prelims-1-0");
  });

  test("inserts below the bottom-most card in a column", async ({ page }) => {
    await seedCanvasApp(page);
    await openCanvas(page);

    await dragCardToTarget(page, "manual-row-2", "canvas-track-slot-stage-prelims-0-1");

    await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-0-0", "manual-row-1");
    await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-0-1", "manual-row-2");
  });

  test("moves a card across stages", async ({ page }) => {
    await seedCanvasApp(page);
    await openCanvas(page);

    await dragCardToTarget(page, "manual-row-1", "canvas-column-slot-stage-demo-1");

    await expectCellToContainCard(page, "canvas-track-cell-stage-demo-0-0", "manual-row-4");
    await expectCellToContainCard(page, "canvas-track-cell-stage-demo-1-0", "manual-row-1");
    await expectCellToContainCard(page, "canvas-track-cell-stage-demo-2-0", "manual-row-5");
  });

  test("persists stage, column, and track after reload", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1200 },
    });
    const page = await context.newPage();

    await seedCanvasApp(page);
    await openCanvas(page);

    await dragCardToTarget(page, "manual-row-2", "canvas-track-slot-stage-prelims-0-1");
    await dragCardToTarget(page, "manual-row-4", "canvas-column-slot-stage-prelims-2");

    await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-0-1", "manual-row-2");
    await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-2-0", "manual-row-4");

    await page.reload();
    await page.getByTestId("workspace-view-canvas").click();

    await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-0-1", "manual-row-2");
    await expectCellToContainCard(page, "canvas-track-cell-stage-prelims-2-0", "manual-row-4");

    await context.close();
  });

  test("shows the active target in debug mode while dragging", async ({ page }) => {
    await seedCanvasApp(page);
    await openCanvas(page);

    const card = page.getByTestId("canvas-card-manual-row-4");
    const target = page.getByTestId("canvas-column-slot-stage-prelims-1-0");
    const source = await getRect(card);
    const destination = await getRect(target);

    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(source.x + source.width / 2 + 24, source.y + source.height / 2 + 24, {
      steps: 5,
    });
    await page.mouse.move(
      destination.x + destination.width / 2,
      destination.y + destination.height / 2,
      { steps: 12 }
    );

    await expect(page.getByTestId("canvas-debug-active-target")).toContainText(
      "insert column / stage-prelims / column 1 / track 0"
    );

    await page.mouse.up();
  });
});
