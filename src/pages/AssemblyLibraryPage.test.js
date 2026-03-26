import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AssemblyLibraryPage from "./AssemblyLibraryPage";

const stages = [
  { id: "stage-demo", name: "Demolition", sortOrder: 1, isActive: true, color: "#d78476" },
  { id: "stage-finish", name: "Finishes", sortOrder: 2, isActive: true, color: "#d7aa5a" },
];

const trades = [
  { id: "trade-general", name: "General", sortOrder: 1, isActive: true },
  { id: "trade-tile", name: "Tile", sortOrder: 2, isActive: true },
];

const elements = [{ id: "element-floor", name: "Floor", sortOrder: 1, isActive: true }];

const roomTypes = [
  { id: "room-type-bedroom", name: "Bedroom", sortOrder: 1, isActive: true },
  { id: "room-type-bathroom", name: "Bathroom", sortOrder: 2, isActive: true },
];

const costCodes = [
  { id: "cost-code-demo", name: "Demolition", sortOrder: 1, isActive: true },
  { id: "cost-code-finish", name: "Finishes", sortOrder: 2, isActive: true },
];

const units = [{ id: "unit-sqm", name: "Square Metre", abbreviation: "SQM", sortOrder: 1, isActive: true }];
const costs = [
  { id: "cost-1", itemName: "Tile Installation", unitId: "unit-sqm", unit: "SQM", rate: 100 },
  { id: "cost-2", itemName: "Adhesive Bed", unitId: "unit-sqm", unit: "SQM", rate: 50 },
  { id: "cost-3", itemName: "Surface Prep", unitId: "unit-sqm", unit: "SQM", rate: 25 },
  { id: "cost-4", itemName: "Tile Labour", unitId: "unit-hr", unit: "HR", rate: 80 },
];

const assemblies = [
  {
    id: "assembly-1",
    assemblyId: "assembly-group-bathroom-floor-tile",
    assemblyCategory: "Finishes",
    assemblyName: "Bathroom Floor Tile",
    appliesToRoomTypeId: "room-type-bathroom",
    appliesToRoomType: "Bathroom",
    stageId: "stage-finish",
    stage: "Finishes",
    elementId: "element-floor",
    element: "Floor",
    tradeId: "trade-tile",
    trade: "Tile",
    costCodeId: "cost-code-finish",
    costCode: "Finishes",
    costItemId: "cost-1",
    itemName: "Tile Installation",
    laborHoursPerUnit: 1,
    laborCostItemId: "",
    laborCostItemName: "",
    unitId: "unit-sqm",
    unit: "SQM",
    qtyRule: "FloorArea",
    sortOrder: 1,
  },
  {
    id: "assembly-4",
    assemblyId: "assembly-group-bathroom-floor-tile",
    assemblyCategory: "Finishes",
    assemblyName: "Bathroom Floor Tile",
    appliesToRoomTypeId: "room-type-bathroom",
    appliesToRoomType: "Bathroom",
    stageId: "stage-finish",
    stage: "Finishes",
    elementId: "element-floor",
    element: "Floor",
    tradeId: "trade-tile",
    trade: "Tile",
    costCodeId: "cost-code-finish",
    costCode: "Finishes",
    costItemId: "cost-2",
    itemName: "Adhesive Bed",
    laborHoursPerUnit: 1,
    laborCostItemId: "",
    laborCostItemName: "",
    unitId: "unit-sqm",
    unit: "SQM",
    qtyRule: "FloorArea",
    sortOrder: 2,
  },
  {
    id: "assembly-2",
    assemblyCategory: "Finishes",
    assemblyName: "Bathroom Waterproofing",
    appliesToRoomTypeId: "room-type-bathroom",
    appliesToRoomType: "Bathroom",
    stageId: "stage-demo",
    stage: "Demolition",
    elementId: "element-floor",
    element: "Floor",
    tradeId: "trade-general",
    trade: "General",
    costCodeId: "cost-code-demo",
    costCode: "Demolition",
    costItemId: "cost-3",
    itemName: "Surface Prep",
    laborHoursPerUnit: 1,
    laborCostItemId: "",
    laborCostItemName: "",
    unitId: "unit-sqm",
    unit: "SQM",
    qtyRule: "FloorArea",
    sortOrder: 2,
  },
  {
    id: "assembly-3",
    assemblyCategory: "Finishes",
    assemblyName: "Bedroom Floor Tile",
    appliesToRoomTypeId: "room-type-bedroom",
    appliesToRoomType: "Bedroom",
    stageId: "stage-finish",
    stage: "Finishes",
    elementId: "element-floor",
    element: "Floor",
    tradeId: "trade-tile",
    trade: "Tile",
    costCodeId: "cost-code-finish",
    costCode: "Finishes",
    costItemId: "cost-2",
    itemName: "Adhesive Bed",
    laborHoursPerUnit: 1,
    laborCostItemId: "",
    laborCostItemName: "",
    unitId: "unit-sqm",
    unit: "SQM",
    qtyRule: "FloorArea",
    sortOrder: 3,
  },
];

function renderPage() {
  const onAssembliesChange = jest.fn();

  const view = render(
    <AssemblyLibraryPage
      assemblies={assemblies}
      stages={stages}
      trades={trades}
      elements={elements}
      roomTypes={roomTypes}
      costCodes={costCodes}
      units={units}
      costs={costs}
      onAssembliesChange={onAssembliesChange}
    />
  );

  return { ...view, onAssembliesChange };
}

function getVisibleItemNames(container) {
  return Array.from(container.querySelectorAll("tbody tr"))
    .map((row) => {
      const select = row.querySelector("td:nth-child(1) select");
      return select?.selectedOptions?.[0]?.textContent || "";
    })
    .filter(Boolean);
}

test("assembly library filters and search work together", async () => {
  const { container } = renderPage();
  const filterPanel = container.querySelector(".assembly-library-filters");
  const filterSelects = within(filterPanel).getAllByRole("combobox");

  await userEvent.selectOptions(filterSelects[0], "stage-finish");
  await userEvent.selectOptions(filterSelects[1], "room-type-bathroom");
  await userEvent.selectOptions(filterSelects[2], "trade-tile");
  await userEvent.selectOptions(filterSelects[3], "cost-code-finish");
  await userEvent.type(within(filterPanel).getByRole("textbox"), "install");
  await userEvent.click(screen.getByRole("button", { name: /expand all/i }));

  expect(getVisibleItemNames(container)).toEqual(["Tile Installation"]);
});

test("assembly library sorts by item name when header is clicked", async () => {
  const { container } = renderPage();
  await userEvent.click(screen.getByRole("button", { name: /expand all/i }));
  const sortButtons = screen.getAllByRole("button", { name: /sort by item name/i });

  await userEvent.click(sortButtons[0]);
  expect(getVisibleItemNames(container)).toEqual([
    "Adhesive Bed",
    "Tile Installation",
    "Adhesive Bed",
    "Surface Prep",
  ]);

  await userEvent.click(sortButtons[0]);
  expect(getVisibleItemNames(container)).toEqual([
    "Tile Installation",
    "Adhesive Bed",
    "Surface Prep",
    "Adhesive Bed",
  ]);
});

test("assembly library applies managed stage colors to the stage select", async () => {
  const { container } = renderPage();
  await userEvent.click(screen.getByRole("button", { name: /expand all/i }));
  const stageSelect = container.querySelector("tbody tr td:nth-child(2) select");

  expect(stageSelect).not.toBeNull();
  expect(stageSelect).toHaveStyle({
    backgroundColor: "rgba(215, 170, 90, 0.14)",
  });
});

test("assembly library groups multi-item assemblies and supports collapse", async () => {
  const { container } = renderPage();

  expect(screen.getByRole("button", { name: /bathroom floor tile/i })).toBeInTheDocument();
  expect(screen.getByText("2 items")).toBeInTheDocument();
  expect(getVisibleItemNames(container)).toEqual([]);

  await userEvent.click(screen.getByRole("button", { name: /bathroom floor tile/i }));
  expect(getVisibleItemNames(container)).toEqual([
    "Tile Installation",
    "Adhesive Bed",
  ]);

  await userEvent.click(screen.getByRole("button", { name: /bathroom floor tile/i }));

  expect(getVisibleItemNames(container)).toEqual([]);
});

test("assembly library can add a new item under an existing assembly group", async () => {
  const { onAssembliesChange } = renderPage();

  const addButtons = screen.getAllByRole("button", { name: "Add Item" });
  await userEvent.click(addButtons[0]);

  expect(onAssembliesChange).toHaveBeenCalledTimes(1);

  const nextAssemblies = onAssembliesChange.mock.calls[0][0];
  const newAssembly = nextAssemblies[nextAssemblies.length - 1];

  expect(newAssembly).toMatchObject({
    assemblyId: "assembly-group-bathroom-floor-tile",
    assemblyName: "Bathroom Floor Tile",
    appliesToRoomTypeId: "room-type-bathroom",
    costItemId: "",
    itemName: "",
    qtyRule: "FloorArea",
  });
  expect(newAssembly.sortOrder).toBe(3);
});

test("assembly library previews derived values and live calculated quantities", async () => {
  renderPage();

  await userEvent.click(screen.getAllByRole("button", { name: /preview \/ test/i })[0]);

  expect(screen.getByText("Floor Area")).toBeInTheDocument();
  expect(screen.getByText("6.00 sq m")).toBeInTheDocument();
  expect(screen.getAllByText("6.00")).toHaveLength(2);

  const widthInput = screen.getByText(/width \(m\)/i).closest(".field").querySelector("input");
  await userEvent.clear(widthInput);
  await userEvent.type(widthInput, "4");

  expect(screen.getByText("12.00 sq m")).toBeInTheDocument();
  expect(screen.getAllByText("12.00")).toHaveLength(2);
});
