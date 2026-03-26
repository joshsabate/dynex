import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EstimateBuilderPage from "./EstimateBuilderPage";

const stages = [
  { id: "stage-finishes", name: "Finishes", sortOrder: 1, isActive: true, color: "#d7aa5a" },
];

const trades = [
  { id: "trade-general", name: "General", sortOrder: 1, isActive: true },
];

const elements = [
  { id: "element-floor", name: "Floor", sortOrder: 1, isActive: true },
];

const costCodes = [
  { id: "cost-code-finishes", name: "Finishes", sortOrder: 1, isActive: true },
];

const units = [
  { id: "unit-ea", name: "Each", abbreviation: "EA", sortOrder: 1, isActive: true },
];

const costs = [
  { id: "cost-1", itemName: "Scaffold Hire", unitId: "unit-ea", unit: "EA", rate: 250 },
  { id: "cost-assembly-1", itemName: "Tile Installation", unitId: "unit-ea", unit: "EA", rate: 100 },
];

const assemblies = [
  {
    id: "assembly-row-1",
    assemblyId: "assembly-bathroom-floor",
    assemblyCategory: "Finishes",
    assemblyName: "Bathroom Floor Tile",
    appliesToRoomTypeId: "room-type-bathroom",
    appliesToRoomType: "Bathroom",
    stageId: "stage-finishes",
    stage: "Finishes",
    elementId: "element-floor",
    element: "Floor",
    tradeId: "trade-general",
    trade: "General",
    costCodeId: "cost-code-finishes",
    costCode: "Finishes",
    costItemId: "cost-assembly-1",
    itemName: "Tile Installation",
    unitId: "unit-ea",
    unit: "EA",
    qtyRule: "1",
    sortOrder: 1,
  },
];

const roomTemplates = [
  {
    id: "room-template-1",
    name: "Typical Bathroom",
    roomTypeId: "room-type-bathroom",
    roomType: "Bathroom",
    length: 2,
    width: 2,
    height: 2.7,
    tileHeight: 2.1,
    waterproofWallHeight: 1.2,
    quantity: 1,
    include: true,
    assemblyIds: ["assembly-bathroom-floor"],
    customItems: [],
  },
];

async function expandMainWorksSection() {
  await userEvent.click(screen.getByRole("button", { name: /main works/i }));
}

async function expandEnsuiteRoom() {
  await userEvent.click(screen.getByRole("button", { name: /ensuite 01/i }));
}

test("estimate builder adds project sections", async () => {
  const onSectionsChange = jest.fn();

  render(
    <EstimateBuilderPage
      sections={[]}
      manualLines={[]}
      stages={stages}
      trades={trades}
      elements={elements}
      costCodes={costCodes}
      units={units}
      assemblies={assemblies}
      onSectionsChange={onSectionsChange}
      onManualLinesChange={jest.fn()}
      generatedRows={[]}
      generatedRowSectionAssignments={{}}
      onGeneratedRowSectionAssignmentsChange={jest.fn()}
    />
  );

  await userEvent.type(screen.getByPlaceholderText(/preliminaries/i), "Main Works");
  await userEvent.click(screen.getByRole("button", { name: /add section/i }));

  expect(onSectionsChange).toHaveBeenCalledWith([
    expect.objectContaining({
      name: "Main Works",
      parentSectionId: "",
      stageId: "",
      sortOrder: 1,
    }),
  ]);
});

test("estimate builder adds manual items from a section action", async () => {
  const onManualLinesChange = jest.fn();

  render(
    <EstimateBuilderPage
      sections={[
        {
          id: "section-1",
          name: "Main Works",
          parentSectionId: "",
          stageId: "stage-finishes",
          sortOrder: 1,
        },
      ]}
      manualLines={[]}
      stages={stages}
      trades={trades}
      elements={elements}
      costCodes={costCodes}
      units={units}
      assemblies={assemblies}
      onSectionsChange={jest.fn()}
      onManualLinesChange={onManualLinesChange}
      generatedRows={[]}
      generatedRowSectionAssignments={{}}
      onGeneratedRowSectionAssignmentsChange={jest.fn()}
    />
  );

  await expandMainWorksSection();
  await userEvent.click(screen.getByRole("button", { name: /add manual item/i }));
  const inlineForm = document.querySelector(".estimate-builder-inline-form");

  await userEvent.type(within(inlineForm).getByPlaceholderText(/custom estimate item/i), "Scaffold");
  await userEvent.selectOptions(
    within(inlineForm).getByText("Unit").closest(".field").querySelector("select"),
    "unit-ea"
  );
  await userEvent.click(within(inlineForm).getByRole("button", { name: /add manual item$/i }));

  expect(onManualLinesChange).toHaveBeenCalledWith([
    expect.objectContaining({
      itemName: "Scaffold",
      sectionId: "section-1",
      unitId: "unit-ea",
      unit: "EA",
      quantity: 1,
      rate: 0,
    }),
  ]);
});

test("estimate builder hides detached generated-row assignment workflow", () => {

  render(
    <EstimateBuilderPage
      sections={[
        {
          id: "section-1",
          name: "Main Works",
          parentSectionId: "",
          stageId: "stage-finishes",
          sortOrder: 1,
        },
      ]}
      manualLines={[]}
      stages={stages}
      trades={trades}
      elements={elements}
      costCodes={costCodes}
      units={units}
      onSectionsChange={jest.fn()}
      onManualLinesChange={jest.fn()}
      generatedRows={[]}
      generatedRowSectionAssignments={{}}
      onGeneratedRowSectionAssignmentsChange={jest.fn()}
    />
  );

  expect(screen.queryByRole("heading", { name: /assign generated row/i })).not.toBeInTheDocument();
  expect(screen.queryByText(/project rooms/i)).not.toBeInTheDocument();
});

test("estimate builder adds a project room instance from a section action", async () => {
  const onProjectRoomsChange = jest.fn();

  render(
    <EstimateBuilderPage
      sections={[
        {
          id: "section-1",
          name: "Main Works",
          parentSectionId: "",
          stageId: "stage-finishes",
          sortOrder: 1,
        },
      ]}
      manualLines={[]}
      stages={stages}
      trades={trades}
      elements={elements}
      costCodes={costCodes}
      units={units}
      assemblies={assemblies}
      roomTemplates={roomTemplates}
      projectRooms={[]}
      onSectionsChange={jest.fn()}
      onManualLinesChange={jest.fn()}
      onProjectRoomsChange={onProjectRoomsChange}
      generatedRows={[]}
      generatedRowSectionAssignments={{}}
      onGeneratedRowSectionAssignmentsChange={jest.fn()}
    />
  );

  await expandMainWorksSection();
  await userEvent.click(screen.getByRole("button", { name: /add room/i }));
  const inlineForm = document.querySelector(".estimate-builder-inline-form");

  await userEvent.selectOptions(
    within(inlineForm).getByText("Room template").closest(".field").querySelector("select"),
    "room-template-1"
  );
  await userEvent.type(within(inlineForm).getByPlaceholderText(/optional override/i), "Ensuite 01");
  await userEvent.click(within(inlineForm).getByRole("button", { name: /add room$/i }));

  expect(onProjectRoomsChange).toHaveBeenCalledWith([
    expect.objectContaining({
      templateId: "room-template-1",
      name: "Ensuite 01",
      sectionId: "section-1",
      roomType: "Bathroom",
      assemblyIds: ["assembly-bathroom-floor"],
    }),
  ]);
});

test("estimate builder adds child sections from a section action", async () => {
  const onSectionsChange = jest.fn();

  render(
    <EstimateBuilderPage
      sections={[
        {
          id: "section-1",
          name: "Main Works",
          parentSectionId: "",
          stageId: "stage-finishes",
          sortOrder: 1,
        },
      ]}
      manualLines={[]}
      stages={stages}
      trades={trades}
      elements={elements}
      costCodes={costCodes}
      units={units}
      assemblies={assemblies}
      onSectionsChange={onSectionsChange}
      onManualLinesChange={jest.fn()}
      generatedRows={[]}
      generatedRowSectionAssignments={{}}
      onGeneratedRowSectionAssignmentsChange={jest.fn()}
    />
  );

  await expandMainWorksSection();
  await userEvent.click(screen.getByRole("button", { name: /add child section/i }));
  const inlineForm = document.querySelector(".estimate-builder-inline-form");

  await userEvent.type(within(inlineForm).getByPlaceholderText(/subsection/i), "Fixtures");
  await userEvent.click(within(inlineForm).getByRole("button", { name: /add child section$/i }));

  expect(onSectionsChange).toHaveBeenCalledWith([
    expect.objectContaining({
      id: "section-1",
      name: "Main Works",
      parentSectionId: "",
      stageId: "stage-finishes",
      sortOrder: 1,
    }),
    expect.objectContaining({
      name: "Fixtures",
      parentSectionId: "section-1",
      stageId: "stage-finishes",
      sortOrder: 1,
    }),
  ]);
});

test("estimate builder adds manual labour from a section action", async () => {
  const onManualLinesChange = jest.fn();

  render(
    <EstimateBuilderPage
      sections={[
        {
          id: "section-1",
          name: "Main Works",
          parentSectionId: "",
          stageId: "stage-finishes",
          sortOrder: 1,
        },
      ]}
      manualLines={[]}
      stages={stages}
      trades={trades}
      elements={elements}
      costCodes={costCodes}
      units={[...units, { id: "unit-hr", name: "Hour", abbreviation: "HR", sortOrder: 2, isActive: true }]}
      costs={[...costs, { id: "cost-hr", itemName: "General Labour", unitId: "unit-hr", unit: "HR", rate: 75 }]}
      assemblies={assemblies}
      onSectionsChange={jest.fn()}
      onManualLinesChange={onManualLinesChange}
      generatedRows={[]}
      generatedRowSectionAssignments={{}}
      onGeneratedRowSectionAssignmentsChange={jest.fn()}
    />
  );

  await expandMainWorksSection();
  await userEvent.click(screen.getByRole("button", { name: /add manual labour/i }));
  const inlineForm = document.querySelector(".estimate-builder-inline-form");

  await userEvent.selectOptions(
    within(inlineForm).getByText("Labour cost item").closest(".field").querySelector("select"),
    "cost-hr"
  );
  await userEvent.clear(within(inlineForm).getByText("Hours").closest(".field").querySelector("input"));
  await userEvent.type(within(inlineForm).getByText("Hours").closest(".field").querySelector("input"), "4");
  await userEvent.click(within(inlineForm).getByRole("button", { name: /add manual labour$/i }));

  expect(onManualLinesChange).toHaveBeenCalledWith([
    expect.objectContaining({
      itemName: "General Labour",
      sectionId: "section-1",
      unitId: "unit-hr",
      unit: "HR",
      quantity: 4,
      rate: 75,
      stageId: "stage-finishes",
    }),
  ]);
});

test("estimate builder adds a cost library item directly into a section", async () => {
  const onManualLinesChange = jest.fn();

  render(
    <EstimateBuilderPage
      sections={[
        {
          id: "section-1",
          name: "Main Works",
          parentSectionId: "",
          stageId: "stage-finishes",
          sortOrder: 1,
        },
      ]}
      manualLines={[]}
      stages={stages}
      trades={trades}
      elements={elements}
      costCodes={costCodes}
      units={units}
      costs={costs}
      assemblies={assemblies}
      onSectionsChange={jest.fn()}
      onManualLinesChange={onManualLinesChange}
      generatedRows={[]}
      generatedRowSectionAssignments={{}}
      onGeneratedRowSectionAssignmentsChange={jest.fn()}
    />
  );

  await expandMainWorksSection();
  await userEvent.click(screen.getByRole("button", { name: /add cost item/i }));
  const inlineForm = document.querySelector(".estimate-builder-inline-form");

  await userEvent.selectOptions(within(inlineForm).getByText("Cost item").closest(".field").querySelector("select"), "cost-1");
  await userEvent.clear(within(inlineForm).getByText("Quantity").closest(".field").querySelector("input"));
  await userEvent.type(within(inlineForm).getByText("Quantity").closest(".field").querySelector("input"), "3");
  await userEvent.type(within(inlineForm).getByPlaceholderText(/optional notes/i), "Allow access setup");
  await userEvent.click(within(inlineForm).getByRole("button", { name: /add selected cost item/i }));

  expect(onManualLinesChange).toHaveBeenCalledWith([
    expect.objectContaining({
      itemName: "Scaffold Hire",
      sectionId: "section-1",
      unitId: "unit-ea",
      unit: "EA",
      quantity: 3,
      rate: 250,
      stageId: "stage-finishes",
      notes: "Allow access setup",
    }),
  ]);
});

test("estimate builder renders project rooms inside their section with generated rows", async () => {
  render(
    <EstimateBuilderPage
      sections={[
        {
          id: "section-1",
          name: "Main Works",
          parentSectionId: "",
          stageId: "stage-finishes",
          sortOrder: 1,
        },
      ]}
      manualLines={[]}
      stages={stages}
      trades={trades}
      elements={elements}
      costCodes={costCodes}
      units={units}
      assemblies={assemblies}
      roomTemplates={roomTemplates}
      projectRooms={[
        {
          id: "project-room-1",
          templateId: "room-template-1",
          name: "Ensuite 01",
          roomType: "Bathroom",
          sectionId: "section-1",
          assemblyIds: ["assembly-bathroom-floor"],
          customItems: [],
        },
      ]}
      onSectionsChange={jest.fn()}
      onManualLinesChange={jest.fn()}
      onProjectRoomsChange={jest.fn()}
      generatedRows={[
        {
          id: "generated-row-1",
          roomId: "project-room-1",
          roomName: "Ensuite 01",
          roomType: "Bathroom",
          assemblyName: "Bathroom Floor Tile",
          itemName: "Tile Installation",
          stageId: "stage-finishes",
          tradeId: "trade-general",
          costCodeId: "cost-code-finishes",
          quantity: 10,
          unitId: "unit-ea",
          unit: "EA",
          unitRate: 100,
          sectionId: "section-1",
          source: "generated",
        },
      ]}
      generatedRowSectionAssignments={{}}
      onGeneratedRowSectionAssignmentsChange={jest.fn()}
    />
  );

  await expandMainWorksSection();
  await expandEnsuiteRoom();
  expect(screen.getByDisplayValue("Ensuite 01")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Tile Installation")).toBeInTheDocument();
  expect(screen.getAllByText("Bathroom").length).toBeGreaterThan(0);
});

test("estimate builder can exclude a generated room row inside a room block", async () => {
  const onGeneratedRowOverrideChange = jest.fn();

  render(
    <EstimateBuilderPage
      sections={[
        {
          id: "section-1",
          name: "Main Works",
          parentSectionId: "",
          stageId: "stage-finishes",
          sortOrder: 1,
        },
      ]}
      manualLines={[]}
      stages={stages}
      trades={trades}
      elements={elements}
      costCodes={costCodes}
      units={units}
      assemblies={assemblies}
      projectRooms={[
        {
          id: "project-room-1",
          templateId: "room-template-1",
          name: "Ensuite 01",
          roomType: "Bathroom",
          sectionId: "section-1",
          assemblyIds: ["assembly-bathroom-floor"],
          customItems: [],
        },
      ]}
      onSectionsChange={jest.fn()}
      onManualLinesChange={jest.fn()}
      onProjectRoomsChange={jest.fn()}
      onGeneratedRowOverrideChange={onGeneratedRowOverrideChange}
      generatedRows={[
        {
          id: "generated-row-1",
          roomId: "project-room-1",
          roomName: "Ensuite 01",
          roomType: "Bathroom",
          assemblyName: "Bathroom Floor Tile",
          itemName: "Tile Installation",
          stageId: "stage-finishes",
          tradeId: "trade-general",
          costCodeId: "cost-code-finishes",
          quantity: 10,
          unitId: "unit-ea",
          unit: "EA",
          unitRate: 100,
          notes: "",
          include: true,
          sectionId: "section-1",
          source: "generated",
        },
      ]}
      generatedRowSectionAssignments={{}}
      onGeneratedRowSectionAssignmentsChange={jest.fn()}
    />
  );

  await expandMainWorksSection();
  await expandEnsuiteRoom();
  await userEvent.click(screen.getByRole("button", { name: /exclude/i }));

  expect(onGeneratedRowOverrideChange).toHaveBeenCalledWith("generated-row-1", {
    includeOverride: false,
  });
});

test("estimate builder visually marks excluded generated rows", async () => {
  render(
    <EstimateBuilderPage
      sections={[
        {
          id: "section-1",
          name: "Main Works",
          parentSectionId: "",
          stageId: "stage-finishes",
          sortOrder: 1,
        },
      ]}
      manualLines={[]}
      stages={stages}
      trades={trades}
      elements={elements}
      costCodes={costCodes}
      units={units}
      assemblies={assemblies}
      projectRooms={[
        {
          id: "project-room-1",
          templateId: "room-template-1",
          name: "Ensuite 01",
          roomType: "Bathroom",
          sectionId: "section-1",
          assemblyIds: ["assembly-bathroom-floor"],
          customItems: [],
        },
      ]}
      onSectionsChange={jest.fn()}
      onManualLinesChange={jest.fn()}
      onProjectRoomsChange={jest.fn()}
      generatedRows={[
        {
          id: "generated-row-1",
          roomId: "project-room-1",
          roomName: "Ensuite 01",
          roomType: "Bathroom",
          assemblyName: "Bathroom Floor Tile",
          itemName: "Tile Installation",
          stageId: "stage-finishes",
          tradeId: "trade-general",
          costCodeId: "cost-code-finishes",
          quantity: 10,
          unitId: "unit-ea",
          unit: "EA",
          unitRate: 100,
          notes: "",
          include: false,
          sectionId: "section-1",
          source: "generated",
        },
      ]}
      generatedRowSectionAssignments={{}}
      onGeneratedRowSectionAssignmentsChange={jest.fn()}
    />
  );

  await expandMainWorksSection();
  await expandEnsuiteRoom();
  expect(screen.getByRole("button", { name: /include/i })).toBeInTheDocument();
  expect(screen.getByDisplayValue("Tile Installation").closest(".estimate-builder-grid-row")).toHaveClass(
    "estimate-builder-grid-row-excluded"
  );
});

test("estimate builder supports inline editing of generated estimate-instance rows", async () => {
  const onGeneratedRowOverrideChange = jest.fn();

  render(
    <EstimateBuilderPage
      sections={[
        {
          id: "section-1",
          name: "Main Works",
          parentSectionId: "",
          stageId: "stage-finishes",
          sortOrder: 1,
        },
      ]}
      manualLines={[]}
      stages={[
        ...stages,
        { id: "stage-services", name: "Services", sortOrder: 2, isActive: true, color: "#7ea06f" },
      ]}
      trades={[
        ...trades,
        { id: "trade-install", name: "Install", sortOrder: 2, isActive: true },
      ]}
      elements={elements}
      costCodes={[
        ...costCodes,
        { id: "cost-code-services", name: "Services", sortOrder: 2, isActive: true },
      ]}
      units={[
        ...units,
        { id: "unit-lm", name: "Lineal Metre", abbreviation: "LM", sortOrder: 2, isActive: true },
      ]}
      assemblies={assemblies}
      projectRooms={[
        {
          id: "project-room-1",
          templateId: "room-template-1",
          name: "Ensuite 01",
          roomType: "Bathroom",
          sectionId: "section-1",
          assemblyIds: ["assembly-bathroom-floor"],
          customItems: [],
        },
      ]}
      onSectionsChange={jest.fn()}
      onManualLinesChange={jest.fn()}
      onProjectRoomsChange={jest.fn()}
      onGeneratedRowOverrideChange={onGeneratedRowOverrideChange}
      generatedRows={[
        {
          id: "generated-row-1",
          roomId: "project-room-1",
          roomName: "Ensuite 01",
          roomType: "Bathroom",
          assemblyName: "Bathroom Floor Tile",
          itemName: "Tile Installation",
          stageId: "stage-finishes",
          tradeId: "trade-general",
          costCodeId: "cost-code-finishes",
          quantity: 10,
          unitId: "unit-ea",
          unit: "EA",
          unitRate: 100,
          sortOrder: 1,
          notes: "",
          include: true,
          sectionId: "section-1",
          source: "generated",
        },
      ]}
      generatedRowSectionAssignments={{}}
      onGeneratedRowSectionAssignmentsChange={jest.fn()}
    />
  );

  await expandMainWorksSection();
  await expandEnsuiteRoom();

  await userEvent.selectOptions(screen.getByLabelText(/stage for tile installation/i), "stage-services");
  expect(onGeneratedRowOverrideChange).toHaveBeenCalledWith("generated-row-1", {
    stageId: "stage-services",
    stage: "Services",
  });

  await userEvent.clear(screen.getByLabelText(/quantity for tile installation/i));
  await userEvent.type(screen.getByLabelText(/quantity for tile installation/i), "12.5");
  expect(onGeneratedRowOverrideChange).toHaveBeenLastCalledWith("generated-row-1", {
    quantityOverride: "12.5",
  });
});

test("estimate builder supports inline editing of manual estimate-instance rows", async () => {
  const onManualLinesChange = jest.fn();

  render(
    <EstimateBuilderPage
      sections={[
        {
          id: "section-1",
          name: "Main Works",
          parentSectionId: "",
          stageId: "stage-finishes",
          sortOrder: 1,
        },
      ]}
      manualLines={[
        {
          id: "manual-line-1",
          itemName: "Scaffold Hire",
          unitId: "unit-ea",
          unit: "EA",
          quantity: 1,
          rate: 250,
          stageId: "stage-finishes",
          sectionId: "section-1",
          costCodeId: "cost-code-finishes",
          tradeId: "trade-general",
          elementId: "element-floor",
          notes: "Manual line",
          sortOrder: 10,
        },
      ]}
      stages={stages}
      trades={trades}
      elements={elements}
      costCodes={costCodes}
      units={[
        ...units,
        { id: "unit-lm", name: "Lineal Metre", abbreviation: "LM", sortOrder: 2, isActive: true },
      ]}
      assemblies={assemblies}
      onSectionsChange={jest.fn()}
      onManualLinesChange={onManualLinesChange}
      generatedRows={[]}
      generatedRowSectionAssignments={{}}
      onGeneratedRowSectionAssignmentsChange={jest.fn()}
    />
  );

  await expandMainWorksSection();

  await userEvent.clear(screen.getByLabelText(/sort order for scaffold hire/i));
  await userEvent.type(screen.getByLabelText(/sort order for scaffold hire/i), "25");

  expect(onManualLinesChange).toHaveBeenLastCalledWith([
    expect.objectContaining({
      id: "manual-line-1",
      sortOrder: 25,
    }),
  ]);
});

test("estimate builder adds an assembly directly into a section as estimate rows", async () => {
  const onManualLinesChange = jest.fn();

  render(
    <EstimateBuilderPage
      sections={[
        {
          id: "section-1",
          name: "Main Works",
          parentSectionId: "",
          stageId: "stage-finishes",
          sortOrder: 1,
        },
      ]}
      manualLines={[]}
      stages={stages}
      trades={trades}
      elements={elements}
      costCodes={costCodes}
      units={units}
      costs={costs}
      assemblies={assemblies}
      onSectionsChange={jest.fn()}
      onManualLinesChange={onManualLinesChange}
      generatedRows={[]}
      generatedRowSectionAssignments={{}}
      onGeneratedRowSectionAssignmentsChange={jest.fn()}
    />
  );

  await expandMainWorksSection();
  await userEvent.click(screen.getByRole("button", { name: /^add assembly$/i }));
  const inlineForm = document.querySelector(".estimate-builder-inline-form");

  await userEvent.selectOptions(
    within(inlineForm).getByText("Assembly").closest(".field").querySelector("select"),
    "assembly-bathroom-floor"
  );
  await userEvent.click(within(inlineForm).getByRole("button", { name: /^add assembly$/i }));

  expect(onManualLinesChange).toHaveBeenCalledWith([
    expect.objectContaining({
      itemName: "Tile Installation",
      sectionId: "section-1",
      sourceAssemblyId: "assembly-bathroom-floor",
      sourceAssemblyName: "Bathroom Floor Tile",
      sourceAssemblyRowId: "assembly-row-1",
      sourceCostItemId: "cost-assembly-1",
      quantity: 1,
      rate: 100,
    }),
  ]);
});

test("estimate builder moves manual rows up within a section", async () => {
  const onManualLinesChange = jest.fn();

  render(
    <EstimateBuilderPage
      sections={[
        {
          id: "section-1",
          name: "Main Works",
          parentSectionId: "",
          stageId: "stage-finishes",
          sortOrder: 1,
        },
      ]}
      manualLines={[
        {
          id: "manual-line-1",
          itemName: "First Item",
          unitId: "unit-ea",
          unit: "EA",
          quantity: 1,
          rate: 100,
          stageId: "stage-finishes",
          sectionId: "section-1",
          costCodeId: "cost-code-finishes",
          tradeId: "trade-general",
          elementId: "element-floor",
          notes: "",
          sortOrder: 10,
        },
        {
          id: "manual-line-2",
          itemName: "Second Item",
          unitId: "unit-ea",
          unit: "EA",
          quantity: 1,
          rate: 100,
          stageId: "stage-finishes",
          sectionId: "section-1",
          costCodeId: "cost-code-finishes",
          tradeId: "trade-general",
          elementId: "element-floor",
          notes: "",
          sortOrder: 20,
        },
      ]}
      stages={stages}
      trades={trades}
      elements={elements}
      costCodes={costCodes}
      units={units}
      assemblies={assemblies}
      onSectionsChange={jest.fn()}
      onManualLinesChange={onManualLinesChange}
      generatedRows={[]}
      generatedRowSectionAssignments={{}}
      onGeneratedRowSectionAssignmentsChange={jest.fn()}
    />
  );

  await expandMainWorksSection();
  const secondItemRow = screen.getByDisplayValue("Second Item").closest(".estimate-builder-grid-row");
  await userEvent.click(within(secondItemRow).getByRole("button", { name: /move up/i }));

  expect(onManualLinesChange).toHaveBeenCalledWith([
    expect.objectContaining({ id: "manual-line-1", sortOrder: 20 }),
    expect.objectContaining({ id: "manual-line-2", sortOrder: 10 }),
  ]);
});

test("estimate builder uses one shared estimate header per section", async () => {
  render(
    <EstimateBuilderPage
      sections={[
        {
          id: "section-1",
          name: "Main Works",
          parentSectionId: "",
          stageId: "stage-finishes",
          sortOrder: 1,
        },
      ]}
      manualLines={[
        {
          id: "manual-line-1",
          itemName: "Scaffold Hire",
          unitId: "unit-ea",
          unit: "EA",
          quantity: 1,
          rate: 250,
          stageId: "stage-finishes",
          sectionId: "section-1",
          costCodeId: "cost-code-finishes",
          tradeId: "trade-general",
          elementId: "element-floor",
          notes: "Manual line",
        },
      ]}
      stages={stages}
      trades={trades}
      elements={elements}
      costCodes={costCodes}
      units={units}
      assemblies={assemblies}
      projectRooms={[
        {
          id: "project-room-1",
          templateId: "room-template-1",
          name: "Ensuite 01",
          roomType: "Bathroom",
          sectionId: "section-1",
          assemblyIds: ["assembly-bathroom-floor"],
          customItems: [],
        },
      ]}
      onSectionsChange={jest.fn()}
      onManualLinesChange={jest.fn()}
      onProjectRoomsChange={jest.fn()}
      generatedRows={[
        {
          id: "generated-row-1",
          roomId: "project-room-1",
          roomName: "Ensuite 01",
          roomType: "Bathroom",
          assemblyName: "Bathroom Floor Tile",
          itemName: "Tile Installation",
          stageId: "stage-finishes",
          tradeId: "trade-general",
          costCodeId: "cost-code-finishes",
          quantity: 10,
          unitId: "unit-ea",
          unit: "EA",
          unitRate: 100,
          notes: "",
          include: true,
          sectionId: "section-1",
          source: "generated",
        },
      ]}
      generatedRowSectionAssignments={{}}
      onGeneratedRowSectionAssignmentsChange={jest.fn()}
    />
  );

  await expandMainWorksSection();
  await expandEnsuiteRoom();
  expect(screen.getAllByRole("columnheader", { name: "Item" })).toHaveLength(1);
  expect(screen.getAllByRole("columnheader", { name: "Stage" })).toHaveLength(1);
  expect(screen.getByDisplayValue("Tile Installation")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Scaffold Hire")).toBeInTheDocument();
});
