import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AssemblyLibraryPage from "./AssemblyLibraryPage";
import {
  convertAssembliesToParentCsv,
  convertAssemblyItemsToCsv,
} from "../utils/csvUtils";

const roomTypes = [
  { id: "room-type-bathroom", name: "Bathroom", sortOrder: 1, isActive: true },
];
const units = [
  { id: "unit-sqm", name: "Square Metre", abbreviation: "SQM", sortOrder: 1, isActive: true },
  { id: "unit-hr", name: "Hour", abbreviation: "HR", sortOrder: 2, isActive: true },
];
const trades = [
  { id: "trade-tile", name: "Tile", sortOrder: 1, isActive: true },
  { id: "trade-general", name: "General", sortOrder: 2, isActive: true },
];
const costCodes = [
  { id: "cost-code-finishes", name: "Finishes", sortOrder: 1, isActive: true },
  { id: "cost-code-wall", name: "S10", sortOrder: 2, isActive: true },
];
const itemFamilies = [
  { id: "item-family-lining", name: "Linings", sortOrder: 1, isActive: true },
];
const costs = [
  {
    id: "cost-1",
    itemName: "Villaboard Sheets",
    displayName: "Villaboard Sheets",
    costType: "MTL",
    deliveryType: "Supply",
    tradeId: "trade-general",
    trade: "General",
    costCodeId: "cost-code-wall",
    costCode: "S10",
    unitId: "unit-sqm",
    unit: "SQM",
    rate: 22,
    status: "Active",
    isActive: true,
  },
];
const parameters = [
  { id: "parameter-floor-area", key: "floorArea", label: "Floor Area", inputType: "number", unit: "m2" },
  { id: "parameter-wall-area", key: "wallArea", label: "Wall Area", inputType: "number", unit: "m2" },
];
const assemblies = [
  {
    id: "assembly-1",
    assemblyName: "Wall  Villaboard Lining",
    roomTypeId: "room-type-bathroom",
    roomType: "Bathroom",
    appliesToRoomTypeId: "room-type-bathroom",
    appliesToRoomType: "Bathroom",
    assemblyGroup: "Walls & Linings",
    assemblyCategory: "Walls & Linings",
    items: [
      {
        id: "assembly-1-item-1",
        libraryItemId: "cost-1",
        itemNameSnapshot: "Villaboard Sheets",
        itemName: "Villaboard Sheets",
        costType: "MTL",
        deliveryType: "Supply",
        tradeId: "trade-general",
        trade: "General",
        costCodeId: "cost-code-wall",
        costCode: "S10",
        quantityFormula: "villaboardArea",
        unitId: "unit-sqm",
        unit: "SQM",
        baseRate: 22,
        rateOverride: "",
        isCustomItem: false,
      },
    ],
  },
];

function renderPage(overrides = {}) {
  const onAssembliesChange = jest.fn();
  const onCostsChange = jest.fn();
  const onItemFamiliesChange = jest.fn();
  render(
    <AssemblyLibraryPage
      assemblies={overrides.assemblies || assemblies}
      roomTypes={roomTypes}
      units={units}
      trades={trades}
      costCodes={costCodes}
      itemFamilies={overrides.itemFamilies || itemFamilies}
      costs={overrides.costs || costs}
      assemblyLineTemplates={overrides.assemblyLineTemplates || []}
      parameters={overrides.parameters || parameters}
      onAssembliesChange={onAssembliesChange}
      onCostsChange={onCostsChange}
      onItemFamiliesChange={onItemFamiliesChange}
    />
  );
  return { onAssembliesChange, onCostsChange, onItemFamiliesChange };
}

test("exports assembly parent and child csv files with the 2-file format", () => {
  const parentCsv = convertAssembliesToParentCsv(assemblies);
  const itemCsv = convertAssemblyItemsToCsv(assemblies);

  expect(parentCsv).toContain(
    "assembly_key,assembly_name,room_type,assembly_group,assembly_element,assembly_scope,assembly_spec,image_url,notes,sort_order,is_active"
  );
  expect(parentCsv).toContain("assembly-1,Wall  Villaboard Lining,Bathroom,Walls & Linings");
  expect(itemCsv).toContain(
    "assembly_key,line_name,cost_item_id,cost_item_name,quantity_formula,qty_rule,waste_factor,unit_override,rate_override,trade_source,trade_id,cost_code_source,cost_code_id,unit_source,notes,sort_order,is_active"
  );
  expect(itemCsv).toContain(
    "assembly-1,Villaboard Sheets,cost-1,Villaboard Sheets,villaboardArea,villaboardArea"
  );
});

test("requires linked or custom assembly items to include the new classification fields", async () => {
  renderPage({ assemblies: [] });

  await userEvent.click(screen.getByRole("button", { name: /add assembly/i }));
  await userEvent.click(screen.getByRole("button", { name: /manage assembly items/i }));
  await userEvent.click(screen.getByRole("button", { name: /add custom item/i }));
  await userEvent.type(screen.getByLabelText(/element/i), "Wall");
  await userEvent.type(screen.getByLabelText(/scope/i), "Villaboard Lining");
  await userEvent.selectOptions(screen.getByLabelText(/assembly group/i), "Walls & Linings");
  await userEvent.click(screen.getByRole("button", { name: /save assembly/i }));

  expect(screen.getByText(/cost item 1: item name is required\./i)).toBeInTheDocument();
  expect(screen.getByText(/cost item 1: cost type is required\./i)).toBeInTheDocument();
  expect(screen.getByText(/cost item 1: delivery type is required\./i)).toBeInTheDocument();
  expect(screen.getByText(/cost item 1: trade is required\./i)).toBeInTheDocument();
});

test("imports 2 csv files, previews validation, and replaces matching child items", async () => {
  const { onAssembliesChange } = renderPage();
  const assembliesFile = new File(
    [
      [
        "assembly_key,assembly_name,room_type,assembly_group,assembly_element,assembly_scope,assembly_spec,image_url,notes,sort_order,is_active",
        "assembly-1,Wall  Villaboard Lining,Bathroom,Walls & Linings,Wall,Villaboard Lining,,https://example.com/assembly.jpg,Imported notes,1,true",
      ].join("\n"),
    ],
    "assemblies.csv",
    { type: "text/csv" }
  );
  const assemblyItemsFile = new File(
    [
      [
        "assembly_key,line_name,cost_item_id,cost_item_name,quantity_formula,qty_rule,waste_factor,unit_override,rate_override,trade_source,trade_id,cost_code_source,cost_code_id,unit_source,notes,sort_order,is_active",
        "assembly-1,Villaboard Sheets,cost-1,Villaboard Sheets,floorArea,floorArea,,,12.5,inherit,trade-general,inherit,cost-code-wall,inherit,,1,true",
        "assembly-1,Install Villaboard,,Villaboard Sheets,floorArea * 0.7,floorArea * 0.7,,,75,override,trade-tile,override,cost-code-finishes,override,HR,2,true",
      ].join("\n"),
    ],
    "assembly_items.csv",
    { type: "text/csv" }
  );

  await userEvent.click(screen.getByRole("button", { name: /import csv/i }));
  fireEvent.change(screen.getByLabelText(/assemblies\.csv/i), {
    target: { files: [assembliesFile] },
  });
  fireEvent.change(screen.getByLabelText(/assembly_items\.csv/i), {
    target: { files: [assemblyItemsFile] },
  });
  await userEvent.click(screen.getByRole("button", { name: /preview import/i }));

  await waitFor(() => {
    expect(screen.getByText(/validation preview/i)).toBeInTheDocument();
  });
  expect(
    screen.getByText((_, node) => node?.textContent === "0assemblies to create")
  ).toBeInTheDocument();
  expect(
    screen.getByText((_, node) => node?.textContent === "1assemblies to update")
  ).toBeInTheDocument();
  expect(
    screen.getByText((_, node) => node?.textContent === "2child items to create")
  ).toBeInTheDocument();
  expect(
    screen.getByText((_, node) => node?.textContent === "0unresolved cost items")
  ).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /apply import/i }));

  await waitFor(() => expect(onAssembliesChange).toHaveBeenCalledTimes(1));
  const nextAssemblies = onAssembliesChange.mock.calls[0][0];

  expect(nextAssemblies).toHaveLength(1);
  expect(nextAssemblies[0].items).toHaveLength(2);
  expect(nextAssemblies[0]).toMatchObject({
    id: "assembly-1",
    imageUrl: "https://example.com/assembly.jpg",
    notes: "Imported notes",
  });
  expect(nextAssemblies[0].items[0]).toMatchObject({
    libraryItemId: "cost-1",
    itemNameSnapshot: "Villaboard Sheets",
    quantityFormula: "floorArea",
    rateOverride: 12.5,
  });
  expect(nextAssemblies[0].items[1]).toMatchObject({
    itemNameSnapshot: "Villaboard Sheets",
    tradeId: "trade-tile",
    costCodeId: "cost-code-finishes",
    unit: "SQM",
    isCustomItem: false,
  });
});

test("builds assembly names from structured identity fields and keeps notes collapsed by default", async () => {
  renderPage({ assemblies: [] });

  await userEvent.click(screen.getByRole("button", { name: /add assembly/i }));

  expect(
    screen.getByText(/Generated automatically as:\s*Element\s*Scope\s*Optional Spec/i)
  ).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText(/element/i), "Wall");
  await userEvent.type(screen.getByLabelText(/scope/i), "Villaboard Lining");
  expect(screen.getByLabelText(/assembly name/i)).toHaveValue("Wall  Villaboard Lining");
  expect(screen.queryByLabelText(/assembly notes/i)).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /add notes/i }));

  expect(screen.getByLabelText(/assembly notes/i)).toBeInTheDocument();
});

test("allows saving an assembly header with no cost items", async () => {
  const { onAssembliesChange } = renderPage({ assemblies: [] });

  await userEvent.click(screen.getByRole("button", { name: /add assembly/i }));
  await userEvent.type(screen.getByLabelText(/element/i), "Ceiling");
  await userEvent.type(screen.getByLabelText(/scope/i), "Paint");
  await userEvent.selectOptions(screen.getByLabelText(/assembly group/i), "Walls & Linings");
  await userEvent.click(screen.getByRole("button", { name: /save assembly/i }));

  await waitFor(() => expect(onAssembliesChange).toHaveBeenCalledTimes(1));

  const nextAssemblies = onAssembliesChange.mock.calls[0][0];
  expect(nextAssemblies).toHaveLength(1);
  expect(nextAssemblies[0]).toMatchObject({
    assemblyName: "Ceiling  Paint",
    assemblyGroup: "Walls & Linings",
    items: [],
  });
  expect(screen.queryByText(/at least one cost item is required\./i)).not.toBeInTheDocument();
});

test("saves an optional image url on an assembly", async () => {
  const { onAssembliesChange } = renderPage({ assemblies: [] });

  await userEvent.click(screen.getByRole("button", { name: /add assembly/i }));
  const editorForm = screen.getByRole("button", { name: /save assembly/i }).closest("form");

  await userEvent.type(within(editorForm).getByLabelText(/element/i), "Wall");
  await userEvent.type(within(editorForm).getByLabelText(/scope/i), "Feature Wall");
  await userEvent.selectOptions(
    within(editorForm).getByLabelText(/room type/i),
    "room-type-bathroom"
  );
  await userEvent.selectOptions(
    within(editorForm).getByLabelText(/assembly group/i),
    "Walls & Linings"
  );
  await userEvent.type(
    within(editorForm).getByLabelText(/image url/i),
    "https://example.com/assembly.jpg"
  );
  await userEvent.click(screen.getByRole("button", { name: /save assembly/i }));

  await waitFor(() => expect(onAssembliesChange).toHaveBeenCalledTimes(1));
  expect(onAssembliesChange.mock.calls[0][0][0]).toMatchObject({
    assemblyName: "Wall  Feature Wall",
    imageUrl: "https://example.com/assembly.jpg",
  });
});

test("supports add rename and delete in manage groups", async () => {
  const { onAssembliesChange } = renderPage({ assemblies });

  await userEvent.click(screen.getByRole("button", { name: /add assembly/i }));
  await userEvent.click(screen.getByRole("button", { name: /manage groups/i }));

  await userEvent.type(screen.getByLabelText(/add group/i), "Ceilings");
  await userEvent.click(screen.getByRole("button", { name: /add group/i }));
  const ceilingsRow = screen
    .getByText("Ceilings", { selector: "strong" })
    .closest(".assembly-library-group-row");
  await userEvent.click(within(ceilingsRow).getByRole("button", { name: /rename ceilings/i }));
  const editInput = within(ceilingsRow).getByDisplayValue("Ceilings");
  await userEvent.clear(editInput);
  await userEvent.type(editInput, "Feature Ceilings");
  await userEvent.click(within(ceilingsRow).getByRole("button", { name: /save ceilings/i }));
  await waitFor(() => {
    expect(screen.getByText("Feature Ceilings", { selector: "strong" })).toBeInTheDocument();
  });

  jest.spyOn(window, "confirm").mockReturnValue(true);
  const featureCeilingsRow = screen
    .getByText("Feature Ceilings", { selector: "strong" })
    .closest(".assembly-library-group-row");
  await userEvent.click(within(featureCeilingsRow).getByRole("button", { name: /delete feature ceilings/i }));
  expect(screen.queryByText("Feature Ceilings")).not.toBeInTheDocument();

  const wallsRow = screen
    .getByText("Walls & Linings", { selector: "strong" })
    .closest(".assembly-library-group-row");
  await userEvent.click(within(wallsRow).getByRole("button", { name: /rename walls & linings/i }));
  const usedEditInput = within(wallsRow).getByDisplayValue("Walls & Linings");
  await userEvent.clear(usedEditInput);
  await userEvent.type(usedEditInput, "Wall Systems");
  await userEvent.click(within(wallsRow).getByRole("button", { name: /save walls & linings/i }));

  await waitFor(() => {
    expect(screen.getByText("Wall Systems", { selector: "strong" })).toBeInTheDocument();
  });
  expect(
    screen.getByText((_, node) => node?.textContent === "In use by existing assemblies")
  ).toBeInTheDocument();
  await waitFor(() => expect(onAssembliesChange).toHaveBeenCalled());
  window.confirm.mockRestore();
});

test("deletes in-use groups by reassigning affected assemblies to Unassigned", async () => {
  const { onAssembliesChange } = renderPage({ assemblies });
  jest.spyOn(window, "confirm").mockReturnValue(true);

  await userEvent.click(screen.getByRole("button", { name: /add assembly/i }));
  await userEvent.click(screen.getByRole("button", { name: /manage groups/i }));

  const wallsRow = screen
    .getByText("Walls & Linings", { selector: "strong" })
    .closest(".assembly-library-group-row");
  await userEvent.click(within(wallsRow).getByRole("button", { name: /delete walls & linings/i }));

  expect(window.confirm).toHaveBeenCalledWith(
    expect.stringMatching(/used by 1 assemblies\. those assemblies will be reassigned to unassigned\./i)
  );
  await waitFor(() => expect(onAssembliesChange).toHaveBeenCalled());
  const nextAssemblies = onAssembliesChange.mock.calls.at(-1)[0];
  expect(nextAssemblies[0]).toMatchObject({
    assemblyGroup: "Unassigned",
    assemblyCategory: "Unassigned",
  });
  expect(screen.getByText("Unassigned", { selector: "strong" })).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /delete unassigned/i })
  ).toBeDisabled();
  window.confirm.mockRestore();
});

test("shows the selected assembly group value after selection", async () => {
  renderPage({ assemblies: [] });

  await userEvent.click(screen.getByRole("button", { name: /add assembly/i }));
  await userEvent.selectOptions(screen.getByLabelText(/assembly group/i), "Walls & Linings");

  expect(screen.getByText(/selected: walls & linings/i)).toBeInTheDocument();
});

test("supports selecting multiple linked cost items and adding them together", async () => {
  const multiCosts = [
    ...costs,
    {
      id: "cost-2",
      itemName: "Waterproof Membrane",
      displayName: "Waterproof Membrane",
      costType: "MTL",
      deliveryType: "Supply",
      tradeId: "trade-general",
      trade: "General",
      costCodeId: "cost-code-wall",
      costCode: "S10",
      unitId: "unit-sqm",
      unit: "SQM",
      rate: 39,
      status: "Active",
      isActive: true,
    },
  ];

  renderPage({ assemblies: [], costs: multiCosts });

  await userEvent.click(screen.getByRole("button", { name: /add assembly/i }));
  await userEvent.click(screen.getByRole("button", { name: /manage assembly items/i }));
  await userEvent.click(screen.getByRole("button", { name: /add from cost library/i }));
  await userEvent.click(screen.getByLabelText(/select villaboard sheets/i));
  await userEvent.click(screen.getByLabelText(/select waterproof membrane/i));
  await userEvent.click(screen.getByRole("button", { name: /add selected \(2\)/i }));

  expect(screen.getByText("Villaboard Sheets")).toBeInTheDocument();
  expect(screen.getByText("Waterproof Membrane")).toBeInTheDocument();
});

test("inherits all linked cost library fields and shows unassigned labels for missing linked values", async () => {
  const linkedCosts = [
    {
      id: "cost-linked-full",
      itemName: "Tile Adhesive",
      displayName: "Tile Adhesive",
      costType: "MTL",
      deliveryType: "Supply",
      tradeId: "trade-general",
      trade: "General",
      costCodeId: "cost-code-wall",
      costCode: "S10",
      unitId: "unit-sqm",
      unit: "SQM",
      rate: 19,
      status: "Active",
      isActive: true,
    },
    {
      id: "cost-linked-unassigned",
      itemName: "Primer",
      displayName: "Primer",
      costType: "MTL",
      deliveryType: "Supply",
      tradeId: "",
      trade: "",
      costCodeId: "",
      costCode: "",
      unitId: "unit-sqm",
      unit: "SQM",
      rate: 7,
      status: "Active",
      isActive: true,
    },
  ];

  renderPage({ assemblies: [], costs: linkedCosts });

  await userEvent.click(screen.getByRole("button", { name: /add assembly/i }));
  await userEvent.click(screen.getByRole("button", { name: /manage assembly items/i }));
  await userEvent.click(screen.getByRole("button", { name: /add from cost library/i }));
  await userEvent.click(screen.getByLabelText(/select tile adhesive/i));
  await userEvent.click(screen.getByRole("button", { name: /add selected \(1\)/i }));

  expect(screen.getByLabelText(/item name/i)).toHaveValue("Tile Adhesive");
  expect(screen.getByLabelText(/^cost type$/i)).toHaveValue("MTL");
  expect(screen.getByLabelText(/delivery type/i)).toHaveValue("Supply");
  expect(screen.getByLabelText(/^trade$/i)).toHaveValue("General");
  expect(screen.getByLabelText(/cost code/i)).toHaveValue("S10");
  expect(screen.getByLabelText(/^unit$/i)).toHaveValue("SQM");
  expect(screen.getByLabelText(/base rate/i)).toHaveValue(19);
  expect(screen.getByLabelText(/link id/i)).toHaveValue("cost-linked-full");

  await userEvent.click(screen.getByRole("button", { name: /add from cost library/i }));
  await userEvent.click(screen.getByLabelText(/select primer/i));
  await userEvent.click(screen.getByRole("button", { name: /add selected \(1\)/i }));

  expect(screen.getByLabelText(/^trade$/i)).toHaveValue("Unassigned");
  expect(screen.getByLabelText(/cost code/i)).toHaveValue("Unassigned");
});

test("keeps override rate editable as a normal blank-allowed numeric input", async () => {
  renderPage({ assemblies });

  await userEvent.click(screen.getByRole("button", { name: /manage items for wall\s+villaboard lining/i }));

  const editablePanel = screen
    .getByRole("heading", { name: /assembly use fields/i })
    .closest(".assembly-library-item-detail-editable");
  const overrideRateInput = within(editablePanel).getByLabelText(/^override rate$/i);
  expect(overrideRateInput).toHaveValue(null);

  await userEvent.type(overrideRateInput, "45.5");
  expect(overrideRateInput).toHaveValue(45.5);

  await userEvent.clear(overrideRateInput);
  expect(overrideRateInput).toHaveValue(null);
});

test("builds quantity formulas from guided parameters and stores the formula string", async () => {
  renderPage({ assemblies });

  await userEvent.click(screen.getByRole("button", { name: /manage items for wall\s+villaboard lining/i }));
  await userEvent.click(screen.getByRole("button", { name: /use guided builder/i }));

  await userEvent.selectOptions(screen.getByLabelText(/base parameter/i), "floorArea");
  await userEvent.clear(screen.getByLabelText(/factor/i));
  await userEvent.type(screen.getByLabelText(/factor/i), "1.1");

  expect(screen.getByText(/floorArea \* 1.1/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /use advanced formula/i }));

  expect(screen.getByDisplayValue("floorArea * 1.1")).toBeInTheDocument();
});

test("opens manage assembly items directly from the assembly row icon", async () => {
  renderPage({ assemblies });

  await userEvent.click(screen.getByRole("button", { name: /manage items for wall\s+villaboard lining/i }));

  expect(screen.getByRole("heading", { name: /manage assembly items/i })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /assembly use fields/i })).toBeInTheDocument();
});

test("removes low-value assembly columns and shows delivery type tags in the items modal", async () => {
  renderPage({ assemblies });

  expect(screen.queryByRole("columnheader", { name: /item mix/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("columnheader", { name: /source mix/i })).not.toBeInTheDocument();
  expect(screen.getByText("Villaboard Sheets")).toHaveClass("assembly-library-name-secondary");

  await userEvent.click(screen.getByRole("button", { name: /manage items for wall\s+villaboard lining/i }));

  expect(screen.getByText("Supply")).toHaveClass("assembly-library-delivery-tag", "is-supply");
  const editablePanel = screen
    .getByRole("heading", { name: /assembly use fields/i })
    .closest(".assembly-library-item-detail-editable");
  expect(within(editablePanel).queryByLabelText(/notes/i)).not.toBeInTheDocument();
});

test("supports bulk edit across selected assembly items and keeps the selection", async () => {
  const bulkAssemblies = [
    {
      ...assemblies[0],
      items: [
        {
          id: "assembly-1-item-1",
          libraryItemId: "",
          itemNameSnapshot: "Villaboard Sheets",
          itemName: "Villaboard Sheets",
          costType: "MTL",
          deliveryType: "Supply",
          tradeId: "trade-general",
          trade: "General",
          costCodeId: "cost-code-wall",
          costCode: "S10",
          quantityFormula: "villaboardArea",
          unitId: "unit-sqm",
          unit: "SQM",
          baseRate: 22,
          rateOverride: "",
          isCustomItem: true,
        },
        {
          id: "assembly-1-item-2",
          libraryItemId: "",
          itemNameSnapshot: "Joint Compound",
          itemName: "Joint Compound",
          costType: "LBR",
          deliveryType: "Install",
          tradeId: "trade-tile",
          trade: "Tile",
          costCodeId: "cost-code-finishes",
          costCode: "Finishes",
          quantityFormula: "jointArea",
          unitId: "unit-hr",
          unit: "HR",
          baseRate: 18,
          rateOverride: "",
          isCustomItem: true,
        },
      ],
    },
  ];

  renderPage({ assemblies: bulkAssemblies });

  await userEvent.click(screen.getByRole("button", { name: /manage items for wall\s+villaboard lining/i }));
  await userEvent.click(screen.getByLabelText(/select all assembly items/i));

  expect(screen.getByText(/2 selected/i)).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /bulk edit/i }));
  const bulkEditor = screen
    .getByRole("heading", { name: /selected items/i })
    .closest(".assembly-library-items-bulk-editor");
  await userEvent.selectOptions(within(bulkEditor).getByLabelText(/^trade$/i), "trade-general");

  const bulkOverrideRateInput = within(bulkEditor).getByLabelText(/^override rate$/i);
  await userEvent.type(bulkOverrideRateInput, "45");
  await userEvent.click(within(bulkEditor).getByRole("button", { name: /apply changes/i }));

  expect(screen.getByText(/2 selected/i)).toBeInTheDocument();

  await userEvent.click(screen.getByText("Joint Compound"));

  expect(screen.getByLabelText(/^trade$/i)).toHaveValue("trade-general");
  expect(screen.getByLabelText(/^override rate$/i)).toHaveValue(45);
});

test("creates a reusable cost item inside manage assembly items and auto-adds it as linked", async () => {
  const { onCostsChange } = renderPage({ assemblies: [] });

  await userEvent.click(screen.getByRole("button", { name: /add assembly/i }));
  await userEvent.click(screen.getByRole("button", { name: /manage assembly items/i }));
  await userEvent.click(screen.getByRole("button", { name: /create new cost item/i }));

  expect(screen.getByRole("heading", { name: /create cost item/i })).toBeInTheDocument();

  await userEvent.type(screen.getByLabelText(/core name/i), "Waterproof Membrane");
  await userEvent.selectOptions(screen.getByLabelText(/^cost type$/i), "MTL");
  await userEvent.selectOptions(screen.getByLabelText(/delivery type/i), "Supply");
  await userEvent.selectOptions(screen.getByLabelText(/^trade$/i), "trade-general");
  await userEvent.selectOptions(screen.getByLabelText(/cost code/i), "cost-code-wall");
  await userEvent.selectOptions(screen.getByLabelText(/^unit$/i), "unit-sqm");
  await userEvent.type(screen.getByLabelText(/^rate$/i), "39.5");
  await userEvent.click(
    screen.getByRole("button", { name: /save to cost library and add to assembly/i })
  );

  await waitFor(() => expect(onCostsChange).toHaveBeenCalledTimes(1));

  const nextCosts = onCostsChange.mock.calls[0][0];
  expect(nextCosts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        itemName: "Waterproof Membrane",
        costType: "MTL",
        deliveryType: "Supply",
        tradeId: "trade-general",
        costCodeId: "cost-code-wall",
        unitId: "unit-sqm",
        rate: 39.5,
      }),
    ])
  );

  expect(screen.getByText(/cost item created and added to assembly/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/item name/i)).toHaveValue("Waterproof Membrane");
  expect(screen.getByLabelText(/^cost type$/i)).toHaveValue("MTL");
  expect(screen.getByLabelText(/delivery type/i)).toHaveValue("Supply");
  expect(screen.getByLabelText(/^trade$/i)).toHaveValue("General");
  expect(screen.getByLabelText(/cost code/i)).toHaveValue("S10");
  expect(screen.getByLabelText(/^unit$/i)).toHaveValue("SQM");
  expect(screen.getByLabelText(/base rate/i)).toHaveValue(39.5);
  expect(screen.getByLabelText(/link id/i).value).toMatch(/^cost-/);
});


test("copies selected assembly line templates into the current assembly as editable items", async () => {
  const assemblyLineTemplates = [
    {
      id: "template-1",
      name: "Bathroom floor tile line",
      costItemId: "cost-1",
      costItemNameSnapshot: "Villaboard Sheets",
      defaultFormula: "floorArea * 1.1",
      defaultQtyRule: "FloorArea",
      defaultUnit: "SQM",
      defaultRateOverride: "12.5",
      tradeId: "trade-general",
      costCodeId: "cost-code-wall",
      roomType: "Bathroom",
      assemblyGroup: "Walls & Linings",
      assemblyElement: "Wall",
      assemblyScope: "Villaboard Lining",
      notes: "Template note",
      sortOrder: 1,
      isActive: true,
    },
  ];

  renderPage({ assemblies: [], assemblyLineTemplates });

  await userEvent.click(screen.getByRole("button", { name: /add assembly/i }));
  await userEvent.click(screen.getByRole("button", { name: /manage assembly items/i }));
  await userEvent.click(
    screen.getByRole("button", { name: /add from assembly line library/i })
  );
  await userEvent.click(screen.getByLabelText(/select bathroom floor tile line/i));
  await userEvent.click(screen.getByRole("button", { name: /add selected \(1\)/i }));

  expect(screen.getByLabelText(/item name/i)).toHaveValue("Villaboard Sheets");
  expect(screen.getByLabelText(/^trade$/i)).toHaveValue("General");
  expect(screen.getByLabelText(/cost code/i)).toHaveValue("S10");
  expect(screen.getByLabelText(/^unit$/i)).toHaveValue("SQM");
  expect(screen.getByLabelText(/base rate/i)).toHaveValue(22);
  expect(screen.getByLabelText(/^override rate$/i)).toHaveValue(12.5);
  expect(screen.getByLabelText(/link id/i)).toHaveValue("cost-1");
});

