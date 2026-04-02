import { generateEstimateRows, generateManualEstimateBuilderRows } from "./estimateRows";

const units = [
  { id: "unit-sqm", name: "Square Metre", abbreviation: "SQM" },
  { id: "unit-lm", name: "Lineal Metre", abbreviation: "LM" },
  { id: "unit-ea", name: "Each", abbreviation: "EA" },
  { id: "unit-hr", name: "Hour", abbreviation: "HR" },
];

const rooms = [
  {
    id: "room-1",
    name: "Test Bathroom",
    roomType: "Bathroom",
    length: 2,
    width: 3,
    height: 2.5,
    tileHeight: 2,
    waterproofWallHeight: 1,
    quantity: 1,
    include: true,
    assemblyIds: ["assembly-bathroom-floor", "assembly-bathroom-wall"],
  },
];

const assemblyRows = [
  {
    id: "assembly-row-1",
    assemblyId: "assembly-bathroom-floor",
    assemblyCategory: "Finishes",
    assemblyName: "Bathroom Floor",
    appliesToRoomType: "Bathroom",
    stage: "Finishes",
    element: "Floor",
    trade: "Tile",
    costItemId: "cost-1",
    itemName: "Floor Tile Installation",
    qtyRule: "FloorArea",
    unit: "sq m",
    sortOrder: 1,
  },
  {
    id: "assembly-row-2",
    assemblyId: "assembly-bathroom-wall",
    assemblyCategory: "Finishes",
    assemblyName: "Bathroom Wall",
    appliesToRoomType: "Bathroom",
    stage: "Finishes",
    element: "Wall",
    trade: "Tile",
    costItemId: "cost-2",
    itemName: "Wall Tile Installation",
    qtyRule: "TileWallArea",
    unit: "sq m",
    sortOrder: 1,
  },
];

const costRows = [
  { id: "cost-1", itemName: "Floor Tile Installation", unit: "sq m", rate: 100 },
  { id: "cost-2", itemName: "Wall Tile Installation", unit: "sq m", rate: 200 },
];

test("generates estimate rows for each selected assembly group on a room", () => {
  const rows = generateEstimateRows(rooms, assemblyRows, costRows);

  expect(rows).toHaveLength(2);
  expect(rows.map((row) => row.assemblyId)).toEqual([
    "assembly-bathroom-floor",
    "assembly-bathroom-wall",
  ]);
  expect(rows.map((row) => row.itemName)).toEqual([
    "Floor Tile Installation",
    "Wall Tile Installation",
  ]);
  expect(rows[0].costCode).toBe("Unassigned");
});

test("includes manual custom room items in estimate rows", () => {
  const rows = generateEstimateRows(
    [
      {
        ...rooms[0],
        customItems: [
          {
            id: "custom-1",
            stage: "Finishes",
            element: "Accessory",
            trade: "Install",
            itemName: "Mirror Install",
            unit: "each",
            quantity: 2,
            rate: 150,
            include: true,
            sortOrder: 50,
          },
        ],
      },
    ],
    assemblyRows,
    costRows
  );

  expect(rows).toHaveLength(3);
  expect(rows.at(-1)).toMatchObject({
    assemblyName: "Manual Item",
    itemName: "Mirror Install",
    generatedQuantity: 2,
    quantity: 2,
    generatedRate: 150,
    unitRate: 150,
    total: 300,
    source: "manual-room",
  });
});

test("supports parameter and derived metric quantity sources for template manual items and labour", () => {
  const rows = generateEstimateRows(
    [
      {
        ...rooms[0],
        manualItems: [
          {
            id: "manual-1",
            costItemId: "cost-1",
            itemName: "Floor Tile Installation",
            unit: "sq m",
            quantitySourceType: "derivedMetric",
            derivedMetricKey: "floorArea",
            include: true,
            sortOrder: 50,
          },
        ],
        labourItems: [
          {
            id: "labour-1",
            labourItemId: "cost-3",
            itemName: "Trade Support",
            unit: "HR",
            quantitySourceType: "parameter",
            parameterKey: "length",
            include: true,
            sortOrder: 60,
          },
        ],
      },
    ],
    assemblyRows,
    [...costRows, { id: "cost-3", itemName: "Trade Support", unit: "HR", rate: 60 }]
  );

  expect(rows.find((row) => row.id === "room-1-manual-1")).toMatchObject({
    source: "manual-room",
    quantity: 6,
    total: 600,
  });
  expect(rows.find((row) => row.id === "room-1-labour-1")).toMatchObject({
    source: "manual-room-labour",
    quantity: 2,
    total: 120,
  });
});

test("supports arithmetic formulas for template manual item quantities", () => {
  const rows = generateEstimateRows(
    [
      {
        ...rooms[0],
        manualItems: [
          {
            id: "manual-formula-1",
            costItemId: "cost-1",
            itemName: "Floor Tile Installation",
            unit: "sq m",
            quantitySourceType: "formula",
            formula: "(floorArea + length) / 2",
            include: true,
            sortOrder: 50,
          },
        ],
      },
    ],
    assemblyRows,
    costRows
  );

  expect(rows.find((row) => row.id === "room-1-manual-formula-1")).toMatchObject({
    source: "manual-room",
    quantity: 4,
    total: 400,
  });
});

test("applies row overrides while keeping generated values", () => {
  const rows = generateEstimateRows(rooms, assemblyRows, costRows, {
    "room-1-assembly-bathroom-floor-assembly-row-1": {
      includeOverride: true,
      quantityOverride: 10,
      rateOverride: 125,
      stageId: "stage-custom",
      stage: "Custom Stage",
      tradeId: "trade-custom",
      trade: "Custom Trade",
      costCodeId: "cost-code-custom",
      costCode: "Custom Cost Code",
      unitId: "unit-ea",
      unit: "EA",
      sortOrder: 77,
      notes: "Adjusted onsite",
    },
    "room-1-assembly-bathroom-wall-assembly-row-2": {
      includeOverride: false,
    },
  });

  expect(rows[0]).toMatchObject({
    source: "generated",
    generatedQuantity: 6,
    quantity: 10,
    generatedRate: 100,
    unitRate: 125,
    stageId: "stage-custom",
    stage: "Custom Stage",
    tradeId: "trade-custom",
    trade: "Custom Trade",
    costCodeId: "cost-code-custom",
    costCode: "Custom Cost Code",
    unitId: "unit-ea",
    unit: "EA",
    sortOrder: 77,
    total: 1250,
    notes: "Adjusted onsite",
  });
  expect(rows[1]).toMatchObject({
    include: false,
    total: 0,
  });
});

test("recomputes row stage display from the resolved stageId instead of a stale stage label", () => {
  const rows = generateManualEstimateBuilderRows(
    [
      {
        id: "manual-line-1",
        itemName: "Scaffold Hire",
        quantity: 1,
        rate: 100,
        stageId: "stage-demolition",
        stage: "Preliminaries",
      },
    ],
    {},
    [],
    [
      { id: "stage-preliminaries", name: "Preliminaries", sortOrder: 1, isActive: true },
      { id: "stage-demolition", name: "Demolition", sortOrder: 2, isActive: true },
    ]
  );

  expect(rows[0]).toMatchObject({
    stageId: "stage-demolition",
    stage: "Demolition",
  });
});

test("normalizes quantity, rate, and image gallery fields for manual builder rows", () => {
  const rows = generateManualEstimateBuilderRows(
    [
      {
        id: "manual-line-images",
        itemName: "Feature tiling",
        unitId: "unit-sqm",
        unit: "sq m",
        quantity: 12,
        rate: 37.5,
        stageId: "stage-preliminaries",
        imageUrls: ["data:image/png;base64,aaa", "", "data:image/png;base64,bbb"],
        primaryImageIndex: 1,
      },
    ],
    {},
    [],
    [{ id: "stage-preliminaries", name: "Preliminaries", sortOrder: 1, isActive: true }],
    [],
    [],
    units
  );

  expect(rows[0]).toMatchObject({
    quantity: 12,
    rate: 37.5,
    unitRate: 37.5,
    total: 450,
    imageUrls: ["data:image/png;base64,aaa", "data:image/png;base64,bbb"],
    primaryImageIndex: 1,
    imageUrl: "data:image/png;base64,bbb",
  });
});

test("allows row overrides to fully manage canvas image galleries", () => {
  const rows = generateEstimateRows(rooms, assemblyRows, costRows, {
    "room-1-assembly-bathroom-floor-assembly-row-1": {
      imageUrls: [],
      primaryImageIndex: 4,
    },
  });

  expect(rows[0]).toMatchObject({
    imageUrls: [],
    primaryImageIndex: 0,
    imageUrl: "",
  });
});

test("normalizes takeoff calibration and entries for manual builder rows", () => {
  const rows = generateManualEstimateBuilderRows(
    [
      {
        id: "manual-line-takeoff",
        itemName: "Feature tiling",
        unitId: "unit-sqm",
        unit: "sq m",
        quantity: 12,
        rate: 37.5,
        stageId: "stage-preliminaries",
        imageUrls: ["data:image/png;base64,aaa", "data:image/png;base64,bbb"],
        primaryImageIndex: 0,
        takeoffCalibrations: {
          0: {
            points: [{ x: 0.1, y: 0.2 }, { x: 0.7, y: 0.2 }],
            realLength: 4,
            realUnit: "m",
            metersPerPixel: 0.02,
          },
        },
        takeoffs: [
          {
            id: "takeoff-1",
            imageIndex: 0,
            tool: "polygon",
            points: [
              { x: 0.1, y: 0.2 },
              { x: 0.7, y: 0.2 },
              { x: 0.7, y: 0.8 },
            ],
            computedValue: 8.75,
            unit: "sqm",
            label: "Wall area",
          },
        ],
      },
    ],
    {},
    [],
    [{ id: "stage-preliminaries", name: "Preliminaries", sortOrder: 1, isActive: true }],
    [],
    [],
    units
  );

  expect(rows[0]).toMatchObject({
    takeoffCalibrations: {
      0: {
        realLength: 4,
        realUnit: "m",
        metersPerPixel: 0.02,
      },
    },
    takeoffs: [
      {
        id: "takeoff-1",
        imageIndex: 0,
        tool: "polygon",
        computedValue: 8.75,
        unit: "SQM",
        label: "Wall area",
      },
    ],
  });
});

test("allows row overrides to persist takeoff data for generated rows", () => {
  const rows = generateEstimateRows(rooms, assemblyRows, costRows, {
    "room-1-assembly-bathroom-floor-assembly-row-1": {
      imageUrls: ["data:image/png;base64,override"],
      takeoffCalibrations: {
        0: {
          points: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }],
          realLength: 5,
          realUnit: "m",
          metersPerPixel: 0.01,
        },
      },
      takeoffs: [
        {
          id: "takeoff-override",
          imageIndex: 0,
          tool: "line",
          points: [{ x: 0.1, y: 0.1 }, { x: 0.6, y: 0.1 }],
          computedValue: 2.5,
          unit: "lm",
          label: "Skirting",
        },
      ],
    },
  });

  expect(rows[0]).toMatchObject({
    takeoffCalibrations: {
      0: {
        realLength: 5,
        realUnit: "m",
        metersPerPixel: 0.01,
      },
    },
    takeoffApplied: null,
    takeoffs: [
      {
        id: "takeoff-override",
        tool: "line",
        computedValue: 2.5,
        unit: "LM",
        label: "Skirting",
      },
    ],
  });
});

test("normalizes takeoff-applied metadata for generated rows", () => {
  const rows = generateEstimateRows(rooms, assemblyRows, costRows, {
    "room-1-assembly-bathroom-floor-assembly-row-1": {
      imageUrls: ["data:image/png;base64,override"],
      quantityOverride: 2.5,
      takeoffApplied: {
        takeoffId: "takeoff-override",
        imageIndex: 0,
        tool: "line",
        computedValue: 2.5,
        unit: "lm",
        mode: "replace",
        appliedQuantity: 2.5,
        appliedAt: "2026-04-03T12:00:00.000Z",
      },
    },
  });

  expect(rows[0]).toMatchObject({
    takeoffApplied: {
      takeoffId: "takeoff-override",
      imageIndex: 0,
      tool: "line",
      computedValue: 2.5,
      unit: "LM",
      mode: "replace",
      appliedQuantity: 2.5,
      appliedAt: "2026-04-03T12:00:00.000Z",
    },
  });
});

test("invalidates takeoff-applied metadata when effective quantity changes", () => {
  const rows = generateEstimateRows(rooms, assemblyRows, costRows, {
    "room-1-assembly-bathroom-floor-assembly-row-1": {
      quantityOverride: 4,
      imageUrls: ["data:image/png;base64,override"],
      takeoffApplied: {
        takeoffId: "takeoff-override",
        imageIndex: 0,
        tool: "line",
        computedValue: 2.5,
        unit: "lm",
        mode: "replace",
        appliedQuantity: 2.5,
        appliedAt: "2026-04-03T12:00:00.000Z",
      },
    },
  });

  expect(rows[0].quantity).toBe(4);
  expect(rows[0].takeoffApplied).toBeNull();
});

test("supports kitchen-specific quantity rules from room inputs", () => {
  const rows = generateEstimateRows(
    [
      {
        id: "room-kitchen-1",
        name: "Kitchen Test",
        roomType: "Kitchen",
        length: 4,
        width: 3,
        height: 2.7,
        tileHeight: 0.6,
        waterproofWallHeight: 0,
        baseCabinetLength: 3.6,
        overheadCabinetLength: 2.4,
        benchtopLength: 3.6,
        splashbackLength: 2.8,
        splashbackHeight: 0.6,
        quantity: 1,
        include: true,
        assemblyIds: ["assembly-kitchen-base", "assembly-kitchen-splashback"],
        customItems: [],
      },
    ],
    [
      {
        id: "assembly-kitchen-row-1",
        assemblyId: "assembly-kitchen-base",
        assemblyCategory: "Joinery",
        assemblyName: "Kitchen Base Cabinets",
        appliesToRoomType: "Kitchen",
        stage: "Finishes",
        element: "Cabinetry",
        trade: "Joinery",
        costItemId: "cost-k1",
        itemName: "Kitchen Base Cabinets",
        qtyRule: "BaseCabinetLength",
        unit: "lm",
        sortOrder: 1,
      },
      {
        id: "assembly-kitchen-row-2",
        assemblyId: "assembly-kitchen-splashback",
        assemblyCategory: "Finishes",
        assemblyName: "Kitchen Splashback Tiling",
        appliesToRoomType: "Kitchen",
        stage: "Finishes",
        element: "Wall",
        trade: "Tile",
        costItemId: "cost-k2",
        itemName: "Kitchen Splashback Tiling",
        qtyRule: "SplashbackArea",
        unit: "sq m",
        sortOrder: 2,
      },
    ],
    [
      { id: "cost-k1", itemName: "Kitchen Base Cabinets", unit: "lm", rate: 1000 },
      { id: "cost-k2", itemName: "Kitchen Splashback Tiling", unit: "sq m", rate: 500 },
    ]
  );

  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({
    itemName: "Kitchen Base Cabinets",
    quantity: 3.6,
    total: 3600,
  });
  expect(rows[1]).toMatchObject({
    itemName: "Kitchen Splashback Tiling",
    quantity: 1.68,
    total: 840,
  });
});

test("supports laundry-specific assemblies using shared cabinet and splashback inputs", () => {
  const rows = generateEstimateRows(
    [
      {
        id: "room-laundry-1",
        name: "Laundry Test",
        roomType: "Service",
        length: 2.1,
        width: 1.8,
        height: 2.7,
        tileHeight: 0.6,
        waterproofWallHeight: 0,
        baseCabinetLength: 1.8,
        overheadCabinetLength: 1.2,
        benchtopLength: 1.8,
        splashbackLength: 1.8,
        splashbackHeight: 0.6,
        quantity: 1,
        include: true,
        assemblyIds: ["assembly-laundry-base", "assembly-laundry-splashback"],
        customItems: [],
      },
    ],
    [
      {
        id: "assembly-laundry-row-1",
        assemblyId: "assembly-laundry-base",
        assemblyCategory: "Joinery",
        assemblyName: "Laundry Base Cabinets",
        appliesToRoomType: "Service",
        stage: "Finishes",
        element: "Cabinetry",
        trade: "Joinery",
        costItemId: "cost-l1",
        itemName: "Laundry Base Cabinets",
        qtyRule: "BaseCabinetLength",
        unit: "lm",
        sortOrder: 1,
      },
      {
        id: "assembly-laundry-row-2",
        assemblyId: "assembly-laundry-splashback",
        assemblyCategory: "Finishes",
        assemblyName: "Laundry Splashback",
        appliesToRoomType: "Service",
        stage: "Finishes",
        element: "Wall",
        trade: "Tile",
        costItemId: "cost-l2",
        itemName: "Laundry Splashback",
        qtyRule: "SplashbackArea",
        unit: "sq m",
        sortOrder: 2,
      },
    ],
    [
      { id: "cost-l1", itemName: "Laundry Base Cabinets", unit: "lm", rate: 1000 },
      { id: "cost-l2", itemName: "Laundry Splashback", unit: "sq m", rate: 500 },
    ]
  );

  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({
    itemName: "Laundry Base Cabinets",
    quantity: 1.8,
    total: 1800,
  });
  expect(rows[1]).toMatchObject({
    itemName: "Laundry Splashback",
    quantity: 1.08,
    total: 540,
  });
});

test("generates labour rows from labour productivity and linked labour rate", () => {
  const rows = generateEstimateRows(
    rooms,
    [
      {
        id: "assembly-row-1",
        assemblyId: "assembly-bathroom-floor",
        assemblyCategory: "Finishes",
        assemblyName: "Bathroom Floor",
        appliesToRoomType: "Bathroom",
        stage: "Finishes",
        element: "Floor",
        trade: "Tile",
        costCode: "Finishes",
        costItemId: "cost-1",
        itemName: "Floor Tile Installation",
        qtyRule: "FloorArea",
        unit: "sq m",
        laborHoursPerUnit: 0.5,
        laborCostItemId: "cost-2",
        laborCostItemName: "Carpentry Labour",
        sortOrder: 1,
      },
    ],
    [
      { id: "cost-1", itemName: "Floor Tile Installation", unit: "sq m", rate: 100 },
      { id: "cost-2", itemName: "Carpentry Labour", unit: "HR", rate: 80 },
    ]
  );

  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({
    itemName: "Floor Tile Installation",
    quantity: 6,
    laborHours: 3,
  });
  expect(rows[1]).toMatchObject({
    assemblyName: "Bathroom Floor Labour",
    itemName: "Carpentry Labour",
    unit: "HR",
    quantity: 3,
    total: 240,
    laborHours: 3,
  });
});

test("matches rates by managed unit id and outputs unit abbreviations consistently", () => {
  const rows = generateEstimateRows(
    rooms,
    [
      {
        id: "assembly-row-1",
        assemblyId: "assembly-bathroom-floor",
        assemblyCategory: "Finishes",
        assemblyName: "Bathroom Floor",
        appliesToRoomType: "Bathroom",
        itemName: "Floor Tile Installation",
        qtyRule: "FloorArea",
        unitId: "unit-sqm",
        unit: "sq m",
        sortOrder: 1,
      },
    ],
    [
      {
        id: "cost-1",
        itemName: "Floor Tile Installation",
        unitId: "unit-sqm",
        unit: "SQM",
        rate: 100,
      },
    ],
    {},
    [],
    [],
    [],
    units
  );

  expect(rows[0]).toMatchObject({
    unitId: "unit-sqm",
    unit: "SQM",
    generatedRate: 100,
    total: 600,
  });
});

test("prefers linked cost item ids over free-typed item names", () => {
  const rows = generateEstimateRows(
    rooms,
    [
      {
        id: "assembly-row-linked",
        assemblyId: "assembly-bathroom-floor",
        assemblyCategory: "Finishes",
        assemblyName: "Bathroom Floor",
        costItemId: "cost-1",
        itemName: "Old Typed Name",
        qtyRule: "FloorArea",
        unitId: "unit-sqm",
        unit: "sq m",
        sortOrder: 1,
      },
    ],
    [{ id: "cost-1", itemName: "Floor Tile Installation", unitId: "unit-sqm", unit: "SQM", rate: 100 }],
    {},
    [],
    [],
    [],
    units
  );

  expect(rows[0]).toMatchObject({
    itemName: "Old Typed Name",
    generatedRate: 100,
    total: 600,
  });
});

test("does not generate assembly rows when a room has no selected assemblies", () => {
  const rows = generateEstimateRows(
    [
      {
        ...rooms[0],
        assemblyIds: [],
        customItems: [],
      },
    ],
    assemblyRows,
    costRows
  );

  expect(rows).toHaveLength(0);
});

test("uses manually selected assemblies even when they do not match the room type", () => {
  const rows = generateEstimateRows(
    [
      {
        ...rooms[0],
        assemblyIds: ["assembly-kitchen-splashback"],
      },
    ],
    [
      ...assemblyRows,
      {
        id: "assembly-row-3",
        assemblyId: "assembly-kitchen-splashback",
        assemblyCategory: "Finishes",
        assemblyName: "Kitchen Splashback",
        appliesToRoomType: "Kitchen",
        stage: "Finishes",
        element: "Wall",
        trade: "Tile",
        itemName: "Kitchen Splashback Tiling",
        qtyRule: "TileWallArea",
        unit: "sq m",
        sortOrder: 3,
      },
    ],
    [...costRows, { id: "cost-3", itemName: "Kitchen Splashback Tiling", unit: "sq m", rate: 250 }]
  );

  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    assemblyId: "assembly-kitchen-splashback",
    itemName: "Kitchen Splashback Tiling",
  });
});

test("builds estimate rows for estimate builder manual lines", () => {
  const rows = generateManualEstimateBuilderRows(
    [
      {
        id: "builder-line-1",
        itemName: "Site Office",
        unitId: "unit-ea",
        unit: "EA",
        quantity: 1,
        rate: 5000,
        stageId: "stage-finishes",
        sectionId: "section-1",
        costCodeId: "",
        tradeId: "",
        elementId: "",
        notes: "Temporary facilities",
        sortOrder: 40,
      },
    ],
    {},
    [{ id: "section-1", name: "Preliminaries" }],
    [{ id: "stage-finishes", name: "Finishes" }],
    [],
    [],
    units,
    []
  );

  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    source: "manual-builder",
    roomName: "Preliminaries",
    assemblyName: "Preliminaries",
    itemName: "Site Office",
    sortOrder: 40,
    quantity: 1,
    unitRate: 5000,
    total: 5000,
  });
});

test("builds structured display labels for assembly-generated rows", () => {
  const rows = generateEstimateRows(
    rooms,
    [
      {
        id: "assembly-row-structured",
        assemblyId: "assembly-bathroom-floor",
        assemblyCategory: "Finishes",
        assemblyName: "Bathroom Floor",
        costItemId: "cost-1",
        itemName: "Wall Frame Stud",
        workType: "Supply",
        itemFamily: "Timber",
        specification: "90x45",
        gradeOrQuality: "MGP10 LOSP",
        brand: "Dynex",
        finishOrVariant: "Primed",
        qtyRule: "FloorArea",
        unitId: "unit-sqm",
        unit: "sq m",
        sortOrder: 1,
      },
    ],
    [{ id: "cost-1", itemName: "Floor Tile Installation", unitId: "unit-sqm", unit: "SQM", rate: 100 }],
    {},
    [],
    [],
    [],
    units
  );

  expect(rows[0]).toMatchObject({
    workType: "Supply",
    itemFamily: "Timber",
    specification: "90x45",
    gradeOrQuality: "MGP10 LOSP",
    brand: "Dynex",
    finishOrVariant: "Primed",
    displayPrimary: "Timber Wall Frame Stud",
    displayMeta: "90x45 MGP10 LOSP Dynex Primed",
    displayName: "Timber Wall Frame Stud 90x45 MGP10 LOSP Dynex Primed",
  });
});

test("keeps legacy item names as fallback when structured fields are absent", () => {
  const rows = generateManualEstimateBuilderRows(
    [
      {
        id: "builder-line-legacy",
        itemName: "Legacy Typed Name",
        unitId: "unit-ea",
        unit: "EA",
        quantity: 1,
        rate: 10,
        sectionId: "section-1",
      },
    ],
    {},
    [{ id: "section-1", name: "Preliminaries" }],
    [],
    [],
    [],
    units,
    []
  );

  expect(rows[0]).toMatchObject({
    itemName: "Legacy Typed Name",
    displayPrimary: "Legacy Typed Name",
    displayMeta: "",
    displayName: "Legacy Typed Name",
  });
});
