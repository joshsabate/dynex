import {
  evaluateDerivedParameters,
  extractFormulaReferences,
  resolveDerivedParameterOrder,
} from "./parameterEvaluation";

const parameters = [
  { key: "length", parameterType: "Input" },
  { key: "width", parameterType: "Input" },
  { key: "height", parameterType: "Input" },
  { key: "windowArea", parameterType: "Input" },
  { key: "floorArea", parameterType: "Derived", formula: "length * width" },
  { key: "perimeter", parameterType: "Derived", formula: "(length + width) * 2" },
  { key: "wallArea", parameterType: "Derived", formula: "perimeter * height" },
  { key: "netWallArea", parameterType: "Derived", formula: "wallArea - windowArea" },
];

test("extracts parameter references from formulas", () => {
  expect(extractFormulaReferences("(length + width) * 2")).toEqual(["length", "width"]);
});

test("resolves dependency order for derived parameters", () => {
  expect(resolveDerivedParameterOrder(parameters).orderedKeys).toEqual([
    "floorArea",
    "perimeter",
    "wallArea",
    "netWallArea",
  ]);
});

test("evaluates derived parameters safely from available inputs", () => {
  const result = evaluateDerivedParameters(parameters, {
    length: 4,
    width: 3,
    height: 2.7,
    windowArea: 2,
  });

  expect(result.values).toMatchObject({
    floorArea: 12,
    perimeter: 14,
    wallArea: 37.8,
    netWallArea: 35.8,
  });
  expect(result.errors).toHaveLength(0);
});

test("fails safely on unknown references and circular dependencies", () => {
  expect(
    evaluateDerivedParameters(
      [{ key: "mystery", parameterType: "Derived", formula: "missingInput * 2" }],
      {}
    ).errors
  ).toEqual([expect.objectContaining({ key: "mystery" })]);

  expect(
    resolveDerivedParameterOrder([
      { key: "a", parameterType: "Derived", formula: "b + 1" },
      { key: "b", parameterType: "Derived", formula: "a + 1" },
    ]).errors
  ).toEqual([expect.objectContaining({ reason: "Circular dependency" })]);
});
