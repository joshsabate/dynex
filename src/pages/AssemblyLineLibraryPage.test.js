import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AssemblyLineLibraryPage from "./AssemblyLineLibraryPage";

const costs = [
  {
    id: "cost-1",
    itemName: "Floor Tile",
    displayName: "Floor Tile",
    tradeId: "trade-tile",
    trade: "Tile",
    costCodeId: "cost-code-finishes",
    costCode: "Finishes",
    unit: "SQM",
    rate: 42.5,
    isActive: true,
  },
];

const trades = [{ id: "trade-tile", name: "Tile", sortOrder: 1, isActive: true }];
const costCodes = [
  { id: "cost-code-finishes", name: "Finishes", sortOrder: 1, isActive: true },
];
const units = [
  { id: "unit-sqm", abbreviation: "SQM", name: "Square Metre", sortOrder: 1, isActive: true },
];
const roomTypes = [
  { id: "room-type-bathroom", name: "Bathroom", sortOrder: 1, isActive: true },
];
const elements = [{ id: "element-floor", name: "Floor", sortOrder: 1, isActive: true }];
const parameters = [
  { id: "parameter-floor-area", key: "floorArea", label: "Floor Area", sortOrder: 1, isActive: true },
  { id: "parameter-wall-area", key: "wallArea", label: "Wall Area", sortOrder: 2, isActive: true },
];

function renderPage(overrides = {}) {
  const onAssemblyLineTemplatesChange = jest.fn();

  render(
    <AssemblyLineLibraryPage
      assemblyLineTemplates={overrides.assemblyLineTemplates || []}
      costs={costs}
      trades={trades}
      costCodes={costCodes}
      units={units}
      roomTypes={roomTypes}
      elements={elements}
      parameters={parameters}
      onAssemblyLineTemplatesChange={onAssemblyLineTemplatesChange}
    />
  );

  return { onAssemblyLineTemplatesChange };
}

test("adds, edits, and removes assembly line templates", async () => {
  const existingTemplates = [
    {
      id: "template-1",
      name: "Bathroom wall tile",
      costItemId: "cost-1",
      costItemNameSnapshot: "Floor Tile",
      defaultFormula: "wallArea",
      defaultQtyRule: "wallArea",
      defaultWasteFactor: "0.1",
      defaultUnit: "",
      defaultRateOverride: "",
      tradeId: "",
      costCodeId: "",
      roomType: "Bathroom",
      assemblyGroup: "Walls & Linings",
      assemblyElement: "Floor",
      assemblyScope: "Wall tiling",
      notes: "Existing note",
      sortOrder: 1,
      isActive: true,
    },
  ];
  const { onAssemblyLineTemplatesChange } = renderPage({
    assemblyLineTemplates: existingTemplates,
  });

  await userEvent.selectOptions(screen.getByLabelText(/^Cost item$/i), "cost-1");
  await userEvent.selectOptions(screen.getByLabelText(/room type/i), "Bathroom");
  await userEvent.selectOptions(screen.getByLabelText(/assembly element/i), "Floor");
  await userEvent.type(screen.getByLabelText(/assembly scope/i), "Floor tiling");
  expect(screen.getByLabelText(/template name/i)).toHaveValue("Floor - Floor tiling");

  await userEvent.type(screen.getByLabelText(/default formula/i), "floorArea");
  await userEvent.type(screen.getByLabelText(/assembly group/i), "Floors");
  await userEvent.click(screen.getByRole("button", { name: /add template/i }));

  expect(onAssemblyLineTemplatesChange).toHaveBeenCalledTimes(1);
  const createdTemplates = onAssemblyLineTemplatesChange.mock.calls[0][0];
  expect(createdTemplates).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "Floor - Floor tiling",
        costItemId: "cost-1",
        costItemNameSnapshot: "Floor Tile",
        defaultFormula: "floorArea",
        roomType: "Bathroom",
        assemblyGroup: "Floors",
        tradeId: "",
        costCodeId: "",
        defaultUnit: "",
      }),
    ])
  );

  await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));
  const templateNameInput = screen.getByLabelText(/template name/i);
  await userEvent.clear(templateNameInput);
  await userEvent.type(templateNameInput, "Bathroom wall tile updated");
  await userEvent.click(screen.getByRole("button", { name: /save template/i }));

  const updatedTemplates = onAssemblyLineTemplatesChange.mock.calls[1][0];
  expect(updatedTemplates[0]).toMatchObject({
    id: "template-1",
    name: "Bathroom wall tile updated",
  });

  await userEvent.click(screen.getByRole("button", { name: /^remove$/i }));
  expect(onAssemblyLineTemplatesChange.mock.calls[2][0]).toEqual([]);
});

test("supports inherited defaults and optional overrides without changing the copy payload shape", async () => {
  const { onAssemblyLineTemplatesChange } = renderPage();

  await userEvent.selectOptions(screen.getByLabelText(/^Cost item$/i), "cost-1");

  expect(screen.getByLabelText(/^Trade$/i)).toHaveValue("Tile");
  expect(screen.getByLabelText(/^Cost code$/i)).toHaveValue("Finishes");
  expect(screen.getByLabelText(/^Default unit$/i)).toHaveValue("SQM");
  expect(screen.getByLabelText(/base rate preview/i)).toHaveValue("$42.5");

  await userEvent.selectOptions(screen.getByLabelText(/trade source/i), "override");
  await userEvent.selectOptions(screen.getByLabelText(/^Trade$/i), "trade-tile");
  await userEvent.selectOptions(screen.getByLabelText(/cost code source/i), "override");
  await userEvent.selectOptions(screen.getByLabelText(/^Cost code$/i), "cost-code-finishes");
  await userEvent.selectOptions(screen.getByLabelText(/unit source/i), "override");
  await userEvent.selectOptions(screen.getByLabelText(/^Default unit$/i), "SQM");

  await userEvent.type(screen.getByLabelText(/template name/i), "Tile template");
  await userEvent.click(screen.getByRole("button", { name: /add template/i }));

  const createdTemplate = onAssemblyLineTemplatesChange.mock.calls[0][0][0];
  expect(createdTemplate).toMatchObject({
    tradeId: "trade-tile",
    costCodeId: "cost-code-finishes",
    defaultUnit: "SQM",
  });
});
