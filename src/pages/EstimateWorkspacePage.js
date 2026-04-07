import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import EstimateBuilderPage from "./EstimateBuilderPage";
import EstimateCanvasView from "./EstimateCanvasView";
import EstimateTimelineView from "./EstimateTimelineView";
import { generateManualEstimateBuilderRows } from "../utils/estimateRows";
import { normalizeAssemblies } from "../utils/assemblies";
import { getAssemblyGroupId } from "../utils/assemblyGroups";
import { getUnitAbbreviation } from "../utils/units";

function cleanText(value) {
  return String(value || "").trim();
}

function getPreferredStageId(stages = [], preferredStageId = "") {
  const normalizedPreferredStageId = cleanText(preferredStageId);
  const activeStages = (stages || [])
    .filter((stage) => stage.isActive !== false)
    .sort(
      (left, right) =>
        Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) ||
        left.name.localeCompare(right.name)
    );

  if (normalizedPreferredStageId && activeStages.some((stage) => stage.id === normalizedPreferredStageId)) {
    return normalizedPreferredStageId;
  }

  return activeStages[0]?.id || "";
}

function getNextSectionSortOrder(sections = []) {
  return (
    (sections || []).reduce(
      (highestSortOrder, section) => Math.max(highestSortOrder, Number(section.sortOrder ?? 0)),
      0
    ) + 10
  );
}

function getNextManualSortOrder(manualLines = [], sectionId = "") {
  return (
    (manualLines || [])
      .filter((line) => cleanText(line.sectionId) === cleanText(sectionId))
      .reduce(
        (highestSortOrder, line) => Math.max(highestSortOrder, Number(line.sortOrder ?? 0)),
        0
      ) + 10
  );
}

function createAssemblyCardProjectLine({
  assembly,
  sectionId,
  sortOrder,
  stageId,
  units = [],
}) {
  const items = Array.isArray(assembly?.items) ? assembly.items : [];
  const leadItem = items[0] || {};
  const aggregateRate = items.reduce(
    (total, item) => total + Number(item.rateOverride ?? item.baseRate ?? item.unitCost ?? 0),
    0
  );
  const unitId = cleanText(leadItem.unitId) || "unit-ea";
  const unit = getUnitAbbreviation(units, unitId, leadItem.unit, "EA") || "EA";

  return {
    id: `manual-estimate-line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sortOrder,
    include: true,
    itemName: assembly.assemblyName,
    displayNameOverride: assembly.assemblyName,
    workType: cleanText(leadItem.workType) || "Assembly",
    itemFamily: cleanText(leadItem.itemFamily),
    specification: "",
    gradeOrQuality: "",
    brand: "",
    finishOrVariant: "",
    unitId,
    unit,
    quantity: 1,
    rate: Math.round(aggregateRate * 100) / 100,
    stageId,
    sectionId,
    costCodeId: cleanText(leadItem.costCodeId || assembly.costCodeId),
    tradeId: cleanText(leadItem.tradeId || assembly.tradeId),
    elementId: cleanText(leadItem.elementId || assembly.elementId),
    notes: "",
    sourceLink: "",
    imageUrl: cleanText(assembly.imageUrl || leadItem.imageUrl),
    assemblyImageUrl: cleanText(assembly.imageUrl),
    itemImageUrl: cleanText(leadItem.imageUrl),
    sourceAssemblyId: getAssemblyGroupId(assembly),
    sourceAssemblyName: assembly.assemblyName,
    sourceAssemblyRowId: "",
    sourceCostItemId: "",
    sourceType: "assembly_library",
    cardType: "assembly",
  };
}

function withTakeoffIntegrity(updates = {}) {
  if (!updates || typeof updates !== "object") {
    return updates;
  }

  if (
    Object.prototype.hasOwnProperty.call(updates, "takeoffApplied") ||
    (!Object.prototype.hasOwnProperty.call(updates, "quantity") &&
      !Object.prototype.hasOwnProperty.call(updates, "quantityOverride"))
  ) {
    return updates;
  }

  return {
    ...updates,
    takeoffApplied: null,
  };
}

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
  presentationSettings,
  onPresentationSettingsChange = () => {},
  presentationModel = null,
  clientPresentationModel = null,
  onExportPresentationPdf = () => {},
  onCreateShareLink = () => {},
  shareState = { status: "idle", message: "", url: "" },
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
  const [addCardDialogState, setAddCardDialogState] = useState({
    isOpen: false,
    searchTerm: "",
    assemblyId: "",
    stageId: "",
    sectionId: "",
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
  const normalizedAssemblyGroups = useMemo(
    () => normalizeAssemblies(assemblies, { units, costs, trades, costCodes }),
    [assemblies, costCodes, costs, trades, units]
  );
  const sortedSections = useMemo(
    () =>
      [...(sections || [])].sort(
        (left, right) =>
          Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) ||
          left.name.localeCompare(right.name)
      ),
    [sections]
  );
  const filteredAssemblyGroups = useMemo(() => {
    const normalizedSearch = cleanText(addCardDialogState.searchTerm).toLowerCase();

    return normalizedAssemblyGroups.filter((assembly) => {
      if (!normalizedSearch) {
        return true;
      }

      return [
        assembly.assemblyName,
        assembly.assemblyCategory,
        assembly.appliesToRoomType,
        assembly.items?.map((item) => item.itemName).join(" "),
      ]
        .map((value) => cleanText(value).toLowerCase())
        .some((value) => value.includes(normalizedSearch));
    });
  }, [addCardDialogState.searchTerm, normalizedAssemblyGroups]);
  const selectedAddAssembly =
    normalizedAssemblyGroups.find((assembly) => getAssemblyGroupId(assembly) === addCardDialogState.assemblyId) ||
    null;
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

  const openAddAssemblyCardDialog = () => {
    setAddCardDialogState({
      isOpen: true,
      searchTerm: "",
      assemblyId: normalizedAssemblyGroups[0] ? getAssemblyGroupId(normalizedAssemblyGroups[0]) : "",
      stageId: getPreferredStageId(stages, normalizedAssemblyGroups[0]?.stageId),
      sectionId: sortedSections[0]?.id || "",
    });
  };

  const closeAddAssemblyCardDialog = () => {
    setAddCardDialogState((current) => ({
      ...current,
      isOpen: false,
    }));
  };

  const createAssemblyCardFromCanvas = () => {
    if (!selectedAddAssembly) {
      return;
    }

    const ensuredStageId = getPreferredStageId(stages, addCardDialogState.stageId || selectedAddAssembly.stageId);

    if (!ensuredStageId) {
      return;
    }

    let ensuredSectionId = cleanText(addCardDialogState.sectionId);
    let nextSections = sections || [];

    if (!ensuredSectionId) {
      ensuredSectionId = `estimate-section-canvas-${Date.now()}`;
      nextSections = [
        ...(sections || []),
        {
          id: ensuredSectionId,
          name: "Canvas Cards",
          parentSectionId: "",
          stageId: "",
          sortOrder: getNextSectionSortOrder(sections),
        },
      ];
      onSectionsChange(nextSections);
    }

    const nextLine = createAssemblyCardProjectLine({
      assembly: selectedAddAssembly,
      sectionId: ensuredSectionId,
      sortOrder: getNextManualSortOrder(manualLines, ensuredSectionId),
      stageId: ensuredStageId,
      units,
    });

    onManualLinesChange([...(manualLines || []), nextLine]);
    setCanvasSearchTerm(selectedAddAssembly.assemblyName);
    setCanvasFilters((current) => ({
      ...current,
      stageId: ensuredStageId,
    }));
    closeAddAssemblyCardDialog();
  };

  const handleSharedRowChange = (rowId, updates) => {
    const safeUpdates = withTakeoffIntegrity(updates);
    const targetManualLine = (manualLines || []).find((line) => line.id === rowId);

    if (targetManualLine) {
      onManualLinesChange(
        (manualLines || []).map((line) =>
          line.id === rowId
            ? {
                ...line,
                ...safeUpdates,
                stageId:
                  Object.prototype.hasOwnProperty.call(safeUpdates || {}, "stageId")
                    ? safeUpdates.stageId
                    : line.stageId,
              }
            : line
        )
      );
      return;
    }

    onRowOverrideChange(rowId, safeUpdates);
  };

  const handleSharedRowsChange = (changes = []) => {
    if (!Array.isArray(changes) || !changes.length) {
      return;
    }

    const manualChangesById = new Map();
    const generatedChanges = [];
    const manualLineIds = new Set((manualLines || []).map((line) => line.id));

    changes.forEach((change) => {
      if (!change?.rowId || !change?.updates) {
        return;
      }

      if (manualLineIds.has(change.rowId)) {
        manualChangesById.set(change.rowId, {
          ...(manualChangesById.get(change.rowId) || {}),
          ...withTakeoffIntegrity(change.updates),
        });
        return;
      }

      generatedChanges.push({
        ...change,
        updates: withTakeoffIntegrity(change.updates),
      });
    });

    if (manualChangesById.size) {
      onManualLinesChange(
        (manualLines || []).map((line) => {
          const updates = manualChangesById.get(line.id);

          if (!updates) {
            return line;
          }

          return {
            ...line,
            ...updates,
            stageId:
              Object.prototype.hasOwnProperty.call(updates, "stageId")
                ? updates.stageId
                : line.stageId,
          };
        })
      );
    }

    generatedChanges.forEach(({ rowId, updates }) => {
      onRowOverrideChange(rowId, updates);
    });
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
                  onClick={openAddAssemblyCardDialog}
                >
                  Add Card
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
                <summary className="secondary-button estimate-workspace-topbar-button">Add Card</summary>
                <div className="estimate-workspace-add-menu-panel">
                  <p>Create a Canvas card from the Assembly Library as a shared project item.</p>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={openAddAssemblyCardDialog}
                  >
                    From Assembly Library
                  </button>
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

      {addCardDialogState.isOpen ? (
        <div className="estimate-workspace-add-card-modal" role="dialog" aria-modal="true" aria-label="Add assembly card">
          <button
            type="button"
            className="estimate-workspace-add-card-backdrop"
            aria-label="Close add card"
            onClick={closeAddAssemblyCardDialog}
          />
          <div className="estimate-workspace-add-card-panel">
            <div className="estimate-workspace-add-card-header">
              <div>
                <span className="estimate-workspace-add-card-kicker">Add Card</span>
                <h3>From Assembly Library</h3>
              </div>
              <button
                type="button"
                className="toolbar-icon-button"
                aria-label="Close add card"
                onClick={closeAddAssemblyCardDialog}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <div className="estimate-workspace-add-card-body">
              <label className="field">
                <span>Search assembly</span>
                <input
                  type="search"
                  value={addCardDialogState.searchTerm}
                  onChange={(event) =>
                    setAddCardDialogState((current) => ({
                      ...current,
                      searchTerm: event.target.value,
                    }))
                  }
                  placeholder="Search assembly library"
                />
              </label>

              <div className="estimate-workspace-add-card-assembly-list" role="listbox" aria-label="Assembly library">
                {filteredAssemblyGroups.map((assembly) => {
                  const assemblyId = getAssemblyGroupId(assembly);
                  const isSelected = assemblyId === addCardDialogState.assemblyId;

                  return (
                    <button
                      key={assemblyId}
                      type="button"
                      className={[
                        "estimate-workspace-add-card-assembly-option",
                        isSelected ? "is-selected" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() =>
                        setAddCardDialogState((current) => ({
                          ...current,
                          assemblyId,
                          stageId: current.stageId || getPreferredStageId(stages, assembly.stageId),
                        }))
                      }
                    >
                      <strong>{assembly.assemblyName}</strong>
                      <span>
                        {[cleanText(assembly.assemblyCategory), cleanText(assembly.appliesToRoomType)]
                          .filter(Boolean)
                          .join(" · ") || "Assembly template"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="estimate-workspace-add-card-grid">
                <label className="field">
                  <span>Stage</span>
                  <select
                    value={addCardDialogState.stageId}
                    onChange={(event) =>
                      setAddCardDialogState((current) => ({
                        ...current,
                        stageId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select stage</option>
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
                  <span>Section / Zone</span>
                  <select
                    value={addCardDialogState.sectionId}
                    onChange={(event) =>
                      setAddCardDialogState((current) => ({
                        ...current,
                        sectionId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Create in Canvas Cards</option>
                    {sortedSections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {selectedAddAssembly ? (
                <div className="estimate-workspace-add-card-summary">
                  <strong>{selectedAddAssembly.assemblyName}</strong>
                  <span>
                    Creates one shared project item and one Canvas card. Child assembly items stay inside the template source.
                  </span>
                </div>
              ) : null}
            </div>

            <div className="estimate-workspace-add-card-actions">
              <button type="button" className="secondary-button" onClick={closeAddAssemblyCardDialog}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={createAssemblyCardFromCanvas}
                disabled={!selectedAddAssembly || !addCardDialogState.stageId}
              >
                Create Assembly Card
              </button>
            </div>
          </div>
        </div>
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
          presentationSettings={presentationSettings}
          onPresentationSettingsChange={onPresentationSettingsChange}
          presentationModel={presentationModel}
          clientPresentationModel={clientPresentationModel}
          onExportPresentationPdf={onExportPresentationPdf}
          onCreateShareLink={onCreateShareLink}
          shareState={shareState}
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
          onRowsChange={handleSharedRowsChange}
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


