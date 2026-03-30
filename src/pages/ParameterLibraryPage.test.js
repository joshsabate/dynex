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
    description: "Wall coverage area",
    category: "Area",
    status: "Active",
  },
];

function renderPage(overrides = {}) {
  const onParametersChange = jest.fn();
  render(
    <ParameterLibraryPage
      parameters={overrides.parameters || parameters}
      onParametersChange={onParametersChange}
    />
  );
  return { onParametersChange };
}

test("exports parameter library rows to csv", () => {
  const csvText = convertParametersToCSV(parameters);

  expect(csvText).toContain(
    "Parameter Name,Parameter Key,Input Type,Unit,Default Value,Description,Category,Status"
  );
  expect(csvText).toContain("Wall Area,wallArea,number,m2,,Wall coverage area,Area,Active");
});

test("parses parameter csv rows with normalized keys", () => {
  const { rows, skippedRows } = parseParameterCsv(
    [
      "Parameter Name,Parameter Key,Unit,Description,Category,Status",
      "Floor Area,floor area,m2,Floor coverage area,Area,Active",
      ",,, , ,",
    ].join("\n")
  );

  expect(skippedRows).toBe(0);
  expect(rows[0]).toMatchObject({
    label: "Floor Area",
    key: "floorArea",
    unit: "m2",
    description: "Floor coverage area",
    category: "Area",
    status: "Active",
  });
});

test("imports parameter csv in append mode and skips duplicates", async () => {
  const { onParametersChange } = renderPage();
  const file = new File(
    [
      [
        "Parameter Name,Parameter Key,Unit,Description,Category,Status",
        "Wall Area,wallArea,m2,Duplicate,Area,Active",
        "Floor Area,floorArea,m2,Floor coverage area,Area,Active",
      ].join("\n"),
    ],
    "parameters.csv",
    { type: "text/csv" }
  );
  file.text = async () =>
    [
      "Parameter Name,Parameter Key,Unit,Description,Category,Status",
      "Wall Area,wallArea,m2,Duplicate,Area,Active",
      "Floor Area,floorArea,m2,Floor coverage area,Area,Active",
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
        "Parameter Name,Parameter Key,Unit,Description,Category,Status",
        "Wall Area,wallArea,m2,Updated description,Area,Archived",
      ].join("\n"),
    ],
    "parameters.csv",
    { type: "text/csv" }
  );
  file.text = async () =>
    [
      "Parameter Name,Parameter Key,Unit,Description,Category,Status",
      "Wall Area,wallArea,m2,Updated description,Area,Archived",
    ].join("\n");

  await userEvent.selectOptions(screen.getByLabelText(/import mode/i), "replace");

  fireEvent.change(screen.getByLabelText(/import parameter csv/i), {
    target: { files: [file] },
  });

  await waitFor(() => expect(onParametersChange).toHaveBeenCalledTimes(1));
  expect(onParametersChange.mock.calls[0][0][0]).toMatchObject({
    key: "wallArea",
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
        "Parameter Name,Parameter Key,Unit,Description,Category,Status",
        "Perimeter,perimeter,m,Room perimeter,Linear,Active",
      ].join("\n"),
    ],
    "parameters.csv",
    { type: "text/csv" }
  );
  file.text = async () =>
    [
      "Parameter Name,Parameter Key,Unit,Description,Category,Status",
      "Perimeter,perimeter,m,Room perimeter,Linear,Active",
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
  });
  expect(confirmSpy).toHaveBeenCalled();
  confirmSpy.mockRestore();
});
