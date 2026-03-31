import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ParameterLibraryPage from "./ParameterLibraryPage";
import { convertParametersToCSV, parseParameterCsv } from "../utils/csvUtils";

const parameters = [
  {
    id: "parameter-wall-area",
    key: "wallArea",
    label: "Wall Area",
    inputType: "number",
    unit: "m2",
    defaultValue: "",
    required: false,
    sortOrder: 10,
    parameterType: "Derived",
    formula: "length * width",
    description: "Wall coverage area",
    category: "Derived",
    status: "Active",
  },
];

function renderPage(overrides = {}) {
  const onParametersChange = jest.fn();
  const onExpandedCategoriesChange = jest.fn();
  render(
    <ParameterLibraryPage
      parameters={overrides.parameters || parameters}
      onParametersChange={onParametersChange}
      expandedCategories={overrides.expandedCategories}
      onExpandedCategoriesChange={onExpandedCategoriesChange}
    />
  );
  return { onParametersChange, onExpandedCategoriesChange };
}

test("exports parameter library rows to csv", () => {
  const csvText = convertParametersToCSV(parameters);

  expect(csvText).toContain(
    "Parameter Name,Parameter Key,Parameter Type,Input Type,Unit,Default Value,Required,Sort Order,Formula,Description,Category,Status"
  );
  expect(csvText).toContain(
    "Wall Area,wallArea,Derived,number,m2,,No,10,length * width,Wall coverage area,Derived,Active"
  );
});

test("parses parameter csv rows with normalized keys", () => {
  const { rows, skippedRows } = parseParameterCsv(
    [
      "Parameter Name,Parameter Key,Parameter Type,Input Type,Unit,Default Value,Required,Sort Order,Formula,Description,Category,Status",
      "Floor Area,floor area,Derived,number,m2,,Yes,20,length * width,Floor coverage area,Derived,Active",
      ",,, , ,",
    ].join("\n")
  );

  expect(skippedRows).toBe(0);
  expect(rows[0]).toMatchObject({
    label: "Floor Area",
    key: "floorArea",
    parameterType: "Derived",
    unit: "m2",
    formula: "length * width",
    description: "Floor coverage area",
    category: "Derived",
    status: "Active",
  });
});

test("imports parameter csv in append mode and skips duplicates", async () => {
  const { onParametersChange } = renderPage();
  const file = new File(
    [
      [
        "Parameter Name,Parameter Key,Parameter Type,Input Type,Unit,Default Value,Required,Sort Order,Formula,Description,Category,Status",
        "Wall Area,wallArea,Derived,number,m2,,No,10,length * width,Duplicate,Derived,Active",
        "Floor Area,floorArea,Derived,number,m2,,No,20,length * width,Floor coverage area,Derived,Active",
      ].join("\n"),
    ],
    "parameters.csv",
    { type: "text/csv" }
  );
  file.text = async () =>
    [
      "Parameter Name,Parameter Key,Parameter Type,Input Type,Unit,Default Value,Required,Sort Order,Formula,Description,Category,Status",
      "Wall Area,wallArea,Derived,number,m2,,No,10,length * width,Duplicate,Derived,Active",
      "Floor Area,floorArea,Derived,number,m2,,No,20,length * width,Floor coverage area,Derived,Active",
    ].join("\n");

  fireEvent.change(screen.getByLabelText(/import parameter csv/i), {
    target: { files: [file] },
  });

  await waitFor(() => expect(onParametersChange).toHaveBeenCalledTimes(1));
  expect(onParametersChange.mock.calls[0][0]).toHaveLength(2);
  expect(screen.getByText(/1 added, 0 replaced, 1 skipped\./i)).toBeInTheDocument();
});

test("imports parameter csv in replace duplicates mode", async () => {
  const { onParametersChange } = renderPage();
  const file = new File(
    [
      [
        "Parameter Name,Parameter Key,Parameter Type,Input Type,Unit,Default Value,Required,Sort Order,Formula,Description,Category,Status",
        "Wall Area,wallArea,Derived,number,m2,,No,10,length * width,Updated description,Derived,Archived",
      ].join("\n"),
    ],
    "parameters.csv",
    { type: "text/csv" }
  );
  file.text = async () =>
    [
      "Parameter Name,Parameter Key,Parameter Type,Input Type,Unit,Default Value,Required,Sort Order,Formula,Description,Category,Status",
      "Wall Area,wallArea,Derived,number,m2,,No,10,length * width,Updated description,Derived,Archived",
    ].join("\n");

  await userEvent.selectOptions(screen.getByLabelText(/import mode/i), "replace");

  fireEvent.change(screen.getByLabelText(/import parameter csv/i), {
    target: { files: [file] },
  });

  await waitFor(() => expect(onParametersChange).toHaveBeenCalledTimes(1));
  expect(onParametersChange.mock.calls[0][0][0]).toMatchObject({
    key: "wallArea",
    parameterType: "Derived",
    formula: "length * width",
    description: "Updated description",
    status: "Archived",
  });
  expect(screen.getByText(/0 added, 1 replaced, 0 skipped\./i)).toBeInTheDocument();
});

test("imports parameter csv in override all mode", async () => {
  const { onParametersChange } = renderPage();
  const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
  const file = new File(
    [
      [
        "Parameter Name,Parameter Key,Parameter Type,Input Type,Unit,Default Value,Required,Sort Order,Formula,Description,Category,Status",
        "Perimeter,perimeter,Derived,number,m,,No,10,(length + width) * 2,Room perimeter,Derived,Active",
      ].join("\n"),
    ],
    "parameters.csv",
    { type: "text/csv" }
  );
  file.text = async () =>
    [
      "Parameter Name,Parameter Key,Parameter Type,Input Type,Unit,Default Value,Required,Sort Order,Formula,Description,Category,Status",
      "Perimeter,perimeter,Derived,number,m,,No,10,(length + width) * 2,Room perimeter,Derived,Active",
    ].join("\n");

  await userEvent.selectOptions(screen.getByLabelText(/import mode/i), "override");

  fireEvent.change(screen.getByLabelText(/import parameter csv/i), {
    target: { files: [file] },
  });

  await waitFor(() => expect(onParametersChange).toHaveBeenCalledTimes(1));
  expect(onParametersChange.mock.calls[0][0]).toHaveLength(1);
  expect(onParametersChange.mock.calls[0][0][0]).toMatchObject({
    key: "perimeter",
    label: "Perimeter",
    parameterType: "Derived",
  });
  expect(confirmSpy).toHaveBeenCalled();
  confirmSpy.mockRestore();
});

test("groups parameters by category and filters them with search", async () => {
  renderPage({
    parameters: [
      ...parameters,
      {
        id: "parameter-waterproof-wall-area",
        key: "waterproofWallArea",
        label: "Waterproof Wall Area",
        inputType: "number",
        unit: "m2",
        defaultValue: "",
        required: true,
        sortOrder: 20,
        description: "",
        category: "Wet Area",
        status: "Active",
      },
      {
        id: "parameter-joinery-depth",
        key: "joineryDepth",
        label: "Joinery Depth",
        inputType: "number",
        unit: "mm",
        defaultValue: 600,
        required: false,
        sortOrder: 10,
        description: "",
        category: "Joinery",
        status: "Active",
      },
      {
        id: "parameter-upturn-length",
        key: "upturnLength",
        label: "Upturn Length",
        inputType: "number",
        unit: "m",
        defaultValue: 0,
        required: false,
        sortOrder: 10,
        description: "",
        category: "Waterproofing",
        status: "Active",
      },
    ],
    expandedCategories: {
      Derived: true,
      "Wet Area": true,
      Joinery: true,
      Waterproofing: true,
    },
  });

  expect(screen.getByRole("heading", { name: /^derived$/i })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /wet area/i })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /waterproofing/i })).toBeInTheDocument();
  expect(screen.getByText("wallArea")).toBeInTheDocument();

  await userEvent.type(screen.getByLabelText(/search/i), "water");

  expect(screen.getByText(/waterproof wall area/i)).toBeInTheDocument();
  expect(screen.queryByText(/joinery depth/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/^Wall Area$/i)).not.toBeInTheDocument();
});

test("collapses and expands category sections", async () => {
  const { onExpandedCategoriesChange } = renderPage({
    parameters: [
      {
        id: "parameter-waterproof-wall-area",
        key: "waterproofWallArea",
        label: "Waterproof Wall Area",
        inputType: "number",
        unit: "m2",
        defaultValue: "",
        required: true,
        sortOrder: 20,
        description: "",
        category: "Wet Area",
        status: "Active",
      },
      {
        id: "parameter-upturn-length",
        key: "upturnLength",
        label: "Upturn Length",
        inputType: "number",
        unit: "m",
        defaultValue: 0,
        required: false,
        sortOrder: 10,
        description: "",
        category: "Waterproofing",
        status: "Active",
      },
    ],
    expandedCategories: {
      "Wet Area": true,
      Waterproofing: true,
    },
  });

  expect(screen.getByText(/waterproof wall area/i)).toBeInTheDocument();
  expect(screen.getByText(/upturn length/i)).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /wet area/i }));

  expect(onExpandedCategoriesChange).toHaveBeenCalledWith({
    "Wet Area": false,
    Waterproofing: true,
  });
});

test("defaults categories to collapsed when no saved state is present", () => {
  renderPage({
    parameters: [
      {
        id: "parameter-waterproof-wall-area",
        key: "waterproofWallArea",
        label: "Waterproof Wall Area",
        inputType: "number",
        unit: "m2",
        defaultValue: "",
        required: true,
        sortOrder: 20,
        description: "",
        category: "Wet Area",
        status: "Active",
      },
    ],
  });

  expect(screen.queryByText(/waterproof wall area/i)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /wet area/i })).toHaveAttribute(
    "aria-expanded",
    "false"
  );
});

test("expand all and collapse all update visible category state", async () => {
  const { onExpandedCategoriesChange } = renderPage({
    parameters: [
      {
        id: "parameter-waterproof-wall-area",
        key: "waterproofWallArea",
        label: "Waterproof Wall Area",
        inputType: "number",
        unit: "m2",
        defaultValue: "",
        required: true,
        sortOrder: 20,
        description: "",
        category: "Wet Area",
        status: "Active",
      },
      {
        id: "parameter-upturn-length",
        key: "upturnLength",
        label: "Upturn Length",
        inputType: "number",
        unit: "m",
        defaultValue: 0,
        required: false,
        sortOrder: 10,
        description: "",
        category: "Waterproofing",
        status: "Active",
      },
    ],
    expandedCategories: {},
  });

  await userEvent.click(screen.getByRole("button", { name: /expand all/i }));

  expect(onExpandedCategoriesChange).toHaveBeenCalledWith({
    "Wet Area": true,
    Waterproofing: true,
  });

  await userEvent.click(screen.getByRole("button", { name: /collapse all/i }));

  expect(onExpandedCategoriesChange).toHaveBeenLastCalledWith({
    "Wet Area": false,
    Waterproofing: false,
  });
});

test("reorders parameters within a category by drag and drop", () => {
  const { onParametersChange } = renderPage({
    parameters: [
      {
        id: "parameter-wall-area",
        key: "wallArea",
        label: "Wall Area",
        inputType: "number",
        unit: "m2",
        defaultValue: "",
        required: false,
        sortOrder: 10,
        description: "",
        category: "Core Geometry",
        status: "Active",
      },
      {
        id: "parameter-floor-area",
        key: "floorArea",
        label: "Floor Area",
        inputType: "number",
        unit: "m2",
        defaultValue: "",
        required: false,
        sortOrder: 20,
        description: "",
        category: "Core Geometry",
        status: "Active",
      },
    ],
    expandedCategories: {
      "Core Geometry": true,
    },
  });

  const wallCard = screen.getByLabelText(/parameter wall area/i);
  const floorCard = screen.getByLabelText(/parameter floor area/i);

  fireEvent.dragStart(floorCard);
  fireEvent.dragOver(wallCard);
  fireEvent.drop(wallCard);

  expect(onParametersChange).toHaveBeenCalledTimes(1);
  expect(onParametersChange.mock.calls[0][0]).toEqual([
    expect.objectContaining({ id: "parameter-wall-area", sortOrder: 20 }),
    expect.objectContaining({ id: "parameter-floor-area", sortOrder: 10 }),
  ]);
});
