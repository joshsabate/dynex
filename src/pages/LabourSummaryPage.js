import { useMemo } from "react";
import DataTable from "../components/DataTable";
import SectionCard from "../components/SectionCard";
import { isHourUnit } from "../utils/units";

function formatMoney(value) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function summarizeLabourBy(rows, key, fallbackLabel) {
  const groups = rows.reduce((summary, row) => {
    if (!row.include || row.unit !== "HR") {
      return summary;
    }

    const groupName = row[key] || fallbackLabel;
    const current = summary.get(groupName) || { labourHours: 0, labourCost: 0 };

    summary.set(groupName, {
      labourHours: current.labourHours + row.quantity,
      labourCost: current.labourCost + row.total,
    });

    return summary;
  }, new Map());

  return Array.from(groups.entries())
    .map(([groupName, values]) => ({
      id: `${key}-${groupName}`,
      groupName,
      labourHours: values.labourHours,
      labourCost: values.labourCost,
    }))
    .sort(
      (left, right) =>
        right.labourCost - left.labourCost || left.groupName.localeCompare(right.groupName)
    );
}

function LabourSummaryPage({ rows }) {
  const labourRows = useMemo(
    () => rows.filter((row) => row.include && isHourUnit([], row.unitId, row.unit)),
    [rows]
  );

  const totalsByTrade = useMemo(() => summarizeLabourBy(labourRows, "trade", "Unassigned"), [labourRows]);
  const totalsByCostCode = useMemo(
    () => summarizeLabourBy(labourRows, "costCode", "Unassigned"),
    [labourRows]
  );
  const totalsByRoom = useMemo(() => summarizeLabourBy(labourRows, "roomName", "Unassigned"), [labourRows]);

  const totalLabourHours = useMemo(
    () => labourRows.reduce((total, row) => total + row.quantity, 0),
    [labourRows]
  );
  const totalLabourCost = useMemo(
    () => labourRows.reduce((total, row) => total + row.total, 0),
    [labourRows]
  );

  const summaryColumns = [
    { key: "groupName", header: "Group", className: "labour-summary-col-group" },
    {
      key: "labourHours",
      header: "Labour Hours",
      className: "labour-summary-col-hours",
      render: (row) => row.labourHours.toFixed(2),
    },
    {
      key: "labourCost",
      header: "Labour Cost",
      className: "labour-summary-col-cost",
      render: (row) => formatMoney(row.labourCost),
    },
  ];

  return (
    <SectionCard
      title="Labour Summary"
      description="Review calculated labour hours and labour cost separately from the main estimate using the current effective labour rows."
    >
      <div className="summary-grid">
        <div className="summary-card">
          <h3>Total Labour Hours</h3>
          <p>{totalLabourHours.toFixed(2)}</p>
        </div>
        <div className="summary-card">
          <h3>Total Labour Cost</h3>
          <p>{formatMoney(totalLabourCost)}</p>
        </div>
      </div>

      <div className="summary-sections">
        <div className="summary-section">
          <h3>Total Labour Hours by Trade</h3>
          <DataTable
            columns={summaryColumns}
            rows={totalsByTrade}
            emptyMessage="No labour rows by trade yet."
            tableClassName="summary-table labour-summary-table"
          />
        </div>

        <div className="summary-section">
          <h3>Total Labour Hours by Cost Code</h3>
          <DataTable
            columns={summaryColumns}
            rows={totalsByCostCode}
            emptyMessage="No labour rows by cost code yet."
            tableClassName="summary-table labour-summary-table"
          />
        </div>

        <div className="summary-section">
          <h3>Total Labour Hours by Room / Area</h3>
          <DataTable
            columns={summaryColumns}
            rows={totalsByRoom}
            emptyMessage="No labour rows by room yet."
            tableClassName="summary-table labour-summary-table"
          />
        </div>

        <div className="summary-section">
          <h3>Total Labour Cost by Trade</h3>
          <DataTable
            columns={summaryColumns}
            rows={totalsByTrade}
            emptyMessage="No labour cost rows by trade yet."
            tableClassName="summary-table labour-summary-table"
          />
        </div>
      </div>
    </SectionCard>
  );
}

export default LabourSummaryPage;
