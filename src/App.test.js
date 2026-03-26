import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

beforeEach(() => {
  window.localStorage.clear();
});

test("renders primary navigation and default estimate builder page", () => {
  render(<App />);
  expect(screen.getByRole("button", { name: /estimate builder/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /project details/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /room library/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/estimate name/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/^rev$/i)).toBeInTheDocument();
});

test("new project resets project data without clearing global libraries", async () => {
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

  await userEvent.click(screen.getByRole("button", { name: /project details/i }));

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
