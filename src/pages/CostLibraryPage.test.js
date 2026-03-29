import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CostLibraryPage from "./CostLibraryPage";
import { convertCostsToCSV } from "../utils/csvUtils";

const units = [{ id: "unit-sqm", name: "Square Metre", abbreviation: "SQM", sortOrder: 1, isActive: true }];
const trades = [{ id: "trade-tile", name: "Tile", sortOrder: 1, isActive: true }];
const costCodes = [{ id: "cost-code-finishes", name: "Finishes", sortOrder: 1, isActive: true }];
const itemFamilies = [{ id: "family-tiles", name: "Tiles", sortOrder: 1, isActive: true }];
const costs = [
  {
    id: "cost-1",
    internalId: "cost-1",
    itemName: "Floor Tile",
    coreName: "Floor Tile",
    displayName: "Floor Tile",
    costType: "MTL",
    deliveryType: "Supply",
    itemFamily: "Tiles",
    family: "Tiles",
    tradeId: "trade-tile",
    trade: "Tile",
    costCodeId: "cost-code-finishes",
    costCode: "Finishes",
    unitId: "unit-sqm",
    unit: "SQM",
    rate: 22,
    status: "Active",
    isActive: true,
  },
];

function renderPage(overrides = {}) {
  const onCostsChange = jest.fn();
  render(
    <CostLibraryPage
      costs={overrides.costs || costs}
      units={units}
      trades={trades}
      costCodes={costCodes}
      itemFamilies={itemFamilies}
      onCostsChange={onCostsChange}
      onItemFamiliesChange={jest.fn()}
    />
  );
  return { onCostsChange };
}

test("builds cost csv rows with cost type, delivery type, and status", () => {
  const csvText = convertCostsToCSV(costs);
  expect(csvText).toContain(
    "Core Name,Item Name,Cost Type,Delivery Type,Family,Trade,Cost Code,Spec,Grade,Finish,Brand,Unit,Rate,Status"
  );
  expect(csvText).toContain("Floor Tile,Floor Tile,MTL,Supply,Tiles,Tile,Finishes,,,,,SQM,22,Active");
});

test("validates required cost classification fields before save", async () => {
  renderPage({ costs: [] });
  await userEvent.click(screen.getByRole("button", { name: /add cost item/i }));
  await userEvent.click(screen.getByRole("button", { name: /save cost item/i }));

  expect(screen.getByText(/item name is required\./i)).toBeInTheDocument();
  expect(screen.getByText(/cost type is required\./i)).toBeInTheDocument();
  expect(screen.getByText(/delivery type is required\./i)).toBeInTheDocument();
});

test("imports cost csv rows using the new classification columns", async () => {
  const { onCostsChange } = renderPage({ costs: [] });
  const fileInput = screen.getByLabelText(/import cost csv/i);
  const csvFile = new File(
    [
      [
        "Core Name,Item Name,Cost Type,Delivery Type,Family,Trade,Cost Code,Spec,Grade,Finish,Brand,Unit,Rate,Status",
        "Wall Tile,Wall Tile,MTL,Supply,Tiles,Tile,Finishes,600x600,Premium,Matt,ABC,SQM,30,Active",
      ].join("\n"),
    ],
    "costs.csv",
    { type: "text/csv" }
  );

  fireEvent.change(fileInput, { target: { files: [csvFile] } });

  await waitFor(() => expect(onCostsChange).toHaveBeenCalledTimes(1));
  expect(onCostsChange.mock.calls[0][0][0]).toMatchObject({
    itemName: "Wall Tile",
    costType: "MTL",
    deliveryType: "Supply",
    tradeId: "trade-tile",
    costCodeId: "cost-code-finishes",
    unitId: "unit-sqm",
    rate: 30,
    status: "Active",
  });
});
