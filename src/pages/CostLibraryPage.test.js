import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
        "Wall Tile,,MTL,Supply,Tiles,Tile,Finishes,600x600,Premium,Matt,ABC,SQM,30,",
      ].join("\n"),
    ],
    "costs.csv",
    { type: "text/csv" }
  );

  fireEvent.change(fileInput, { target: { files: [csvFile] } });

  await waitFor(() => expect(onCostsChange).toHaveBeenCalledTimes(1));
  expect(onCostsChange.mock.calls[0][0][0]).toMatchObject({
    itemName: "Wall Tile",
    displayName: "Tiles Wall Tile 600x600 Premium ABC Matt",
    costType: "MTL",
    deliveryType: "Supply",
    unitId: "unit-sqm",
    rate: 30,
    status: "Active",
  });
  expect(onCostsChange.mock.calls[0][0][0].internalId).toContain("cost-import-");
});

test("saves an optional image url on a cost item", async () => {
  const { onCostsChange } = renderPage({ costs: [] });

  await userEvent.click(screen.getByRole("button", { name: /add cost item/i }));
  const editorForm = screen.getByRole("button", { name: /save cost item/i }).closest("form");

  await userEvent.type(within(editorForm).getByLabelText(/core name/i), "Wall Tile");
  await userEvent.selectOptions(within(editorForm).getByLabelText(/cost type/i), "MTL");
  await userEvent.selectOptions(within(editorForm).getByLabelText(/delivery type/i), "Supply");
  await userEvent.selectOptions(within(editorForm).getByLabelText(/^trade$/i), "trade-tile");
  await userEvent.selectOptions(within(editorForm).getByLabelText(/cost code/i), "cost-code-finishes");
  await userEvent.selectOptions(within(editorForm).getByLabelText(/^unit$/i), "unit-sqm");
  await userEvent.type(within(editorForm).getByLabelText(/rate/i), "30");
  await userEvent.type(
    within(editorForm).getByLabelText(/image url/i),
    "https://example.com/tile.jpg"
  );
  await userEvent.click(screen.getByRole("button", { name: /save cost item/i }));

  await waitFor(() => expect(onCostsChange).toHaveBeenCalledTimes(1));
  expect(onCostsChange.mock.calls[0][0][0]).toMatchObject({
    itemName: "Wall Tile",
    imageUrl: "https://example.com/tile.jpg",
  });
});

test("reports row-level validation failures and duplicate internal ids during append import", async () => {
  const { onCostsChange } = renderPage();
  const fileInput = screen.getByLabelText(/import cost csv/i);
  const csvFile = new File(
    [
      [
        "Internal ID,Core Name,Item Name,Cost Type,Delivery Type,Family,Trade,Cost Code,Spec,Grade,Finish,Brand,Unit,Rate,Status,Notes,Source Link",
        "cost-1,New Tile,,MTL,Supply,Tiles,Tile,Finishes,600x600,Premium,Matt,ABC,SQM,25,Active,,",
        ",Broken Tile,,BAD,Supply,Tiles,Tile,Finishes,600x600,Premium,Matt,ABC,SQM,10,Active,,",
        ",,,MTL,Supply,Tiles,Tile,Finishes,600x600,Premium,Matt,ABC,SQM,10,Active,,",
      ].join("\n"),
    ],
    "costs.csv",
    { type: "text/csv" }
  );

  fireEvent.change(fileInput, { target: { files: [csvFile] } });

  await waitFor(() =>
    expect(screen.getByText(/Imported 0 rows\. Skipped 3 rows\./i)).toBeInTheDocument()
  );
  expect(onCostsChange).not.toHaveBeenCalled();
  expect(screen.getByText(/Row 2: Duplicate Internal ID/i)).toBeInTheDocument();
  expect(screen.getByText(/Row 3: Invalid Cost Type/i)).toBeInTheDocument();
  expect(screen.getByText(/Row 4: Missing required field: Core Name/i)).toBeInTheDocument();
});

test("toggles optional cost library columns without affecting the compact default view", async () => {
  renderPage();

  expect(screen.queryByRole("columnheader", { name: /delivery type/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("columnheader", { name: /cost code/i })).not.toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: /actions/i })).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /show more/i }));

  expect(screen.getByRole("columnheader", { name: /delivery type/i })).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: /cost code/i })).toBeInTheDocument();
  expect(screen.getByText("Supply")).toBeInTheDocument();
  expect(screen.getAllByText("Finishes")[0]).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /show less/i })).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: /actions/i })).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /show less/i }));

  expect(screen.queryByRole("columnheader", { name: /delivery type/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("columnheader", { name: /cost code/i })).not.toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: /actions/i })).toBeInTheDocument();
});
