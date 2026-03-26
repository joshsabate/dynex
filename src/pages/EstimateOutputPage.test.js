import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EstimateOutputPage from "./EstimateOutputPage";

const stages = [
  { id: "stage-finishes", name: "Finishes", sortOrder: 1, isActive: true, color: "#d7aa5a" },
];

const rows = [
  {
    id: "row-1",
    sortOrder: 1,
    source: "generated",
    roomName: "Bathroom",
    roomType: "Bathroom",
    assemblyName: "Bathroom Floor Tile",
    stageId: "stage-finishes",
    stage: "Finishes",
    trade: "Tile",
    itemName: "Tile Installation",
    unit: "SQM",
    generatedQuantity: 10,
    quantity: 10,
    generatedRate: 100,
    unitRate: 100,
    total: 1000,
    include: true,
    notes: "",
    laborHours: 2,
    missingRate: false,
  },
];

test("estimate output renders stage with managed stage color", () => {
  const { container } = render(
    <EstimateOutputPage
      rows={rows}
      manualBuilderRows={[]}
      summary={{ total: 1000 }}
      stages={stages}
      sections={[]}
      generatedRowSectionAssignments={{}}
      onRowOverrideChange={jest.fn()}
    />
  );

  expect(screen.getByText("Finishes")).toBeInTheDocument();
  expect(container.querySelector(".stage-chip")).not.toBeNull();
});

test("estimate output supports combined and manual builder only modes", async () => {
  render(
    <EstimateOutputPage
      rows={rows}
      manualBuilderRows={[
        {
          id: "builder-1",
          sortOrder: 1,
          source: "manual-builder",
          roomName: "Preliminaries",
          roomType: "",
          assemblyName: "Preliminaries",
          stageId: "stage-finishes",
          stage: "Finishes",
          trade: "",
          itemName: "Site Office",
          unit: "EA",
          generatedQuantity: 1,
          quantity: 1,
          generatedRate: 500,
          unitRate: 500,
          total: 500,
          include: true,
          notes: "",
          laborHours: 0,
          missingRate: false,
        },
      ]}
      summary={{ total: 1000 }}
      stages={stages}
      sections={[{ id: "section-1", name: "Preliminaries" }]}
      generatedRowSectionAssignments={{}}
      onRowOverrideChange={jest.fn()}
    />
  );

  expect(screen.getByText("Site Office")).toBeInTheDocument();
  expect(screen.getByText("Manual Builder")).toBeInTheDocument();
  expect(screen.getByText("1,500.00")).toBeInTheDocument();

  await userEvent.selectOptions(screen.getByLabelText(/view/i), "manual-builder");

  expect(screen.getByText("Site Office")).toBeInTheDocument();
  expect(screen.queryByText("Tile Installation")).not.toBeInTheDocument();
  expect(screen.getAllByText("500.00").length).toBeGreaterThan(0);
});

test("estimate output groups assigned generated rows under their estimate builder section", () => {
  render(
    <EstimateOutputPage
      rows={rows}
      manualBuilderRows={[]}
      summary={{ total: 1000 }}
      stages={stages}
      sections={[{ id: "section-1", name: "Preliminaries" }]}
      generatedRowSectionAssignments={{ "row-1": "section-1" }}
      onRowOverrideChange={jest.fn()}
    />
  );

  expect(screen.getByText("Preliminaries")).toBeInTheDocument();
  expect(screen.getByText("Tile Installation")).toBeInTheDocument();
});
