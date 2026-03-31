import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RoomInputsPage from "./RoomInputsPage";
import { buildInitialRoomTypeParameterDefinitions } from "../utils/roomTypeParameters";

const roomTypes = [
  {
    id: "room-type-bedroom",
    name: "Bedroom",
    sortOrder: 1,
    isActive: true,
    parameterDefinitions: buildInitialRoomTypeParameterDefinitions("room-type-bedroom"),
  },
  {
    id: "room-type-bathroom",
    name: "Bathroom",
    sortOrder: 2,
    isActive: true,
    parameterDefinitions: buildInitialRoomTypeParameterDefinitions("room-type-bathroom"),
  },
  {
    id: "room-type-kitchen",
    name: "Kitchen",
    sortOrder: 3,
    isActive: true,
    parameterDefinitions: buildInitialRoomTypeParameterDefinitions("room-type-kitchen"),
  },
];

const costs = [
  { id: "cost-1", itemName: "Mirror Install", unitId: "unit-ea", unit: "EA", rate: 150 },
  { id: "cost-2", itemName: "Trade Support", unitId: "unit-hr", unit: "HR", rate: 80 },
];

const units = [
  { id: "unit-sqm", name: "Square Metre", abbreviation: "SQM", sortOrder: 1, isActive: true },
  { id: "unit-ea", name: "Each", abbreviation: "EA", sortOrder: 2, isActive: true },
  { id: "unit-hr", name: "Hour", abbreviation: "HR", sortOrder: 3, isActive: true },
];

const stages = [{ id: "stage-finishes", name: "Finishes", sortOrder: 1, isActive: true }];
const trades = [{ id: "trade-install", name: "Install", sortOrder: 1, isActive: true }];
const elements = [{ id: "element-accessory", name: "Accessory", sortOrder: 1, isActive: true }];
const costCodes = [{ id: "cost-code-fixtures", name: "Fixtures", sortOrder: 1, isActive: true }];

function renderPage(overrides = {}) {
  return render(
    <RoomInputsPage
      rooms={[]}
      assemblies={[]}
      roomTypes={roomTypes}
      onRoomsChange={jest.fn()}
      costs={costs}
      units={units}
      stages={stages}
      trades={trades}
      elements={elements}
      costCodes={costCodes}
      {...overrides}
    />
  );
}

test("adds the first room template and shows the full editor", async () => {
  const onRoomsChange = jest.fn();

  renderPage({ onRoomsChange });

  expect(screen.getByText(/add a room template to begin editing/i)).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /add room template/i }));

  expect(onRoomsChange).toHaveBeenCalledWith([
    expect.objectContaining({
      name: "Room Template 1",
      roomTypeId: "room-type-bedroom",
      assemblyIds: [],
      manualItems: [],
      labourItems: [],
    }),
  ]);
});

test("renders a selected template in one editor with preview metrics and rows", () => {
  renderPage({
    rooms: [
      {
        id: "template-1",
        name: "Bathroom Template",
        roomTypeId: "room-type-bathroom",
        roomType: "Bathroom",
        defaults: {
          length: 2,
          width: 3,
          height: 2.5,
          tileHeight: 1.2,
          waterproofWallHeight: 1,
          quantity: 1,
          include: true,
        },
        defaultAssemblyIds: ["assembly-bathroom-floor"],
      },
    ],
    assemblies: [
      {
        id: "assembly-row-1",
        assemblyId: "assembly-bathroom-floor",
        assemblyCategory: "Finishes",
        assemblyName: "Bathroom Floor Tile",
        itemName: "Tile Install",
        qtyRule: "FloorArea",
        unitId: "unit-sqm",
        unit: "SQM",
        sortOrder: 1,
        appliesToRoomTypeId: "room-type-bathroom",
        appliesToRoomType: "Bathroom",
      },
    ],
  });

  expect(screen.getByDisplayValue("Bathroom Template")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /parameters/i })).toBeInTheDocument();
  expect(screen.getAllByText("6.00 sq m").length).toBeGreaterThan(0);
  expect(screen.getByText("Tile Install")).toBeInTheDocument();
  expect(screen.getByText("6 SQM")).toBeInTheDocument();
});

test("adds assemblies directly inside the selected template editor", async () => {
  const onRoomsChange = jest.fn();

  renderPage({
    onRoomsChange,
    rooms: [
      {
        id: "template-1",
        name: "Bathroom Template",
        roomTypeId: "room-type-bathroom",
        roomType: "Bathroom",
        length: 2,
        width: 2,
        height: 2.7,
        tileHeight: 2.1,
        waterproofWallHeight: 1.2,
        quantity: 1,
        include: true,
        assemblyIds: [],
      },
    ],
    assemblies: [
      {
        id: "assembly-row-1",
        assemblyId: "assembly-bathroom-floor",
        assemblyCategory: "Finishes",
        assemblyName: "Bathroom Floor Tile",
        appliesToRoomTypeId: "room-type-bathroom",
        appliesToRoomType: "Bathroom",
      },
    ],
  });

  const assemblySelect = screen.getByText("Assembly").closest(".field").querySelector("select");

  await userEvent.selectOptions(assemblySelect, "assembly-bathroom-floor");
  await userEvent.click(screen.getByRole("button", { name: /^add assembly$/i }));

  expect(onRoomsChange).toHaveBeenCalledWith([
    expect.objectContaining({
      id: "template-1",
      assemblyIds: ["assembly-bathroom-floor"],
    }),
  ]);
});

test("adds manual items and labour with controlled selectors", async () => {
  const onRoomsChange = jest.fn();

  renderPage({
    onRoomsChange,
    rooms: [
      {
        id: "template-1",
        name: "Bathroom Template",
        roomTypeId: "room-type-bathroom",
        roomType: "Bathroom",
        length: 2,
        width: 2,
        height: 2.7,
        tileHeight: 2.1,
        waterproofWallHeight: 1.2,
        quantity: 1,
        include: true,
        assemblyIds: [],
      },
    ],
  });

  const costItemSelect = screen.getByText("Cost item").closest(".field").querySelector("select");
  await userEvent.selectOptions(costItemSelect, "cost-1");
  await userEvent.click(screen.getByRole("button", { name: /add manual item/i }));

  expect(onRoomsChange).toHaveBeenCalledWith([
    expect.objectContaining({
      manualItems: [
        expect.objectContaining({
          costItemId: "cost-1",
          quantitySourceType: "fixed",
        }),
      ],
    }),
  ]);

  const labourSelect = screen.getByText("Labour item").closest(".field").querySelector("select");
  await userEvent.selectOptions(labourSelect, "cost-2");
  await userEvent.click(screen.getByRole("button", { name: /add labour/i }));

  expect(onRoomsChange).toHaveBeenLastCalledWith([
    expect.objectContaining({
      labourItems: [
        expect.objectContaining({
          labourItemId: "cost-2",
          quantitySourceType: "fixed",
        }),
      ],
    }),
  ]);
});

test("updates visible parameter fields when the room type changes", async () => {
  const onRoomsChange = jest.fn();

  renderPage({
    onRoomsChange,
    rooms: [
      {
        id: "template-1",
        name: "Bedroom Template",
        roomTypeId: "room-type-bedroom",
        roomType: "Bedroom",
        length: 3.6,
        width: 3.2,
        height: 2.7,
        quantity: 1,
        include: true,
        assemblyIds: [],
      },
    ],
  });

  expect(screen.queryByText(/base cabinet length \(m\)/i)).not.toBeInTheDocument();

  const roomTypeSelect = screen.getByText("Room type").closest(".field").querySelector("select");
  await userEvent.selectOptions(roomTypeSelect, "room-type-kitchen");

  expect(onRoomsChange).toHaveBeenCalledWith([
    expect.objectContaining({
      roomTypeId: "room-type-kitchen",
      roomType: "Kitchen",
      baseCabinetLength: 0,
      splashbackHeight: 0.6,
    }),
  ]);
});

test("renders derived parameters as read-only values", () => {
  renderPage({
    roomTypes: [
      {
        id: "room-type-custom",
        name: "Custom",
        sortOrder: 1,
        isActive: true,
        parameterDefinitions: [
          { key: "length", defaultValue: 0, isRequired: true, sortOrder: 1 },
          { key: "width", defaultValue: 0, isRequired: true, sortOrder: 2 },
          { key: "floorArea", defaultValue: "", isRequired: false, sortOrder: 3 },
        ],
      },
    ],
    parameters: [
      { id: "parameter-length", key: "length", label: "Length", parameterType: "Input", inputType: "number", unit: "m", defaultValue: 0, category: "Core Geometry" },
      { id: "parameter-width", key: "width", label: "Width", parameterType: "Input", inputType: "number", unit: "m", defaultValue: 0, category: "Core Geometry" },
      { id: "parameter-floor-area", key: "floorArea", label: "Floor Area", parameterType: "Derived", inputType: "number", unit: "sqm", defaultValue: "", formula: "length * width", category: "Derived" },
    ],
    rooms: [
      {
        id: "template-1",
        name: "Custom Template",
        roomTypeId: "room-type-custom",
        roomType: "Custom",
        length: 2,
        width: 3,
        include: true,
        quantity: 1,
      },
    ],
  });

  const floorAreaInput = screen.getByDisplayValue("6");
  expect(floorAreaInput).toHaveAttribute("readonly");
});

test("stores parameter-based quantity sources on manual items", async () => {
  const onRoomsChange = jest.fn();

  const view = renderPage({
    onRoomsChange,
    rooms: [
      {
        id: "template-1",
        name: "Study Template",
        roomTypeId: "room-type-bedroom",
        roomType: "Bedroom",
        length: 3,
        width: 3,
        height: 2.7,
        quantity: 1,
        include: true,
        assemblyIds: [],
        manualItems: [
          {
            id: "manual-1",
            costItemId: "cost-1",
            itemName: "Mirror Install",
            unitId: "unit-ea",
            unit: "EA",
            quantitySourceType: "fixed",
            fixedQty: 1,
            include: true,
            sortOrder: 10,
          },
        ],
      },
    ],
  });

  const quantitySourceSelect = screen
    .getByText("Quantity source")
    .closest(".field")
    .querySelector("select");
  await userEvent.selectOptions(quantitySourceSelect, "parameter");

  const updatedRooms = onRoomsChange.mock.calls.at(-1)[0];
  view.rerender(
    <RoomInputsPage
      rooms={updatedRooms}
      assemblies={[]}
      roomTypes={roomTypes}
      onRoomsChange={onRoomsChange}
      costs={costs}
      units={units}
      stages={stages}
      trades={trades}
      elements={elements}
      costCodes={costCodes}
    />
  );

  const lineCard = document.querySelector(".room-template-line-card");
  const parameterSelect = lineCard.querySelectorAll(".field")[2].querySelector("select");
  await userEvent.selectOptions(parameterSelect, "length");

  expect(onRoomsChange).toHaveBeenLastCalledWith([
    expect.objectContaining({
      manualItems: [
        expect.objectContaining({
          quantitySourceType: "parameter",
          parameterKey: "length",
        }),
      ],
    }),
  ]);
});
