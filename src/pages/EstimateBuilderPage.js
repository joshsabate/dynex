import { useMemo, useState } from "react";
import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";
import { getStagePresentation } from "../utils/stages";
import { getAssemblyGroupId, getAssemblyGroups } from "../utils/assemblyGroups";
import { getStructuredItemPresentation, getWorkTypeTone, workTypeOptions } from "../utils/itemNaming";
import { instantiateRoomTemplate } from "../utils/roomTemplates";
import { getUnitAbbreviation, isHourUnit } from "../utils/units";

const defaultSectionForm = {
  name: "",
  parentSectionId: "",
  stageId: "",
  sortOrder: "1",
};

const defaultManualLineForm = {
  itemName: "",
  workType: "Supply",
  itemFamily: "",
  specification: "",
  gradeOrQuality: "",
  brand: "",
  finishOrVariant: "",
  unitId: "",
  unit: "",
  quantity: "1",
  rate: "0",
  stageId: "",
  sectionId: "",
  costCodeId: "",
  tradeId: "",
  elementId: "",
  notes: "",
};

const defaultProjectRoomForm = {
  roomTemplateId: "",
  name: "",
  sectionId: "",
};

const defaultManualLabourForm = {
  costId: "",
  quantity: "1",
  notes: "",
  stageId: "",
  costCodeId: "",
  tradeId: "",
  elementId: "",
};

function createDefaultSectionCostItemForm(sectionStageId = "") {
  return {
    searchTerm: "",
    costId: "",
    quantity: "1",
    notes: "",
    stageId: sectionStageId,
    costCodeId: "",
    tradeId: "",
    elementId: "",
  };
}

function createDefaultSectionAssemblyForm() {
  return {
    searchTerm: "",
    assemblyId: "",
  };
}

function toNumber(value, fallback = 0) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function getDefaultWorkTypeFromCost(cost, units) {
  if (!cost) {
    return "";
  }

  return isHourUnit(units, cost.unitId, cost.unit) ? "Labour" : "Supply";
}

function renderIconActionButton({
  label,
  icon,
  className = "secondary-button",
  onClick,
}) {
  return (
    <button
      type="button"
      className={`estimate-builder-icon-button ${className}`}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}

const estimateColumns = [
  { key: "itemName", label: "Item", className: "estimate-builder-col-item" },
  { key: "stage", label: "Stage", className: "estimate-builder-col-stage" },
  { key: "trade", label: "Trade", className: "estimate-builder-col-trade" },
  { key: "costCode", label: "Cost Code", className: "estimate-builder-col-cost-code" },
  { key: "sortOrder", label: "Sort", className: "estimate-builder-col-sort" },
  { key: "quantity", label: "Qty", className: "estimate-builder-col-qty" },
  { key: "unit", label: "Unit", className: "estimate-builder-col-unit" },
  { key: "rate", label: "Rate", className: "estimate-builder-col-rate" },
  { key: "notes", label: "Notes", className: "estimate-builder-col-notes" },
  { key: "actions", label: "Actions", className: "estimate-builder-col-actions" },
];

function EstimateBuilderPage({
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
  onGeneratedRowOverrideChange = () => {},
  generatedRows = [],
  generatedRowSectionAssignments = {},
  onGeneratedRowSectionAssignmentsChange,
}) {
  const [sectionForm, setSectionForm] = useState(defaultSectionForm);
  const [manualLineForm, setManualLineForm] = useState(defaultManualLineForm);
  const [projectRoomForm, setProjectRoomForm] = useState(defaultProjectRoomForm);
  const [manualLabourForm, setManualLabourForm] = useState(defaultManualLabourForm);
  const [collapsedSections, setCollapsedSections] = useState({});
  const [collapsedProjectRooms, setCollapsedProjectRooms] = useState({});
  const [collapsedAssemblyGroups, setCollapsedAssemblyGroups] = useState({});
  const [costItemFormBySection, setCostItemFormBySection] = useState({});
  const [assemblyFormBySection, setAssemblyFormBySection] = useState({});
  const [activeSectionAction, setActiveSectionAction] = useState({
    sectionId: "",
    action: "",
  });

  const sortedSections = useMemo(
    () =>
      [...sections].sort(
        (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
      ),
    [sections]
  );

  const activeStages = useMemo(
    () =>
      [...stages]
        .filter((stage) => stage.isActive)
        .sort(
          (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
        ),
    [stages]
  );
  const activeTrades = useMemo(
    () =>
      [...trades]
        .filter((trade) => trade.isActive)
        .sort(
          (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
        ),
    [trades]
  );
  const activeElements = useMemo(
    () =>
      [...elements]
        .filter((element) => element.isActive)
        .sort(
          (left, right) =>
            left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
        ),
    [elements]
  );
  const activeCostCodes = useMemo(
    () =>
      [...costCodes]
        .filter((costCode) => costCode.isActive)
        .sort(
          (left, right) =>
            left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
        ),
    [costCodes]
  );
  const activeUnits = useMemo(
    () =>
      [...units]
        .filter((unit) => unit.isActive)
        .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)),
    [units]
  );
  const activeItemFamilies = useMemo(
    () =>
      [...itemFamilies]
        .filter((itemFamily) => itemFamily.isActive !== false)
        .sort(
          (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
        ),
    [itemFamilies]
  );
  const sortedCosts = useMemo(
    () =>
      [...costs].sort(
        (left, right) => left.itemName.localeCompare(right.itemName) || left.id.localeCompare(right.id)
      ),
    [costs]
  );
  const labourCosts = useMemo(
    () => sortedCosts.filter((cost) => isHourUnit(units, cost.unitId, cost.unit)),
    [sortedCosts, units]
  );
  const availableAssemblies = useMemo(() => getAssemblyGroups(assemblies), [assemblies]);

  const getStageName = (stageId, fallback = "") =>
    stages.find((stage) => stage.id === stageId)?.name || fallback || "Unassigned";
  const getTradeName = (tradeId, fallback = "") =>
    trades.find((trade) => trade.id === tradeId)?.name || fallback || "Unassigned";
  const getCostCodeName = (costCodeId, fallback = "") =>
    costCodes.find((costCode) => costCode.id === costCodeId)?.name || fallback || "Unassigned";
  const getUnitName = (unitId, fallback = "") =>
    getUnitAbbreviation(units, unitId, fallback, fallback) || "Unassigned";
  const getCostDisplayName = (cost) => getStructuredItemPresentation(cost).displayName;
  const getRowRate = (row) => row.unitRate ?? row.rate ?? "";
  const sortEstimateRows = (left, right) =>
    Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) ||
    getStructuredItemPresentation(left).displayName.localeCompare(
      getStructuredItemPresentation(right).displayName
    );

  const updateManualLine = (lineId, key, value) => {
    onManualLinesChange(
      manualLines.map((line) => {
        if (line.id !== lineId) {
          return line;
        }

        if (key === "include") {
          return {
            ...line,
            include: value,
          };
        }

        if (key === "unitId") {
          return {
            ...line,
            unitId: value,
            unit: getUnitAbbreviation(units, value, line.unit, line.unit),
          };
        }

        if (["quantity", "rate", "sortOrder"].includes(key)) {
          return {
            ...line,
            [key]: value === "" ? 0 : toNumber(value),
          };
        }

        return {
          ...line,
          [key]: value,
        };
      })
    );
  };

  const updateGeneratedRow = (row, key, value) => {
    if (key === "remove") {
      onGeneratedRowOverrideChange(row.id, { removed: true });
      return;
    }

    if (key === "include") {
      onGeneratedRowOverrideChange(row.id, { includeOverride: value });
      return;
    }

    if (key === "quantity") {
      onGeneratedRowOverrideChange(row.id, { quantityOverride: value });
      return;
    }

    if (key === "rate") {
      onGeneratedRowOverrideChange(row.id, { rateOverride: value });
      return;
    }

    if (key === "sortOrder") {
      onGeneratedRowOverrideChange(row.id, { sortOrder: value });
      return;
    }

    if (key === "stageId") {
      onGeneratedRowOverrideChange(row.id, {
        stageId: value,
        stage: getStageName(value, ""),
      });
      return;
    }

    if (key === "tradeId") {
      onGeneratedRowOverrideChange(row.id, {
        tradeId: value,
        trade: getTradeName(value, ""),
      });
      return;
    }

    if (key === "costCodeId") {
      onGeneratedRowOverrideChange(row.id, {
        costCodeId: value,
        costCode: getCostCodeName(value, ""),
      });
      return;
    }

    if (key === "unitId") {
      onGeneratedRowOverrideChange(row.id, {
        unitId: value,
        unit: getUnitAbbreviation(units, value, row.unit, row.unit),
      });
      return;
    }

    onGeneratedRowOverrideChange(row.id, { [key]: value });
  };

  const renderEstimateGridHeader = () => (
    <div className="estimate-builder-grid estimate-builder-grid-header" role="row">
      {estimateColumns.map((column) => (
        <div
          key={column.key}
          className={`estimate-builder-grid-cell ${column.className}`}
          role="columnheader"
        >
          {column.label}
        </div>
      ))}
    </div>
  );

  const renderEstimateGridRow = (row, actionButton, options = {}) => {
    const onRowFieldChange =
      options.sourceType === "manual-builder"
        ? (key, value) => updateManualLine(row.id, key, value)
        : (key, value) => updateGeneratedRow(row, key, value);
    const itemPresentation = getStructuredItemPresentation(row);
    const workTypeTone = getWorkTypeTone(row.workType);

    return (
    <div
      key={row.id}
      className={`estimate-builder-grid estimate-builder-grid-row ${
        row.include === false ? "estimate-builder-grid-row-excluded" : ""
      } ${
        options.className || ""
      }`.trim()}
      role="row"
    >
      <div className="estimate-builder-grid-cell estimate-builder-col-item">
        {row.workType ? (
          <span className={`estimate-builder-worktype-badge is-${workTypeTone || "default"}`}>
            {row.workType}
          </span>
        ) : null}
        <span className="estimate-builder-item-label">{itemPresentation.displayName}</span>
      </div>
      <div className="estimate-builder-grid-cell estimate-builder-col-stage">
        <select
          className="estimate-builder-inline-control"
          aria-label={`Stage for ${row.itemName}`}
          value={row.stageId || ""}
          onChange={(event) => onRowFieldChange("stageId", event.target.value)}
        >
          <option value="">Unassigned</option>
          {activeStages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
      </div>
      <div className="estimate-builder-grid-cell estimate-builder-col-trade">
        <select
          className="estimate-builder-inline-control"
          aria-label={`Trade for ${row.itemName}`}
          value={row.tradeId || ""}
          onChange={(event) => onRowFieldChange("tradeId", event.target.value)}
        >
          <option value="">Unassigned</option>
          {activeTrades.map((trade) => (
            <option key={trade.id} value={trade.id}>
              {trade.name}
            </option>
          ))}
        </select>
      </div>
      <div className="estimate-builder-grid-cell estimate-builder-col-cost-code">
        <select
          className="estimate-builder-inline-control"
          aria-label={`Cost code for ${row.itemName}`}
          value={row.costCodeId || ""}
          onChange={(event) => onRowFieldChange("costCodeId", event.target.value)}
        >
          <option value="">Unassigned</option>
          {activeCostCodes.map((costCode) => (
            <option key={costCode.id} value={costCode.id}>
              {costCode.name}
            </option>
          ))}
        </select>
      </div>
      <div className="estimate-builder-grid-cell estimate-builder-col-sort">
        <input
          className="estimate-builder-inline-control"
          aria-label={`Sort order for ${row.itemName}`}
          type="number"
          min="0"
          step="0.1"
          value={row.sortOrder ?? 0}
          onChange={(event) => onRowFieldChange("sortOrder", event.target.value)}
        />
      </div>
      <div className="estimate-builder-grid-cell estimate-builder-col-qty">
        <input
          className="estimate-builder-inline-control"
          aria-label={`Quantity for ${row.itemName}`}
          type="number"
          min="0"
          step="0.01"
          value={row.quantity}
          onChange={(event) => onRowFieldChange("quantity", event.target.value)}
        />
      </div>
      <div className="estimate-builder-grid-cell estimate-builder-col-unit">
        <select
          className="estimate-builder-inline-control"
          aria-label={`Unit for ${row.itemName}`}
          value={row.unitId || ""}
          onChange={(event) => onRowFieldChange("unitId", event.target.value)}
        >
          <option value="">Unassigned</option>
          {activeUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.abbreviation || unit.name}
            </option>
          ))}
        </select>
      </div>
      <div className="estimate-builder-grid-cell estimate-builder-col-rate">
        <input
          className="estimate-builder-inline-control"
          aria-label={`Rate for ${row.itemName}`}
          type="number"
          min="0"
          step="0.01"
          value={getRowRate(row)}
          onChange={(event) => onRowFieldChange("rate", event.target.value)}
        />
      </div>
      <div className="estimate-builder-grid-cell estimate-builder-col-notes">
        <input
          className="estimate-builder-inline-control"
          aria-label={`Notes for ${row.itemName}`}
          type="text"
          value={row.notes || ""}
          onChange={(event) => onRowFieldChange("notes", event.target.value)}
          placeholder="Notes"
        />
      </div>
      <div className="estimate-builder-grid-cell estimate-builder-col-actions">
        <div className="estimate-builder-row-actions">{actionButton}</div>
      </div>
    </div>
    );
  };

  const renderRowActions = (row, sourceType, moveUp, moveDown, removeRow) => {
    const onRowFieldChange =
      sourceType === "manual-builder"
        ? (key, value) => updateManualLine(row.id, key, value)
        : (key, value) => updateGeneratedRow(row, key, value);

    return (
      <>
        {renderIconActionButton({
          label: "Move up",
          icon: "↑",
          onClick: moveUp,
        })}
        {renderIconActionButton({
          label: "Move down",
          icon: "↓",
          onClick: moveDown,
        })}
        {renderIconActionButton({
          label: row.include ? "Exclude row" : "Include row",
          icon: row.include ? "⊘" : "○",
          className: row.include ? "danger-button" : "secondary-button",
          onClick: () => onRowFieldChange("include", !row.include),
        })}
        {renderIconActionButton({
          label: "Remove row",
          icon: "×",
          className: "danger-button",
          onClick: removeRow,
        })}
      </>
    );
  };

  const renderSectionActionButtons = (section) => (
    <div className="estimate-builder-section-actions" aria-label={`Section actions for ${section.name}`}>
      {renderIconActionButton({
        label: "Add Room",
        icon: "+R",
        className: "estimate-builder-section-action estimate-builder-section-action-room",
        onClick: () => openSectionAction(section, "room"),
      })}
      {renderIconActionButton({
        label: "Add Assembly",
        icon: "+A",
        className: "estimate-builder-section-action estimate-builder-section-action-assembly",
        onClick: () => openSectionAction(section, "assembly"),
      })}
      {renderIconActionButton({
        label: "Add Cost Item",
        icon: "+$",
        className: "estimate-builder-section-action estimate-builder-section-action-cost",
        onClick: () => openSectionAction(section, "cost-item"),
      })}
      {renderIconActionButton({
        label: "Add Manual Item",
        icon: "+I",
        className: "estimate-builder-section-action estimate-builder-section-action-manual",
        onClick: () => openSectionAction(section, "manual-item"),
      })}
      {renderIconActionButton({
        label: "Add Manual Labour",
        icon: "+L",
        className: "estimate-builder-section-action estimate-builder-section-action-labour",
        onClick: () => openSectionAction(section, "manual-labour"),
      })}
      {renderIconActionButton({
        label: "Add Child Section",
        icon: "+S",
        className: "estimate-builder-section-action estimate-builder-section-action-child",
        onClick: () => openSectionAction(section, "child-section"),
      })}
    </div>
  );

  const updateSectionForm = (key, value) => {
    setSectionForm((current) => ({ ...current, [key]: value }));
  };

  const updateManualLineForm = (key, value) => {
    setManualLineForm((current) => ({
      ...current,
      unit:
        key === "unitId"
          ? getUnitAbbreviation(units, value, current.unit, current.unit)
          : current.unit,
      [key]: value,
    }));
  };

  const updateProjectRoomForm = (key, value) => {
    setProjectRoomForm((current) => ({ ...current, [key]: value }));
  };

  const updateSectionName = (sectionId, value) => {
    onSectionsChange(
      sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              name: value,
            }
          : section
      )
    );
  };

  const updateProjectRoomName = (roomId, value) => {
    onProjectRoomsChange(
      projectRooms.map((room) =>
        room.id === roomId
          ? {
              ...room,
              name: value,
            }
          : room
      )
    );
  };

  const updateAssemblyGroupName = (sectionId, assemblyId, value) => {
    onManualLinesChange(
      manualLines.map((line) =>
        line.sectionId === sectionId && line.sourceAssemblyId === assemblyId
          ? {
              ...line,
              sourceAssemblyName: value,
            }
          : line
      )
    );
  };

  const updateManualLabourForm = (key, value) => {
    setManualLabourForm((current) => ({ ...current, [key]: value }));
  };

  const updateSectionCostItemForm = (sectionId, key, value) => {
    setCostItemFormBySection((current) => ({
      ...current,
      [sectionId]: {
        ...(current[sectionId] || createDefaultSectionCostItemForm()),
        [key]: value,
      },
    }));
  };

  const updateSectionAssemblyForm = (sectionId, key, value) => {
    setAssemblyFormBySection((current) => ({
      ...current,
      [sectionId]: {
        ...(current[sectionId] || createDefaultSectionAssemblyForm()),
        [key]: value,
      },
    }));
  };

  const getFilteredCosts = (sectionId) => {
    const normalizedSearch = String(costItemFormBySection[sectionId]?.searchTerm || "")
      .trim()
      .toLowerCase();

    if (!normalizedSearch) {
      return sortedCosts;
    }

    return sortedCosts.filter((cost) =>
      getCostDisplayName(cost).toLowerCase().includes(normalizedSearch) ||
      cost.itemName.toLowerCase().includes(normalizedSearch)
    );
  };

  const getFilteredAssemblies = (sectionId) => {
    const normalizedSearch = String(assemblyFormBySection[sectionId]?.searchTerm || "")
      .trim()
      .toLowerCase();

    if (!normalizedSearch) {
      return availableAssemblies;
    }

    return availableAssemblies.filter((assembly) =>
      assembly.assemblyName.toLowerCase().includes(normalizedSearch)
    );
  };

  const openSectionAction = (section, action) => {
    setActiveSectionAction({ sectionId: section.id, action });

    if (action === "cost-item" && !costItemFormBySection[section.id]) {
      setCostItemFormBySection((current) => ({
        ...current,
        [section.id]: createDefaultSectionCostItemForm(section.stageId || ""),
      }));
    }

    if (action === "assembly" && !assemblyFormBySection[section.id]) {
      setAssemblyFormBySection((current) => ({
        ...current,
        [section.id]: createDefaultSectionAssemblyForm(),
      }));
    }

    if (action === "room") {
      setProjectRoomForm({
        ...defaultProjectRoomForm,
        sectionId: section.id,
      });
    }

    if (action === "manual-item") {
      setManualLineForm({
        ...defaultManualLineForm,
        sectionId: section.id,
        stageId: section.stageId || "",
      });
    }

    if (action === "manual-labour") {
      setManualLabourForm({
        ...defaultManualLabourForm,
        stageId: section.stageId || "",
      });
    }

    if (action === "child-section") {
      const childCount = sections.filter((child) => child.parentSectionId === section.id).length;

      setSectionForm({
        ...defaultSectionForm,
        parentSectionId: section.id,
        stageId: section.stageId || "",
        sortOrder: String(childCount + 1),
      });
    }
  };

  const closeSectionAction = () => {
    setActiveSectionAction({ sectionId: "", action: "" });
  };

  const isSectionCollapsed = (sectionId) => collapsedSections[sectionId] ?? true;
  const isProjectRoomCollapsed = (roomId) => collapsedProjectRooms[roomId] ?? true;
  const setAllSectionsCollapsed = (isCollapsed) => {
    setCollapsedSections(
      Object.fromEntries(sortedSections.map((section) => [section.id, isCollapsed]))
    );
  };
  const setSectionRoomsCollapsed = (sectionId, isCollapsed) => {
    setCollapsedProjectRooms((current) => ({
      ...current,
      ...Object.fromEntries(
        projectRooms
          .filter((room) => room.sectionId === sectionId)
          .map((room) => [room.id, isCollapsed])
      ),
    }));
  };

  const addSection = (event) => {
    event.preventDefault();

    if (!sectionForm.name) {
      return;
    }

    onSectionsChange([
      ...sections,
      {
        id: `estimate-section-${Date.now()}`,
        name: sectionForm.name,
        parentSectionId: sectionForm.parentSectionId,
        stageId: sectionForm.stageId,
        sortOrder: Number(sectionForm.sortOrder),
      },
    ]);

    setSectionForm((current) => ({
      ...defaultSectionForm,
      parentSectionId: current.parentSectionId,
      stageId: current.stageId,
      sortOrder: current.sortOrder,
    }));
  };

  const removeSection = (sectionId) => {
    const sectionIdsToRemove = new Set([sectionId]);
    let foundChild;

    do {
      foundChild = false;

      for (const section of sections) {
        if (
          section.parentSectionId &&
          sectionIdsToRemove.has(section.parentSectionId) &&
          !sectionIdsToRemove.has(section.id)
        ) {
          sectionIdsToRemove.add(section.id);
          foundChild = true;
        }
      }
    } while (foundChild);

    onSectionsChange(sections.filter((section) => !sectionIdsToRemove.has(section.id)));
    onManualLinesChange(manualLines.filter((line) => !sectionIdsToRemove.has(line.sectionId)));
    onGeneratedRowSectionAssignmentsChange(
      Object.fromEntries(
        Object.entries(generatedRowSectionAssignments).filter(
          ([, assignedSectionId]) => !sectionIdsToRemove.has(assignedSectionId)
        )
      )
    );
    onProjectRoomsChange(
      projectRooms.map((room) =>
        sectionIdsToRemove.has(room.sectionId)
          ? {
              ...room,
              sectionId: "",
            }
          : room
      )
    );
  };

  const removeProjectRoom = (roomId) => {
    onProjectRoomsChange(projectRooms.filter((room) => room.id !== roomId));
  };

  const addProjectRoomToSection = (section) => {
    const template = roomTemplates.find((roomTemplate) => roomTemplate.id === projectRoomForm.roomTemplateId);

    if (!template) {
      return;
    }

    const instantiatedRoom = instantiateRoomTemplate(template, [], parameters);

    onProjectRoomsChange([
      ...projectRooms,
      {
        ...instantiatedRoom,
        name: projectRoomForm.name.trim() || template.name,
        sectionId: section.id,
      },
    ]);

    setProjectRoomForm({
      ...defaultProjectRoomForm,
      sectionId: section.id,
    });
    closeSectionAction();
  };

  const appendManualLine = (line) => {
    const nextSortOrder =
      manualLines
        .filter((existingLine) => existingLine.sectionId === line.sectionId)
        .reduce(
          (highestSortOrder, existingLine) => Math.max(highestSortOrder, Number(existingLine.sortOrder ?? 0)),
          0
        ) + 10;

    onManualLinesChange([
      ...manualLines,
      {
        id: `manual-estimate-line-${Date.now()}`,
        sortOrder: nextSortOrder,
        include: true,
        ...line,
      },
    ]);
  };

  const addCostItemToSection = (section) => {
    const sectionCostForm = costItemFormBySection[section.id];
    const selectedCost = sortedCosts.find((cost) => cost.id === sectionCostForm?.costId);

    if (!selectedCost) {
      return;
    }

    appendManualLine({
      itemName: selectedCost.itemName,
      workType: getDefaultWorkTypeFromCost(selectedCost, units),
      itemFamily: selectedCost.itemFamily || "",
      specification: selectedCost.specification || "",
      gradeOrQuality: selectedCost.gradeOrQuality || "",
      brand: selectedCost.brand || "",
      finishOrVariant: selectedCost.finishOrVariant || "",
      unitId: selectedCost.unitId || "",
      unit: getUnitAbbreviation(units, selectedCost.unitId, selectedCost.unit, ""),
      quantity: Number(sectionCostForm.quantity || 0),
      rate: Number(selectedCost.rate || 0),
      stageId: sectionCostForm.stageId || section.stageId || "",
      sectionId: section.id,
      costCodeId: sectionCostForm.costCodeId,
      tradeId: sectionCostForm.tradeId,
      elementId: sectionCostForm.elementId,
      notes: sectionCostForm.notes,
    });

    setCostItemFormBySection((current) => {
      const nextForms = { ...current };
      delete nextForms[section.id];
      return nextForms;
    });
    closeSectionAction();
  };

  const addManualItemToSection = (section) => {
    if (!manualLineForm.itemName || !manualLineForm.unitId) {
      return;
    }

    appendManualLine({
      itemName: manualLineForm.itemName,
      workType: manualLineForm.workType,
      itemFamily: manualLineForm.itemFamily,
      specification: manualLineForm.specification,
      gradeOrQuality: manualLineForm.gradeOrQuality,
      brand: manualLineForm.brand,
      finishOrVariant: manualLineForm.finishOrVariant,
      unitId: manualLineForm.unitId,
      unit: getUnitAbbreviation(units, manualLineForm.unitId, manualLineForm.unit, ""),
      quantity: Number(manualLineForm.quantity),
      rate: Number(manualLineForm.rate),
      stageId: manualLineForm.stageId || section.stageId || "",
      sectionId: section.id,
      costCodeId: manualLineForm.costCodeId,
      tradeId: manualLineForm.tradeId,
      elementId: manualLineForm.elementId,
      notes: manualLineForm.notes,
    });

    setManualLineForm({
      ...defaultManualLineForm,
      sectionId: section.id,
      stageId: section.stageId || "",
    });
    closeSectionAction();
  };

  const addManualLabourToSection = (section) => {
    const selectedCost = labourCosts.find((cost) => cost.id === manualLabourForm.costId);

    if (!selectedCost) {
      return;
    }

    appendManualLine({
      itemName: selectedCost.itemName,
      workType: "Labour",
      itemFamily: selectedCost.itemFamily || "",
      specification: selectedCost.specification || "",
      gradeOrQuality: selectedCost.gradeOrQuality || "",
      brand: selectedCost.brand || "",
      finishOrVariant: selectedCost.finishOrVariant || "",
      unitId: selectedCost.unitId || "unit-hr",
      unit: getUnitAbbreviation(units, selectedCost.unitId || "unit-hr", selectedCost.unit || "HR", ""),
      quantity: Number(manualLabourForm.quantity),
      rate: Number(selectedCost.rate || 0),
      stageId: manualLabourForm.stageId || section.stageId || "",
      sectionId: section.id,
      costCodeId: manualLabourForm.costCodeId,
      tradeId: manualLabourForm.tradeId,
      elementId: manualLabourForm.elementId,
      notes: manualLabourForm.notes,
    });

    setManualLabourForm({
      ...defaultManualLabourForm,
      stageId: section.stageId || "",
    });
    closeSectionAction();
  };

  const addAssemblyToSection = (section) => {
    const sectionAssemblyForm = assemblyFormBySection[section.id];
    const selectedAssemblyId = sectionAssemblyForm?.assemblyId;

    if (!selectedAssemblyId) {
      return;
    }

    const selectedAssemblyRows = assemblies
      .filter((assemblyRow) => getAssemblyGroupId(assemblyRow) === selectedAssemblyId)
      .sort(sortEstimateRows);

    if (!selectedAssemblyRows.length) {
      return;
    }

    let nextSortOrder =
      manualLines
        .filter((line) => line.sectionId === section.id)
        .reduce(
          (highestSortOrder, existingLine) => Math.max(highestSortOrder, Number(existingLine.sortOrder ?? 0)),
          0
        ) + 10;

    const nextAssemblyLines = selectedAssemblyRows.map((assemblyRow) => {
      const linkedCost = sortedCosts.find((cost) => cost.id === assemblyRow.costItemId);

      const line = {
        id: `manual-estimate-line-${Date.now()}-${assemblyRow.id}-${nextSortOrder}`,
        itemName: assemblyRow.itemName,
        workType: assemblyRow.workType || "",
        itemFamily: assemblyRow.itemFamily || "",
        specification: assemblyRow.specification || "",
        gradeOrQuality: assemblyRow.gradeOrQuality || "",
        brand: assemblyRow.brand || "",
        finishOrVariant: assemblyRow.finishOrVariant || "",
        unitId: assemblyRow.unitId || linkedCost?.unitId || "",
        unit: getUnitAbbreviation(
          units,
          assemblyRow.unitId || linkedCost?.unitId,
          assemblyRow.unit || linkedCost?.unit,
          ""
        ),
        quantity: assemblyRow.qtyRule === "1" ? 1 : 0,
        rate: Number(linkedCost?.rate || 0),
        stageId: assemblyRow.stageId || section.stageId || "",
        sectionId: section.id,
        costCodeId: assemblyRow.costCodeId || "",
        tradeId: assemblyRow.tradeId || "",
        elementId: assemblyRow.elementId || "",
        notes: "",
        sortOrder: nextSortOrder,
        sourceAssemblyId: selectedAssemblyId,
        sourceAssemblyName: assemblyRow.assemblyName,
        sourceAssemblyRowId: assemblyRow.id,
        sourceCostItemId: assemblyRow.costItemId || "",
        sourceQtyRule: assemblyRow.qtyRule || "",
      };

      nextSortOrder += 10;
      return line;
    });

    onManualLinesChange([...manualLines, ...nextAssemblyLines]);
    setAssemblyFormBySection((current) => {
      const nextForms = { ...current };
      delete nextForms[section.id];
      return nextForms;
    });
    closeSectionAction();
  };

  const addChildSection = (section) => {
    if (!sectionForm.name) {
      return;
    }

    onSectionsChange([
      ...sections,
      {
        id: `estimate-section-${Date.now()}`,
        name: sectionForm.name,
        parentSectionId: section.id,
        stageId: sectionForm.stageId,
        sortOrder: Number(sectionForm.sortOrder),
      },
    ]);

    setSectionForm({
      ...defaultSectionForm,
      parentSectionId: section.id,
      stageId: section.stageId || "",
      sortOrder: "1",
    });
    closeSectionAction();
  };

  const removeManualLine = (lineId) => {
    onManualLinesChange(manualLines.filter((line) => line.id !== lineId));
  };

  const moveManualLine = (lineId, direction) => {
    const targetLine = manualLines.find((line) => line.id === lineId);

    if (!targetLine) {
      return;
    }

    const siblingLines = manualLines
      .filter((line) => line.sectionId === targetLine.sectionId)
      .sort(sortEstimateRows);
    const currentIndex = siblingLines.findIndex((line) => line.id === lineId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= siblingLines.length) {
      return;
    }

    const reorderedLines = [...siblingLines];
    const [movedLine] = reorderedLines.splice(currentIndex, 1);
    reorderedLines.splice(nextIndex, 0, movedLine);

    const sortOrderById = Object.fromEntries(
      reorderedLines.map((line, index) => [line.id, (index + 1) * 10])
    );

    onManualLinesChange(
      manualLines.map((line) =>
        line.sectionId === targetLine.sectionId
          ? {
              ...line,
              sortOrder: sortOrderById[line.id] ?? line.sortOrder,
            }
          : line
      )
    );
  };

  const moveGeneratedRow = (roomRows, rowId, direction) => {
    const currentIndex = roomRows.findIndex((row) => row.id === rowId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= roomRows.length) {
      return;
    }

    const reorderedRows = [...roomRows];
    const [movedRow] = reorderedRows.splice(currentIndex, 1);
    reorderedRows.splice(nextIndex, 0, movedRow);

    reorderedRows.forEach((row, index) => {
      onGeneratedRowOverrideChange(row.id, {
        sortOrder: (index + 1) * 10,
      });
    });
  };

  const toggleSection = (sectionId) => {
    setCollapsedSections((current) => ({
      ...current,
      [sectionId]: !(current[sectionId] ?? true),
    }));
  };

  const toggleProjectRoom = (roomId) => {
    setCollapsedProjectRooms((current) => ({
      ...current,
      [roomId]: !(current[roomId] ?? true),
    }));
  };

  const toggleAssemblyGroup = (groupId) => {
    setCollapsedAssemblyGroups((current) => ({
      ...current,
      [groupId]: !(current[groupId] ?? true),
    }));
  };

  const renderSectionTree = (parentSectionId = "", depth = 0) => {
    const childSections = sortedSections.filter(
      (section) => (section.parentSectionId || "") === parentSectionId
    );

    if (!childSections.length) {
      return null;
    }

    return (
      <div className="estimate-builder-tree">
        {childSections.map((section) => {
          const sectionLines = manualLines
            .filter((line) => line.sectionId === section.id)
            .sort(sortEstimateRows);
          const sectionAssemblyGroups = Object.values(
            sectionLines.reduce((groups, line) => {
              if (!line.sourceAssemblyId) {
                return groups;
              }

              if (!groups[line.sourceAssemblyId]) {
                groups[line.sourceAssemblyId] = {
                  id: line.sourceAssemblyId,
                  name: line.sourceAssemblyName || line.itemName || "Assembly",
                  rows: [],
                };
              }

              groups[line.sourceAssemblyId].rows.push(line);
              return groups;
            }, {})
          )
            .map((group) => ({
              ...group,
              rows: group.rows.sort(sortEstimateRows),
            }))
            .sort((left, right) => left.name.localeCompare(right.name));
          const standaloneSectionLines = sectionLines.filter((line) => !line.sourceAssemblyId);
          const sectionRooms = projectRooms.filter((room) => room.sectionId === section.id);
          const sectionCostForm = costItemFormBySection[section.id];
          const sectionAssemblyForm = assemblyFormBySection[section.id];
          const selectedCost = sortedCosts.find((cost) => cost.id === sectionCostForm?.costId);
          const isActiveActionSection = activeSectionAction.sectionId === section.id;
          const isCollapsed = isSectionCollapsed(section.id);

          return (
            <div
              key={section.id}
              className="estimate-builder-section"
              style={{ marginLeft: `${depth * 20}px` }}
            >
              <div className="estimate-builder-section-header">
                <div className="estimate-builder-section-title">
                  <button
                    type="button"
                    className="estimate-group-toggle"
                    aria-label={section.name}
                    onClick={() => toggleSection(section.id)}
                  >
                    <span>{isCollapsed ? "+" : "-"}</span>
                  </button>
                  <input
                    className="estimate-builder-group-name-input"
                    aria-label={`Section name for ${section.name}`}
                    value={section.name}
                    onChange={(event) => updateSectionName(section.id, event.target.value)}
                  />
                </div>
                <div className="estimate-builder-section-meta">
                  {renderSectionActionButtons(section)}
                  <span
                    className="stage-chip"
                    style={getStagePresentation(stages, section.stageId, getStageName(section.stageId))}
                  >
                    {getStageName(section.stageId)}
                  </span>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setSectionRoomsCollapsed(section.id, false)}
                  >
                    Expand Rooms
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setSectionRoomsCollapsed(section.id, true)}
                  >
                    Collapse Rooms
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => removeSection(section.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>

              {!isCollapsed ? (
                <>
                  {isActiveActionSection && activeSectionAction.action === "room" ? (
                    <div className="summary-section estimate-builder-inline-form">
                      <FormField label="Room template">
                        <select
                          value={projectRoomForm.roomTemplateId}
                          onChange={(event) => updateProjectRoomForm("roomTemplateId", event.target.value)}
                        >
                          <option value="">Select room template</option>
                          {roomTemplates.map((roomTemplate) => (
                            <option key={roomTemplate.id} value={roomTemplate.id}>
                              {roomTemplate.name}
                            </option>
                          ))}
                        </select>
                      </FormField>

                      <FormField label="Project room name">
                        <input
                          value={projectRoomForm.name}
                          onChange={(event) => updateProjectRoomForm("name", event.target.value)}
                          placeholder="Optional override"
                        />
                      </FormField>

                      <div className="action-row">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => addProjectRoomToSection(section)}
                        >
                          Add Room
                        </button>
                        <button type="button" className="secondary-button" onClick={closeSectionAction}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {isActiveActionSection && activeSectionAction.action === "assembly" && sectionAssemblyForm ? (
                    <div className="summary-section estimate-builder-inline-form">
                      <FormField label="Search assemblies">
                        <input
                          value={sectionAssemblyForm.searchTerm}
                          onChange={(event) =>
                            updateSectionAssemblyForm(section.id, "searchTerm", event.target.value)
                          }
                          placeholder="Search assembly"
                        />
                      </FormField>

                      <FormField label="Assembly">
                        <select
                          value={sectionAssemblyForm.assemblyId}
                          onChange={(event) =>
                            updateSectionAssemblyForm(section.id, "assemblyId", event.target.value)
                          }
                        >
                          <option value="">Select assembly</option>
                          {getFilteredAssemblies(section.id).map((assembly) => (
                            <option key={assembly.id} value={assembly.id}>
                              {assembly.assemblyName}
                            </option>
                          ))}
                        </select>
                      </FormField>

                      <div className="action-row">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => addAssemblyToSection(section)}
                        >
                          Add Assembly
                        </button>
                        <button type="button" className="secondary-button" onClick={closeSectionAction}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {isActiveActionSection && activeSectionAction.action === "cost-item" && sectionCostForm ? (
                    <div className="summary-section estimate-builder-inline-form">
                      <FormField label="Search cost items">
                        <input
                          value={sectionCostForm.searchTerm}
                          onChange={(event) =>
                            updateSectionCostItemForm(section.id, "searchTerm", event.target.value)
                          }
                          placeholder="Search cost item"
                        />
                      </FormField>

                      <FormField label="Cost item">
                        <select
                          value={sectionCostForm.costId}
                          onChange={(event) =>
                            updateSectionCostItemForm(section.id, "costId", event.target.value)
                          }
                        >
                          <option value="">Select cost item</option>
                          {getFilteredCosts(section.id).map((cost) => (
                            <option key={cost.id} value={cost.id}>
                              {getCostDisplayName(cost)}
                            </option>
                          ))}
                        </select>
                      </FormField>

                      {selectedCost ? (
                        <p className="empty-state">
                          {getCostDisplayName(selectedCost)} | {getUnitName(selectedCost.unitId, selectedCost.unit)} | Rate {selectedCost.rate}
                        </p>
                      ) : null}

                      <div className="form-grid estimate-builder-inline-grid">
                        <FormField label="Quantity">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={sectionCostForm.quantity}
                            onChange={(event) =>
                              updateSectionCostItemForm(section.id, "quantity", event.target.value)
                            }
                          />
                        </FormField>

                        <FormField label="Stage">
                          <select
                            value={sectionCostForm.stageId}
                            onChange={(event) =>
                              updateSectionCostItemForm(section.id, "stageId", event.target.value)
                            }
                          >
                            <option value="">Use section stage</option>
                            {activeStages.map((stage) => (
                              <option key={stage.id} value={stage.id}>
                                {stage.name}
                              </option>
                            ))}
                          </select>
                        </FormField>

                        <FormField label="Cost code">
                          <select
                            value={sectionCostForm.costCodeId}
                            onChange={(event) =>
                              updateSectionCostItemForm(section.id, "costCodeId", event.target.value)
                            }
                          >
                            <option value="">Unassigned</option>
                            {activeCostCodes.map((costCode) => (
                              <option key={costCode.id} value={costCode.id}>
                                {costCode.name}
                              </option>
                            ))}
                          </select>
                        </FormField>

                        <FormField label="Trade">
                          <select
                            value={sectionCostForm.tradeId}
                            onChange={(event) =>
                              updateSectionCostItemForm(section.id, "tradeId", event.target.value)
                            }
                          >
                            <option value="">Unassigned</option>
                            {activeTrades.map((trade) => (
                              <option key={trade.id} value={trade.id}>
                                {trade.name}
                              </option>
                            ))}
                          </select>
                        </FormField>

                        <FormField label="Element">
                          <select
                            value={sectionCostForm.elementId}
                            onChange={(event) =>
                              updateSectionCostItemForm(section.id, "elementId", event.target.value)
                            }
                          >
                            <option value="">Unassigned</option>
                            {activeElements.map((element) => (
                              <option key={element.id} value={element.id}>
                                {element.name}
                              </option>
                            ))}
                          </select>
                        </FormField>

                        <FormField label="Notes">
                          <input
                            value={sectionCostForm.notes}
                            onChange={(event) =>
                              updateSectionCostItemForm(section.id, "notes", event.target.value)
                            }
                            placeholder="Optional notes"
                          />
                        </FormField>
                      </div>

                      <div className="action-row">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => addCostItemToSection(section)}
                        >
                          Add Selected Cost Item
                        </button>
                        <button type="button" className="secondary-button" onClick={closeSectionAction}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {isActiveActionSection && activeSectionAction.action === "manual-item" ? (
                    <div className="summary-section estimate-builder-inline-form">
                      <div className="form-grid estimate-builder-inline-grid">
                        <FormField label="Item name">
                          <input
                            value={manualLineForm.itemName}
                            onChange={(event) => updateManualLineForm("itemName", event.target.value)}
                            placeholder="Custom estimate item"
                          />
                        </FormField>

                        <FormField label="Work type">
                          <select
                            value={manualLineForm.workType}
                            onChange={(event) => updateManualLineForm("workType", event.target.value)}
                          >
                            <option value="">Unassigned</option>
                            {workTypeOptions.map((workType) => (
                              <option key={workType} value={workType}>
                                {workType}
                              </option>
                            ))}
                          </select>
                        </FormField>

                        <FormField label="Item family">
                          <select
                            value={manualLineForm.itemFamily}
                            onChange={(event) => updateManualLineForm("itemFamily", event.target.value)}
                          >
                            <option value="">Unassigned</option>
                            {activeItemFamilies.map((itemFamily) => (
                              <option key={itemFamily.id} value={itemFamily.name}>
                                {itemFamily.name}
                              </option>
                            ))}
                          </select>
                        </FormField>

                        <FormField label="Specification">
                          <input
                            value={manualLineForm.specification}
                            onChange={(event) => updateManualLineForm("specification", event.target.value)}
                            placeholder="90x45"
                          />
                        </FormField>

                        <FormField label="Grade / quality">
                          <input
                            value={manualLineForm.gradeOrQuality}
                            onChange={(event) =>
                              updateManualLineForm("gradeOrQuality", event.target.value)
                            }
                            placeholder="MGP10 LOSP"
                          />
                        </FormField>

                        <FormField label="Brand">
                          <input
                            value={manualLineForm.brand}
                            onChange={(event) => updateManualLineForm("brand", event.target.value)}
                            placeholder="Caroma"
                          />
                        </FormField>

                        <FormField label="Finish / variant">
                          <input
                            value={manualLineForm.finishOrVariant}
                            onChange={(event) =>
                              updateManualLineForm("finishOrVariant", event.target.value)
                            }
                            placeholder="Matt Black"
                          />
                        </FormField>

                        <FormField label="Unit">
                          <select
                            value={manualLineForm.unitId}
                            onChange={(event) => updateManualLineForm("unitId", event.target.value)}
                          >
                            <option value="">Select unit</option>
                            {activeUnits.map((unit) => (
                              <option key={unit.id} value={unit.id}>
                                {unit.abbreviation}
                              </option>
                            ))}
                          </select>
                        </FormField>

                        <FormField label="Quantity">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={manualLineForm.quantity}
                            onChange={(event) => updateManualLineForm("quantity", event.target.value)}
                          />
                        </FormField>

                        <FormField label="Rate">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={manualLineForm.rate}
                            onChange={(event) => updateManualLineForm("rate", event.target.value)}
                          />
                        </FormField>

                        <FormField label="Stage">
                          <select
                            value={manualLineForm.stageId}
                            onChange={(event) => updateManualLineForm("stageId", event.target.value)}
                          >
                            <option value="">Use section stage</option>
                            {activeStages.map((stage) => (
                              <option key={stage.id} value={stage.id}>
                                {stage.name}
                              </option>
                            ))}
                          </select>
                        </FormField>

                        <FormField label="Cost code">
                          <select
                            value={manualLineForm.costCodeId}
                            onChange={(event) => updateManualLineForm("costCodeId", event.target.value)}
                          >
                            <option value="">Unassigned</option>
                            {activeCostCodes.map((costCode) => (
                              <option key={costCode.id} value={costCode.id}>
                                {costCode.name}
                              </option>
                            ))}
                          </select>
                        </FormField>

                        <FormField label="Trade">
                          <select
                            value={manualLineForm.tradeId}
                            onChange={(event) => updateManualLineForm("tradeId", event.target.value)}
                          >
                            <option value="">Unassigned</option>
                            {activeTrades.map((trade) => (
                              <option key={trade.id} value={trade.id}>
                                {trade.name}
                              </option>
                            ))}
                          </select>
                        </FormField>

                        <FormField label="Element">
                          <select
                            value={manualLineForm.elementId}
                            onChange={(event) => updateManualLineForm("elementId", event.target.value)}
                          >
                            <option value="">Unassigned</option>
                            {activeElements.map((element) => (
                              <option key={element.id} value={element.id}>
                                {element.name}
                              </option>
                            ))}
                          </select>
                        </FormField>

                        <FormField label="Notes">
                          <input
                            value={manualLineForm.notes}
                            onChange={(event) => updateManualLineForm("notes", event.target.value)}
                            placeholder="Optional notes"
                          />
                        </FormField>
                      </div>

                      <div className="action-row">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => addManualItemToSection(section)}
                        >
                          Add Manual Item
                        </button>
                        <button type="button" className="secondary-button" onClick={closeSectionAction}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {isActiveActionSection && activeSectionAction.action === "manual-labour" ? (
                    <div className="summary-section estimate-builder-inline-form">
                      <div className="form-grid estimate-builder-inline-grid">
                        <FormField label="Labour cost item">
                          <select
                            value={manualLabourForm.costId}
                            onChange={(event) => updateManualLabourForm("costId", event.target.value)}
                          >
                            <option value="">Select labour cost item</option>
                            {labourCosts.map((cost) => (
                              <option key={cost.id} value={cost.id}>
                                {getCostDisplayName(cost)}
                              </option>
                            ))}
                          </select>
                        </FormField>

                        <FormField label="Hours">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={manualLabourForm.quantity}
                            onChange={(event) => updateManualLabourForm("quantity", event.target.value)}
                          />
                        </FormField>

                        <FormField label="Stage">
                          <select
                            value={manualLabourForm.stageId}
                            onChange={(event) => updateManualLabourForm("stageId", event.target.value)}
                          >
                            <option value="">Use section stage</option>
                            {activeStages.map((stage) => (
                              <option key={stage.id} value={stage.id}>
                                {stage.name}
                              </option>
                            ))}
                          </select>
                        </FormField>

                        <FormField label="Cost code">
                          <select
                            value={manualLabourForm.costCodeId}
                            onChange={(event) => updateManualLabourForm("costCodeId", event.target.value)}
                          >
                            <option value="">Unassigned</option>
                            {activeCostCodes.map((costCode) => (
                              <option key={costCode.id} value={costCode.id}>
                                {costCode.name}
                              </option>
                            ))}
                          </select>
                        </FormField>

                        <FormField label="Trade">
                          <select
                            value={manualLabourForm.tradeId}
                            onChange={(event) => updateManualLabourForm("tradeId", event.target.value)}
                          >
                            <option value="">Unassigned</option>
                            {activeTrades.map((trade) => (
                              <option key={trade.id} value={trade.id}>
                                {trade.name}
                              </option>
                            ))}
                          </select>
                        </FormField>

                        <FormField label="Element">
                          <select
                            value={manualLabourForm.elementId}
                            onChange={(event) => updateManualLabourForm("elementId", event.target.value)}
                          >
                            <option value="">Unassigned</option>
                            {activeElements.map((element) => (
                              <option key={element.id} value={element.id}>
                                {element.name}
                              </option>
                            ))}
                          </select>
                        </FormField>

                        <FormField label="Notes">
                          <input
                            value={manualLabourForm.notes}
                            onChange={(event) => updateManualLabourForm("notes", event.target.value)}
                            placeholder="Optional notes"
                          />
                        </FormField>
                      </div>

                      <div className="action-row">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => addManualLabourToSection(section)}
                        >
                          Add Manual Labour
                        </button>
                        <button type="button" className="secondary-button" onClick={closeSectionAction}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {isActiveActionSection && activeSectionAction.action === "child-section" ? (
                    <div className="summary-section estimate-builder-inline-form">
                      <div className="form-grid estimate-builder-inline-grid">
                        <FormField label="Child section name">
                          <input
                            value={sectionForm.name}
                            onChange={(event) => updateSectionForm("name", event.target.value)}
                            placeholder="Subsection"
                          />
                        </FormField>

                        <FormField label="Stage">
                          <select
                            value={sectionForm.stageId}
                            onChange={(event) => updateSectionForm("stageId", event.target.value)}
                          >
                            <option value="">Unassigned</option>
                            {activeStages.map((stage) => (
                              <option key={stage.id} value={stage.id}>
                                {stage.name}
                              </option>
                            ))}
                          </select>
                        </FormField>

                        <FormField label="Sort order">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={sectionForm.sortOrder}
                            onChange={(event) => updateSectionForm("sortOrder", event.target.value)}
                          />
                        </FormField>
                      </div>

                      <div className="action-row">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => addChildSection(section)}
                        >
                          Add Child Section
                        </button>
                        <button type="button" className="secondary-button" onClick={closeSectionAction}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {sectionRooms.length || sectionLines.length ? (
                    <div className="estimate-builder-section-grid">
                      <div className="estimate-builder-sheet-scroll">
                      {renderEstimateGridHeader()}

                      {sectionRooms.length ? (
                        <div className="estimate-builder-room-list">
                          {sectionRooms.map((room) => {
                            const roomRows = generatedRows
                              .filter((row) => row.roomId === room.id)
                              .sort(sortEstimateRows);
                            const isRoomCollapsed = isProjectRoomCollapsed(room.id);

                            return (
                              <div key={room.id} className="estimate-builder-group-block estimate-builder-room-block">
                                <div className="estimate-builder-room-header">
                                  <div className="estimate-builder-group-title">
                                    <button
                                      type="button"
                                      className="estimate-group-toggle"
                                      aria-label={room.name}
                                      onClick={() => toggleProjectRoom(room.id)}
                                    >
                                      <span>{isRoomCollapsed ? "+" : "-"}</span>
                                    </button>
                                    <input
                                      className="estimate-builder-group-name-input"
                                      aria-label={`Room name for ${room.name}`}
                                      value={room.name}
                                      onChange={(event) => updateProjectRoomName(room.id, event.target.value)}
                                    />
                                  </div>
                                  <div className="estimate-builder-room-meta">
                                    <span>{room.roomType}</span>
                                    <span>{roomRows.length} row{roomRows.length === 1 ? "" : "s"}</span>
                                    <button
                                      type="button"
                                      className="danger-button"
                                      onClick={() => removeProjectRoom(room.id)}
                                    >
                                      Remove Room
                                    </button>
                                  </div>
                                </div>

                                {!isRoomCollapsed ? (
                                  <div className="estimate-builder-room-rows">
                                    {roomRows.length ? (
                                      roomRows.map((row) =>
                                        renderEstimateGridRow(
                                          row,
                                          renderRowActions(
                                            row,
                                            "generated",
                                            () => moveGeneratedRow(roomRows, row.id, -1),
                                            () => moveGeneratedRow(roomRows, row.id, 1),
                                            () => updateGeneratedRow(row, "remove", true)
                                          ),
                                          {
                                            className: "estimate-builder-generated-row",
                                            sourceType: "generated",
                                          }
                                        )
                                      )
                                    ) : (
                                      <p className="empty-state estimate-builder-inline-empty">
                                        No generated room rows in this section.
                                      </p>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}

                      {sectionAssemblyGroups.length ? (
                        <div className="estimate-builder-room-list">
                          {sectionAssemblyGroups.map((assemblyGroup) => {
                            const groupCollapseKey = `${section.id}-${assemblyGroup.id}`;
                            const isAssemblyCollapsed = collapsedAssemblyGroups[groupCollapseKey] ?? true;

                            return (
                              <div
                                key={assemblyGroup.id}
                                className="estimate-builder-group-block estimate-builder-assembly-block"
                              >
                                <div className="estimate-builder-room-header">
                                  <div className="estimate-builder-group-title">
                                    <button
                                      type="button"
                                      className="estimate-group-toggle"
                                      aria-label={assemblyGroup.name}
                                      onClick={() => toggleAssemblyGroup(groupCollapseKey)}
                                    >
                                      <span>{isAssemblyCollapsed ? "+" : "-"}</span>
                                    </button>
                                    <input
                                      className="estimate-builder-group-name-input"
                                      aria-label={`Assembly name for ${assemblyGroup.name}`}
                                      value={assemblyGroup.name}
                                      onChange={(event) =>
                                        updateAssemblyGroupName(
                                          section.id,
                                          assemblyGroup.id,
                                          event.target.value
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="estimate-builder-room-meta">
                                    <span>Assembly</span>
                                    <span>
                                      {assemblyGroup.rows.length} row
                                      {assemblyGroup.rows.length === 1 ? "" : "s"}
                                    </span>
                                  </div>
                                </div>

                                {!isAssemblyCollapsed ? (
                                  <div className="estimate-builder-room-rows">
                                    {assemblyGroup.rows.map((row) =>
                                      renderEstimateGridRow(
                                        row,
                                        renderRowActions(
                                          row,
                                          "manual-builder",
                                          () => moveManualLine(row.id, -1),
                                          () => moveManualLine(row.id, 1),
                                          () => removeManualLine(row.id)
                                        ),
                                        {
                                          className: "estimate-builder-manual-row",
                                          sourceType: "manual-builder",
                                        }
                                      )
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}

                      {standaloneSectionLines.length ? (
                        <div className="estimate-builder-manual-lines">
                          {standaloneSectionLines.map((row) =>
                            renderEstimateGridRow(
                              row,
                              renderRowActions(
                                row,
                                "manual-builder",
                                () => moveManualLine(row.id, -1),
                                () => moveManualLine(row.id, 1),
                                () => removeManualLine(row.id)
                              ),
                              {
                                className: "estimate-builder-manual-row",
                                sourceType: "manual-builder",
                              }
                            )
                          )}
                        </div>
                      ) : null}
                      </div>
                    </div>
                  ) : (
                    <p className="empty-state">No estimate rows in this section yet.</p>
                  )}
                  {renderSectionTree(section.id, depth + 1)}
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <SectionCard>
      <div className="estimate-builder-toolbar">
        <div className="estimate-builder-toolbar-actions">
          {sortedSections.length ? (
            <>
              {renderIconActionButton({
                label: "Expand all sections",
                icon: "+",
                onClick: () => setAllSectionsCollapsed(false),
              })}
              {renderIconActionButton({
                label: "Collapse all sections",
                icon: "-",
                onClick: () => setAllSectionsCollapsed(true),
              })}
            </>
          ) : null}
          <div className="estimate-builder-meta-fields">
            <FormField label="Estimate Name">
              <input
                className="estimate-builder-name-input"
                value={estimateName}
                onChange={(event) => onEstimateNameChange(event.target.value)}
                placeholder="Estimate name"
              />
            </FormField>
            <FormField label="Rev">
              <input
                className="estimate-builder-revision-input"
                value={estimateRevision}
                onChange={(event) => onEstimateRevisionChange(event.target.value)}
                placeholder="Rev"
              />
            </FormField>
          </div>
        </div>

        <form className="library-form-card estimate-builder-add-section-card" onSubmit={addSection}>
          <div className="library-form-grid estimate-builder-add-section-grid">
            <FormField label="Section name">
              <input
                value={sectionForm.name}
                onChange={(event) => updateSectionForm("name", event.target.value)}
                placeholder="Preliminaries"
              />
            </FormField>

            <FormField label="Parent section">
              <select
                value={sectionForm.parentSectionId}
                onChange={(event) => updateSectionForm("parentSectionId", event.target.value)}
              >
                <option value="">Top-level section</option>
                {sortedSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Stage">
              <select
                value={sectionForm.stageId}
                onChange={(event) => updateSectionForm("stageId", event.target.value)}
              >
                <option value="">Unassigned</option>
                {activeStages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Sort order">
              <input
                type="number"
                min="0"
                step="1"
                value={sectionForm.sortOrder}
                onChange={(event) => updateSectionForm("sortOrder", event.target.value)}
              />
            </FormField>

            <div className="action-row estimate-builder-add-section-actions">
              <button type="submit" className="primary-button">
                Add Section
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="estimate-builder-main">
        <div className="estimate-builder-tree-panel">
          {sortedSections.length ? (
            renderSectionTree()
          ) : (
            <p className="empty-state">No estimate sections added yet.</p>
          )}

          {manualLines.length && !sortedSections.length ? (
            <p className="empty-state">Manual lines need sections to be visible.</p>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}

export default EstimateBuilderPage;
