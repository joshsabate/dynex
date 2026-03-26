import { useMemo } from "react";
import DataTable from "../components/DataTable";
import SectionCard from "../components/SectionCard";

function formatMoney(value) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function MissingRatesPage({ rows }) {
  const missingRateRows = useMemo(
    () => rows.filter((row) => row.missingRate),
    [rows]
  );

  const affectedQuantity = useMemo(
    () => missingRateRows.reduce((total, row) => total + row.quantity, 0),
    [missingRateRows]
  );

  return (
    <SectionCard
      title="Missing Rates"
      description="Review estimate rows that currently have no effective rate so they can be priced before final export or summary review."
    >
      <div className="summary-grid">
        <div className="summary-card">
          <h3>Missing Rate Rows</h3>
          <p>{missingRateRows.length}</p>
        </div>
        <div className="summary-card">
          <h3>Affected Quantity</h3>
          <p>{affectedQuantity.toFixed(2)}</p>
        </div>
      </div>

      <DataTable
        columns={[
          {
            key: "source",
            header: "Source",
            render: (row) => (row.source === "generated" ? "Generated" : "Manual"),
          },
          { key: "roomName", header: "Room / Area" },
          { key: "roomType", header: "Room Type" },
          { key: "assemblyName", header: "Assembly" },
          { key: "stage", header: "Stage" },
          { key: "trade", header: "Trade" },
          { key: "itemName", header: "Item Name" },
          { key: "unit", header: "Unit" },
          {
            key: "quantity",
            header: "Quantity",
            render: (row) => `${row.quantity.toFixed(2)} ${row.unit}`,
          },
          {
            key: "unitRate",
            header: "Effective Rate",
            render: (row) => formatMoney(row.unitRate),
          },
          { key: "notes", header: "Notes" },
        ]}
        rows={missingRateRows}
        emptyMessage="No missing-rate rows found."
        getRowClassName={() => "estimate-row-missing-rate"}
      />
    </SectionCard>
  );
}

export default MissingRatesPage;
