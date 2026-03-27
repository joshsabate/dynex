import { useMemo, useState } from "react";
import DataTable from "../components/DataTable";
import SectionCard from "../components/SectionCard";
import { getStagePresentation } from "../utils/stages";
import { summarizeEstimateRows } from "../utils/estimateRows";

function formatMoney(value) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeCsvValue(value) {
  const normalizedValue = String(value ?? "");

  if (/[",\n]/.test(normalizedValue)) {
    return `"${normalizedValue.replace(/"/g, '""')}"`;
  }

  return normalizedValue;
}

const groupingOptions = [
  { value: "sectionName", label: "Section" },
  { value: "stage", label: "Stage" },
  { value: "roomName", label: "Room" },
  { value: "trade", label: "Trade" },
  { value: "assemblyName", label: "Assembly" },
];

const sortingOptions = [
  { value: "sortOrder", label: "Sort Order" },
  { value: "itemName", label: "Item Name" },
  { value: "roomName", label: "Room" },
  { value: "stage", label: "Stage" },
  { value: "trade", label: "Trade" },
];

const modeOptions = [
  { value: "generated", label: "Generated Only" },
  { value: "manual-builder", label: "Manual Builder Only" },
  { value: "combined", label: "Combined" },
];

function getSourceLabel(source) {
  if (source === "generated") {
    return "Generated";
  }

  if (source === "manual-builder") {
    return "Manual Builder";
  }

  if (source === "manual-room") {
    return "Manual Room";
  }

  return "Manual";
}

function getSectionName(sections, sectionId) {
  return sections.find((section) => section.id === sectionId)?.name || "";
}

function compareRows(left, right, sortBy) {
  if (sortBy === "sortOrder") {
    return (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.itemName.localeCompare(right.itemName);
  }

  return String(left[sortBy] || "").localeCompare(String(right[sortBy] || "")) ||
    (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
}

function EstimateOutputPage({
  rows,
  manualBuilderRows = [],
  summary,
  onRowOverrideChange,
  stages = [],
  sections = [],
  generatedRowSectionAssignments = {},
}) {
  const [groupBy, setGroupBy] = useState("sectionName");
  const [sortBy, setSortBy] = useState("sortOrder");
  const [viewMode, setViewMode] = useState("combined");
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const hasBuilderEstimateItems = rows.length > 0 || manualBuilderRows.length > 0;
  const rowsWithSectionContext = useMemo(() => {
    const generatedRowsWithSections = rows.map((row) => {
      const assignedSectionId = generatedRowSectionAssignments[row.id] || row.sectionId || "";
      const assignedSectionName = getSectionName(sections, assignedSectionId);

      return {
        ...row,
        sectionId: assignedSectionId,
        sectionName:
          row.source === "generated" && assignedSectionName
            ? assignedSectionName
            : row.roomName || "Unassigned",
      };
    });

    const manualBuilderRowsWithSections = manualBuilderRows.map((row) => ({
      ...row,
      sectionId: row.sectionId || "",
      sectionName: row.roomName || "Unassigned",
    }));

    return {
      generatedRowsWithSections,
      manualBuilderRowsWithSections,
    };
  }, [generatedRowSectionAssignments, manualBuilderRows, rows, sections]);
  const activeRows = useMemo(() => {
    if (viewMode === "generated") {
      return rowsWithSectionContext.generatedRowsWithSections;
    }

    if (viewMode === "manual-builder") {
      return rowsWithSectionContext.manualBuilderRowsWithSections;
    }

    return [
      ...rowsWithSectionContext.generatedRowsWithSections,
      ...rowsWithSectionContext.manualBuilderRowsWithSections,
    ];
  }, [rowsWithSectionContext, viewMode]);

  const groupedRows = useMemo(() => {
    const groups = new Map();

    activeRows.forEach((row) => {
      const groupValue = row[groupBy] || "Unassigned";

      if (!groups.has(groupValue)) {
        groups.set(groupValue, []);
      }

      groups.get(groupValue).push(row);
    });

    return Array.from(groups.entries())
      .map(([groupName, groupRows]) => ({
        groupName,
        rows: [...groupRows].sort((left, right) => compareRows(left, right, sortBy)),
        subtotal: groupRows.reduce((total, row) => total + row.total, 0),
      }))
      .sort((left, right) => left.groupName.localeCompare(right.groupName));
  }, [activeRows, groupBy, sortBy]);

  const flatSortedRows = useMemo(
    () => groupedRows.flatMap((group) => group.rows),
    [groupedRows]
  );
  const activeSummary = useMemo(
    () => summarizeEstimateRows(activeRows),
    [activeRows]
  );

  const exportCsv = () => {
    if (typeof window === "undefined" || !flatSortedRows.length) {
      return;
    }

    const headers = [
      "Source",
      "Room / Area",
      "Room Type",
      "Assembly",
      "Stage",
      "Element",
      "Trade",
      "Item Name",
      "Unit",
      "Generated Quantity",
      "Effective Quantity",
      "Generated Rate",
      "Effective Rate",
      "Total",
      "Include",
      "Notes",
      "Sort Order",
    ];

    const csvRows = flatSortedRows.map((row) =>
      [
        getSourceLabel(row.source),
        row.roomName,
        row.roomType,
        row.assemblyName,
        row.stage,
        row.element,
        row.trade,
        row.itemName,
        row.unit,
        row.generatedQuantity,
        row.quantity,
        row.generatedRate,
        row.unitRate,
        row.total,
        row.include ? "Yes" : "No",
        row.notes,
        row.sortOrder,
      ]
        .map(escapeCsvValue)
        .join(",")
    );

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "estimate-output.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const toggleGroup = (groupName) => {
    setCollapsedGroups((current) => ({
      ...current,
      [groupName]: !current[groupName],
    }));
  };

  return (
    <SectionCard
      title="Estimate Output Table"
      description="Review generated assembly lines together with manual room items. Use the controls to regroup the output and reorder rows without leaving local React state."
    >
      {!hasBuilderEstimateItems ? (
        <p className="empty-state">
          No estimate items yet. Build an estimate in Estimate Builder to see output here.
        </p>
      ) : (
        <>
      <div className="summary-grid">
        <div className="summary-card">
          <h3>Grand Total</h3>
          <p>{formatMoney(activeSummary.total ?? summary.total)}</p>
        </div>
      </div>

      <div className="action-row">
        <button
          type="button"
          className="secondary-button"
          onClick={exportCsv}
          disabled={!flatSortedRows.length}
        >
          Export CSV
        </button>
      </div>

      <div className="page-grid estimate-controls">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="group-by">Group by</label>
            <select
              id="group-by"
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value)}
            >
              {groupingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="view-mode">View</label>
            <select
              id="view-mode"
              value={viewMode}
              onChange={(event) => setViewMode(event.target.value)}
            >
              {modeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="sort-by">Sort by</label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              {sortingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {groupedRows.length ? (
        <div className="estimate-groups">
          {groupedRows.map((group) => (
            <div key={group.groupName} className="estimate-group">
              <div className="estimate-group-header">
                <button
                  type="button"
                  className="estimate-group-toggle"
                  onClick={() => toggleGroup(group.groupName)}
                >
                  <span>{collapsedGroups[group.groupName] ? "+" : "-"}</span>
                  <span>{group.groupName}</span>
                </button>
                <p>{formatMoney(group.subtotal)}</p>
              </div>

              {!collapsedGroups[group.groupName] ? (
                <>
                  <DataTable
                    columns={[
                      {
                        key: "roomName",
                        header: "Room",
                        className: "estimate-output-col-room",
                      },
                      {
                        key: "stage",
                        header: "Stage",
                        className: "estimate-output-col-stage",
                        render: (row) => (
                          <span className="stage-chip" style={getStagePresentation(stages, row.stageId, row.stage)}>
                            {row.stage || "Unassigned"}
                          </span>
                        ),
                      },
                      {
                        key: "trade",
                        header: "Trade",
                        className: "estimate-output-col-trade estimate-output-group-end-context",
                      },
                      {
                        key: "itemName",
                        header: "Item",
                        className: "estimate-output-col-item estimate-output-group-end-identity",
                        render: (row) => row.displayName || row.itemName,
                      },
                      {
                        key: "quantity",
                        header: "Quantity",
                        className: "estimate-output-col-qty",
                        render: (row) => (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.quantity}
                            onChange={(event) =>
                              onRowOverrideChange(row.id, {
                                quantityOverride: event.target.value,
                              })
                            }
                          />
                        ),
                      },
                      {
                        key: "unit",
                        header: "Unit",
                        className: "estimate-output-col-unit",
                      },
                      {
                        key: "unitRate",
                        header: "Rate",
                        className: "estimate-output-col-rate",
                        render: (row) => (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.unitRate}
                            onChange={(event) =>
                              onRowOverrideChange(row.id, {
                                rateOverride: event.target.value,
                              })
                            }
                          />
                        ),
                      },
                      {
                        key: "total",
                        header: "Line Total",
                        className: "estimate-output-col-total estimate-output-group-end-values",
                        render: (row) => formatMoney(row.total),
                      },
                      {
                        key: "notes",
                        header: "Notes",
                        className: "estimate-output-col-notes",
                        render: (row) => (
                          <input
                            type="text"
                            value={row.notes}
                            onChange={(event) =>
                              onRowOverrideChange(row.id, {
                                notes: event.target.value,
                              })
                            }
                            placeholder="Optional notes"
                          />
                        ),
                      },
                    ]}
                    rows={group.rows}
                    emptyMessage="No estimate rows available for the current view."
                    getRowClassName={(row) => (row.missingRate ? "estimate-row-missing-rate" : "")}
                    tableClassName="estimate-output-table"
                  />

                  <div className="estimate-group-subtotal">
                    <span>Subtotal</span>
                    <strong>{formatMoney(group.subtotal)}</strong>
                  </div>
                </>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-state">No estimate rows available for the current view.</p>
      )}
        </>
      )}
    </SectionCard>
  );
}

export default EstimateOutputPage;
