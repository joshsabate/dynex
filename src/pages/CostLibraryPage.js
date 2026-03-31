import { useMemo, useRef, useState } from "react";
import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";
import { applyImportMode, convertCostsToCSV, parseCSV } from "../utils/csvUtils";
import { getStructuredItemPresentation } from "../utils/itemNaming";
import {
  costStatusOptions,
  costTypeOptions,
  deliveryTypeOptions,
  normalizeCosts,
} from "../utils/costs";
import { resolveUnit } from "../utils/units";

const requiredCostImportHeaders = [
  "Core Name",
  "Cost Type",
  "Delivery Type",
  "Trade",
  "Cost Code",
  "Unit",
  "Rate",
];

function sortActiveItems(items = []) {
  return [...items]
    .filter((item) => item.isActive !== false)
    .sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
    );
}

function cleanText(value) {
  return String(value || "").trim();
}

function createEmptyCostItem(units = []) {
  const unit = sortActiveItems(units)[0] || { id: "", abbreviation: "" };

  return {
    id: "",
    internalId: "",
    itemName: "",
    coreName: "",
    costType: "",
    deliveryType: "",
    itemFamily: "",
    family: "",
    tradeId: "",
    trade: "",
    costCodeId: "",
    costCode: "",
    specification: "",
    spec: "",
    gradeOrQuality: "",
    grade: "",
    finishOrVariant: "",
    finish: "",
    brand: "",
    unitId: unit.id,
    unit: unit.abbreviation,
    rate: "",
    status: "Active",
    isActive: true,
    notes: "",
    sourceLink: "",
  };
}

function cloneCostItem(cost, units = []) {
  return { ...createEmptyCostItem(units), ...cost };
}

function getTradeKey(cost) {
  return cleanText(cost.tradeId || cost.trade);
}

function createDuplicateName(itemName) {
  const baseName = cleanText(itemName) || "Cost Item";
  return baseName.includes("(Copy)") ? baseName : `${baseName} (Copy)`;
}

function buildImportedCostSource(row, index) {
  const coreName = cleanText(row["Core Name"] || row["Item Name"]);

  return {
    id: `cost-import-${Date.now()}-${index}`,
    internalId: cleanText(row["Internal ID"]),
    coreName,
    itemName: coreName,
    costType: cleanText(row["Cost Type"]),
    deliveryType: cleanText(row["Delivery Type"]),
    workType: cleanText(row["Work Type"]),
    itemFamily: cleanText(row.Family || row["Item Family"]),
    trade: cleanText(row.Trade),
    costCode: cleanText(row["Cost Code"]),
    specification: cleanText(row.Spec || row.Specification),
    gradeOrQuality: cleanText(row.Grade || row["Grade / Quality"]),
    finishOrVariant: cleanText(row.Finish || row["Finish / Variant"]),
    brand: cleanText(row.Brand),
    unit: cleanText(row.Unit),
    rate: cleanText(row.Rate),
    status: cleanText(row.Status) || "Active",
    sourceLink: cleanText(row["Source Link"]),
    notes: cleanText(row.Notes),
  };
}

function validateImportedCostRow(row, units = []) {
  const requiredFields = [
    "Core Name",
    "Cost Type",
    "Delivery Type",
    "Trade",
    "Cost Code",
    "Unit",
    "Rate",
  ];
  const errors = [];

  requiredFields.forEach((field) => {
    if (!cleanText(row[field])) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  const rate = cleanText(row.Rate);
  if (rate && !Number.isFinite(Number(rate))) {
    errors.push("Invalid Rate");
  }

  const costType = cleanText(row["Cost Type"]);
  if (costType && !costTypeOptions.includes(costType)) {
    errors.push("Invalid Cost Type");
  }

  const deliveryType = cleanText(row["Delivery Type"]);
  if (deliveryType && !deliveryTypeOptions.includes(deliveryType)) {
    errors.push("Invalid Delivery Type");
  }

  const unit = cleanText(row.Unit);
  if (unit && !resolveUnit(units, "", unit)) {
    errors.push("Invalid Unit");
  }

  return errors;
}

function CostLibraryPage({
  costs,
  units,
  trades,
  costCodes,
  itemFamilies = [],
  onCostsChange,
  onItemFamiliesChange = () => {},
}) {
  const importFileInputRef = useRef(null);
  const activeUnits = useMemo(() => sortActiveItems(units), [units]);
  const activeTrades = useMemo(() => sortActiveItems(trades), [trades]);
  const activeCostCodes = useMemo(() => sortActiveItems(costCodes), [costCodes]);
  const activeItemFamilies = useMemo(
    () => sortActiveItems(itemFamilies),
    [itemFamilies]
  );
  const normalizedCosts = useMemo(
    () => normalizeCosts(costs, { units, trades, costCodes, itemFamilies }),
    [costCodes, costs, itemFamilies, trades, units]
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTradeId, setActiveTradeId] = useState("all");
  const [costCodeFilter, setCostCodeFilter] = useState("");
  const [familyFilter, setFamilyFilter] = useState("");
  const [costTypeFilter, setCostTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [csvStatus, setCsvStatus] = useState("");
  const [importFailures, setImportFailures] = useState([]);
  const [importMode, setImportMode] = useState("append");
  const [sortKey, setSortKey] = useState("itemName");
  const [editorState, setEditorState] = useState({
    isOpen: false,
    mode: "create",
    costId: "",
  });
  const [draft, setDraft] = useState(createEmptyCostItem(units));
  const [validationErrors, setValidationErrors] = useState([]);
  const [selectedCostIds, setSelectedCostIds] = useState([]);

  const tradeNavItems = useMemo(() => {
    const counts = normalizedCosts.reduce((map, cost) => {
      const key = getTradeKey(cost) || "unassigned";
      map[key] = (map[key] || 0) + 1;
      return map;
    }, {});

    const tradeItems = activeTrades.map((trade) => ({
      id: trade.id,
      label: trade.name,
      count: counts[trade.id] || 0,
    }));

    const unassignedCount = counts.unassigned || 0;
    return [
      { id: "all", label: "All Items", count: normalizedCosts.length },
      ...tradeItems,
      ...(unassignedCount
        ? [{ id: "unassigned", label: "Unassigned", count: unassignedCount }]
        : []),
    ];
  }, [activeTrades, normalizedCosts]);

  const filteredCosts = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const rows = normalizedCosts.filter((cost) => {
      const tradeKey = getTradeKey(cost) || "unassigned";

      return (
        (activeTradeId === "all" || tradeKey === activeTradeId) &&
        (!costCodeFilter || cost.costCodeId === costCodeFilter) &&
        (!familyFilter || cleanText(cost.itemFamily) === familyFilter) &&
        (!costTypeFilter || cost.costType === costTypeFilter) &&
        (!statusFilter || cost.status === statusFilter) &&
        (!search ||
          [
            cost.itemName,
            cost.displayName,
            cost.itemFamily,
            cost.trade,
            cost.costCode,
          ].some((value) => cleanText(value).toLowerCase().includes(search)))
      );
    });

    return [...rows].sort(
      (a, b) =>
        cleanText(a[sortKey]).localeCompare(cleanText(b[sortKey])) ||
        cleanText(a.itemName).localeCompare(cleanText(b.itemName))
    );
  }, [
    activeTradeId,
    costCodeFilter,
    costTypeFilter,
    familyFilter,
    normalizedCosts,
    searchTerm,
    sortKey,
    statusFilter,
  ]);

  const selectedFilteredCostIds = filteredCosts
    .map((cost) => cost.id)
    .filter((costId) => selectedCostIds.includes(costId));
  const allFilteredSelected =
    filteredCosts.length > 0 &&
    selectedFilteredCostIds.length === filteredCosts.length;

  const readFileAsText = (file) =>
    typeof file?.text === "function"
      ? file.text()
      : new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("Unable to read file"));
          reader.readAsText(file);
        });

  const ensureFamiliesExist = (familyNames) => {
    const existing = new Set(
      activeItemFamilies.map((itemFamily) => itemFamily.name)
    );
    const missing = familyNames
      .map((name) => cleanText(name))
      .filter(Boolean)
      .filter((name) => !existing.has(name));

    if (!missing.length) {
      return;
    }

    const nextSort =
      itemFamilies.reduce(
        (max, itemFamily) => Math.max(max, Number(itemFamily.sortOrder || 0)),
        0
      ) + 1;

    onItemFamiliesChange([
      ...itemFamilies,
      ...missing.map((name, index) => ({
        id: `item-family-${Date.now()}-${index}`,
        name,
        sortOrder: nextSort + index,
        isActive: true,
      })),
    ]);
  };

  const openCreateEditor = () => {
    setDraft(createEmptyCostItem(units));
    setValidationErrors([]);
    setEditorState({ isOpen: true, mode: "create", costId: "" });
  };

  const openEditEditor = (cost) => {
    setDraft(cloneCostItem(cost, units));
    setValidationErrors([]);
    setEditorState({ isOpen: true, mode: "edit", costId: cost.id });
  };

  const closeEditor = () => {
    setEditorState({ isOpen: false, mode: "create", costId: "" });
    setDraft(createEmptyCostItem(units));
    setValidationErrors([]);
  };

  const updateDraftField = (key, value) =>
    setDraft((current) => {
      if (key === "unitId") {
        const unit = activeUnits.find((row) => row.id === value) || null;
        return { ...current, unitId: value, unit: unit?.abbreviation || "" };
      }

      if (key === "tradeId") {
        const trade = activeTrades.find((row) => row.id === value) || null;
        return { ...current, tradeId: value, trade: trade?.name || "" };
      }

      if (key === "costCodeId") {
        const costCode =
          activeCostCodes.find((row) => row.id === value) || null;
        return {
          ...current,
          costCodeId: value,
          costCode: costCode?.name || "",
        };
      }

      if (key === "itemFamily") {
        return { ...current, itemFamily: value, family: value };
      }

      if (key === "itemName") {
        return { ...current, itemName: value, coreName: value };
      }

      if (key === "status") {
        return { ...current, status: value, isActive: value === "Active" };
      }

      return { ...current, [key]: value };
    });

  const validateDraft = () => {
    const errors = [];

    if (!cleanText(draft.itemName)) {
      errors.push("Item Name is required.");
    }
    if (!cleanText(draft.costType)) {
      errors.push("Cost Type is required.");
    }
    if (!cleanText(draft.deliveryType)) {
      errors.push("Delivery Type is required.");
    }
    if (!cleanText(draft.tradeId)) {
      errors.push("Trade is required.");
    }
    if (!cleanText(draft.costCodeId)) {
      errors.push("Cost Code is required.");
    }
    if (!cleanText(draft.unitId)) {
      errors.push("Unit is required.");
    }
    if (draft.rate === "" || !Number.isFinite(Number(draft.rate))) {
      errors.push("Rate must be a valid number.");
    }

    return errors;
  };

  const saveCost = (event) => {
    event.preventDefault();

    const errors = validateDraft();
    setValidationErrors(errors);
    if (errors.length) {
      return;
    }

    ensureFamiliesExist([draft.itemFamily]);

    const nextId = draft.id || `cost-${Date.now()}`;
    const nextCost = normalizeCosts(
      [
        {
          ...draft,
          id: nextId,
          internalId:
            cleanText(draft.internalId) || cleanText(draft.id) || nextId,
          rate: Number(draft.rate),
        },
      ],
      { units, trades, costCodes, itemFamilies }
    )[0];

    onCostsChange(
      editorState.mode === "edit"
        ? normalizedCosts.map((cost) =>
            cost.id === editorState.costId ? nextCost : cost
          )
        : [...normalizedCosts, nextCost]
    );

    closeEditor();
  };

  const deleteCost = (costId) => {
    if (typeof window !== "undefined") {
      const shouldDelete = window.confirm(
        "Delete this cost item? This action cannot be undone."
      );
      if (!shouldDelete) {
        return;
      }
    }

    onCostsChange(normalizedCosts.filter((cost) => cost.id !== costId));
    setSelectedCostIds((current) =>
      current.filter((selectedCostId) => selectedCostId !== costId)
    );
    if (editorState.costId === costId) {
      closeEditor();
    }
  };

  const duplicateCost = (costId) => {
    const sourceCost = normalizedCosts.find((cost) => cost.id === costId);
    if (!sourceCost) {
      return;
    }

    const nextId = `cost-${Date.now()}`;
    const duplicatedCost = normalizeCosts(
      [
        {
          ...sourceCost,
          id: nextId,
          internalId: nextId,
          itemName: createDuplicateName(sourceCost.itemName),
          coreName: createDuplicateName(sourceCost.itemName),
        },
      ],
      { units, trades, costCodes, itemFamilies }
    )[0];

    const nextCosts = [...normalizedCosts, duplicatedCost];
    onCostsChange(nextCosts);
    setSelectedCostIds([]);
    openEditEditor(duplicatedCost);
  };

  const toggleCostSelection = (costId) => {
    setSelectedCostIds((current) =>
      current.includes(costId)
        ? current.filter((selectedCostId) => selectedCostId !== costId)
        : [...current, costId]
    );
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedCostIds((current) =>
        current.filter((costId) => !selectedFilteredCostIds.includes(costId))
      );
      return;
    }

    setSelectedCostIds((current) => [
      ...new Set([...current, ...filteredCosts.map((cost) => cost.id)]),
    ]);
  };

  const confirmTypedDelete = (message) => {
    if (typeof window === "undefined") {
      return true;
    }

    const confirmation = window.prompt(`${message}\n\nType DELETE to confirm.`);
    return confirmation === "DELETE";
  };

  const deleteSelectedCosts = () => {
    if (!selectedCostIds.length) {
      return;
    }

    const confirmed = confirmTypedDelete(
      `Delete ${selectedCostIds.length} selected cost item${
        selectedCostIds.length === 1 ? "" : "s"
      }?`
    );

    if (!confirmed) {
      return;
    }

    onCostsChange(
      normalizedCosts.filter((cost) => !selectedCostIds.includes(cost.id))
    );
    if (selectedCostIds.includes(editorState.costId)) {
      closeEditor();
    }
    setSelectedCostIds([]);
  };

  const deleteAllFilteredCosts = () => {
    if (!filteredCosts.length) {
      return;
    }

    const confirmed = confirmTypedDelete(
      `Delete all ${filteredCosts.length} cost item${
        filteredCosts.length === 1 ? "" : "s"
      } in the current filtered view?`
    );

    if (!confirmed) {
      return;
    }

    const filteredIds = filteredCosts.map((cost) => cost.id);
    onCostsChange(
      normalizedCosts.filter((cost) => !filteredIds.includes(cost.id))
    );
    if (filteredIds.includes(editorState.costId)) {
      closeEditor();
    }
    setSelectedCostIds((current) =>
      current.filter((costId) => !filteredIds.includes(costId))
    );
  };

  const exportCostsAsCsv = () => {
    if (typeof window === "undefined") {
      return;
    }

    const csvText = convertCostsToCSV(normalizedCosts);
    const blob = new Blob([csvText], {
      type: "text/csv;charset=utf-8;",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "cost-library-export.csv";
    link.click();
    window.URL.revokeObjectURL(url);
    setImportFailures([]);
    setCsvStatus(`Exported ${normalizedCosts.length} cost items.`);
  };

  const importCostsFromCsv = async (file) => {
    if (!file) {
      return;
    }

    try {
      const csvText = await readFileAsText(file);
      const parsedRows = parseCSV(csvText);
      const parsedHeaders = Object.keys(parsedRows[0] || {});
      const missingHeaders = requiredCostImportHeaders.filter(
        (header) => !parsedHeaders.includes(header)
      );

      if (missingHeaders.length && !parsedHeaders.includes("Work Type")) {
        setImportFailures([]);
        setCsvStatus(
          `Unable to import CSV. Missing required columns: ${missingHeaders.join(
            ", "
          )}.`
        );
        return;
      }

      const validationFailures = [];
      const validRows = [];

      parsedRows.forEach((row, index) => {
        const rowNumber = index + 2;
        const errors = validateImportedCostRow(row, units);

        if (errors.length) {
          validationFailures.push({
            rowNumber,
            reasons: errors,
          });
          return;
        }

        validRows.push({
          rowNumber,
          source: buildImportedCostSource(row, index),
        });
      });

      if (!validRows.length) {
        setImportFailures(validationFailures);
        setCsvStatus(
          `Imported 0 rows. Skipped ${validationFailures.length} row${
            validationFailures.length === 1 ? "" : "s"
          }.`
        );
        return;
      }

      const normalizedImportedCosts = normalizeCosts(
        validRows.map((row) => row.source),
        { units, trades, costCodes, itemFamilies }
      );

      ensureFamiliesExist(normalizedImportedCosts.map((cost) => cost.itemFamily));

      if (importMode === "append") {
        const seenInternalIds = new Set(
          normalizedCosts.map((cost) => cleanText(cost.internalId)).filter(Boolean)
        );
        const nextItems = [...normalizedCosts];
        let importedCount = 0;

        normalizedImportedCosts.forEach((cost, index) => {
          const internalId = cleanText(cost.internalId);

          if (internalId && seenInternalIds.has(internalId)) {
            validationFailures.push({
              rowNumber: validRows[index].rowNumber,
              reasons: ["Duplicate Internal ID"],
            });
            return;
          }

          if (internalId) {
            seenInternalIds.add(internalId);
          }

          nextItems.push(cost);
          importedCount += 1;
        });

        if (importedCount) {
          onCostsChange(nextItems);
        }

        setImportFailures(validationFailures);
        setCsvStatus(
          `Imported ${importedCount} row${importedCount === 1 ? "" : "s"}. Skipped ${
            validationFailures.length
          } row${validationFailures.length === 1 ? "" : "s"}.`
        );
        return;
      }

      const mergeResult = applyImportMode({
        existingItems: normalizedCosts,
        importedItems: normalizedImportedCosts,
        mode: importMode,
        getMatchKey: (existing, incoming) =>
          (cleanText(existing.internalId) &&
            cleanText(existing.internalId) === cleanText(incoming.internalId)) ||
          (cleanText(existing.itemName) === cleanText(incoming.itemName) &&
            cleanText(existing.unit) === cleanText(incoming.unit)) ||
          (cleanText(existing.coreName) === cleanText(incoming.coreName) &&
            cleanText(existing.itemName) === cleanText(incoming.itemName)),
        shouldConfirmOverride: () =>
          typeof window === "undefined" ||
          window.confirm("Override all existing Cost Library items with the imported CSV?"),
      });

      if (!mergeResult) {
        return;
      }

      onCostsChange(mergeResult.items);
      setImportFailures(validationFailures);
      setCsvStatus(
        `Imported ${mergeResult.summary.added} row${
          mergeResult.summary.added === 1 ? "" : "s"
        }, replaced ${mergeResult.summary.replaced}, skipped ${
          validationFailures.length + mergeResult.summary.skipped
        }.`
      );
    } catch (error) {
      setImportFailures([]);
      setCsvStatus("Unable to import CSV. Please choose a valid CSV file.");
    }
  };

  const draftPresentation = getStructuredItemPresentation(draft);
  const activeTradeLabel =
    tradeNavItems.find((item) => item.id === activeTradeId)?.label ||
    "All Items";

  return (
    <SectionCard
      title="Cost Library"
      description="Browse by trade, filter by cost code/family/type/status, scan items in a compact table, and edit the selected item with notes and source links."
    >
      <div className="cost-library-layout">
        <aside className="cost-library-sidebar">
          <div className="cost-library-sidebar-header">
            <h3>Trades</h3>
            <button
              type="button"
              className="primary-button"
              onClick={openCreateEditor}
            >
              Add Cost Item
            </button>
          </div>

          <div className="cost-library-trade-list">
            {tradeNavItems.map((trade) => (
              <button
                key={trade.id}
                type="button"
                className={`cost-library-trade-button${
                  activeTradeId === trade.id ? " is-active" : ""
                }`}
                onClick={() => setActiveTradeId(trade.id)}
              >
                <span>{trade.label}</span>
                <span>{trade.count}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="cost-library-browser">
          <div className="summary-section cost-library-browser-panel">
            <div className="cost-library-filter-bar">
              <FormField label="Search">
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search item, family, trade"
                />
              </FormField>

              <FormField label="Cost Code">
                <select
                  value={costCodeFilter}
                  onChange={(event) => setCostCodeFilter(event.target.value)}
                >
                  <option value="">All</option>
                  {activeCostCodes.map((costCode) => (
                    <option key={costCode.id} value={costCode.id}>
                      {costCode.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Family">
                <select
                  value={familyFilter}
                  onChange={(event) => setFamilyFilter(event.target.value)}
                >
                  <option value="">All</option>
                  {activeItemFamilies.map((itemFamily) => (
                    <option key={itemFamily.id} value={itemFamily.name}>
                      {itemFamily.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Cost Type">
                <select
                  value={costTypeFilter}
                  onChange={(event) => setCostTypeFilter(event.target.value)}
                >
                  <option value="">All</option>
                  {costTypeOptions.map((costType) => (
                    <option key={costType} value={costType}>
                      {costType}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Status">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="">All</option>
                  {costStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Sort">
                <select
                  value={sortKey}
                  onChange={(event) => setSortKey(event.target.value)}
                >
                  <option value="itemName">Core Name</option>
                  <option value="itemFamily">Family</option>
                  <option value="displayName">Item Name</option>
                </select>
              </FormField>
            </div>

            <div className="cost-library-toolbar-row">
              <div className="cost-library-toolbar-meta">
                <strong>{activeTradeLabel}</strong>
                <span>
                  {filteredCosts.length} visible item
                  {filteredCosts.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="action-row">
                {editorState.costId ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => duplicateCost(editorState.costId)}
                  >
                    Duplicate Selected
                  </button>
                ) : null}
                <button
                  type="button"
                  className="secondary-button"
                  onClick={deleteAllFilteredCosts}
                >
                  Delete All (Filtered)
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={exportCostsAsCsv}
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => importFileInputRef.current?.click()}
                >
                  Import CSV
                </button>
                <FormField label="Import mode">
                  <select value={importMode} onChange={(event) => setImportMode(event.target.value)}>
                    <option value="append">Append</option>
                    <option value="override">Override All</option>
                    <option value="replace">Replace Duplicates</option>
                  </select>
                </FormField>
              </div>

              <input
                ref={importFileInputRef}
                type="file"
                accept=".csv,text/csv"
                aria-label="Import Cost CSV"
                style={{ display: "none" }}
                onChange={(event) => {
                  const [file] = event.target.files || [];
                  importCostsFromCsv(file);
                  event.target.value = "";
                }}
              />
            </div>

            {csvStatus ? (
              <p className="assembly-library-status">{csvStatus}</p>
            ) : null}

            <p className="cost-library-import-help">
              Required: Core Name, Cost Type, Delivery Type, Trade, Cost Code, Unit, Rate. Auto-generated if blank: Internal ID, Item Name. Optional: Family, Spec, Grade, Finish, Brand, Status, Notes, Source Link.
            </p>

            {importFailures.length ? (
              <div className="summary-section room-template-compact-section assembly-library-validation">
                <h3>Import issues</h3>
                {importFailures.map((failure) => (
                  <p key={`${failure.rowNumber}-${failure.reasons.join("-")}`}>
                    Row {failure.rowNumber}: {failure.reasons.join("; ")}
                  </p>
                ))}
              </div>
            ) : null}

            {selectedCostIds.length ? (
              <div className="cost-library-bulk-bar">
                <strong>{selectedCostIds.length} selected</strong>
                <div className="action-row">
                  <button
                    type="button"
                    className="danger-button"
                    onClick={deleteSelectedCosts}
                  >
                    Delete Selected
                  </button>
                </div>
              </div>
            ) : null}

            {filteredCosts.length ? (
              <div className="table-wrap cost-library-table-wrap">
                <table className="data-table cost-library-table">
                  <colgroup>
                    <col className="cost-library-col-select" />
                    <col className="cost-library-col-core" />
                    <col className="cost-library-col-item" />
                    <col className="cost-library-col-type" />
                    <col className="cost-library-col-unit" />
                    <col className="cost-library-col-rate" />
                    <col className="cost-library-col-trade" />
                    <col className="cost-library-col-actions" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          aria-label="Select all visible cost items"
                          onChange={toggleSelectAllFiltered}
                        />
                      </th>
                      <th>Core Name</th>
                      <th>Item Name</th>
                      <th>Cost Type</th>
                      <th>Unit</th>
                      <th>Rate</th>
                      <th>Trade</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCosts.map((cost) => {
                      const isActive = editorState.costId === cost.id;
                      const isSelected = selectedCostIds.includes(cost.id);
                      const itemPresentation = getStructuredItemPresentation(cost);

                      return (
                        <tr
                          key={cost.id}
                          className={`${isActive ? "cost-library-row-active" : ""}${
                            isSelected ? " cost-library-row-selected" : ""
                          }`}
                          onClick={() => openEditEditor(cost)}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              aria-label={`Select ${cost.itemName}`}
                              onClick={(event) => event.stopPropagation()}
                              onChange={() => toggleCostSelection(cost.id)}
                            />
                          </td>
                          <td>{cost.itemName}</td>
                          <td>
                            <div className="cost-library-name-cell">
                              <span className="cost-library-name-primary">
                                {itemPresentation.primaryLabel}
                              </span>
                              {itemPresentation.metaLabel ? (
                                <span
                                  className="cost-library-name-meta"
                                  title={itemPresentation.metaLabel}
                                >
                                  {itemPresentation.metaLabel}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td>{cost.costType}</td>
                          <td>{cost.unit || ""}</td>
                          <td>{cost.rate}</td>
                          <td>{cost.trade || "Unassigned"}</td>
                          <td>
                            <div className="action-row">
                              <button
                                type="button"
                                className="danger-button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  deleteCost(cost.id);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state">
                No cost items match the current trade and filters.
              </p>
            )}
          </div>
        </div>


        <div className="cost-library-editor">
          {editorState.isOpen ? (
            <form className="assembly-editor-panel" onSubmit={saveCost}>
              <div className="summary-section room-template-editor-header cost-library-editor-header">
                <div>
                  <p className="room-template-editor-kicker">
                    {editorState.mode === "edit" ? "Editing" : "New Cost Item"}
                  </p>
                  <h3>
                    {editorState.mode === "edit"
                      ? `Editing: ${draftPresentation.primaryLabel || draft.itemName || "Cost Item"}`
                      : "Create Cost Item"}
                  </h3>
                  {draftPresentation.metaLabel ? (
                    <p className="cost-library-editor-subtitle">
                      {draftPresentation.metaLabel}
                    </p>
                  ) : null}
                </div>

                <div className="room-template-editor-header-meta">
                  <span className="room-template-selected-badge">
                    {draft.trade || "Unassigned Trade"}
                  </span>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={closeEditor}
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="summary-section room-template-compact-section cost-library-editor-section cost-library-editor-section-identity">
                <h3>Identity</h3>
                <div className="form-grid room-template-fields-grid room-template-fields-grid-compact">
                  <FormField label="Core Name">
                    <input
                      value={draft.itemName}
                      onChange={(event) =>
                        updateDraftField("itemName", event.target.value)
                      }
                      placeholder="Floor Tile"
                    />
                  </FormField>

                  <FormField label="Item Name">
                    <input value={draftPresentation.displayName || ""} readOnly />
                  </FormField>

                  <FormField label="Status">
                    <select
                      value={draft.status}
                      onChange={(event) =>
                        updateDraftField("status", event.target.value)
                      }
                    >
                      {costStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
              </div>

              <div className="summary-section room-template-compact-section cost-library-editor-section cost-library-editor-section-classification">
                <h3>Classification</h3>
                <div className="form-grid room-template-fields-grid room-template-fields-grid-compact">
                  <FormField label="Cost Type">
                    <select
                      value={draft.costType}
                      onChange={(event) =>
                        updateDraftField("costType", event.target.value)
                      }
                    >
                      <option value="">Select cost type</option>
                      {costTypeOptions.map((costType) => (
                        <option key={costType} value={costType}>
                          {costType}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Delivery Type">
                    <select
                      value={draft.deliveryType}
                      onChange={(event) =>
                        updateDraftField("deliveryType", event.target.value)
                      }
                    >
                      <option value="">Select delivery type</option>
                      {deliveryTypeOptions.map((deliveryType) => (
                        <option key={deliveryType} value={deliveryType}>
                          {deliveryType}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Family">
                    <select
                      value={draft.itemFamily}
                      onChange={(event) =>
                        updateDraftField("itemFamily", event.target.value)
                      }
                    >
                      <option value="">Unassigned</option>
                      {activeItemFamilies.map((itemFamily) => (
                        <option key={itemFamily.id} value={itemFamily.name}>
                          {itemFamily.name}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Trade">
                    <select
                      value={draft.tradeId}
                      onChange={(event) =>
                        updateDraftField("tradeId", event.target.value)
                      }
                    >
                      <option value="">Select trade</option>
                      {activeTrades.map((trade) => (
                        <option key={trade.id} value={trade.id}>
                          {trade.name}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Cost Code">
                    <select
                      value={draft.costCodeId}
                      onChange={(event) =>
                        updateDraftField("costCodeId", event.target.value)
                      }
                    >
                      <option value="">Select cost code</option>
                      {activeCostCodes.map((costCode) => (
                        <option key={costCode.id} value={costCode.id}>
                          {costCode.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
              </div>

              <div className="summary-section room-template-compact-section cost-library-editor-section cost-library-editor-section-details">
                <h3>Details</h3>
                <div className="form-grid room-template-fields-grid room-template-fields-grid-compact">
                  <FormField label="Spec">
                    <input
                      value={draft.specification}
                      onChange={(event) =>
                        updateDraftField("specification", event.target.value)
                      }
                      placeholder="600x600"
                    />
                  </FormField>

                  <FormField label="Grade">
                    <input
                      value={draft.gradeOrQuality}
                      onChange={(event) =>
                        updateDraftField("gradeOrQuality", event.target.value)
                      }
                      placeholder="Premium"
                    />
                  </FormField>

                  <FormField label="Finish">
                    <input
                      value={draft.finishOrVariant}
                      onChange={(event) =>
                        updateDraftField("finishOrVariant", event.target.value)
                      }
                      placeholder="Matt"
                    />
                  </FormField>

                  <FormField label="Brand">
                    <input
                      value={draft.brand}
                      onChange={(event) =>
                        updateDraftField("brand", event.target.value)
                      }
                      placeholder="ABC"
                    />
                  </FormField>

                  <FormField label="Source Link">
                    <input
                      value={draft.sourceLink}
                      onChange={(event) =>
                        updateDraftField("sourceLink", event.target.value)
                      }
                      placeholder="https://supplier.example/item"
                    />
                  </FormField>

                  <FormField label="Notes">
                    <textarea
                      rows={4}
                      value={draft.notes}
                      onChange={(event) =>
                        updateDraftField("notes", event.target.value)
                      }
                      placeholder="Optional notes or pricing context"
                    />
                  </FormField>
                </div>
              </div>

              <div className="summary-section room-template-compact-section cost-library-editor-section cost-library-editor-section-pricing">
                <h3>Pricing</h3>
                <div className="form-grid room-template-fields-grid room-template-fields-grid-compact">
                  <FormField label="Unit">
                    <select
                      value={draft.unitId}
                      onChange={(event) =>
                        updateDraftField("unitId", event.target.value)
                      }
                    >
                      <option value="">Select unit</option>
                      {activeUnits.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.abbreviation}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Rate">
                    <input
                      type="number"
                      step="0.01"
                      value={draft.rate}
                      onChange={(event) =>
                        updateDraftField("rate", event.target.value)
                      }
                    />
                  </FormField>
                </div>
              </div>

              {validationErrors.length ? (
                <div className="summary-section room-template-compact-section assembly-library-validation">
                  {validationErrors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              ) : null}

              <div className="summary-section room-template-compact-section assembly-editor-actions">
                <div className="action-row">
                  {editorState.mode === "edit" ? (
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => {
                        deleteCost(editorState.costId);
                        closeEditor();
                      }}
                    >
                      Delete
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={closeEditor}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="primary-button">
                    {editorState.mode === "edit"
                      ? "Save Changes"
                      : "Save Cost Item"}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="summary-section">
              <p className="empty-state">
                Select a cost item from the table to edit it.
              </p>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

export default CostLibraryPage;
