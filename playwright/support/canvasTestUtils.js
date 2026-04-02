const { expect } = require("@playwright/test");

const GLOBAL_LIBRARIES_KEY = "estimator-app-global-libraries";
const LIBRARY_DATA_KEY = "estimator-app-library-data";
const PROJECT_DATA_KEY = "estimator-app-project-data";

function buildCanvasSeedState(overrides = {}) {
  const globalLibraries = {
    roomTypes: [],
    parameters: [],
    units: [
      { id: "unit-ea", name: "Each", abbreviation: "EA", sortOrder: 1, isActive: true },
    ],
    costCodes: [
      {
        id: "cost-code-prelims",
        name: "Preliminaries",
        code: "P01",
        sortOrder: 1,
        isActive: true,
      },
    ],
    stages: [
      {
        id: "stage-prelims",
        name: "Preliminaries",
        sortOrder: 1,
        isActive: true,
        color: "#d7aa5a",
      },
      {
        id: "stage-demo",
        name: "Demolition",
        sortOrder: 2,
        isActive: true,
        color: "#7ea06f",
      },
    ],
    trades: [{ id: "trade-general", name: "General", sortOrder: 1, isActive: true }],
    itemFamilies: [],
    elements: [{ id: "element-site", name: "Site", sortOrder: 1, isActive: true }],
  };

  const libraryData = {
    roomTemplates: [],
    assemblies: [],
    costs: [],
  };

  const projectData = {
    localProjectId: "playwright-project",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    projectName: "Playwright Project",
    estimateName: "Canvas Browser Test",
    revision: "Rev 3",
    revisionNumber: 3,
    projectRooms: [],
    estimateSections: [
      {
        id: "section-1",
        name: "Main Works",
        parentSectionId: "",
        stageId: "stage-prelims",
        sortOrder: 1,
      },
    ],
    manualEstimateLines: [
      {
        id: "manual-row-1",
        itemName: "Site fencing",
        unitId: "unit-ea",
        unit: "EA",
        quantity: 1,
        rate: 1500,
        stageId: "stage-prelims",
        sectionId: "section-1",
        costCodeId: "cost-code-prelims",
        tradeId: "trade-general",
        elementId: "element-site",
        notes: "",
        workType: "Supply",
        sortOrder: 10,
      },
      {
        id: "manual-row-2",
        itemName: "Pump hire",
        unitId: "unit-ea",
        unit: "EA",
        quantity: 1,
        rate: 700,
        stageId: "stage-prelims",
        sectionId: "section-1",
        costCodeId: "cost-code-prelims",
        tradeId: "trade-general",
        elementId: "element-site",
        notes: "",
        workType: "Equipment",
        sortOrder: 20,
      },
      {
        id: "manual-row-3",
        itemName: "Reo install",
        unitId: "unit-ea",
        unit: "EA",
        quantity: 1,
        rate: 900,
        stageId: "stage-prelims",
        sectionId: "section-1",
        costCodeId: "cost-code-prelims",
        tradeId: "trade-general",
        elementId: "element-site",
        notes: "",
        workType: "Labour",
        sortOrder: 30,
      },
      {
        id: "manual-row-4",
        itemName: "Stripout setup",
        unitId: "unit-ea",
        unit: "EA",
        quantity: 1,
        rate: 800,
        stageId: "stage-demo",
        sectionId: "section-1",
        costCodeId: "cost-code-prelims",
        tradeId: "trade-general",
        elementId: "element-site",
        notes: "",
        workType: "Labour",
        sortOrder: 10,
      },
      {
        id: "manual-row-5",
        itemName: "Survey setout",
        unitId: "unit-ea",
        unit: "EA",
        quantity: 1,
        rate: 600,
        stageId: "stage-demo",
        sectionId: "section-1",
        costCodeId: "cost-code-prelims",
        tradeId: "trade-general",
        elementId: "element-site",
        notes: "",
        workType: "Labour",
        sortOrder: 20,
      },
    ],
    generatedRowSectionAssignments: {},
    estimateRowOverrides: {},
    parameterLibraryUiState: { expandedCategories: {} },
    lastSavedAt: "",
    lastBackupAt: "",
    lastFileName: "",
    ...overrides,
  };

  return { globalLibraries, libraryData, projectData };
}

async function seedCanvasApp(page, overrides = {}) {
  const state = buildCanvasSeedState(overrides);

  await page.addInitScript(
    (payload) => {
      const hasExistingProjectState =
        window.localStorage.getItem(payload.globalKey) ||
        window.localStorage.getItem(payload.libraryKey) ||
        window.localStorage.getItem(payload.projectKey);

      if (hasExistingProjectState) {
        return;
      }

      window.localStorage.setItem(payload.globalKey, JSON.stringify(payload.globalLibraries));
      window.localStorage.setItem(payload.libraryKey, JSON.stringify(payload.libraryData));
      window.localStorage.setItem(payload.projectKey, JSON.stringify(payload.projectData));
    },
    {
      globalKey: GLOBAL_LIBRARIES_KEY,
      libraryKey: LIBRARY_DATA_KEY,
      projectKey: PROJECT_DATA_KEY,
      ...state,
    }
  );
}

async function openCanvas(page, options = {}) {
  const { debug = true, testMode = true } = options;
  const params = new URLSearchParams();

  if (debug) {
    params.set("canvasDebug", "1");
  }

  if (testMode) {
    params.set("canvasTest", "1");
  }

  const query = params.toString();
  await page.goto(query ? `/?${query}` : "/");
  await page.getByTestId("workspace-view-canvas").click();
  await expect(page.getByTestId("canvas-debug-active-target")).toBeVisible();
}

async function dragCardToTarget(page, cardId, targetTestId) {
  const card = page.getByTestId(`canvas-card-${cardId}`);
  const target = page.getByTestId(targetTestId);
  const getClientRect = (locator) =>
    locator.evaluate((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    });
  const getExpectedTargetLabel = async () => {
    const targetData = await target.evaluate((element) => ({
      type: element.getAttribute("data-canvas-drop-type") || "",
      stageId: element.getAttribute("data-canvas-stage-id") || "",
      index: Number(element.getAttribute("data-canvas-index") || 0),
      parentId: element.getAttribute("data-canvas-parent-id") || "",
    }));

    if (targetData.type === "primary") {
      return `Primary slot / ${targetData.stageId || "unassigned"} / index ${targetData.index}`;
    }

    if (targetData.type === "stack") {
      return `Stack under / ${targetData.parentId || "unknown"} / index ${targetData.index}`;
    }

    return "None";
  };
  const movePointerToTargetPoint = async (point) => {
    await page.mouse.move(point.x, point.y, { steps: 10 });
    await page.waitForTimeout(16);
  };

  await card.evaluate((element) =>
    element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" })
  );
  await target.evaluate((element) =>
    element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" })
  );

  const sourceBox = await getClientRect(card);
  const expectedTargetLabel = await getExpectedTargetLabel();

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();

  await target.evaluate((element) =>
    element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" })
  );

  const targetBox = await getClientRect(target);

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2 + 20,
    sourceBox.y + sourceBox.height / 2 + 20,
    { steps: 4 }
  );

  const candidatePoints = [
    { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 },
    { x: targetBox.x + Math.min(28, targetBox.width - 8), y: targetBox.y + targetBox.height / 2 },
    { x: targetBox.x + targetBox.width / 2, y: targetBox.y + Math.min(10, targetBox.height - 8) },
    { x: targetBox.x + targetBox.width / 2, y: targetBox.y + Math.max(targetBox.height - 10, 8) },
    { x: targetBox.x + Math.max(targetBox.width - 12, 8), y: targetBox.y + targetBox.height / 2 },
  ];

  let targetActivated = false;

  for (const point of candidatePoints) {
    await movePointerToTargetPoint(point);

    const activeTargetText = await page.getByTestId("canvas-debug-active-target").textContent();

    if ((activeTargetText || "").includes(expectedTargetLabel)) {
      targetActivated = true;
      break;
    }
  }

  if (!targetActivated) {
    await expect
      .poll(async () => page.getByTestId("canvas-debug-active-target").textContent(), {
        timeout: 1000,
      })
      .toContain(expectedTargetLabel);
  }

  await page.mouse.up();
}

async function getPrimaryIds(page, stageId) {
  return page
    .getByTestId(`canvas-stage-${stageId}`)
    .locator('[data-card-kind="primary"]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-card-id")));
}

async function getStackedIds(page, parentId) {
  return page
    .getByTestId(`canvas-stack-zone-${parentId}`)
    .locator('[data-card-kind="stacked"]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-card-id")));
}

module.exports = {
  buildCanvasSeedState,
  dragCardToTarget,
  getPrimaryIds,
  getStackedIds,
  openCanvas,
  seedCanvasApp,
};
