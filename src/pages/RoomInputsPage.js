import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable";
import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";
import { getAssemblyGroups } from "../utils/assemblyGroups";
import { generateEstimateRows } from "../utils/estimateRows";
import {
  derivedMetricOptions,
  duplicateRoomTemplate,
  normalizeRoomTemplate,
  serializeRoomTemplate,
} from "../utils/roomTemplates";
import { calculateRoomMetrics } from "../utils/roomMetrics";
import { getRoomTypeParameterDefinitions } from "../utils/roomTypeParameters";
import { isHourUnit } from "../utils/units";

function sortActiveItems(items = []) {
  return [...items]
    .filter((item) => item.isActive !== false)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
}

function toNumber(value, fallback = 0) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function getParameterLabel(parameterDefinition) {
  return `${parameterDefinition.label}${parameterDefinition.unit ? ` (${parameterDefinition.unit})` : ""}`;
}

function formatMetricValue(key, value) {
  const linearMetrics = [
    "perimeter",
    "skirtingLength",
    "baseCabinetLengthTotal",
    "overheadCabinetLengthTotal",
    "benchtopLengthTotal",
    "splashbackLengthTotal",
  ];

  if (linearMetrics.includes(key)) {
    return `${Number(value || 0).toFixed(2)} m`;
  }

  if (key === "quantity") {
    return String(value || 0);
  }

  return `${Number(value || 0).toFixed(2)} sq m`;
}

function getSelectedCost(costs, costId) {
  return costs.find((cost) => cost.id === costId) || null;
}

function RoomInputsPage({
  rooms,
  assemblies,
  roomTypes,
  parameters = [],
  onRoomsChange,
  costs = [],
  stages = [],
  trades = [],
  elements = [],
  units = [],
  costCodes = [],
}) {
  const activeRoomTypes = useMemo(() => sortActiveItems(roomTypes), [roomTypes]);
  const activeStages = useMemo(() => sortActiveItems(stages), [stages]);
  const activeTrades = useMemo(() => sortActiveItems(trades), [trades]);
  const activeElements = useMemo(() => sortActiveItems(elements), [elements]);
  const activeCostCodes = useMemo(() => sortActiveItems(costCodes), [costCodes]);
  const activeCosts = useMemo(
    () => [...costs].sort((left, right) => left.itemName.localeCompare(right.itemName)),
    [costs]
  );
  const activeLabourCosts = useMemo(
    () => activeCosts.filter((cost) => isHourUnit(units, cost.unitId, cost.unit)),
    [activeCosts, units]
  );
  const normalizedTemplates = useMemo(
    () => rooms.map((room) => normalizeRoomTemplate(room, roomTypes, parameters)),
    [parameters, roomTypes, rooms]
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState(normalizedTemplates[0]?.id || "");
  const [assemblySearchTerm, setAssemblySearchTerm] = useState("");
  const [assemblySelection, setAssemblySelection] = useState("");
  const [manualCostSearchTerm, setManualCostSearchTerm] = useState("");
  const [manualCostSelection, setManualCostSelection] = useState("");
  const [labourCostSearchTerm, setLabourCostSearchTerm] = useState("");
  const [labourCostSelection, setLabourCostSelection] = useState("");

  useEffect(() => {
    if (!normalizedTemplates.length) {
      setSelectedTemplateId("");
      return;
    }

    if (!normalizedTemplates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId(normalizedTemplates[0].id);
    }
  }, [normalizedTemplates, selectedTemplateId]);

  const selectedTemplate = useMemo(
    () => normalizedTemplates.find((template) => template.id === selectedTemplateId) || null,
    [normalizedTemplates, selectedTemplateId]
  );
  const selectedRoomType =
    roomTypes.find((roomType) => roomType.id === selectedTemplate?.roomTypeId) ||
    activeRoomTypes[0] ||
    null;
  const parameterDefinitions = useMemo(
    () => getRoomTypeParameterDefinitions(selectedRoomType || {}, parameters),
    [parameters, selectedRoomType]
  );
  const availableAssemblies = useMemo(
    () =>
      selectedTemplate
        ? getAssemblyGroups(
            assemblies,
            selectedTemplate.roomType,
            selectedTemplate.roomTypeId
          )
        : [],
    [assemblies, selectedTemplate]
  );
  const filteredAssemblies = useMemo(() => {
    const normalizedSearch = assemblySearchTerm.trim().toLowerCase();

    return availableAssemblies.filter((assembly) =>
      !normalizedSearch ? true : assembly.assemblyName.toLowerCase().includes(normalizedSearch)
    );
  }, [assemblySearchTerm, availableAssemblies]);
  const filteredManualCosts = useMemo(() => {
    const normalizedSearch = manualCostSearchTerm.trim().toLowerCase();

    return activeCosts.filter((cost) =>
      !normalizedSearch ? true : cost.itemName.toLowerCase().includes(normalizedSearch)
    );
  }, [activeCosts, manualCostSearchTerm]);
  const filteredLabourCosts = useMemo(() => {
    const normalizedSearch = labourCostSearchTerm.trim().toLowerCase();

    return activeLabourCosts.filter((cost) =>
      !normalizedSearch ? true : cost.itemName.toLowerCase().includes(normalizedSearch)
    );
  }, [activeLabourCosts, labourCostSearchTerm]);
  const templateMetrics = useMemo(
    () => (selectedTemplate ? calculateRoomMetrics(selectedTemplate) : null),
    [selectedTemplate]
  );
  const previewRows = useMemo(() => {
    if (!selectedTemplate) {
      return [];
    }

    return generateEstimateRows(
      [selectedTemplate],
      assemblies,
      costs,
      {},
      stages,
      trades,
      elements,
      units,
      costCodes
    );
  }, [assemblies, costCodes, costs, elements, selectedTemplate, stages, trades, units]);

  const commitTemplates = (nextTemplates) => {
    onRoomsChange(nextTemplates.map((template) => serializeRoomTemplate(template, roomTypes, parameters)));
  };

  const updateSelectedTemplate = (updater) => {
    if (!selectedTemplate) {
      return;
    }

    commitTemplates(
      normalizedTemplates.map((template) =>
        template.id === selectedTemplate.id ? updater(template) : template
      )
    );
  };

  const addTemplate = () => {
    const roomType = activeRoomTypes[0] || { id: "", name: "" };
    const timestamp = Date.now();
    const nextTemplate = normalizeRoomTemplate(
      {
        id: `room-template-${timestamp}`,
        name: `Room Template ${normalizedTemplates.length + 1}`,
        roomTypeId: roomType.id,
        roomType: roomType.name,
        quantity: 1,
        include: true,
        assemblyIds: [],
        manualItems: [],
        labourItems: [],
      },
      roomTypes,
      parameters
    );

    commitTemplates([...normalizedTemplates, nextTemplate]);
    setSelectedTemplateId(nextTemplate.id);
  };

  const duplicateTemplate = (template) => {
    const nextTemplate = duplicateRoomTemplate(template, roomTypes, parameters);
    commitTemplates([...normalizedTemplates, nextTemplate]);
    setSelectedTemplateId(nextTemplate.id);
  };

  const deleteTemplate = (templateId) => {
    commitTemplates(normalizedTemplates.filter((template) => template.id !== templateId));
  };

  const updateRoomType = (roomTypeId) => {
    const nextRoomType =
      roomTypes.find((roomType) => roomType.id === roomTypeId) || {
        id: roomTypeId,
        name: selectedTemplate?.roomType || "",
      };
    const allowedAssemblyIds = new Set(
      getAssemblyGroups(assemblies, nextRoomType.name, nextRoomType.id).map((assembly) => assembly.id)
    );
    const nextParameterValues = normalizeRoomTemplate(
      {
        ...selectedTemplate,
        roomTypeId: nextRoomType.id,
        roomType: nextRoomType.name,
      },
      roomTypes,
      parameters
    );

    updateSelectedTemplate((template) => ({
      ...template,
      ...nextParameterValues,
      roomTypeId: nextRoomType.id,
      roomType: nextRoomType.name,
      assemblyIds: template.assemblyIds.filter((assemblyId) => allowedAssemblyIds.has(assemblyId)),
    }));
    setAssemblySelection("");
    setAssemblySearchTerm("");
  };

  const moveArrayItem = (items, index, direction) => {
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= items.length) {
      return items;
    }

    const nextItems = [...items];
    const [movedItem] = nextItems.splice(index, 1);
    nextItems.splice(nextIndex, 0, movedItem);

    return nextItems;
  };

  const addAssembly = () => {
    if (!assemblySelection || !selectedTemplate) {
      return;
    }

    updateSelectedTemplate((template) => ({
      ...template,
      assemblyIds: template.assemblyIds.includes(assemblySelection)
        ? template.assemblyIds
        : [...template.assemblyIds, assemblySelection],
    }));
    setAssemblySelection("");
  };

  const addTemplateLine = (type) => {
    if (!selectedTemplate) {
      return;
    }

    const selectedCostId = type === "manual" ? manualCostSelection : labourCostSelection;
    const selectedCost = getSelectedCost(costs, selectedCostId);

    if (!selectedCost) {
      return;
    }

    const lineKey = type === "manual" ? "manualItems" : "labourItems";
    const nextLine = {
      id: `${type}-line-${Date.now()}`,
      costItemId: type === "manual" ? selectedCost.id : "",
      labourItemId: type === "labour" ? selectedCost.id : "",
      itemName: selectedCost.itemName,
      unitId: selectedCost.unitId || "",
      unit: selectedCost.unit || "",
      stageId: "",
      tradeId: "",
      elementId: "",
      costCodeId: "",
      include: true,
      sortOrder: ((selectedTemplate[lineKey] || []).length + 1) * 10,
      quantitySourceType: "fixed",
      fixedQty: 1,
      parameterKey: "",
      derivedMetricKey: "",
      formula: "",
      rate: selectedCost.rate || 0,
    };

    updateSelectedTemplate((template) => ({
      ...template,
      [lineKey]: [...template[lineKey], nextLine],
    }));

    if (type === "manual") {
      setManualCostSelection("");
    } else {
      setLabourCostSelection("");
    }
  };

  const updateTemplateLine = (type, lineId, key, value) => {
    const lineKey = type === "manual" ? "manualItems" : "labourItems";

    updateSelectedTemplate((template) => ({
      ...template,
      [lineKey]: template[lineKey].map((line) => {
        if (line.id !== lineId) {
          return line;
        }

        const nextLine = {
          ...line,
          [key]:
            key === "include"
              ? value
              : key === "sortOrder" || key === "fixedQty" || key === "rate"
                ? toNumber(value)
                : value,
        };

        if (key === "costItemId" || key === "labourItemId") {
          const selectedCost = getSelectedCost(costs, value);

          return {
            ...nextLine,
            itemName: selectedCost?.itemName || line.itemName,
            unitId: selectedCost?.unitId || line.unitId,
            unit: selectedCost?.unit || line.unit,
            rate: selectedCost?.rate ?? line.rate,
          };
        }

        if (key === "quantitySourceType") {
          return {
            ...nextLine,
            parameterKey: "",
            derivedMetricKey: "",
            formula: "",
          };
        }

        return nextLine;
      }),
    }));
  };

  const removeTemplateLine = (type, lineId) => {
    const lineKey = type === "manual" ? "manualItems" : "labourItems";

    updateSelectedTemplate((template) => ({
      ...template,
      [lineKey]: template[lineKey].filter((line) => line.id !== lineId),
    }));
  };

  const moveTemplateLine = (type, index, direction) => {
    const lineKey = type === "manual" ? "manualItems" : "labourItems";

    updateSelectedTemplate((template) => ({
      ...template,
      [lineKey]: moveArrayItem(template[lineKey], index, direction),
    }));
  };

  const moveAssembly = (index, direction) => {
    updateSelectedTemplate((template) => ({
      ...template,
      assemblyIds: moveArrayItem(template.assemblyIds, index, direction),
    }));
  };

  const selectedAssemblyRows = useMemo(() => {
    const assemblyGroupMap = Object.fromEntries(availableAssemblies.map((assembly) => [assembly.id, assembly]));

    return (selectedTemplate?.assemblyIds || []).map((assemblyId) => ({
      id: assemblyId,
      assemblyName: assemblyGroupMap[assemblyId]?.assemblyName || assemblyId,
    }));
  }, [availableAssemblies, selectedTemplate]);
  const selectedTemplateMetrics = selectedTemplate ? calculateRoomMetrics(selectedTemplate) : null;

  const renderQuantitySourceFields = (line, type) => {
    if (line.quantitySourceType === "parameter") {
      return (
        <FormField label="Parameter">
          <select
            value={line.parameterKey}
            onChange={(event) => updateTemplateLine(type, line.id, "parameterKey", event.target.value)}
          >
            <option value="">Select parameter</option>
            {parameterDefinitions.map((parameterDefinition) => (
              <option key={parameterDefinition.key} value={parameterDefinition.key}>
                {parameterDefinition.label}
              </option>
            ))}
          </select>
        </FormField>
      );
    }

    if (line.quantitySourceType === "derivedMetric") {
      return (
        <FormField label="Derived metric">
          <select
            value={line.derivedMetricKey}
            onChange={(event) => updateTemplateLine(type, line.id, "derivedMetricKey", event.target.value)}
          >
            <option value="">Select metric</option>
            {derivedMetricOptions.map((metric) => (
              <option key={metric.key} value={metric.key}>
                {metric.label}
              </option>
            ))}
          </select>
        </FormField>
      );
    }

    if (line.quantitySourceType === "formula") {
      return (
        <FormField label="Formula">
          <input
            value={line.formula}
            onChange={(event) => updateTemplateLine(type, line.id, "formula", event.target.value)}
            placeholder="floorArea * 1.05"
          />
        </FormField>
      );
    }

    return (
      <FormField label="Fixed qty">
        <input
          type="number"
          min="0"
          step="0.01"
          value={line.fixedQty}
          onChange={(event) => updateTemplateLine(type, line.id, "fixedQty", event.target.value)}
        />
      </FormField>
    );
  };

  const renderTemplateLineEditor = (line, index, type) => {
    const lineCostKey = type === "manual" ? "costItemId" : "labourItemId";
    const costOptions = type === "manual" ? activeCosts : activeLabourCosts;

    return (
      <div key={line.id} className="room-template-line-card">
        <div className="room-template-line-header">
          <strong>{line.itemName || "Unassigned"}</strong>
          <div className="action-row">
            <button
              type="button"
              className="secondary-button"
              onClick={() => moveTemplateLine(type, index, -1)}
            >
              Up
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => moveTemplateLine(type, index, 1)}
            >
              Down
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={() => removeTemplateLine(type, line.id)}
            >
              Remove
            </button>
          </div>
        </div>

        <div className="form-grid room-template-line-grid">
          <FormField label={type === "manual" ? "Cost item" : "Labour item"}>
            <select
              value={line[lineCostKey] || line.costItemId || ""}
              onChange={(event) => updateTemplateLine(type, line.id, lineCostKey, event.target.value)}
            >
              <option value="">Select item</option>
              {costOptions.map((cost) => (
                <option key={cost.id} value={cost.id}>
                  {cost.itemName}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Quantity source">
            <select
              value={line.quantitySourceType}
              onChange={(event) =>
                updateTemplateLine(type, line.id, "quantitySourceType", event.target.value)
              }
            >
              <option value="fixed">Fixed</option>
              <option value="parameter">Parameter</option>
              <option value="derivedMetric">Derived Metric</option>
              <option value="formula">Formula</option>
            </select>
          </FormField>

          {renderQuantitySourceFields(line, type)}

          <FormField label="Stage">
            <select
              value={line.stageId}
              onChange={(event) => updateTemplateLine(type, line.id, "stageId", event.target.value)}
            >
              <option value="">Unassigned</option>
              {activeStages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Trade">
            <select
              value={line.tradeId}
              onChange={(event) => updateTemplateLine(type, line.id, "tradeId", event.target.value)}
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
              value={line.elementId}
              onChange={(event) => updateTemplateLine(type, line.id, "elementId", event.target.value)}
            >
              <option value="">Unassigned</option>
              {activeElements.map((element) => (
                <option key={element.id} value={element.id}>
                  {element.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Cost code">
            <select
              value={line.costCodeId}
              onChange={(event) => updateTemplateLine(type, line.id, "costCodeId", event.target.value)}
            >
              <option value="">Unassigned</option>
              {activeCostCodes.map((costCode) => (
                <option key={costCode.id} value={costCode.id}>
                  {costCode.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Sort order">
            <input
              type="number"
              min="0"
              step="1"
              value={line.sortOrder}
              onChange={(event) => updateTemplateLine(type, line.id, "sortOrder", event.target.value)}
            />
          </FormField>

          <FormField label="Include">
            <select
              value={String(line.include)}
              onChange={(event) => updateTemplateLine(type, line.id, "include", event.target.value === "true")}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </FormField>
        </div>
      </div>
    );
  };

  return (
    <SectionCard
      title="Room Library"
      description="Define complete reusable room templates in one place, including parameters, linked assemblies, manual items, labour, and a generated preview."
    >
      <div className="page-grid room-template-page">
        <div className="room-template-list-panel">
          <div className="room-template-list-header">
            <h3>Room Templates</h3>
            <button type="button" className="primary-button" onClick={addTemplate}>
              Add Room Template
            </button>
          </div>

          {normalizedTemplates.length ? (
            <div className="room-template-card-list">
              {normalizedTemplates.map((template) => {
                const isSelected = template.id === selectedTemplateId;
                const templateMetrics = calculateRoomMetrics(template);

                return (
                  <div
                    key={template.id}
                    className={`room-template-card ${
                      isSelected ? "room-template-card-selected" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="room-template-card-button"
                      onClick={() => setSelectedTemplateId(template.id)}
                    >
                      <div className="room-template-card-header">
                        <div className="room-template-card-title">
                          <strong>{template.name || "Untitled Template"}</strong>
                          <span className="room-template-card-type">{template.roomType}</span>
                        </div>
                        {isSelected ? (
                          <span className="room-template-selected-badge">Selected</span>
                        ) : null}
                      </div>

                      <div className="room-template-card-metadata">
                        <span>{template.assemblyIds.length} assemblies</span>
                        <span>{template.manualItems.length} manual items</span>
                        <span>{template.labourItems.length} labour items</span>
                      </div>

                      <div className="room-template-card-footer">
                        <span>{templateMetrics.floorArea.toFixed(2)} sq m</span>
                        <span>{template.include ? "Included" : "Excluded"}</span>
                      </div>
                    </button>

                    <div className="room-template-card-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => duplicateTemplate(template)}
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => deleteTemplate(template.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="empty-state">No room templates added yet.</p>
          )}
        </div>

        {selectedTemplate ? (
          <div className="room-template-editor">
            <div className="summary-section room-template-editor-header">
              <div>
                <p className="room-template-editor-kicker">Editing Template</p>
                <h3>{selectedTemplate.name || "Untitled Template"}</h3>
              </div>
              <div className="room-template-editor-header-meta">
                <span className="room-template-selected-badge">{selectedTemplate.roomType}</span>
                {selectedTemplateMetrics ? (
                  <span className="room-template-editor-metric">
                    {selectedTemplateMetrics.floorArea.toFixed(2)} sq m
                  </span>
                ) : null}
              </div>
            </div>

            <div className="summary-section room-template-compact-section">
              <h3>General</h3>
              <div className="form-grid room-template-fields-grid room-template-fields-grid-compact">
                <FormField label="Template name">
                  <input
                    value={selectedTemplate.name}
                    onChange={(event) =>
                      updateSelectedTemplate((template) => ({
                        ...template,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Bathroom 001"
                  />
                </FormField>

                <FormField label="Room type">
                  <select
                    value={selectedTemplate.roomTypeId}
                    onChange={(event) => updateRoomType(event.target.value)}
                  >
                    {activeRoomTypes.map((roomType) => (
                      <option key={roomType.id} value={roomType.id}>
                        {roomType.name}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Quantity">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={selectedTemplate.quantity}
                    onChange={(event) =>
                      updateSelectedTemplate((template) => ({
                        ...template,
                        quantity: toNumber(event.target.value, 1),
                      }))
                    }
                  />
                </FormField>

                <FormField label="Include">
                  <select
                    value={String(selectedTemplate.include)}
                    onChange={(event) =>
                      updateSelectedTemplate((template) => ({
                        ...template,
                        include: event.target.value === "true",
                      }))
                    }
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </FormField>
              </div>
            </div>

            <div className="summary-section room-template-compact-section">
              <h3>Parameters</h3>
              <div className="form-grid room-template-fields-grid">
                {parameterDefinitions.map((parameterDefinition) => (
                  <FormField
                    key={parameterDefinition.key}
                    label={getParameterLabel(parameterDefinition)}
                  >
                    <input
                      type={parameterDefinition.inputType}
                      min={parameterDefinition.inputType === "number" ? "0" : undefined}
                      step={parameterDefinition.inputType === "number" ? "0.01" : undefined}
                      value={selectedTemplate[parameterDefinition.key] ?? ""}
                      onChange={(event) =>
                        updateSelectedTemplate((template) => ({
                          ...template,
                          [parameterDefinition.key]:
                            parameterDefinition.inputType === "number"
                              ? toNumber(event.target.value)
                              : event.target.value,
                        }))
                      }
                    />
                  </FormField>
                ))}
              </div>
            </div>

            <div className="summary-section room-template-compact-section">
              <div className="room-template-section-header">
                <div>
                  <h3>Assemblies</h3>
                  <p>Link reusable assembly groups by `assemblyId`.</p>
                </div>
              </div>

              <div className="form-grid room-template-fields-grid room-template-add-grid">
                <FormField label="Search assemblies">
                  <input
                    value={assemblySearchTerm}
                    onChange={(event) => setAssemblySearchTerm(event.target.value)}
                    placeholder="Search assemblies"
                  />
                </FormField>

                <FormField label="Assembly">
                  <select
                    value={assemblySelection}
                    onChange={(event) => setAssemblySelection(event.target.value)}
                  >
                    <option value="">Select assembly</option>
                    {filteredAssemblies.map((assembly) => (
                      <option key={assembly.id} value={assembly.id}>
                        {assembly.assemblyName}
                      </option>
                    ))}
                  </select>
                </FormField>

                <div className="action-row room-template-inline-actions">
                  <button type="button" className="secondary-button" onClick={addAssembly}>
                    Add Assembly
                  </button>
                </div>
              </div>

              {selectedAssemblyRows.length ? (
                <div className="room-template-list-stack">
                  {selectedAssemblyRows.map((assembly, index) => (
                    <div key={assembly.id} className="room-template-line-card">
                      <div className="room-template-line-header">
                        <strong>{assembly.assemblyName}</strong>
                        <div className="action-row">
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => moveAssembly(index, -1)}
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => moveAssembly(index, 1)}
                          >
                            Down
                          </button>
                          <button
                            type="button"
                            className="danger-button"
                            onClick={() =>
                              updateSelectedTemplate((template) => ({
                                ...template,
                                assemblyIds: template.assemblyIds.filter(
                                  (assemblyId) => assemblyId !== assembly.id
                                ),
                              }))
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No assemblies linked to this template.</p>
              )}
            </div>

            <div className="summary-section room-template-compact-section">
              <div className="room-template-section-header">
                <div>
                  <h3>Manual Items</h3>
                  <p>Link cost items and drive quantities from fixed values, parameters, metrics, or formulas.</p>
                </div>
              </div>

              <div className="form-grid room-template-fields-grid room-template-add-grid">
                <FormField label="Search cost items">
                  <input
                    value={manualCostSearchTerm}
                    onChange={(event) => setManualCostSearchTerm(event.target.value)}
                    placeholder="Search cost item"
                  />
                </FormField>

                <FormField label="Cost item">
                  <select
                    value={manualCostSelection}
                    onChange={(event) => setManualCostSelection(event.target.value)}
                  >
                    <option value="">Select cost item</option>
                    {filteredManualCosts.map((cost) => (
                      <option key={cost.id} value={cost.id}>
                        {cost.itemName}
                      </option>
                    ))}
                  </select>
                </FormField>

                <div className="action-row room-template-inline-actions">
                  <button type="button" className="secondary-button" onClick={() => addTemplateLine("manual")}>
                    Add Manual Item
                  </button>
                </div>
              </div>

              {selectedTemplate.manualItems.length ? (
                <div className="room-template-list-stack">
                  {selectedTemplate.manualItems.map((line, index) =>
                    renderTemplateLineEditor(line, index, "manual")
                  )}
                </div>
              ) : (
                <p className="empty-state">No manual items linked to this template.</p>
              )}
            </div>

            <div className="summary-section room-template-compact-section">
              <div className="room-template-section-header">
                <div>
                  <h3>Labour</h3>
                  <p>Link labour cost items and set quantity from controlled room data.</p>
                </div>
              </div>

              <div className="form-grid room-template-fields-grid room-template-add-grid">
                <FormField label="Search labour items">
                  <input
                    value={labourCostSearchTerm}
                    onChange={(event) => setLabourCostSearchTerm(event.target.value)}
                    placeholder="Search labour item"
                  />
                </FormField>

                <FormField label="Labour item">
                  <select
                    value={labourCostSelection}
                    onChange={(event) => setLabourCostSelection(event.target.value)}
                  >
                    <option value="">Select labour item</option>
                    {filteredLabourCosts.map((cost) => (
                      <option key={cost.id} value={cost.id}>
                        {cost.itemName}
                      </option>
                    ))}
                  </select>
                </FormField>

                <div className="action-row room-template-inline-actions">
                  <button type="button" className="secondary-button" onClick={() => addTemplateLine("labour")}>
                    Add Labour
                  </button>
                </div>
              </div>

              {selectedTemplate.labourItems.length ? (
                <div className="room-template-list-stack">
                  {selectedTemplate.labourItems.map((line, index) =>
                    renderTemplateLineEditor(line, index, "labour")
                  )}
                </div>
              ) : (
                <p className="empty-state">No labour items linked to this template.</p>
              )}
            </div>

            <div className="summary-section room-template-compact-section">
              <h3>Preview</h3>

              {templateMetrics ? (
                <div className="room-template-preview-metrics">
                  {derivedMetricOptions.map((metric) => (
                    <div key={metric.key} className="room-template-preview-metric">
                      <strong>{metric.label}</strong>
                      <span>{formatMetricValue(metric.key, templateMetrics[metric.key])}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              <DataTable
                columns={[
                  { key: "assemblyName", header: "Source" },
                  { key: "itemName", header: "Item" },
                  { key: "qtyRule", header: "Qty Source" },
                  {
                    key: "quantity",
                    header: "Quantity",
                    render: (row) => `${row.quantity} ${row.unit}`,
                  },
                ]}
                rows={previewRows}
                emptyMessage="No preview lines generated for this template."
                wrapClassName="room-template-preview-table-wrap"
                tableClassName="room-template-preview-table"
              />
            </div>
          </div>
        ) : (
          <div className="summary-section">
            <p className="empty-state">Add a room template to begin editing.</p>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

export default RoomInputsPage;
