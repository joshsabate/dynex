import {
  mapAssemblyItemToSupabaseRow,
  mapCostItemToSupabaseRow,
  mapSupabaseCostRowToItem,
} from "./librarySupabase";

test("maps the structured cost library model into Supabase row columns", () => {
  const row = mapCostItemToSupabaseRow({
    id: "cost-1",
    internalId: "INT-001",
    coreName: "Floor Tile",
    itemName: "Floor Tile",
    costType: "MTL",
    deliveryType: "Supply",
    workType: "Supply",
    itemFamily: "Tiles",
    tradeId: "trade-tile",
    trade: "Tile",
    costCodeId: "cost-code-finishes",
    costCode: "Finishes",
    specification: "600x600",
    gradeOrQuality: "Premium",
    finishOrVariant: "Matt",
    brand: "ABC",
    unitId: "unit-sqm",
    unit: "SQM",
    rate: 22,
    imageUrl: "https://example.com/tile.jpg",
    status: "Active",
    isActive: true,
    notes: "Imported from supplier list",
    sourceLink: "https://supplier.example/floor-tile",
    labourHoursPerUnit: 1.25,
    isTaxable: true,
    isOptional: false,
    sortOrder: 4,
  });

  expect(row).toMatchObject({
    internal_id: "INT-001",
    core_name: "Floor Tile",
    item_name: "Floor Tile",
    item_type: "MTL",
    work_type: "Supply",
    delivery_type: "Supply",
    item_family: "Tiles",
    trade_id: "trade-tile",
    trade: "Tile",
    cost_code_id: "cost-code-finishes",
    cost_code: "Finishes",
    specification: "600x600",
    grade_or_quality: "Premium",
    finish_or_variant: "Matt",
    brand: "ABC",
    unit_id: "unit-sqm",
    unit: "SQM",
    unit_cost: 22,
    image_url: "https://example.com/tile.jpg",
    status: "Active",
    is_active: true,
    internal_note: "Imported from supplier list",
    source_link: "https://supplier.example/floor-tile",
    labour_hours_per_unit: 1.25,
    is_taxable: true,
    is_optional: false,
    sort_order: 4,
    description: "Imported from supplier list",
  });
  expect(row.id).toBeUndefined();
});

test("hydrates a legacy simplified cost_items row into the app cost model", () => {
  const item = mapSupabaseCostRowToItem({
    id: "legacy-cost-1",
    item_name: "Floor Tile",
    description: "Legacy note",
    unit: "SQM",
    unit_cost: 22,
    work_type: "Supply",
    item_type: "MTL",
    trade: "Tile",
    cost_code: "Finishes",
  });

  expect(item).toMatchObject({
    id: "legacy-cost-1",
    internalId: "legacy-cost-1",
    coreName: "Floor Tile",
    itemName: "Floor Tile",
    costType: "MTL",
    deliveryType: "Supply",
    workType: "Supply",
    unit: "SQM",
    rate: 22,
    trade: "Tile",
    costCode: "Finishes",
    notes: "Legacy note",
    status: "Active",
    isActive: true,
  });
});

test("maps assembly item cost references to uuid columns only", () => {
  const invalidReferenceRow = mapAssemblyItemToSupabaseRow(
    {
      id: "assembly-1-item-1",
      libraryItemId: "WALL-PB-MTL",
      costItemId: "WALL-PB-MTL",
      itemNameSnapshot: "Villaboard Sheets",
      itemName: "Villaboard Sheets",
    },
    "assembly-1",
    0
  );

  const validReferenceRow = mapAssemblyItemToSupabaseRow(
    {
      id: "assembly-1-item-2",
      libraryItemId: "11111111-1111-4111-8111-111111111111",
      costItemId: "11111111-1111-4111-8111-111111111111",
      itemNameSnapshot: "Villaboard Sheets",
      itemName: "Villaboard Sheets",
    },
    "assembly-1",
    1
  );

  expect(invalidReferenceRow.cost_item_id).toBe("");
  expect(validReferenceRow.cost_item_id).toBe(
    "11111111-1111-4111-8111-111111111111"
  );
});
