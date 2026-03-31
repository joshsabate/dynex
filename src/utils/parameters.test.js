import {
  buildInitialParameterLibrary,
  mergeSeededParameters,
  normalizeManagedParameter,
  normalizeParameterType,
  parameterCategoryOptions,
} from "./parameters";

test("builds the full seeded parameter library with recommended categories", () => {
  const parameters = buildInitialParameterLibrary();
  const wetAreaKeys = parameters
    .filter((parameter) => parameter.category === "Wet Area")
    .map((parameter) => parameter.key);
  const waterproofingKeys = parameters
    .filter((parameter) => parameter.category === "Waterproofing")
    .map((parameter) => parameter.key);

  expect(parameters).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ key: "length", category: "Core Geometry", unit: "m" }),
      expect.objectContaining({
        key: "wallArea",
        category: "Derived",
        unit: "sqm",
        parameterType: "Derived",
        formula: "perimeter * height",
      }),
      expect.objectContaining({ key: "waterproofWallArea", category: "Wet Area", unit: "sqm" }),
      expect.objectContaining({ key: "powerPointCount", category: "Electrical", unit: "ea" }),
      expect.objectContaining({ key: "projectWeeks", category: "Labour & Overheads", unit: "week" }),
    ])
  );
  expect(wetAreaKeys).toEqual(
    expect.arrayContaining(["waterproofWallArea", "waterproofWallHeight", "bathroomCorners"])
  );
  expect(waterproofingKeys).toEqual(
    expect.arrayContaining(["upturnLength", "movementJointLength", "puddleFlangeCount"])
  );
  expect(waterproofingKeys).not.toEqual(expect.arrayContaining(["waterproofWallArea"]));
  expect(parameterCategoryOptions).toEqual(
    expect.arrayContaining(["Core Geometry", "Fixtures & Fittings", "General / Misc"])
  );
});

test("merges missing seeded parameters without duplicating existing keys", () => {
  const merged = mergeSeededParameters([
    {
      id: "custom-wall-area",
      key: "wallArea",
      label: "Custom Wall Area",
      inputType: "number",
      unit: "m2",
      defaultValue: 99,
      category: "Custom",
      status: "Active",
      sortOrder: 5,
    },
  ]);

  const wallAreaRows = merged.filter((parameter) => parameter.key === "wallArea");
  expect(wallAreaRows).toHaveLength(1);
  expect(wallAreaRows[0]).toMatchObject({
    id: "custom-wall-area",
    label: "Custom Wall Area",
    category: "General / Misc",
  });
  expect(merged).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ key: "length" }),
      expect.objectContaining({ key: "allowanceQty" }),
    ])
  );
});

test("normalizes legacy compact category names into canonical spaced categories", () => {
  expect(
    normalizeManagedParameter({
      key: "length",
      label: "Length",
      category: "coreGeometry",
    }).category
  ).toBe("Core Geometry");
  expect(
    normalizeManagedParameter({
      key: "waterproofWallArea",
      label: "Waterproof Wall Area",
      category: "wetArea",
    }).category
  ).toBe("Wet Area");
  expect(
    normalizeManagedParameter({
      key: "projectWeeks",
      label: "Project Weeks",
      category: "labourOverheads",
    }).category
  ).toBe("Labour & Overheads");
});

test("defaults legacy parameters to sensible parameter types", () => {
  expect(normalizeParameterType("", "floorArea")).toBe("Derived");
  expect(normalizeParameterType("", "length")).toBe("Input");
  expect(
    normalizeManagedParameter({
      key: "itemCount",
      label: "Item Count",
    }).parameterType
  ).toBe("System");
});
