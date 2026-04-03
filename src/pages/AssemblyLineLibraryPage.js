import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable";
import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";
import { getQuantityFormulaOptions } from "../utils/quantityFormulaOptions";

const defaultForm = {
  id: "",
  name: "",
  costItemId: "",
  costItemNameSnapshot: "",
  defaultFormula: "",
  defaultQtyRule: "",
  defaultWasteFactor: "",
  defaultUnit: "",
  defaultRateOverride: "",
  tradeId: "",
  costCodeId: "",
  roomType: "",
  assemblyGroup: "",
  assemblyElement: "",
  assemblyScope: "",
  notes: "",
  sortOrder: "1",
  isActive: true,
  tradeSource: "inherit",
  costCodeSource: "inherit",
  unitSource: "inherit",
};

function cleanText(value) {
  return String(value || "").trim();
}

function sortActiveItems(items = [], labelKey = "name") {
  return [...items]
    .filter((item) => item.isActive !== false)
    .sort(
      (left, right) =>
        Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) ||
        cleanText(left[labelKey]).localeCompare(cleanText(right[labelKey]))
    );
}

function getSourceMode(storedValue, inheritedValue) {
  const normalizedStoredValue = cleanText(storedValue);
  const normalizedInheritedValue = cleanText(inheritedValue);

  if (!normalizedStoredValue || normalizedStoredValue === normalizedInheritedValue) {
    return "inherit";
  }

  return "override";
}

function normalizeUnitValue(value, units = []) {
  const normalizedValue = cleanText(value).toLowerCase();
  const matchedUnit = units.find(
    (unit) =>
      cleanText(unit.id).toLowerCase() === normalizedValue ||
      cleanText(unit.abbreviation).toLowerCase() === normalizedValue ||
      cleanText(unit.name).toLowerCase() === normalizedValue
  );

  return matchedUnit?.abbreviation || cleanText(value);
}

function normalizeTemplateForm(form) {
  return {
    id: form.id || `assembly-line-template-${Date.now()}`,
    name: cleanText(form.name),
    costItemId: cleanText(form.costItemId),
    costItemNameSnapshot: cleanText(form.costItemNameSnapshot),
    defaultFormula: cleanText(form.defaultFormula),
    defaultQtyRule: cleanText(form.defaultQtyRule),
    defaultWasteFactor: cleanText(form.defaultWasteFactor),
    defaultUnit: form.unitSource === "override" ? cleanText(form.defaultUnit) : "",
    defaultRateOverride: cleanText(form.defaultRateOverride),
    tradeId: form.tradeSource === "override" ? cleanText(form.tradeId) : "",
    costCodeId: form.costCodeSource === "override" ? cleanText(form.costCodeId) : "",
    roomType: cleanText(form.roomType),
    assemblyGroup: cleanText(form.assemblyGroup),
    assemblyElement: cleanText(form.assemblyElement),
    assemblyScope: cleanText(form.assemblyScope),
    notes: cleanText(form.notes),
    sortOrder: Number(form.sortOrder || 0),
    isActive: form.isActive !== false,
  };
}

function AssemblyLineLibraryPage({
  assemblyLineTemplates = [],
  costs = [],
  trades = [],
  costCodes = [],
  units = [],
  roomTypes = [],
  elements = [],
  parameters = [],
  onAssemblyLineTemplatesChange,
}) {
  const [form, setForm] = useState(defaultForm);
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [templateNameTouched, setTemplateNameTouched] = useState(false);
  const [formulaMode, setFormulaMode] = useState("guided");
  const [qtyRuleMode, setQtyRuleMode] = useState("guided");

  const activeCosts = useMemo(
    () =>
      [...costs]
        .filter((cost) => cost.isActive !== false)
        .sort((left, right) => cleanText(left.itemName).localeCompare(cleanText(right.itemName))),
    [costs]
  );
  const activeTrades = useMemo(() => sortActiveItems(trades), [trades]);
  const activeCostCodes = useMemo(() => sortActiveItems(costCodes), [costCodes]);
  const activeUnits = useMemo(() => sortActiveItems(units, "abbreviation"), [units]);
  const activeRoomTypes = useMemo(() => sortActiveItems(roomTypes), [roomTypes]);
  const activeElements = useMemo(() => sortActiveItems(elements), [elements]);
  const quantityOptions = useMemo(() => getQuantityFormulaOptions(parameters), [parameters]);
  const quantityOptionValues = useMemo(
    () => quantityOptions.map((option) => option.value),
    [quantityOptions]
  );

  const selectedCost = useMemo(
    () => activeCosts.find((cost) => cost.id === form.costItemId) || null,
    [activeCosts, form.costItemId]
  );
  const inheritedTradeLabel = useMemo(() => {
    if (!selectedCost) {
      return "Unassigned";
    }

    return (
      activeTrades.find((trade) => trade.id === selectedCost.tradeId)?.name ||
      cleanText(selectedCost.trade) ||
      "Unassigned"
    );
  }, [activeTrades, selectedCost]);
  const inheritedCostCodeLabel = useMemo(() => {
    if (!selectedCost) {
      return "Unassigned";
    }

    return (
      activeCostCodes.find((costCode) => costCode.id === selectedCost.costCodeId)?.name ||
      cleanText(selectedCost.costCode) ||
      "Unassigned"
    );
  }, [activeCostCodes, selectedCost]);
  const inheritedUnitLabel = useMemo(() => {
    if (!selectedCost) {
      return "Unassigned";
    }

    return normalizeUnitValue(selectedCost.unit || selectedCost.unitId, activeUnits) || "Unassigned";
  }, [activeUnits, selectedCost]);
  const baseRatePreview = useMemo(() => {
    if (!selectedCost || selectedCost.rate === "" || selectedCost.rate == null) {
      return "Unassigned";
    }

    const numericValue = Number(selectedCost.rate);
    return Number.isFinite(numericValue) ? `$${numericValue}` : "Unassigned";
  }, [selectedCost]);
  const suggestedTemplateName = useMemo(() => {
    const element = cleanText(form.assemblyElement);
    const scope = cleanText(form.assemblyScope);
    const roomType = cleanText(form.roomType);
    const costSnapshot = cleanText(form.costItemNameSnapshot);

    if (element && scope) {
      return `${element} - ${scope}`;
    }

    if (roomType && costSnapshot) {
      return `${roomType} - ${costSnapshot}`;
    }

    return costSnapshot;
  }, [form.assemblyElement, form.assemblyScope, form.costItemNameSnapshot, form.roomType]);

  const sortedTemplates = useMemo(
    () =>
      [...assemblyLineTemplates].sort(
        (left, right) =>
          Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) ||
          cleanText(left.name).localeCompare(cleanText(right.name))
      ),
    [assemblyLineTemplates]
  );

  useEffect(() => {
    if (templateNameTouched) {
      return;
    }

    setForm((current) =>
      current.name === suggestedTemplateName ? current : { ...current, name: suggestedTemplateName }
    );
  }, [suggestedTemplateName, templateNameTouched]);

  const updateField = (key, value) => {
    setForm((current) => {
      const nextForm = { ...current, [key]: value };

      if (key === "costItemId") {
        const nextSelectedCost = activeCosts.find((cost) => cost.id === value);
        nextForm.costItemNameSnapshot =
          nextSelectedCost?.itemName || nextSelectedCost?.displayName || "";
        if (current.tradeSource === "override" && !cleanText(current.tradeId)) {
          nextForm.tradeId = nextSelectedCost?.tradeId || "";
        }
        if (current.costCodeSource === "override" && !cleanText(current.costCodeId)) {
          nextForm.costCodeId = nextSelectedCost?.costCodeId || "";
        }
        if (current.unitSource === "override" && !cleanText(current.defaultUnit)) {
          nextForm.defaultUnit = normalizeUnitValue(
            nextSelectedCost?.unit || nextSelectedCost?.unitId,
            activeUnits
          );
        }
      }

      if (key === "tradeSource" && value === "inherit") {
        nextForm.tradeId = "";
      }
      if (key === "costCodeSource" && value === "inherit") {
        nextForm.costCodeId = "";
      }
      if (key === "unitSource" && value === "inherit") {
        nextForm.defaultUnit = "";
      }

      return nextForm;
    });

    if (key === "name") {
      setTemplateNameTouched(true);
    }
  };

  const resetForm = () => {
    setForm(defaultForm);
    setEditingTemplateId("");
    setTemplateNameTouched(false);
    setFormulaMode("guided");
    setQtyRuleMode("guided");
  };

  const saveTemplate = (event) => {
    event.preventDefault();

    if (!cleanText(form.name) || !cleanText(form.costItemId)) {
      return;
    }

    const nextTemplate = normalizeTemplateForm(form);

    onAssemblyLineTemplatesChange(
      editingTemplateId
        ? assemblyLineTemplates.map((template) =>
            template.id === editingTemplateId ? nextTemplate : template
          )
        : [...assemblyLineTemplates, nextTemplate]
    );

    resetForm();
  };

  const editTemplate = (template) => {
    const linkedCost = activeCosts.find((cost) => cost.id === template.costItemId);
    const inheritedTradeValue = linkedCost?.tradeId || "";
    const inheritedCostCodeValue = linkedCost?.costCodeId || "";
    const inheritedUnitValue = normalizeUnitValue(linkedCost?.unit || linkedCost?.unitId, activeUnits);
    const nextFormulaMode =
      !cleanText(template.defaultFormula) || quantityOptionValues.includes(template.defaultFormula)
        ? "guided"
        : "custom";
    const nextQtyRuleMode =
      !cleanText(template.defaultQtyRule) || quantityOptionValues.includes(template.defaultQtyRule)
        ? "guided"
        : "custom";

    setEditingTemplateId(template.id);
    setTemplateNameTouched(true);
    setFormulaMode(nextFormulaMode);
    setQtyRuleMode(nextQtyRuleMode);
    setForm({
      id: template.id,
      name: template.name || "",
      costItemId: template.costItemId || "",
      costItemNameSnapshot: template.costItemNameSnapshot || linkedCost?.itemName || "",
      defaultFormula: template.defaultFormula || "",
      defaultQtyRule: template.defaultQtyRule || "",
      defaultWasteFactor: template.defaultWasteFactor ?? "",
      defaultUnit:
        getSourceMode(template.defaultUnit, inheritedUnitValue) === "override"
          ? normalizeUnitValue(template.defaultUnit, activeUnits)
          : "",
      defaultRateOverride: template.defaultRateOverride ?? "",
      tradeId:
        getSourceMode(template.tradeId, inheritedTradeValue) === "override"
          ? template.tradeId || ""
          : "",
      costCodeId:
        getSourceMode(template.costCodeId, inheritedCostCodeValue) === "override"
          ? template.costCodeId || ""
          : "",
      roomType: template.roomType || "",
      assemblyGroup: template.assemblyGroup || "",
      assemblyElement: template.assemblyElement || "",
      assemblyScope: template.assemblyScope || "",
      notes: template.notes || "",
      sortOrder: String(template.sortOrder ?? 0),
      isActive: template.isActive !== false,
      tradeSource: getSourceMode(template.tradeId, inheritedTradeValue),
      costCodeSource: getSourceMode(template.costCodeId, inheritedCostCodeValue),
      unitSource: getSourceMode(template.defaultUnit, inheritedUnitValue),
    });
  };

  const removeTemplate = (templateId) => {
    onAssemblyLineTemplatesChange(
      assemblyLineTemplates.filter((template) => template.id !== templateId)
    );

    if (editingTemplateId === templateId) {
      resetForm();
    }
  };

  return (
    <SectionCard
      title="Assembly Line Library"
      description="Manage reusable assembly line templates that pull classification and pricing context from Cost Library items before they are copied into finished assemblies."
    >
      <div className="page-grid library-page library-page-assembly-lines">
        <form className="library-form-card assembly-line-library-form-card" onSubmit={saveTemplate}>
          <div className="assembly-line-library-sections">
            <section className="assembly-line-library-section assembly-line-library-section--inherited">
              <div className="assembly-line-library-section-header">
                <div>
                  <h3>Inherited from Cost Library</h3>
                  <p>Choose a cost item, then inherit or optionally override the linked trade, cost code, and unit.</p>
                </div>
              </div>
              <div className="library-form-grid assembly-line-library-grid">
                <div className="library-form-span-2">
                  <FormField label="Cost item">
                    <select
                      value={form.costItemId}
                      onChange={(event) => updateField("costItemId", event.target.value)}
                    >
                      <option value="">Select a Cost Library item</option>
                      {activeCosts.map((cost) => (
                        <option key={cost.id} value={cost.id}>
                          {cost.itemName}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <div className="library-form-span-2">
                  <FormField label="Cost item snapshot">
                    <input
                      className="assembly-line-library-readonly-input"
                      value={form.costItemNameSnapshot}
                      readOnly
                    />
                  </FormField>
                  <p className="assembly-line-library-field-note">Snapshotted from the linked Cost Library item.</p>
                </div>

                <div className="library-form-span-2 assembly-line-library-override-row">
                  <FormField label="Trade source">
                    <select
                      value={form.tradeSource}
                      onChange={(event) => updateField("tradeSource", event.target.value)}
                    >
                      <option value="inherit">Use Cost Library</option>
                      <option value="override">Override</option>
                    </select>
                  </FormField>
                  <FormField label="Trade">
                    {form.tradeSource === "inherit" ? (
                      <input
                        className="assembly-line-library-readonly-input"
                        value={inheritedTradeLabel}
                        readOnly
                      />
                    ) : (
                      <select
                        value={form.tradeId}
                        onChange={(event) => updateField("tradeId", event.target.value)}
                      >
                        <option value="">Select trade override</option>
                        {activeTrades.map((trade) => (
                          <option key={trade.id} value={trade.id}>
                            {trade.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </FormField>
                </div>

                <div className="library-form-span-2 assembly-line-library-override-row">
                  <FormField label="Cost code source">
                    <select
                      value={form.costCodeSource}
                      onChange={(event) => updateField("costCodeSource", event.target.value)}
                    >
                      <option value="inherit">Use Cost Library</option>
                      <option value="override">Override</option>
                    </select>
                  </FormField>
                  <FormField label="Cost code">
                    {form.costCodeSource === "inherit" ? (
                      <input
                        className="assembly-line-library-readonly-input"
                        value={inheritedCostCodeLabel}
                        readOnly
                      />
                    ) : (
                      <select
                        value={form.costCodeId}
                        onChange={(event) => updateField("costCodeId", event.target.value)}
                      >
                        <option value="">Select cost code override</option>
                        {activeCostCodes.map((costCode) => (
                          <option key={costCode.id} value={costCode.id}>
                            {costCode.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </FormField>
                </div>

                <div className="library-form-span-2 assembly-line-library-override-row">
                  <FormField label="Unit source">
                    <select
                      value={form.unitSource}
                      onChange={(event) => updateField("unitSource", event.target.value)}
                    >
                      <option value="inherit">Use Cost Library</option>
                      <option value="override">Override</option>
                    </select>
                  </FormField>
                  <FormField label="Default unit">
                    {form.unitSource === "inherit" ? (
                      <input
                        className="assembly-line-library-readonly-input"
                        value={inheritedUnitLabel}
                        readOnly
                      />
                    ) : (
                      <select
                        value={form.defaultUnit}
                        onChange={(event) => updateField("defaultUnit", event.target.value)}
                      >
                        <option value="">Select unit override</option>
                        {activeUnits.map((unit) => (
                          <option key={unit.id} value={unit.abbreviation || unit.name}>
                            {unit.abbreviation || unit.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </FormField>
                </div>

                <div className="library-form-span-2">
                  <FormField label="Base rate preview">
                    <input className="assembly-line-library-readonly-input" value={baseRatePreview} readOnly />
                  </FormField>
                </div>
              </div>
            </section>

            <section className="assembly-line-library-section">
              <div className="assembly-line-library-section-header">
                <div>
                  <h3>Template Rules</h3>
                  <p>Set the reusable naming, formula defaults, and optional commercial overrides copied into assemblies.</p>
                </div>
              </div>
              <div className="library-form-grid assembly-line-library-grid">
                <div className="library-form-span-2">
                  <FormField label="Template name">
                    <input
                      value={form.name}
                      onChange={(event) => updateField("name", event.target.value)}
                      placeholder="Bathroom floor tile install"
                    />
                  </FormField>
                  <p className="assembly-line-library-field-note">
                    Suggested automatically from element and scope until you edit it manually.
                  </p>
                </div>

                <div className="library-form-span-2 assembly-line-library-mode-row">
                  <FormField label="Formula mode">
                    <select value={formulaMode} onChange={(event) => setFormulaMode(event.target.value)}>
                      <option value="guided">Search Parameter Library</option>
                      <option value="custom">Custom formula</option>
                    </select>
                  </FormField>
                  <FormField label="Default formula">
                    <input
                      list={formulaMode === "guided" ? "assembly-line-formula-options" : undefined}
                      value={form.defaultFormula}
                      onChange={(event) => updateField("defaultFormula", event.target.value)}
                      placeholder={formulaMode === "guided" ? "Search parameter keys" : "floorArea * 1.1"}
                    />
                  </FormField>
                </div>

                <div className="library-form-span-2 assembly-line-library-mode-row">
                  <FormField label="Qty rule mode">
                    <select value={qtyRuleMode} onChange={(event) => setQtyRuleMode(event.target.value)}>
                      <option value="guided">Search Parameter Library</option>
                      <option value="custom">Custom qty rule</option>
                    </select>
                  </FormField>
                  <FormField label="Default qty rule">
                    <input
                      list={qtyRuleMode === "guided" ? "assembly-line-qty-rule-options" : undefined}
                      value={form.defaultQtyRule}
                      onChange={(event) => updateField("defaultQtyRule", event.target.value)}
                      placeholder={qtyRuleMode === "guided" ? "Search parameter keys" : "FloorArea"}
                    />
                  </FormField>
                </div>

                <div className="library-form-narrow">
                  <FormField label="Waste factor">
                    <input
                      type="number"
                      step="0.01"
                      value={form.defaultWasteFactor}
                      onChange={(event) => updateField("defaultWasteFactor", event.target.value)}
                      placeholder="0.1"
                    />
                  </FormField>
                </div>

                <div className="library-form-narrow">
                  <FormField label="Rate override">
                    <input
                      type="number"
                      step="0.01"
                      value={form.defaultRateOverride}
                      onChange={(event) => updateField("defaultRateOverride", event.target.value)}
                      placeholder="Optional"
                    />
                  </FormField>
                </div>

                <div className="library-form-narrow">
                  <FormField label="Sort order">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.sortOrder}
                      onChange={(event) => updateField("sortOrder", event.target.value)}
                    />
                  </FormField>
                </div>

                <div className="library-form-narrow">
                  <FormField label="Active">
                    <select
                      value={String(form.isActive)}
                      onChange={(event) => updateField("isActive", event.target.value === "true")}
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </FormField>
                </div>

                <div className="library-form-span-2">
                  <FormField label="Notes">
                    <textarea
                      rows={4}
                      value={form.notes}
                      onChange={(event) => updateField("notes", event.target.value)}
                      placeholder="Optional assembly line notes"
                    />
                  </FormField>
                </div>
              </div>
            </section>

            <section className="assembly-line-library-section">
              <div className="assembly-line-library-section-header">
                <div>
                  <h3>Classification / Placement</h3>
                  <p>Place the template where it should surface when teams build assemblies.</p>
                </div>
              </div>
              <div className="library-form-grid assembly-line-library-grid">
                <div className="library-form-medium">
                  <FormField label="Room type">
                    <select
                      value={form.roomType}
                      onChange={(event) => updateField("roomType", event.target.value)}
                    >
                      <option value="">All room types</option>
                      {activeRoomTypes.map((roomType) => (
                        <option key={roomType.id} value={roomType.name}>
                          {roomType.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <div className="library-form-medium">
                  <FormField label="Assembly group">
                    <input
                      value={form.assemblyGroup}
                      onChange={(event) => updateField("assemblyGroup", event.target.value)}
                      placeholder="Walls & Linings"
                    />
                  </FormField>
                </div>

                <div className="library-form-medium">
                  <FormField label="Assembly element">
                    <select
                      value={form.assemblyElement}
                      onChange={(event) => updateField("assemblyElement", event.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {activeElements.map((element) => (
                        <option key={element.id} value={element.name}>
                          {element.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <div className="library-form-medium">
                  <FormField label="Assembly scope">
                    <input
                      value={form.assemblyScope}
                      onChange={(event) => updateField("assemblyScope", event.target.value)}
                      placeholder="Floor tiling"
                    />
                  </FormField>
                </div>
              </div>
            </section>
          </div>

          <datalist id="assembly-line-formula-options">
            {quantityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </datalist>
          <datalist id="assembly-line-qty-rule-options">
            {quantityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </datalist>

          <div className="action-row library-form-actions">
            <button type="submit" className="primary-button">
              {editingTemplateId ? "Save template" : "Add template"}
            </button>
            {editingTemplateId ? (
              <button type="button" className="secondary-button" onClick={resetForm}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>

        <div className="library-table-panel">
          <DataTable
            columns={[
              {
                key: "name",
                header: "Template",
                className: "table-col-wide",
                render: (row) => row.name || "Untitled template",
              },
              {
                key: "costItemNameSnapshot",
                header: "Cost Item",
                className: "table-col-wide",
                render: (row) => row.costItemNameSnapshot || "Unassigned",
              },
              {
                key: "defaultFormula",
                header: "Formula",
                className: "table-col-wide",
                render: (row) => row.defaultFormula || row.defaultQtyRule || "Unassigned",
              },
              {
                key: "roomType",
                header: "Room Type",
                className: "table-col-code",
                render: (row) => row.roomType || "All",
              },
              {
                key: "assemblyGroup",
                header: "Group",
                className: "table-col-code",
                render: (row) => row.assemblyGroup || "Unassigned",
              },
              {
                key: "isActive",
                header: "Active",
                className: "table-col-narrow",
                render: (row) => (row.isActive !== false ? "Yes" : "No"),
              },
            ]}
            rows={sortedTemplates}
            emptyMessage="No assembly line templates added yet."
            tableClassName="library-compact-table"
            actionsColumnClassName="table-col-actions"
            renderActions={(row) => (
              <div className="action-row">
                <button type="button" className="secondary-button" onClick={() => editTemplate(row)}>
                  Edit
                </button>
                <button type="button" className="danger-button" onClick={() => removeTemplate(row.id)}>
                  Remove
                </button>
              </div>
            )}
          />
        </div>
      </div>
    </SectionCard>
  );
}

export default AssemblyLineLibraryPage;
