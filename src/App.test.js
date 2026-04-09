import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fetchDynexLibraryState } from "./lib/librarySupabase";
import App from "./App";

jest.mock("./lib/librarySupabase", () => ({
  fetchDynexLibraryState: jest.fn(async () => null),
}));

beforeEach(() => {
  window.localStorage.clear();
  fetchDynexLibraryState.mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function openProjectDetails() {
  await userEvent.click(screen.getByRole("button", { name: /project menu/i }));
  await userEvent.click(screen.getByRole("menuitem", { name: /project details/i }));
}

test("renders primary navigation and lands on estimate builder by default", () => {
  render(<App />);
  expect(screen.getByText(/^dynex$/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /project menu/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /room library/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /estimate builder/i })).toHaveClass("active");
});

test("logs and surfaces startup library sources from local storage", async () => {
  const consoleInfoSpy = jest.spyOn(console, "info").mockImplementation(() => {});

  window.localStorage.setItem(
    "estimator-app-global-libraries",
    JSON.stringify({
      costCodes: [{ id: "cost-code-custom", name: "Custom Cost Code", sortOrder: 1, isActive: true }],
    })
  );
  window.localStorage.setItem(
    "estimator-app-library-data",
    JSON.stringify({
      assemblies: [{ id: "assembly-1", assemblyName: "Imported Assembly" }],
      costs: [{ id: "cost-1", itemName: "Imported Cost", rate: 100 }],
    })
  );

  render(<App />);

  await openProjectDetails();

  expect(
    screen.getByText(
      /startup sources: cost codes localstorage:global-libraries; costs localstorage:library-data; assemblies localstorage:library-data\./i
    )
  ).toBeInTheDocument();
  expect(consoleInfoSpy).toHaveBeenCalledWith(
    "[Dynex] Startup library sources",
    expect.objectContaining({
      costCodes: "localStorage:global-libraries",
      costs: "localStorage:library-data",
      assemblies: "localStorage:library-data",
    })
  );
});

test("auto-saves project changes to localStorage without manual save", async () => {
  render(<App />);

  await openProjectDetails();
  await userEvent.clear(screen.getByLabelText(/project name/i));
  await userEvent.type(screen.getByLabelText(/project name/i), "Autosave Project");

  expect(JSON.parse(window.localStorage.getItem("estimator-app-project-data"))).toMatchObject({
    projectName: "Autosave Project",
  });
});

test("parameter library category expansion defaults to collapsed and persists per project", async () => {
  render(<App />);

  await userEvent.click(screen.getByRole("button", { name: /parameter library/i }));

  expect(screen.getByRole("button", { name: /wet area/i })).toHaveAttribute(
    "aria-expanded",
    "false"
  );
  expect(screen.getByRole("button", { name: /waterproofing/i })).toHaveAttribute(
    "aria-expanded",
    "false"
  );
  expect(screen.queryByText(/waterproof wall area/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/upturn length/i)).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /wet area/i }));
  await userEvent.click(screen.getByRole("button", { name: /waterproofing/i }));

  expect(screen.getByText(/waterproof wall area/i)).toBeInTheDocument();
  expect(screen.getByText(/upturn length/i)).toBeInTheDocument();

  expect(JSON.parse(window.localStorage.getItem("estimator-app-project-data"))).toMatchObject({
    parameterLibraryUiState: {
      expandedCategories: {
        "Wet Area": true,
        Waterproofing: true,
      },
    },
  });

  await openProjectDetails();
  await userEvent.click(screen.getByRole("button", { name: /parameter library/i }));

  expect(screen.getByRole("button", { name: /wet area/i })).toHaveAttribute(
    "aria-expanded",
    "true"
  );
  expect(screen.getByRole("button", { name: /waterproofing/i })).toHaveAttribute(
    "aria-expanded",
    "true"
  );
  expect(screen.getByText(/waterproof wall area/i)).toBeInTheDocument();
  expect(screen.getByText(/upturn length/i)).toBeInTheDocument();
});

test("project details shows saved state and unsaved changes automatically", async () => {
  render(<App />);

  await openProjectDetails();
  expect(screen.getByText(/^saved$/i)).toBeInTheDocument();

  await userEvent.clear(screen.getByLabelText(/project name/i));
  await userEvent.type(screen.getByLabelText(/project name/i), "Dirty Project");

  expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
});

test("save project exports the current app state to a json file", async () => {
  const originalCreateObjectURL = window.URL.createObjectURL;
  const originalRevokeObjectURL = window.URL.revokeObjectURL;
  const originalCreateElement = document.createElement.bind(document);
  const anchorClickMock = jest.fn();
  let capturedAnchor = null;

  window.URL.createObjectURL = jest.fn(() => "blob:project-file");
  window.URL.revokeObjectURL = jest.fn();

  jest.spyOn(document, "createElement").mockImplementation((tagName, options) => {
    const element = originalCreateElement(tagName, options);

    if (tagName !== "a") {
      return element;
    }

    element.click = anchorClickMock;
    capturedAnchor = element;
    return element;
  });

  try {
    render(<App />);

    await openProjectDetails();
    await userEvent.clear(screen.getByLabelText(/estimate name/i));
    await userEvent.type(screen.getByLabelText(/estimate name/i), "Preliminary Estimate");
    await userEvent.clear(screen.getByLabelText(/revision/i));
    await userEvent.type(screen.getByLabelText(/revision/i), "Rev 1");
    await userEvent.click(screen.getByRole("button", { name: /save project/i }));

    expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(capturedAnchor?.download).toBe("Preliminary Estimate Rev 1.json");
    expect(anchorClickMock).toHaveBeenCalledTimes(1);
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith("blob:project-file");
    expect(screen.getByText(/project file saved\./i)).toBeInTheDocument();
  } finally {
    window.URL.createObjectURL = originalCreateObjectURL;
    window.URL.revokeObjectURL = originalRevokeObjectURL;
  }
});

test("save as revision increments the revision and exports a new file", async () => {
  const originalPrompt = window.prompt;
  const originalCreateObjectURL = window.URL.createObjectURL;
  const originalRevokeObjectURL = window.URL.revokeObjectURL;
  const originalCreateElement = document.createElement.bind(document);
  const anchorClickMock = jest.fn();
  let capturedAnchor = null;

  window.prompt = jest.fn(() => "Revision Save Rev 1.json");
  window.URL.createObjectURL = jest.fn(() => "blob:revision-file");
  window.URL.revokeObjectURL = jest.fn();

  jest.spyOn(document, "createElement").mockImplementation((tagName, options) => {
    const element = originalCreateElement(tagName, options);

    if (tagName !== "a") {
      return element;
    }

    element.click = anchorClickMock;
    capturedAnchor = element;
    return element;
  });

  try {
    render(<App />);

    await openProjectDetails();
    await userEvent.clear(screen.getByLabelText(/revision/i));
    await userEvent.type(screen.getByLabelText(/revision/i), "Rev 0");
    await userEvent.click(screen.getByRole("button", { name: /save as revision/i }));

    expect(window.prompt).toHaveBeenCalled();
    expect(anchorClickMock).toHaveBeenCalledTimes(1);
    expect(capturedAnchor?.download).toBe("Revision Save Rev 1.json");
    expect(screen.getByLabelText(/revision/i)).toHaveValue("Rev 1");
    expect(screen.getByText(/saved as revision rev 1\./i)).toBeInTheDocument();
    expect(screen.getByText(/^saved$/i)).toBeInTheDocument();
  } finally {
    window.prompt = originalPrompt;
    window.URL.createObjectURL = originalCreateObjectURL;
    window.URL.revokeObjectURL = originalRevokeObjectURL;
  }
});

test("open project restores app state from a saved json file", async () => {
  render(<App />);

  await openProjectDetails();

  const fileInput = screen.getAllByLabelText(/open project file/i)[0];
  const projectFile = new File(
    [
      JSON.stringify({
        format: "estimator-app-project-file",
        version: 1,
        savedAt: "2026-03-26T01:02:03.000Z",
        appState: {
          projectName: "Imported Project",
          clientName: "Imported Client",
          revision: "Rev 2",
          projectRooms: [],
          estimateSections: [],
          manualEstimateLines: [],
          generatedRowSectionAssignments: {},
          estimateRowOverrides: {},
        },
      }),
    ],
    "imported-project.json",
    { type: "application/json" }
  );

  fireEvent.change(fileInput, {
    target: {
      files: [projectFile],
    },
  });

  await waitFor(() => {
    expect(screen.getByLabelText(/project name/i)).toHaveValue("Imported Project");
    expect(screen.getByLabelText(/estimate name/i)).toHaveValue("Imported Project");
    expect(screen.getByLabelText(/client name/i)).toHaveValue("Imported Client");
    expect(screen.getByLabelText(/revision/i)).toHaveValue("Rev 2");
  });
  expect(screen.getByText(/opened project file: imported-project\.json/i)).toBeInTheDocument();
});

test("open project warns before discarding unsaved changes", async () => {
  const originalConfirm = window.confirm;
  const inputClickMock = jest.fn();

  window.confirm = jest.fn(() => false);
  jest.spyOn(HTMLInputElement.prototype, "click").mockImplementation(inputClickMock);

  try {
    render(<App />);

    await openProjectDetails();
    await userEvent.clear(screen.getByLabelText(/project name/i));
    await userEvent.type(screen.getByLabelText(/project name/i), "Unsaved Draft");
    await userEvent.click(screen.getByRole("button", { name: /open project/i }));

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringMatching(/unsaved changes/i)
    );
    expect(inputClickMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/project name/i)).toHaveValue("Unsaved Draft");
  } finally {
    window.confirm = originalConfirm;
  }
});

test("open project shows a friendly error for invalid json files", async () => {
  render(<App />);

  await openProjectDetails();

  const fileInput = screen.getAllByLabelText(/open project file/i)[0];
  const invalidFile = new File(["not valid json"], "broken-project.json", {
    type: "application/json",
  });

  fireEvent.change(fileInput, {
    target: {
      files: [invalidFile],
    },
  });

  expect(
    await screen.findByText(/unable to open project file\. please choose a valid project json file\./i)
  ).toBeInTheDocument();
});

test("new project resets project data without clearing global libraries", async () => {
  const originalConfirm = window.confirm;
  window.confirm = jest.fn(() => true);

  try {
    window.localStorage.setItem(
      "estimator-app-global-libraries",
      JSON.stringify({
        stages: [{ id: "stage-custom", name: "Custom Stage", sortOrder: 1, isActive: true }],
        trades: [{ id: "trade-custom", name: "Custom Trade", sortOrder: 1, isActive: true }],
        costCodes: [{ id: "cost-code-custom", name: "Custom Cost Code", sortOrder: 1, isActive: true }],
        units: [{ id: "unit-custom", name: "Custom Unit", abbreviation: "CU", sortOrder: 1, isActive: true }],
        elements: [{ id: "element-custom", name: "Custom Element", sortOrder: 1, isActive: true }],
        roomTypes: [{ id: "room-type-custom", name: "Custom Room Type", sortOrder: 1, isActive: true }],
      })
    );
    window.localStorage.setItem(
      "estimator-app-library-data",
      JSON.stringify({
        roomTemplates: [
          {
            id: "template-custom",
            name: "Custom Room",
            roomTypeId: "room-type-custom",
            roomType: "Custom Room Type",
            length: 1,
            width: 1,
            height: 1,
            tileHeight: 0,
            waterproofWallHeight: 0,
            quantity: 1,
            include: true,
            assemblyIds: [],
            customItems: [],
          },
        ],
        assemblies: [],
        costs: [],
      })
    );
    window.localStorage.setItem(
      "estimator-app-project-data",
      JSON.stringify({
        projectName: "Saved Project",
        clientName: "Saved Client",
        projectAddress: "123 Example Street",
        contactDetails: "saved@example.com",
        projectManager: "PM Saved",
        estimator: "Estimator Saved",
        revision: "Rev 7",
        projectRooms: [
          {
            id: "project-room-custom",
            templateId: "template-custom",
            name: "Custom Room",
            sectionId: "",
            roomTypeId: "room-type-custom",
            roomType: "Custom Room Type",
            length: 1,
            width: 1,
            height: 1,
            tileHeight: 0,
            waterproofWallHeight: 0,
            quantity: 1,
            include: true,
            assemblyIds: [],
            customItems: [],
          },
        ],
        estimateRowOverrides: { "row-1": { rate: 123 } },
        lastSavedAt: "2026-03-22T01:02:03.000Z",
      })
    );

    render(<App />);

    await openProjectDetails();

    expect(screen.getByLabelText(/project name/i)).toHaveValue("Saved Project");
    expect(screen.getByLabelText(/client name/i)).toHaveValue("Saved Client");
    expect(screen.getByLabelText(/project address/i)).toHaveValue("123 Example Street");
    expect(screen.getByLabelText(/contact details/i)).toHaveValue("saved@example.com");
    expect(screen.getByLabelText(/project manager/i)).toHaveValue("PM Saved");
    expect(screen.getByLabelText(/estimator/i)).toHaveValue("Estimator Saved");
    expect(screen.getByLabelText(/revision/i)).toHaveValue("Rev 7");

    await userEvent.click(screen.getByRole("button", { name: /new project/i }));

    expect(screen.getByLabelText(/project name/i)).toHaveValue("Untitled Project");
    expect(screen.getByLabelText(/client name/i)).toHaveValue("");
    expect(screen.getByLabelText(/project address/i)).toHaveValue("");
    expect(screen.getByLabelText(/contact details/i)).toHaveValue("");
    expect(screen.getByLabelText(/project manager/i)).toHaveValue("");
    expect(screen.getByLabelText(/estimator/i)).toHaveValue("");
    expect(screen.getByLabelText(/revision/i)).toHaveValue("Rev 0");

    await userEvent.click(screen.getByRole("button", { name: /stage library/i }));
    expect(screen.getByDisplayValue("Custom Stage")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /room library/i }));
    expect(screen.getAllByText("Custom Room").length).toBeGreaterThan(0);

    expect(JSON.parse(window.localStorage.getItem("estimator-app-global-libraries"))).toMatchObject({
      stages: [{ id: "stage-custom", name: "Custom Stage", sortOrder: 1, isActive: true }],
    });
    expect(JSON.parse(window.localStorage.getItem("estimator-app-project-data"))).toMatchObject({
      estimateName: "Untitled Estimate",
      projectName: "Untitled Project",
      clientName: "",
      projectAddress: "",
      contactDetails: "",
      projectManager: "",
      estimator: "",
      revision: "Rev 0",
      projectRooms: [],
      estimateRowOverrides: {},
      lastSavedAt: "",
    });
  } finally {
    window.confirm = originalConfirm;
  }
});

test("new project can be cancelled when unsaved changes exist", async () => {
  const originalConfirm = window.confirm;
  window.confirm = jest.fn(() => false);

  try {
    render(<App />);

    await openProjectDetails();
    await userEvent.clear(screen.getByLabelText(/project name/i));
    await userEvent.type(screen.getByLabelText(/project name/i), "Do Not Reset");
    await userEvent.click(screen.getByRole("button", { name: /new project/i }));

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringMatching(/unsaved changes/i)
    );
    expect(screen.getByLabelText(/project name/i)).toHaveValue("Do Not Reset");
  } finally {
    window.confirm = originalConfirm;
  }
});

test("estimate output stays empty when only legacy room library data exists", async () => {
  window.localStorage.setItem(
    "estimator-app-project",
    JSON.stringify({
      projectName: "Legacy Project",
      rooms: [
        {
          id: "room-legacy-1",
          name: "Legacy Bathroom",
          roomTypeId: "room-type-bathroom",
          roomType: "Bathroom",
          length: 2.4,
          width: 1.8,
          height: 2.7,
          tileHeight: 2.1,
          waterproofWallHeight: 1.2,
          quantity: 1,
          include: true,
          assemblyIds: ["assembly-bathroom-bathroom-floor-tile"],
          customItems: [],
        },
      ],
      assemblies: [
        {
          id: "assembly-row-legacy-1",
          assemblyId: "assembly-bathroom-bathroom-floor-tile",
          assemblyCategory: "Finishes",
          assemblyName: "Bathroom Floor Tile",
          appliesToRoomTypeId: "room-type-bathroom",
          appliesToRoomType: "Bathroom",
          stageId: "stage-finishes",
          stage: "Finishes",
          elementId: "element-floor",
          element: "Floor",
          tradeId: "trade-tile",
          trade: "Tile",
          costCodeId: "cost-code-finishes",
          costCode: "Finishes",
          itemName: "Floor Tile Installation",
          unitId: "unit-sqm",
          unit: "SQM",
          qtyRule: "FloorArea",
          laborHoursPerUnit: 0,
          laborCostItemName: "",
          sortOrder: 1,
        },
      ],
      costs: [
        {
          id: "cost-legacy-1",
          itemName: "Floor Tile Installation",
          unitId: "unit-sqm",
          unit: "SQM",
          rate: 100,
        },
      ],
    })
  );

  render(<App />);

  await userEvent.click(screen.getByRole("button", { name: /estimate output/i }));

  expect(
    screen.getByText(/no estimate items yet\. build an estimate in estimate builder to see output here\./i)
  ).toBeInTheDocument();
  expect(screen.queryByText("Floor Tile Installation")).not.toBeInTheDocument();
});

test("estimate output stays empty when project rooms are not attached to estimate builder sections", async () => {
  window.localStorage.setItem(
    "estimator-app-project-data",
    JSON.stringify({
      projectName: "Saved Project",
      projectRooms: [
        {
          id: "project-room-1",
          name: "Bathroom 01",
          sectionId: "",
          roomTypeId: "room-type-bathroom",
          roomType: "Bathroom",
          length: 2.4,
          width: 1.8,
          height: 2.7,
          tileHeight: 2.1,
          waterproofWallHeight: 1.2,
          quantity: 1,
          include: true,
          assemblyIds: ["assembly-bathroom-bathroom-floor-tile"],
          customItems: [],
        },
      ],
      estimateSections: [],
      manualEstimateLines: [],
      estimateRowOverrides: {},
      generatedRowSectionAssignments: {},
      lastSavedAt: "",
    })
  );

  render(<App />);

  await userEvent.click(screen.getByRole("button", { name: /estimate output/i }));

  expect(
    screen.getByText(/no estimate items yet\. build an estimate in estimate builder to see output here\./i)
  ).toBeInTheDocument();
  expect(screen.queryByText("Floor Tile Installation")).not.toBeInTheDocument();
});
