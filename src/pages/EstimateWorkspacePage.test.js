import { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EstimateWorkspacePage from "./EstimateWorkspacePage";

const stages = [
  { id: "stage-prelims", name: "Preliminaries", sortOrder: 1, isActive: true, color: "#d7aa5a" },
  { id: "stage-demo", name: "Demolition", sortOrder: 2, isActive: true, color: "#7ea06f" },
];

const trades = [{ id: "trade-general", name: "General", sortOrder: 1, isActive: true }];
const elements = [{ id: "element-site", name: "Site", sortOrder: 1, isActive: true }];
const costCodes = [{ id: "cost-code-prelims", name: "Preliminaries", sortOrder: 1, isActive: true }];
const units = [{ id: "unit-ea", name: "Each", abbreviation: "EA", sortOrder: 1, isActive: true }];

function createBaseProps(overrides = {}) {
  return {
    projectName: "Sample Project",
    estimateName: "Sample Estimate",
    estimateRevision: "Rev 3",
    sections: [
      {
        id: "section-1",
        name: "Main Works",
        parentSectionId: "",
        stageId: "stage-prelims",
        sortOrder: 1,
      },
    ],
    manualLines: [],
    stages,
    trades,
    elements,
    costCodes,
    itemFamilies: [],
    units,
    costs: [],
    assemblies: [
      {
        id: "assembly-row-1",
        assemblyId: "assembly-demo-stripout",
        assemblyName: "Stripout Package",
        assemblyCategory: "Demolition",
        appliesToRoomTypeId: "room-type-bathroom",
        appliesToRoomType: "Bathroom",
        stageId: "stage-demo",
        stage: "Demolition",
        elementId: "element-site",
        element: "Site",
        tradeId: "trade-general",
        trade: "General",
        costCodeId: "cost-code-prelims",
        costCode: "Preliminaries",
        itemName: "Demolition Setup",
        unitId: "unit-ea",
        unit: "EA",
        sortOrder: 1,
        items: [{ id: "assembly-item-1", itemName: "Stripout setup" }],
      },
    ],
    roomTemplates: [],
    parameters: [],
    projectRooms: [],
    onSectionsChange: jest.fn(),
    onManualLinesChange: jest.fn(),
    onProjectRoomsChange: jest.fn(),
    onEstimateNameChange: jest.fn(),
    onEstimateRevisionChange: jest.fn(),
    onGeneratedRowSectionAssignmentsChange: jest.fn(),
    generatedRowSectionAssignments: {},
    onRowOverrideChange: jest.fn(),
    manualBuilderRows: [
      {
        id: "manual-row-1",
        itemName: "Site fencing",
        displayName: "Site fencing",
        roomName: "Preliminaries",
        sectionId: "section-1",
        stageId: "stage-prelims",
        stage: "Preliminaries",
        tradeId: "trade-general",
        trade: "General",
        costCodeId: "cost-code-prelims",
        costCode: "Preliminaries",
        quantity: 1,
        unit: "EA",
        unitRate: 1500,
        total: 1500,
        include: true,
        sortOrder: 10,
        source: "manual-builder",
        workType: "Supply",
        notes: "Fence the site boundary",
      },
      {
        id: "manual-row-2",
        itemName: "Pump hire",
        displayName: "Pump hire",
        roomName: "Preliminaries",
        sectionId: "section-1",
        stageId: "stage-prelims",
        stage: "Preliminaries",
        tradeId: "trade-general",
        trade: "General",
        costCodeId: "cost-code-prelims",
        costCode: "Preliminaries",
        quantity: 1,
        unit: "EA",
        unitRate: 700,
        total: 700,
        include: true,
        sortOrder: 20,
        source: "manual-builder",
        workType: "Equipment",
        notes: "",
      },
      {
        id: "manual-row-3",
        itemName: "Reo install",
        displayName: "Reo install",
        roomName: "Preliminaries",
        sectionId: "section-1",
        stageId: "stage-prelims",
        stage: "Preliminaries",
        tradeId: "trade-general",
        trade: "General",
        costCodeId: "cost-code-prelims",
        costCode: "Preliminaries",
        quantity: 1,
        unit: "EA",
        unitRate: 900,
        total: 900,
        include: true,
        sortOrder: 30,
        source: "manual-builder",
        workType: "Labour",
        notes: "",
      },
    ],
    generatedRows: [
      {
        id: "generated-row-1",
        itemName: "Stripout setup",
        displayName: "Stripout setup",
        assemblyId: "assembly-demo-stripout",
        assemblyName: "Stripout Package",
        roomName: "Bathroom 01",
        stageId: "stage-demo",
        stage: "Demolition",
        tradeId: "trade-general",
        trade: "General",
        costCodeId: "cost-code-prelims",
        costCode: "Preliminaries",
        quantity: 2,
        unit: "EA",
        unitRate: 800,
        total: 1600,
        include: true,
        sortOrder: 20,
        source: "generated",
        workType: "Labour",
        notes: "",
      },
    ],
    ...overrides,
  };
}

async function openCanvasView() {
  await userEvent.click(screen.getByRole("tab", { name: /canvas view/i }));
}

async function openBuilderView() {
  await userEvent.click(screen.getByRole("tab", { name: /builder view/i }));
}

async function openTimelineView() {
  await userEvent.click(screen.getByRole("tab", { name: /timeline view/i }));
}

async function expandMainWorksSection() {
  await userEvent.click(screen.getByRole("button", { name: /main works/i }));
}

async function enableCanvasDebugMode() {
  const toggle = screen.getByTestId("canvas-debug-toggle");

  if (/off/i.test(toggle.textContent || "")) {
    await userEvent.click(toggle);
  }
}

async function enableBuilderDebugMode() {
  const toggle = screen.getByTestId("builder-debug-toggle");

  if (/off/i.test(toggle.textContent || "")) {
    await userEvent.click(toggle);
  }
}

function getCardByName(name) {
  return screen.getAllByText(new RegExp(`^${name}$`, "i"))[0].closest(".estimate-canvas-card");
}

function getCardDetailsButtonByName(name) {
  return within(getCardByName(name)).getByRole("button", {
    name: new RegExp(`open details for ${name}`, "i"),
  });
}

function getDragTarget(testId) {
  return screen.getByTestId(testId);
}

async function dragCardToTarget(card, target) {
  const originalElementFromPoint = document.elementFromPoint;

  document.elementFromPoint = jest.fn(() => target);

  fireEvent.pointerDown(card, { clientX: 12, clientY: 12, button: 0, pointerId: 1 });

  await act(async () => {
    fireEvent.pointerMove(window, { clientX: 36, clientY: 36, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 48, clientY: 48, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 48, clientY: 48, pointerId: 1 });
  });

  if (originalElementFromPoint) {
    document.elementFromPoint = originalElementFromPoint;
  } else {
    delete document.elementFromPoint;
  }
}

async function dragTimelineElement(element, deltaX) {
  fireEvent.mouseDown(element, { clientX: 100, clientY: 12, button: 0 });

  await act(async () => {
    fireEvent.mouseMove(window, { clientX: 100 + deltaX, clientY: 12 });
    fireEvent.mouseUp(window, { clientX: 100 + deltaX, clientY: 12 });
  });
}

test("estimate workspace switches between builder and canvas views instantly", async () => {
  render(<EstimateWorkspacePage {...createBaseProps()} />);

  expect(screen.getByRole("button", { name: /add section/i })).toBeInTheDocument();

  await openCanvasView();

  expect(screen.getByRole("heading", { name: /canvas view/i })).toBeInTheDocument();
  expect(screen.getByText("Site fencing")).toBeInTheDocument();
  expect(screen.getByText("Stripout setup")).toBeInTheDocument();
});

test("canvas cards resolve images from row, assembly, then item sources", async () => {
  render(
    <EstimateWorkspacePage
      {...createBaseProps({
        assemblies: [
          {
            ...createBaseProps().assemblies[0],
            imageUrl: "https://example.com/assembly.jpg",
          },
        ],
        manualBuilderRows: [
          {
            ...createBaseProps().manualBuilderRows[0],
            imageUrl: "https://example.com/row.jpg",
            itemImageUrl: "https://example.com/item-ignored.jpg",
          },
          createBaseProps().manualBuilderRows[1],
          createBaseProps().manualBuilderRows[2],
        ],
        generatedRows: [
          {
            ...createBaseProps().generatedRows[0],
            imageUrl: "",
            assemblyImageUrl: "",
            itemImageUrl: "https://example.com/item.jpg",
          },
        ],
      })}
    />
  );

  await openCanvasView();

  const manualCardImage = getCardByName("Site fencing").querySelector("img.estimate-canvas-card-image");
  const generatedCardImage = getCardByName("Stripout setup").querySelector("img.estimate-canvas-card-image");

  expect(manualCardImage).toHaveAttribute("src", "https://example.com/row.jpg");
  expect(generatedCardImage).toHaveAttribute("src", "https://example.com/assembly.jpg");
});

test("canvas detail edits quantity, unit, and rate and reflects them back into the card", async () => {
  function WorkspaceHarness() {
    const [manualLines, setManualLines] = useState([
      {
        id: "manual-line-1",
        itemName: "Site fencing",
        quantity: 1,
        rate: 150,
        unitId: "unit-ea",
        unit: "EA",
        stageId: "stage-prelims",
        sectionId: "section-1",
        tradeId: "trade-general",
        costCodeId: "cost-code-prelims",
        elementId: "element-site",
        sortOrder: 10,
      },
    ]);

    return (
      <EstimateWorkspacePage
        {...createBaseProps({
          manualLines,
          manualBuilderRows: [],
          onManualLinesChange: setManualLines,
        })}
      />
    );
  }

  render(<WorkspaceHarness />);

  await openCanvasView();
  await userEvent.click(getCardDetailsButtonByName("Site fencing"));

  fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText(/unit/i), { target: { value: "m²" } });
  fireEvent.change(screen.getByLabelText(/rate/i), { target: { value: "225" } });

  const card = getCardByName("Site fencing");

  expect(within(card).getByText("3 m²")).toBeInTheDocument();
  expect(within(card).getByText("$675.00")).toBeInTheDocument();
  expect(screen.getAllByText("$675.00")[0]).toBeInTheDocument();
});

test("timeline view renders shared rows grouped by stage with scheduled and unscheduled items", async () => {
  render(
    <EstimateWorkspacePage
      {...createBaseProps({
        manualBuilderRows: [
          {
            ...createBaseProps().manualBuilderRows[0],
            plannedStartWeek: 2,
            plannedDurationWeeks: 3,
          },
          createBaseProps().manualBuilderRows[1],
          createBaseProps().manualBuilderRows[2],
        ],
        generatedRows: [
          {
            ...createBaseProps().generatedRows[0],
            plannedStartWeek: 5,
            plannedDurationWeeks: 2,
          },
        ],
      })}
    />
  );

  await openTimelineView();

  expect(screen.getByRole("heading", { name: /timeline view/i })).toBeInTheDocument();
  expect(screen.getByTestId("timeline-group-stage-prelims")).toBeInTheDocument();
  expect(screen.getByTestId("timeline-group-stage-demo")).toBeInTheDocument();
  expect(screen.getByTestId("timeline-bar-manual-row-1")).toBeInTheDocument();
  expect(screen.getByTestId("timeline-bar-generated-row-1")).toBeInTheDocument();
  expect(screen.getByTestId("timeline-week-1")).toBeInTheDocument();
  expect(screen.getByTestId("timeline-week-16")).toBeInTheDocument();
  expect(screen.getByTestId("timeline-row-manual-row-2")).toHaveTextContent("Unscheduled");
});

test("timeline reflects builder stage changes from the shared row source immediately", async () => {
  function WorkspaceHarness() {
    const [manualLines, setManualLines] = useState([
      {
        id: "manual-line-1",
        itemName: "Site fencing",
        displayNameOverride: "",
        workType: "Supply",
        itemFamily: "",
        specification: "",
        gradeOrQuality: "",
        brand: "",
        finishOrVariant: "",
        unitId: "unit-ea",
        unit: "EA",
        quantity: 1,
        rate: 1500,
        stageId: "stage-prelims",
        sectionId: "section-1",
        costCodeId: "cost-code-prelims",
        tradeId: "trade-general",
        elementId: "element-site",
        notes: "Fence the site boundary",
        sourceLink: "",
        sortOrder: 10,
        plannedStartWeek: 3,
        plannedDurationWeeks: 2,
      },
    ]);
    const [manualBuilderRows] = useState([
      {
        id: "manual-line-1",
        itemName: "Site fencing",
        displayName: "Site fencing",
        roomName: "Preliminaries",
        sectionId: "section-1",
        stageId: "stage-prelims",
        stage: "Preliminaries",
        tradeId: "trade-general",
        trade: "General",
        costCodeId: "cost-code-prelims",
        costCode: "Preliminaries",
        quantity: 1,
        unit: "EA",
        unitRate: 1500,
        total: 1500,
        include: true,
        sortOrder: 10,
        source: "manual-builder",
        workType: "Supply",
        notes: "Fence the site boundary",
        plannedStartWeek: 3,
        plannedDurationWeeks: 2,
      },
    ]);

    return (
      <EstimateWorkspacePage
        {...createBaseProps({
          manualLines,
          manualBuilderRows,
          onManualLinesChange: setManualLines,
        })}
      />
    );
  }

  render(<WorkspaceHarness />);

  await openBuilderView();
  await expandMainWorksSection();
  await userEvent.selectOptions(screen.getByLabelText(/stage for site fencing/i), "stage-demo");

  await openTimelineView();

  expect(screen.getByTestId("timeline-group-stage-demo")).toHaveTextContent("Site fencing");
  expect(screen.queryByText("Site fencing", { selector: '[data-testid="timeline-group-stage-prelims"] *' })).not.toBeInTheDocument();
});

test("timeline edits planned start week and duration through the shared manual row state", async () => {
  function WorkspaceHarness() {
    const [manualLines, setManualLines] = useState([
      {
        id: "manual-line-1",
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
        sortOrder: 10,
        plannedStartWeek: 3,
        plannedDurationWeeks: 2,
      },
    ]);
    const [manualBuilderRows] = useState([
      {
        id: "manual-line-1",
        itemName: "Site fencing",
        displayName: "Site fencing",
        roomName: "Preliminaries",
        sectionId: "section-1",
        stageId: "stage-prelims",
        stage: "Preliminaries",
        tradeId: "trade-general",
        trade: "General",
        costCodeId: "cost-code-prelims",
        costCode: "Preliminaries",
        quantity: 1,
        unit: "EA",
        unitRate: 1500,
        total: 1500,
        include: true,
        sortOrder: 10,
        source: "manual-builder",
        workType: "Supply",
        notes: "",
        plannedStartWeek: 3,
        plannedDurationWeeks: 2,
      },
    ]);

    return (
      <EstimateWorkspacePage
        {...createBaseProps({
          manualLines,
          manualBuilderRows,
          onManualLinesChange: setManualLines,
        })}
      />
    );
  }

  render(<WorkspaceHarness />);

  await openTimelineView();

  await userEvent.clear(screen.getByLabelText(/planned start week for site fencing/i));
  await userEvent.type(screen.getByLabelText(/planned start week for site fencing/i), "6");
  await userEvent.clear(screen.getByLabelText(/planned duration weeks for site fencing/i));
  await userEvent.type(screen.getByLabelText(/planned duration weeks for site fencing/i), "4");

  expect(screen.getByLabelText(/planned start week for site fencing/i)).toHaveValue(6);
  expect(screen.getByLabelText(/planned duration weeks for site fencing/i)).toHaveValue(4);
  expect(screen.getByTestId("timeline-bar-manual-line-1")).toHaveTextContent("6-9");
});

test("timeline drag moves a scheduled bar and resize updates duration without draft state", async () => {
  function WorkspaceHarness() {
    const [manualLines, setManualLines] = useState([
      {
        id: "manual-line-1",
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
        sortOrder: 10,
        plannedStartWeek: 2,
        plannedDurationWeeks: 3,
      },
    ]);
    const [manualBuilderRows] = useState([
      {
        id: "manual-line-1",
        itemName: "Site fencing",
        displayName: "Site fencing",
        roomName: "Preliminaries",
        sectionId: "section-1",
        stageId: "stage-prelims",
        stage: "Preliminaries",
        tradeId: "trade-general",
        trade: "General",
        costCodeId: "cost-code-prelims",
        costCode: "Preliminaries",
        quantity: 1,
        unit: "EA",
        unitRate: 1500,
        total: 1500,
        include: true,
        sortOrder: 10,
        source: "manual-builder",
        workType: "Supply",
        notes: "",
        plannedStartWeek: 2,
        plannedDurationWeeks: 3,
      },
    ]);

    return (
      <EstimateWorkspacePage
        {...createBaseProps({
          manualLines,
          manualBuilderRows,
          onManualLinesChange: setManualLines,
        })}
      />
    );
  }

  render(<WorkspaceHarness />);

  await openTimelineView();

  await dragTimelineElement(screen.getByTestId("timeline-bar-manual-line-1"), 112);
  expect(screen.getByLabelText(/planned start week for site fencing/i)).toHaveValue(4);
  expect(screen.getByTestId("timeline-bar-manual-line-1")).toHaveTextContent("4-6");

  await dragTimelineElement(
    screen.getByRole("button", { name: /resize duration for site fencing/i }),
    112
  );
  expect(screen.getByLabelText(/planned duration weeks for site fencing/i)).toHaveValue(5);
  expect(screen.getByTestId("timeline-bar-manual-line-1")).toHaveTextContent("4-8");
});

test("canvas view migrates legacy stacked rows into lower tracks in the same stage column", async () => {
  render(
    <EstimateWorkspacePage
      {...createBaseProps({
        manualBuilderRows: [
          createBaseProps().manualBuilderRows[0],
          {
            ...createBaseProps().manualBuilderRows[1],
            canvasStackParentId: "manual-row-1",
            canvasStackOrder: 10,
          },
          {
            ...createBaseProps().manualBuilderRows[2],
            canvasColumn: 1,
            canvasTrack: 0,
          },
        ],
      })}
    />
  );

  await openCanvasView();

  expect(
    within(screen.getByTestId("canvas-track-cell-stage-prelims-0-0")).getByText(/site fencing/i)
  ).toBeInTheDocument();
  expect(
    within(screen.getByTestId("canvas-track-cell-stage-prelims-0-1")).getByText(/pump hire/i)
  ).toBeInTheDocument();
  expect(
    within(screen.getByTestId("canvas-track-cell-stage-prelims-1-0")).getByText(/reo install/i)
  ).toBeInTheDocument();
});

test("dragging a card to the first column slot in another stage updates shared stage immediately", async () => {
  const onRowOverrideChange = jest.fn();
  render(<EstimateWorkspacePage {...createBaseProps({ onRowOverrideChange })} />);

  await openCanvasView();
  await dragCardToTarget(
    getCardByName("Stripout setup"),
    getDragTarget("canvas-column-slot-stage-prelims-0-0")
  );

  expect(screen.queryByRole("button", { name: /apply canvas stage changes/i })).not.toBeInTheDocument();
  expect(onRowOverrideChange).toHaveBeenCalledWith(
    "generated-row-1",
    expect.objectContaining({
      stageId: "stage-prelims",
    })
  );
});

test("moving a card between columns preserves empty leading columns instead of compacting the row", async () => {
  const onRowOverrideChange = jest.fn();

  render(
    <EstimateWorkspacePage
      {...createBaseProps({
        onRowOverrideChange,
        manualBuilderRows: [
          {
            ...createBaseProps().manualBuilderRows[0],
            canvasColumn: 0,
          },
          {
            ...createBaseProps().manualBuilderRows[1],
            canvasColumn: 1,
          },
          {
            ...createBaseProps().manualBuilderRows[2],
            canvasColumn: 2,
          },
        ],
      })}
    />
  );

  await openCanvasView();
  await dragCardToTarget(
    getCardByName("Site fencing"),
    getDragTarget("canvas-column-slot-stage-prelims-2-0")
  );

  expect(onRowOverrideChange).toHaveBeenCalledWith(
    "manual-row-2",
    expect.objectContaining({ canvasColumn: 1, canvasTrack: 0 })
  );
  expect(onRowOverrideChange).toHaveBeenCalledWith(
    "manual-row-1",
    expect.objectContaining({ canvasColumn: 2, canvasTrack: 0 })
  );
  expect(onRowOverrideChange).toHaveBeenCalledWith(
    "manual-row-3",
    expect.objectContaining({ canvasColumn: 3, canvasTrack: 0 })
  );
});

test("dragging a card into a column track slot changes vertical placement within the stage", async () => {
  const onRowOverrideChange = jest.fn();
  render(<EstimateWorkspacePage {...createBaseProps({ onRowOverrideChange })} />);

  await openCanvasView();
  await dragCardToTarget(
    getCardByName("Pump hire"),
    getDragTarget("canvas-track-slot-stage-prelims-0-1")
  );

  expect(onRowOverrideChange).toHaveBeenCalledWith(
    "manual-row-2",
    expect.objectContaining({
      stageId: "stage-prelims",
      canvasColumn: 0,
      canvasTrack: 1,
      canvasStackParentId: "",
    })
  );
});

test("populated columns render vertical insertion slots above, between, and below cards", async () => {
  render(
    <EstimateWorkspacePage
      {...createBaseProps({
        manualBuilderRows: [
          {
            ...createBaseProps().manualBuilderRows[0],
            canvasColumn: 0,
            canvasTrack: 0,
          },
          {
            ...createBaseProps().manualBuilderRows[1],
            canvasColumn: 0,
            canvasTrack: 1,
          },
          {
            ...createBaseProps().manualBuilderRows[2],
            canvasColumn: 1,
            canvasTrack: 0,
          },
        ],
      })}
    />
  );

  await openCanvasView();

  expect(screen.getByTestId("canvas-track-slot-stage-prelims-0-0")).toBeInTheDocument();
  expect(screen.getByTestId("canvas-track-slot-stage-prelims-0-1")).toBeInTheDocument();
  expect(screen.getByTestId("canvas-track-slot-stage-prelims-0-2")).toBeInTheDocument();
});

test("inserting into a middle vertical slot shifts lower cards down without changing other columns", async () => {
  const onRowOverrideChange = jest.fn();

  render(
    <EstimateWorkspacePage
      {...createBaseProps({
        onRowOverrideChange,
        manualBuilderRows: [
          {
            ...createBaseProps().manualBuilderRows[0],
            canvasColumn: 0,
            canvasTrack: 0,
          },
          {
            ...createBaseProps().manualBuilderRows[1],
            canvasColumn: 0,
            canvasTrack: 1,
          },
          {
            ...createBaseProps().manualBuilderRows[2],
            canvasColumn: 2,
            canvasTrack: 0,
          },
        ],
      })}
    />
  );

  await openCanvasView();
  await dragCardToTarget(
    getCardByName("Reo install"),
    getDragTarget("canvas-track-slot-stage-prelims-0-1")
  );

  expect(onRowOverrideChange).toHaveBeenCalledWith(
    "manual-row-1",
    expect.objectContaining({
      stageId: "stage-prelims",
      canvasColumn: 0,
      canvasTrack: 0,
    })
  );
  expect(onRowOverrideChange).toHaveBeenCalledWith(
    "manual-row-3",
    expect.objectContaining({
      stageId: "stage-prelims",
      canvasColumn: 0,
      canvasTrack: 1,
    })
  );
  expect(onRowOverrideChange).toHaveBeenCalledWith(
    "manual-row-2",
    expect.objectContaining({
      stageId: "stage-prelims",
      canvasColumn: 0,
      canvasTrack: 2,
    })
  );
});

test("dense columns keep explicit gap slots and accept drops after the last occupied track", async () => {
  const onRowOverrideChange = jest.fn();

  render(
    <EstimateWorkspacePage
      {...createBaseProps({
        onRowOverrideChange,
        manualBuilderRows: [
          {
            ...createBaseProps().manualBuilderRows[0],
            canvasColumn: 0,
            canvasTrack: 0,
          },
          {
            ...createBaseProps().manualBuilderRows[1],
            canvasColumn: 0,
            canvasTrack: 3,
          },
          {
            ...createBaseProps().manualBuilderRows[2],
            canvasColumn: 1,
            canvasTrack: 0,
          },
        ],
      })}
    />
  );

  await openCanvasView();

  expect(screen.getByTestId("canvas-track-slot-stage-prelims-0-0")).toBeInTheDocument();
  expect(screen.getByTestId("canvas-track-slot-stage-prelims-0-1")).toBeInTheDocument();
  expect(screen.getByTestId("canvas-track-slot-stage-prelims-0-2")).toBeInTheDocument();
  expect(screen.getByTestId("canvas-track-slot-stage-prelims-0-3")).toBeInTheDocument();
  expect(screen.getByTestId("canvas-track-slot-stage-prelims-0-4")).toBeInTheDocument();
  expect(screen.getByTestId("canvas-track-cell-stage-prelims-0-1")).toBeInTheDocument();
  expect(screen.getByTestId("canvas-track-cell-stage-prelims-0-2")).toBeInTheDocument();

  await dragCardToTarget(
    getCardByName("Stripout setup"),
    getDragTarget("canvas-track-slot-stage-prelims-0-4")
  );

  expect(onRowOverrideChange).toHaveBeenCalledWith(
    "manual-row-1",
    expect.objectContaining({
      stageId: "stage-prelims",
      canvasColumn: 0,
      canvasTrack: 0,
    })
  );
  expect(onRowOverrideChange).toHaveBeenCalledWith(
    "manual-row-2",
    expect.objectContaining({
      stageId: "stage-prelims",
      canvasColumn: 0,
      canvasTrack: 3,
    })
  );
  expect(onRowOverrideChange).toHaveBeenCalledWith(
    "generated-row-1",
    expect.objectContaining({
      stageId: "stage-prelims",
      canvasColumn: 0,
      canvasTrack: 4,
    })
  );
});

test("canvas commits multi-row manual shifts to the exact hovered slot without stale overwrites", async () => {
  function WorkspaceHarness() {
    const [manualLines, setManualLines] = useState([
      {
        id: "manual-line-1",
        itemName: "Site fencing",
        displayNameOverride: "",
        workType: "Supply",
        itemFamily: "",
        specification: "",
        gradeOrQuality: "",
        brand: "",
        finishOrVariant: "",
        unitId: "unit-ea",
        unit: "EA",
        quantity: 1,
        rate: 1500,
        stageId: "stage-prelims",
        stage: "Preliminaries",
        sectionId: "section-1",
        costCodeId: "cost-code-prelims",
        tradeId: "trade-general",
        elementId: "element-site",
        notes: "Fence the site boundary",
        sourceLink: "",
        sortOrder: 10,
        canvasColumn: 0,
        canvasTrack: 0,
      },
      {
        id: "manual-line-2",
        itemName: "Pump hire",
        displayNameOverride: "",
        workType: "Equipment",
        itemFamily: "",
        specification: "",
        gradeOrQuality: "",
        brand: "",
        finishOrVariant: "",
        unitId: "unit-ea",
        unit: "EA",
        quantity: 1,
        rate: 700,
        stageId: "stage-prelims",
        stage: "Preliminaries",
        sectionId: "section-1",
        costCodeId: "cost-code-prelims",
        tradeId: "trade-general",
        elementId: "element-site",
        notes: "",
        sourceLink: "",
        sortOrder: 20,
        canvasColumn: 0,
        canvasTrack: 2,
      },
      {
        id: "manual-line-3",
        itemName: "Reo install",
        displayNameOverride: "",
        workType: "Labour",
        itemFamily: "",
        specification: "",
        gradeOrQuality: "",
        brand: "",
        finishOrVariant: "",
        unitId: "unit-ea",
        unit: "EA",
        quantity: 1,
        rate: 900,
        stageId: "stage-demo",
        stage: "Demolition",
        sectionId: "section-1",
        costCodeId: "cost-code-prelims",
        tradeId: "trade-general",
        elementId: "element-site",
        notes: "",
        sourceLink: "",
        sortOrder: 30,
        canvasColumn: 0,
        canvasTrack: 0,
      },
    ]);

    const manualBuilderRows = manualLines.map((line) => ({
      id: line.id,
      itemName: line.itemName,
      displayName: line.itemName,
      roomName: "Preliminaries",
      sectionId: line.sectionId,
      stageId: line.stageId,
      stage: line.stage,
      tradeId: line.tradeId,
      trade: "General",
      costCodeId: line.costCodeId,
      costCode: "Preliminaries",
      quantity: line.quantity,
      unit: line.unit,
      unitRate: line.rate,
      total: line.quantity * line.rate,
      include: true,
      sortOrder: line.sortOrder,
      source: "manual-builder",
      workType: line.workType,
      notes: line.notes,
      canvasColumn: line.canvasColumn,
      canvasTrack: line.canvasTrack,
      canvasOrder: line.canvasColumn * 100 + line.canvasTrack,
    }));

    return (
      <EstimateWorkspacePage
        {...createBaseProps({
          manualLines,
          manualBuilderRows,
          generatedRows: [],
          onManualLinesChange: setManualLines,
        })}
      />
    );
  }

  render(<WorkspaceHarness />);

  await openCanvasView();
  await dragCardToTarget(
    getCardByName("Reo install"),
    getDragTarget("canvas-track-slot-stage-prelims-0-1")
  );

  expect(
    within(screen.getByTestId("canvas-track-cell-stage-prelims-0-0")).getByText(/site fencing/i)
  ).toBeInTheDocument();
  expect(
    within(screen.getByTestId("canvas-track-cell-stage-prelims-0-1")).getByText(/reo install/i)
  ).toBeInTheDocument();
  expect(
    within(screen.getByTestId("canvas-track-cell-stage-prelims-0-3")).getByText(/pump hire/i)
  ).toBeInTheDocument();
  expect(screen.queryByTestId("canvas-track-cell-stage-demo-0-0")).not.toHaveTextContent(/reo install/i);

  await openBuilderView();
  await expandMainWorksSection();

  expect(screen.getByTestId("builder-row-manual-line-1")).toBeInTheDocument();
  expect(screen.getByTestId("builder-row-manual-line-2")).toBeInTheDocument();
  expect(screen.getByTestId("builder-row-manual-line-3")).toBeInTheDocument();
  expect(within(screen.getByTestId("builder-row-manual-line-3")).getByLabelText(/stage for reo install/i)).toHaveValue(
    "stage-prelims"
  );
});

test("moving a card across stages in canvas updates builder immediately", async () => {
  function WorkspaceHarness() {
    const [manualLines, setManualLines] = useState([
      {
        id: "manual-line-1",
        itemName: "Site fencing",
        displayNameOverride: "",
        workType: "Supply",
        itemFamily: "",
        specification: "",
        gradeOrQuality: "",
        brand: "",
        finishOrVariant: "",
        unitId: "unit-ea",
        unit: "EA",
        quantity: 1,
        rate: 1500,
        stageId: "stage-prelims",
        stage: "Preliminaries",
        sectionId: "section-1",
        costCodeId: "cost-code-prelims",
        tradeId: "trade-general",
        elementId: "element-site",
        notes: "Fence the site boundary",
        sourceLink: "",
        sortOrder: 10,
        canvasColumn: 0,
        canvasTrack: 0,
      },
    ]);
    const [manualBuilderRows] = useState([
      {
        id: "manual-line-1",
        itemName: "Site fencing",
        displayName: "Site fencing",
        roomName: "Preliminaries",
        sectionId: "section-1",
        stageId: "stage-prelims",
        stage: "Preliminaries",
        tradeId: "trade-general",
        trade: "General",
        costCodeId: "cost-code-prelims",
        costCode: "Preliminaries",
        quantity: 1,
        unit: "EA",
        unitRate: 1500,
        total: 1500,
        include: true,
        sortOrder: 10,
        source: "manual-builder",
        workType: "Supply",
        notes: "Fence the site boundary",
        canvasColumn: 0,
        canvasTrack: 0,
      },
    ]);

    return (
      <EstimateWorkspacePage
        {...createBaseProps({
          manualLines,
          manualBuilderRows,
          onManualLinesChange: setManualLines,
        })}
      />
    );
  }

  render(<WorkspaceHarness />);

  await openCanvasView();
  await dragCardToTarget(
    getCardByName("Site fencing"),
    getDragTarget("canvas-column-slot-stage-demo-1-0")
  );

  expect(
    within(screen.getByTestId("canvas-stage-stage-demo")).getByText(/site fencing/i)
  ).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /apply canvas stage changes/i })).not.toBeInTheDocument();

  await openBuilderView();
  await expandMainWorksSection();

  const movedRow = screen.getByTestId("builder-row-manual-line-1");
  expect(within(movedRow).getByLabelText(/stage for site fencing/i)).toHaveValue("stage-demo");
});

test("changing stage in builder updates canvas lane immediately", async () => {
  function WorkspaceHarness() {
    const [manualLines, setManualLines] = useState([
      {
        id: "manual-line-1",
        itemName: "Site fencing",
        displayNameOverride: "",
        workType: "Supply",
        itemFamily: "",
        specification: "",
        gradeOrQuality: "",
        brand: "",
        finishOrVariant: "",
        unitId: "unit-ea",
        unit: "EA",
        quantity: 1,
        rate: 1500,
        stageId: "stage-prelims",
        sectionId: "section-1",
        costCodeId: "cost-code-prelims",
        tradeId: "trade-general",
        elementId: "element-site",
        notes: "Fence the site boundary",
        sourceLink: "",
        sortOrder: 10,
      },
    ]);
    const [manualBuilderRows] = useState([
      {
        id: "manual-line-1",
        itemName: "Site fencing",
        displayName: "Site fencing",
        roomName: "Preliminaries",
        sectionId: "section-1",
        stageId: "stage-prelims",
        stage: "Preliminaries",
        tradeId: "trade-general",
        trade: "General",
        costCodeId: "cost-code-prelims",
        costCode: "Preliminaries",
        quantity: 1,
        unit: "EA",
        unitRate: 1500,
        total: 1500,
        include: true,
        sortOrder: 10,
        source: "manual-builder",
        workType: "Supply",
        notes: "Fence the site boundary",
        canvasColumn: 0,
        canvasTrack: 0,
      },
    ]);

    return (
      <EstimateWorkspacePage
        {...createBaseProps({
          manualLines,
          manualBuilderRows,
          onManualLinesChange: setManualLines,
        })}
      />
    );
  }

  render(<WorkspaceHarness />);

  await openBuilderView();
  await expandMainWorksSection();
  await userEvent.selectOptions(screen.getByLabelText(/stage for site fencing/i), "stage-demo");

  await openCanvasView();

  expect(
    within(screen.getByTestId("canvas-track-cell-stage-demo-0-0")).getByText(/site fencing/i)
  ).toBeInTheDocument();
});

test("builder renders the current stage from stageId even when the row stage label snapshot is stale", async () => {
  function WorkspaceHarness() {
    const [manualLines, setManualLines] = useState([
      {
        id: "manual-line-1",
        itemName: "Site fencing",
        displayNameOverride: "",
        workType: "Supply",
        itemFamily: "",
        specification: "",
        gradeOrQuality: "",
        brand: "",
        finishOrVariant: "",
        unitId: "unit-ea",
        unit: "EA",
        quantity: 1,
        rate: 1500,
        stageId: "stage-prelims",
        sectionId: "section-1",
        costCodeId: "cost-code-prelims",
        tradeId: "trade-general",
        elementId: "element-site",
        notes: "Fence the site boundary",
        sourceLink: "",
        sortOrder: 10,
      },
    ]);
    const [manualBuilderRows] = useState([
      {
        id: "manual-line-1",
        itemName: "Site fencing",
        displayName: "Site fencing",
        roomName: "Preliminaries",
        sectionId: "section-1",
        stageId: "stage-prelims",
        stage: "Preliminaries",
        tradeId: "trade-general",
        trade: "General",
        costCodeId: "cost-code-prelims",
        costCode: "Preliminaries",
        quantity: 1,
        unit: "EA",
        unitRate: 1500,
        total: 1500,
        include: true,
        sortOrder: 10,
        source: "manual-builder",
        workType: "Supply",
        notes: "Fence the site boundary",
      },
    ]);

    return (
      <EstimateWorkspacePage
        {...createBaseProps({
          manualLines,
          manualBuilderRows,
          onManualLinesChange: setManualLines,
        })}
      />
    );
  }

  render(<WorkspaceHarness />);

  await openBuilderView();
  await expandMainWorksSection();
  await enableBuilderDebugMode();
  await userEvent.selectOptions(screen.getByLabelText(/stage for site fencing/i), "stage-demo");
  const debugRow = await screen.findByTestId("builder-debug-row-manual-line-1");

  expect(screen.getByLabelText(/stage for site fencing/i)).toHaveValue("stage-demo");
  expect(debugRow).toHaveTextContent("stageId: stage-demo");
  expect(debugRow).toHaveTextContent("stageName: Demolition");
});

test("canvas cross-stage drag does not expose discard controls and builder stays in sync", async () => {
  function WorkspaceHarness() {
    const [manualLines, setManualLines] = useState([
      {
        id: "manual-line-1",
        itemName: "Site fencing",
        displayNameOverride: "",
        workType: "Supply",
        itemFamily: "",
        specification: "",
        gradeOrQuality: "",
        brand: "",
        finishOrVariant: "",
        unitId: "unit-ea",
        unit: "EA",
        quantity: 1,
        rate: 1500,
        stageId: "stage-prelims",
        sectionId: "section-1",
        costCodeId: "cost-code-prelims",
        tradeId: "trade-general",
        elementId: "element-site",
        notes: "Fence the site boundary",
        sourceLink: "",
        sortOrder: 10,
      },
    ]);
    const [manualBuilderRows] = useState([
      {
        id: "manual-line-1",
        itemName: "Site fencing",
        displayName: "Site fencing",
        roomName: "Preliminaries",
        sectionId: "section-1",
        stageId: "stage-prelims",
        stage: "Preliminaries",
        tradeId: "trade-general",
        trade: "General",
        costCodeId: "cost-code-prelims",
        costCode: "Preliminaries",
        quantity: 1,
        unit: "EA",
        unitRate: 1500,
        total: 1500,
        include: true,
        sortOrder: 10,
        source: "manual-builder",
        workType: "Supply",
        notes: "Fence the site boundary",
        canvasColumn: 0,
        canvasTrack: 0,
      },
    ]);

    return (
      <EstimateWorkspacePage
        {...createBaseProps({
          manualLines,
          manualBuilderRows,
          onManualLinesChange: setManualLines,
        })}
      />
    );
  }

  render(<WorkspaceHarness />);

  await openCanvasView();
  await dragCardToTarget(
    getCardByName("Site fencing"),
    getDragTarget("canvas-column-slot-stage-demo-1-0")
  );

  expect(screen.queryByText(/discard canvas stage changes/i)).not.toBeInTheDocument();
  expect(
    within(screen.getByTestId("canvas-stage-stage-demo")).getByText(/site fencing/i)
  ).toBeInTheDocument();

  await openBuilderView();
  await expandMainWorksSection();
  await enableBuilderDebugMode();
  const debugRow = await screen.findByTestId("builder-debug-row-manual-line-1");

  expect(screen.getByLabelText(/stage for site fencing/i)).toHaveValue("stage-demo");
  expect(debugRow).toHaveTextContent("stageId: stage-demo");
  expect(debugRow).toHaveTextContent("stageName: Demolition");
});

test("canvas view restores persisted column and track layout without duplicating rows", async () => {
  const props = createBaseProps({
    manualBuilderRows: [
      {
        ...createBaseProps().manualBuilderRows[0],
        canvasColumn: 1,
        canvasTrack: 0,
      },
      {
        ...createBaseProps().manualBuilderRows[1],
        canvasColumn: 0,
        canvasTrack: 1,
      },
      {
        ...createBaseProps().manualBuilderRows[2],
        canvasColumn: 0,
        canvasTrack: 0,
      },
    ],
  });
  const { rerender } = render(<EstimateWorkspacePage {...props} />);

  await openCanvasView();

  expect(
    within(screen.getByTestId("canvas-track-cell-stage-prelims-0-0")).getByText(/reo install/i)
  ).toBeInTheDocument();
  expect(
    within(screen.getByTestId("canvas-track-cell-stage-prelims-0-1")).getByText(/pump hire/i)
  ).toBeInTheDocument();
  expect(
    within(screen.getByTestId("canvas-track-cell-stage-prelims-1-0")).getByText(/site fencing/i)
  ).toBeInTheDocument();

  rerender(<EstimateWorkspacePage {...props} />);
  expect(screen.getAllByTestId(/canvas-card-/)).toHaveLength(4);
});

test("builder view keeps the same row identity and does not render duplicate rows", async () => {
  render(
    <EstimateWorkspacePage
      {...createBaseProps({
        manualLines: [
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
            sortOrder: 20,
          },
        ],
      })}
    />
  );

  await userEvent.click(screen.getByRole("button", { name: /main works/i }));

  expect(screen.getAllByText("Site fencing")).toHaveLength(1);
  expect(screen.getAllByText("Pump hire")).toHaveLength(1);
});

test("canvas add menu can return the user to builder view", async () => {
  render(<EstimateWorkspacePage {...createBaseProps()} />);

  await openCanvasView();
  await userEvent.click(screen.getByText("Add Card"));

  const menuPanel = document.querySelector(".estimate-workspace-add-menu-panel");
  await userEvent.click(within(menuPanel).getByRole("button", { name: /open builder view/i }));

  expect(screen.getByRole("button", { name: /add section/i })).toBeInTheDocument();
});

test("canvas can add one assembly library card as a shared project item without exploding child rows", async () => {
  function WorkspaceHarness() {
    const [sections, setSections] = useState(createBaseProps().sections);
    const [manualLines, setManualLines] = useState([]);

    return (
      <EstimateWorkspacePage
        {...createBaseProps({
          sections,
          manualLines,
          manualBuilderRows: [],
          generatedRows: [],
          onSectionsChange: setSections,
          onManualLinesChange: setManualLines,
        })}
      />
    );
  }

  render(<WorkspaceHarness />);

  await openCanvasView();
  await userEvent.click(screen.getByText("Add Card"));

  const menuPanel = document.querySelector(".estimate-workspace-add-menu-panel");
  await userEvent.click(within(menuPanel).getByRole("button", { name: /from assembly library/i }));

  const dialog = screen.getByRole("dialog", { name: /add assembly card/i });
  expect(dialog).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: /stripout package/i })).toBeInTheDocument();
  expect(within(dialog).getByLabelText(/stage/i)).toHaveValue("stage-demo");

  await userEvent.click(within(dialog).getByRole("button", { name: /create assembly card/i }));

  expect(screen.queryByRole("dialog", { name: /add assembly card/i })).not.toBeInTheDocument();
  expect(screen.getByText("Stripout Package")).toBeInTheDocument();
  expect(screen.queryByText("Stripout setup")).not.toBeInTheDocument();

  await openBuilderView();
  await expandMainWorksSection();

  expect(screen.getByDisplayValue("Stripout Package")).toBeInTheDocument();
  expect(screen.queryByText("Stripout setup")).not.toBeInTheDocument();
});

test("canvas debug mode shows lane and card metadata plus selected inspector details", async () => {
  render(<EstimateWorkspacePage {...createBaseProps()} />);

  await openCanvasView();
  await enableCanvasDebugMode();
  await userEvent.click(getCardDetailsButtonByName("Site fencing"));

  expect(screen.getByTestId("canvas-debug-active-target")).toHaveTextContent(/idle/i);
  expect(screen.getByTestId("canvas-debug-lane-stage-prelims")).toHaveTextContent(
    /stage: stage-prelims/i
  );
  expect(screen.getByTestId("canvas-debug-card-meta-manual-row-1")).toHaveTextContent(/integrity/i);
  expect(screen.getByTestId("canvas-debug-card-meta-manual-row-1")).toHaveTextContent(/valid/i);
  expect(screen.getByTestId("canvas-debug-inspector")).toHaveTextContent(/manual-row-1/i);
});

test("canvas groups invalid stage ids into the normalized stage library lane without adding extras", async () => {
  render(
    <EstimateWorkspacePage
      {...createBaseProps({
        manualBuilderRows: [
          {
            ...createBaseProps().manualBuilderRows[0],
            stageId: "999",
            stage: "",
          },
        ],
        generatedRows: [],
      })}
    />
  );

  await openCanvasView();
  await enableCanvasDebugMode();

  expect(screen.getByText("2 stages")).toBeInTheDocument();
  expect(screen.queryByTestId("canvas-debug-lane-canvas-unassigned")).not.toBeInTheDocument();
  expect(
    within(screen.getByTestId("canvas-track-cell-stage-prelims-0-0")).getByText(/site fencing/i)
  ).toBeInTheDocument();
  expect(screen.getByTestId("canvas-debug-card-meta-manual-row-1")).toHaveTextContent(/invalid/i);
});

test("canvas debug mode shows the active target while dragging", async () => {
  render(<EstimateWorkspacePage {...createBaseProps()} />);

  await openCanvasView();
  await enableCanvasDebugMode();

  const card = getCardByName("Stripout setup");
  const target = getDragTarget("canvas-column-slot-stage-prelims-1-0");
  const originalElementFromPoint = document.elementFromPoint;

  document.elementFromPoint = jest.fn(() => target);

  fireEvent.pointerDown(card, { clientX: 12, clientY: 12, button: 0, pointerId: 1 });

  await act(async () => {
    fireEvent.pointerMove(window, { clientX: 36, clientY: 36, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 48, clientY: 48, pointerId: 1 });
  });

  expect(screen.getByTestId("canvas-debug-active-target")).toHaveTextContent(
    /insert column \/ stage-prelims \/ column 1 \/ track 0/i
  );

  await act(async () => {
    fireEvent.pointerUp(window, { clientX: 48, clientY: 48, pointerId: 1 });
  });

  if (originalElementFromPoint) {
    document.elementFromPoint = originalElementFromPoint;
  } else {
    delete document.elementFromPoint;
  }
});




