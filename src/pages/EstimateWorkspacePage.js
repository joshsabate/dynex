import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import EstimateBuilderPage from "./EstimateBuilderPage";
import EstimateCanvasView from "./EstimateCanvasView";
import EstimateTimelineView from "./EstimateTimelineView";
import { generateManualEstimateBuilderRows } from "../utils/estimateRows";

export function EstimateWorkspaceViewSwitcher({
  activeView = "builder",
  onViewChange = () => {},
  className = "",
}) {
  const viewOptions = [
    { id: "builder", label: "Builder View", testId: "workspace-view-builder" },
    { id: "canvas", label: "Canvas View", testId: "workspace-view-canvas" },
    { id: "timeline", label: "Timeline View", testId: "workspace-view-timeline" },
  ];

  return (
    <div
      className={["workspace-view-switcher", "estimate-workspace-view-toggle", className]
        .filter(Boolean)
        .join(" ")}
      role="tablist"
      aria-label="Estimate views"
    >
      {viewOptions.map((view) => (
        <button
          key={view.id}
          type="button"
          role="tab"
          data-testid={view.testId}
          aria-selected={activeView === view.id}
          className={[
            "workspace-view-switcher__button",
            "estimate-workspace-view-button",
            activeView === view.id ? "is-active active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onViewChange(view.id)}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}

function buildCanvasTypeOptions(rows = []) {
  return [...new Set(rows.map((row) => String(row.workType || row.source || "").trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right)
  );
}

function EstimateWorkspacePage({
  projectName = "",
  estimateName = "",
  estimateRevision = "",
  sections,
  manualLines,
  stages,
  trades,
  elements,
  costCodes,
  itemFamilies = [],
  units,
  costs = [],
  assemblies = [],
  roomTemplates = [],
  parameters = [],
  projectRooms = [],
  onSectionsChange,
  onManualLinesChange,
  onProjectRoomsChange = () => {},
  onEstimateNameChange = () => {},
  onEstimateRevisionChange = () => {},
  onRowOverrideChange = () => {},
  generatedRows = [],
  manualBuilderRows = [],
  generatedRowSectionAssignments = {},
  onGeneratedRowSectionAssignmentsChange = () => {},
  activeView: controlledActiveView,
  onActiveViewChange,
  topBarPortalTarget,
}) {
  const [localActiveView, setLocalActiveView] = useState(controlledActiveView || "builder");
  const [canvasSearchTerm, setCanvasSearchTerm] = useState("");
  const [canvasFilters, setCanvasFilters] = useState({
    stageId: "",
    tradeId: "",
    type: "",
  });
  const activeView = controlledActiveView || localActiveView;
  const usesExternalViewSwitcher =
    typeof controlledActiveView === "string" && typeof onActiveViewChange === "function";

  const resolvedManualBuilderRows = useMemo(() => {
    if ((manualLines || []).length) {
      const manualBuilderRowMap = new Map((manualBuilderRows || []).map((row) => [row.id, row]));

      return generateManualEstimateBuilderRows(
        manualLines,
        {},
        sections,
        stages,
        trades,
        elements,
        units,
        costCodes
      ).map((row) => {
        const existingRow = manualBuilderRowMap.get(row.id);

        if (!existingRow) {
          return row;
        }

        return {
          ...existingRow,
          ...row,
          canvasColumn: existingRow.canvasColumn ?? row.canvasColumn ?? "",
          canvasTrack: existingRow.canvasTrack ?? row.canvasTrack ?? "",
          canvasOrder: existingRow.canvasOrder ?? row.canvasOrder ?? "",
          canvasStackParentId: existingRow.canvasStackParentId ?? row.canvasStackParentId ?? "",
          canvasStackOrder: existingRow.canvasStackOrder ?? row.canvasStackOrder ?? "",
        };
      });
    }

    return manualBuilderRows;
  }, [manualLines, manualBuilderRows, sections, stages, trades, elements, units, costCodes]);

  const canvasRows = useMemo(
    () => [...generatedRows, ...resolvedManualBuilderRows],
    [generatedRows, resolvedManualBuilderRows]
  );
  const canvasTypeOptions = useMemo(() => buildCanvasTypeOptions(canvasRows), [canvasRows]);
  const workspaceTitle = estimateName || projectName || "Untitled Estimate";

  const updateCanvasFilter = (key, value) => {
    setCanvasFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const clearCanvasFilters = () => {
    setCanvasFilters({
      stageId: "",
      tradeId: "",
      type: "",
    });
  };

  const setActiveWorkspaceView = (nextView) => {
    if (!usesExternalViewSwitcher) {
      setLocalActiveView(nextView);
    }

    if (typeof onActiveViewChange === "function") {
      onActiveViewChange(nextView);
    }
  };

  const handleSharedRowChange = (rowId, updates) => {
    const targetManualLine = (manualLines || []).find((line) => line.id === rowId);

    if (targetManualLine) {
      onManualLinesChange(
        (manualLines || []).map((line) =>
          line.id === rowId
            ? {
                ...line,
                ...updates,
                stageId:
                  Object.prototype.hasOwnProperty.call(updates || {}, "stageId")
                    ? updates.stageId
                    : line.stageId,
              }
            : line
        )
      );
      return;
    }

    onRowOverrideChange(rowId, updates);
  };

  const workspaceTopBarContent =
    topBarPortalTarget && typeof document !== "undefined"
      ? createPortal(
          activeView === "canvas" ? (
            <div className="estimate-workspace-topbar">
              <div className="estimate-workspace-topbar__controls">
                <input
                  type="search"
                  className="estimate-workspace-search estimate-workspace-topbar-search"
                  value={canvasSearchTerm}
                  onChange={(event) => setCanvasSearchTerm(event.target.value)}
                  placeholder="Search cards"
                  aria-label="Search canvas"
                />

                <details className="estimate-workspace-topbar-menu">
                  <summary
                    className="toolbar-icon-button estimate-workspace-topbar-button"
                    aria-label={`Filter canvas${
                      Object.values(canvasFilters).filter(Boolean).length ? " (active)" : ""
                    }`}
                    title={`Filter canvas${
                      Object.values(canvasFilters).filter(Boolean).length ? " (active)" : ""
                    }`}
                  >
                    <span aria-hidden="true">F</span>
                  </summary>
                  <div className="estimate-workspace-topbar-menu-panel estimate-workspace-filter-panel">
                    <div className="estimate-workspace-filter-grid">
                      <label className="field">
                        <span>Stage</span>
                        <select
                          value={canvasFilters.stageId}
                          onChange={(event) => updateCanvasFilter("stageId", event.target.value)}
                        >
                          <option value="">All stages</option>
                          {stages
                            .filter((stage) => stage.isActive !== false)
                            .sort(
                              (left, right) =>
                                Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) ||
                                left.name.localeCompare(right.name)
                            )
                            .map((stage) => (
                              <option key={stage.id} value={stage.id}>
                                {stage.name}
                              </option>
                            ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Trade</span>
                        <select
                          value={canvasFilters.tradeId}
                          onChange={(event) => updateCanvasFilter("tradeId", event.target.value)}
                        >
                          <option value="">All trades</option>
                          {trades
                            .filter((trade) => trade.isActive !== false)
                            .sort(
                              (left, right) =>
                                Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) ||
                                left.name.localeCompare(right.name)
                            )
                            .map((trade) => (
                              <option key={trade.id} value={trade.id}>
                                {trade.name}
                              </option>
                            ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Type</span>
                        <select
                          value={canvasFilters.type}
                          onChange={(event) => updateCanvasFilter("type", event.target.value)}
                        >
                          <option value="">All types</option>
                          {canvasTypeOptions.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="estimate-workspace-filter-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={clearCanvasFilters}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </div>
                </details>

                <button
                  type="button"
                  className="secondary-button estimate-workspace-topbar-button"
                  onClick={() => setActiveWorkspaceView("builder")}
                >
                  Add
                </button>
              </div>
            </div>
          ) : null,
          topBarPortalTarget
        )
      : null;

  return (
    <div className="estimate-workspace">
      {workspaceTopBarContent}
      {usesExternalViewSwitcher ? null : (
        <div className="estimate-workspace-switcher-row">
          <EstimateWorkspaceViewSwitcher
            activeView={activeView}
            onViewChange={setActiveWorkspaceView}
          />
        </div>
      )}

      {activeView === "canvas" && !topBarPortalTarget ? (
        <>
          <div className="estimate-workspace-canvas-toolbar">
            <input
              type="search"
              className="estimate-workspace-search estimate-workspace-canvas-toolbar-search"
              value={canvasSearchTerm}
              onChange={(event) => setCanvasSearchTerm(event.target.value)}
              placeholder="Search cards, rooms, trades"
              aria-label="Search canvas"
            />

            <div className="estimate-workspace-canvas-toolbar-actions">
              <details className="estimate-workspace-topbar-menu">
                <summary className="secondary-button estimate-workspace-topbar-button">Filter</summary>
                <div className="estimate-workspace-topbar-menu-panel estimate-workspace-filter-panel">
                  <div className="estimate-workspace-filter-grid">
                    <label className="field">
                      <span>Stage</span>
                      <select
                        value={canvasFilters.stageId}
                        onChange={(event) => updateCanvasFilter("stageId", event.target.value)}
                      >
                        <option value="">All stages</option>
                        {stages
                          .filter((stage) => stage.isActive !== false)
                          .sort(
                            (left, right) =>
                              Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) ||
                              left.name.localeCompare(right.name)
                          )
                          .map((stage) => (
                            <option key={stage.id} value={stage.id}>
                              {stage.name}
                            </option>
                          ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>Trade</span>
                      <select
                        value={canvasFilters.tradeId}
                        onChange={(event) => updateCanvasFilter("tradeId", event.target.value)}
                      >
                        <option value="">All trades</option>
                        {trades
                          .filter((trade) => trade.isActive !== false)
                          .sort(
                            (left, right) =>
                              Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) ||
                              left.name.localeCompare(right.name)
                          )
                          .map((trade) => (
                            <option key={trade.id} value={trade.id}>
                              {trade.name}
                            </option>
                          ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>Type</span>
                      <select
                        value={canvasFilters.type}
                        onChange={(event) => updateCanvasFilter("type", event.target.value)}
                      >
                        <option value="">All types</option>
                        {canvasTypeOptions.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="estimate-workspace-filter-actions">
                      <button type="button" className="secondary-button" onClick={clearCanvasFilters}>
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              </details>

              <details className="estimate-workspace-add-menu">
                <summary className="secondary-button estimate-workspace-topbar-button">Add</summary>
                <div className="estimate-workspace-add-menu-panel">
                  <p>Use Builder View to add sections, rooms, assemblies, and manual items.</p>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setActiveWorkspaceView("builder")}
                  >
                    Open Builder View
                  </button>
                </div>
              </details>
            </div>
          </div>
        </>
      ) : null}

      {activeView === "builder" ? (
        <EstimateBuilderPage
          estimateName={estimateName}
          estimateRevision={estimateRevision}
          sections={sections}
          manualLines={manualLines}
          stages={stages}
          trades={trades}
          elements={elements}
          costCodes={costCodes}
          itemFamilies={itemFamilies}
          units={units}
          costs={costs}
          assemblies={assemblies}
          roomTemplates={roomTemplates}
          parameters={parameters}
          projectRooms={projectRooms}
          onSectionsChange={onSectionsChange}
          onManualLinesChange={onManualLinesChange}
          onProjectRoomsChange={onProjectRoomsChange}
          onEstimateNameChange={onEstimateNameChange}
          onEstimateRevisionChange={onEstimateRevisionChange}
          onGeneratedRowOverrideChange={onRowOverrideChange}
          generatedRows={generatedRows}
          generatedRowSectionAssignments={generatedRowSectionAssignments}
          onGeneratedRowSectionAssignmentsChange={onGeneratedRowSectionAssignmentsChange}
          topBarPortalTarget={topBarPortalTarget}
        />
      ) : activeView === "canvas" ? (
        <EstimateCanvasView
          estimateName={workspaceTitle}
          estimateRevision={estimateRevision}
          rows={canvasRows}
          stages={stages}
          trades={trades}
          costCodes={costCodes}
          assemblies={assemblies}
          searchTerm={canvasSearchTerm}
          filters={canvasFilters}
          onRowOverrideChange={handleSharedRowChange}
          onOpenBuilderView={() => setActiveWorkspaceView("builder")}
          topBarPortalTarget={topBarPortalTarget}
        />
      ) : (
        <EstimateTimelineView
          estimateName={workspaceTitle}
          rows={canvasRows}
          stages={stages}
          onRowChange={handleSharedRowChange}
        />
      )}
    </div>
  );
}

export default EstimateWorkspacePage;
