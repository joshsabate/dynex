import { useMemo } from "react";
import DataTable from "../components/DataTable";
import SectionCard from "../components/SectionCard";

function formatMoney(value) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function summarizeBy(rows, key, fallbackLabel) {
  const groups = rows.reduce((summary, row) => {
    if (!row.include) {
      return summary;
    }

    const groupName = row[key] || fallbackLabel;
    summary.set(groupName, (summary.get(groupName) || 0) + row.total);
    return summary;
  }, new Map());

  return Array.from(groups.entries())
    .map(([groupName, total]) => ({
      id: `${key}-${groupName}`,
      groupName,
      total,
    }))
    .sort((left, right) => right.total - left.total || left.groupName.localeCompare(right.groupName));
}

function SummaryDashboardPage({ rows }) {
  const totalsByStage = useMemo(() => summarizeBy(rows, "stage", "Unassigned"), [rows]);
  const totalsByTrade = useMemo(() => summarizeBy(rows, "trade", "Unassigned"), [rows]);
  const totalsByRoom = useMemo(() => summarizeBy(rows, "roomName", "Unassigned"), [rows]);
  const totalsByCostCode = useMemo(() => summarizeBy(rows, "costCode", "Unassigned"), [rows]);

  const summaryColumns = [
    { key: "groupName", header: "Group", className: "summary-col-group" },
    {
      key: "total",
      header: "Total Amount",
      className: "summary-col-total",
      render: (row) => formatMoney(row.total),
    },
  ];

  return (
    <SectionCard
      title="Summary Dashboard"
      description="Quick rollup of the current effective estimate totals based on included rows, manual items, and row overrides."
    >
      <div className="summary-sections">
        <div className="summary-section">
          <h3>Total by Stage</h3>
          <DataTable
            columns={summaryColumns}
            rows={totalsByStage}
            emptyMessage="No stage totals yet."
            tableClassName="summary-table summary-dashboard-table"
          />
        </div>

        <div className="summary-section">
          <h3>Total by Trade</h3>
          <DataTable
            columns={summaryColumns}
            rows={totalsByTrade}
            emptyMessage="No trade totals yet."
            tableClassName="summary-table summary-dashboard-table"
          />
        </div>

        <div className="summary-section">
          <h3>Total by Room / Area</h3>
          <DataTable
            columns={summaryColumns}
            rows={totalsByRoom}
            emptyMessage="No room totals yet."
            tableClassName="summary-table summary-dashboard-table"
          />
        </div>

        <div className="summary-section">
          <h3>Total by Cost Code</h3>
          <DataTable
            columns={summaryColumns}
            rows={totalsByCostCode}
            emptyMessage="No cost code totals yet."
            tableClassName="summary-table summary-dashboard-table"
          />
        </div>
      </div>
    </SectionCard>
  );
}

export default SummaryDashboardPage;
