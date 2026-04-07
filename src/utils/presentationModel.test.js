import { buildEstimatePresentationModel } from "./presentationModel";

const rows = [
  {
    id: "generated-1",
    itemName: "Feature light",
    displayNameOverride: "Feature light install",
    quantity: 4,
    unit: "EA",
    unitRate: 25,
    total: 100,
    include: true,
    roomId: "room-1",
    roomName: "Kitchen",
    stage: "Fitoff",
    costCode: "E-101",
    notes: "internal note",
    source: "generated",
  },
  {
    id: "manual-1",
    itemName: "Stone benchtop",
    quantity: 1,
    unit: "EA",
    rate: 500,
    total: 500,
    include: true,
    sectionId: "section-2",
    roomName: "Kitchen",
    stage: "Joinery",
    costCode: "J-201",
    notes: "supplier allowance",
    source: "manual-builder",
  },
];

test("line-sheet output exposes primaryLabel, supporting parts and quantity/unit fields", () => {
  const model = buildEstimatePresentationModel({
    rows: [
      {
        id: "line-1",
        coreName: "Core Fixture",
        specification: "Spec A",
        gradeOrQuality: "Premium",
        brand: "Dynex",
        finishOrVariant: "Matte",
        quantity: 3,
        unit: "EA",
        roomName: "Living",
        stage: "Fitoff",
        include: true,
      },
    ],
    sections: [],
    projectRooms: [],
    groupBy: "room",
    mode: "client",
    presentationLayout: "line_sheet",
    clientPrimaryLabelField: "coreName",
    clientLineItemDetailFields: ["specification", "gradeOrQuality", "brand", "finishOrVariant"],
    clientHideQuantities: false,
    clientShowUnits: true,
    allowedClientGroupings: ["room", "stage"],
    clientGroupBy: "room",
  });

  const item = model.groups[0].items[0];
  expect(item.primaryLabel).toBe("Core Fixture");
  expect(item.supportingDetailParts).toEqual([
    "Spec A",
    "Premium",
    "Dynex",
    "Matte",
  ]);
  expect(item.quantityDisplay).toBe(3);
  expect(item.unitDisplay).toBe("EA");
  expect(model.layout).toBe("line_sheet");
});

test("buildEstimatePresentationModel groups rows by section using assignments", () => {
  const model = buildEstimatePresentationModel({
    rows,
    sections: [
      { id: "section-1", name: "Electrical" },
      { id: "section-2", name: "Joinery" },
    ],
    projectRooms: [{ id: "room-1", sectionId: "section-1" }],
    groupBy: "section",
  });

  expect(model.totals.subtotal).toBe(600);
  expect(model.groups).toHaveLength(2);
  expect(model.groups.map((group) => group.label)).toEqual(["Electrical", "Joinery"]);
  expect(model.groups[0].subtotal).toBe(100);
  expect(model.groups[1].subtotal).toBe(500);
});

test("buildEstimatePresentationModel sanitizes client mode and hides unit rates", () => {
  const model = buildEstimatePresentationModel({
    rows,
    sections: [{ id: "section-2", name: "Joinery" }],
    projectRooms: [{ id: "room-1", sectionId: "section-2" }],
    mode: "client",
    visibility: {
      hideUnitRates: true,
    },
  });

  expect(model.groups[0].items[0]).toMatchObject({
    title: "Feature light install",
    unitRate: null,
    total: null,
  });
  expect(model.groups[0].items[0].costCode).toBeUndefined();
  expect(model.groups[0].items[0].notes).toBeUndefined();
  expect(model.groups[0].items[0].source).toBeUndefined();
});

test("buildEstimatePresentationModel supports totals only visibility", () => {
  const model = buildEstimatePresentationModel({
    rows,
    visibility: {
      totalsOnly: true,
    },
  });

  expect(model.groups).toEqual([]);
  expect(model.totals.finalTotal).toBe(660);
});
