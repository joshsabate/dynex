import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AssemblyLibraryPage from "./AssemblyLibraryPage";
import { convertAssembliesToCSV } from "../utils/csvUtils";

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
  render(
    <AssemblyLibraryPage
      assemblies={overrides.assemblies || assemblies}
      roomTypes={roomTypes}
      units={units}
      trades={trades}
      costCodes={costCodes}
      costs={costs}
      onAssembliesChange={onAssembliesChange}
    />
  );
  return { onAssembliesChange };
}

test("builds dynex assembly csv rows with classification fields", () => {
  const csvText = convertAssembliesToCSV(assemblies);

  expect(csvText).toContain(
    "Assembly Name,Room Type,Assembly Group,Item Name,Cost Type,Delivery Type,Trade,Cost Code,Quantity Formula,Unit,Unit Cost"
  );
  expect(csvText).toContain(
    "Wall  Villaboard Lining,Bathroom,Walls & Linings,Villaboard Sheets,MTL,Supply,General,S10,villaboardArea,SQM,22"
  );
});

test("requires linked or custom assembly items to include the new classification fields", async () => {
  renderPage({ assemblies: [] });

  await userEvent.click(screen.getByRole("button", { name: /add assembly/i }));
  await userEvent.click(screen.getByRole("button", { name: /add custom item/i }));
  await userEvent.type(screen.getByLabelText(/assembly name/i), "Wall  Villaboard Lining");
  await userEvent.selectOptions(screen.getByLabelText(/assembly group/i), "Walls & Linings");
  await userEvent.click(screen.getByRole("button", { name: /save assembly/i }));

  expect(screen.getByText(/cost item 1: item name is required\./i)).toBeInTheDocument();
  expect(screen.getByText(/cost item 1: cost type is required\./i)).toBeInTheDocument();
  expect(screen.getByText(/cost item 1: delivery type is required\./i)).toBeInTheDocument();
  expect(screen.getByText(/cost item 1: trade is required\./i)).toBeInTheDocument();
});

test("imports dynex assembly csv rows and relinks cost library items where possible", async () => {
  const { onAssembliesChange } = renderPage({ assemblies: [] });
  const fileInput = screen.getByLabelText(/import assembly csv/i);
  const csvFile = new File(
    [
      [
        "Assembly Name,Room Type,Assembly Group,Item Name,Cost Type,Delivery Type,Trade,Cost Code,Quantity Formula,Unit,Unit Cost",
        "Wall  Villaboard Lining,Bathroom,Walls & Linings,Villaboard Sheets,MTL,Supply,General,S10,villaboardArea,SQM,22",
        "Wall  Villaboard Lining,Bathroom,Walls & Linings,Install Villaboard,LBR,Install,Tile,Finishes,villaboardArea * 0.7,HR,75",
      ].join("\n"),
    ],
    "assemblies.csv",
    { type: "text/csv" }
  );

  fireEvent.change(fileInput, { target: { files: [csvFile] } });

  await waitFor(() => expect(onAssembliesChange).toHaveBeenCalledTimes(1));
  const nextAssemblies = onAssembliesChange.mock.calls[0][0];

  expect(nextAssemblies).toHaveLength(1);
  expect(nextAssemblies[0].items).toHaveLength(2);
  expect(nextAssemblies[0].items[0]).toMatchObject({
    libraryItemId: "cost-1",
    itemNameSnapshot: "Villaboard Sheets",
    costType: "MTL",
    deliveryType: "Supply",
  });
  expect(nextAssemblies[0].items[1]).toMatchObject({
    itemNameSnapshot: "Install Villaboard",
    costType: "LBR",
    deliveryType: "Install",
    isCustomItem: true,
  });
});
