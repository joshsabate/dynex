import { useMemo, useRef, useState } from "react";
import DataTable from "../components/DataTable";
import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";
import { convertCostsToCSV, parseCSV } from "../utils/csvUtils";
import { getStructuredItemPresentation, workTypeOptions } from "../utils/itemNaming";
import { getUnitAbbreviation } from "../utils/units";

const defaultForm = {
  itemName: "",
  workType: "Supply",
  itemFamily: "",
  specification: "",
  gradeOrQuality: "",
  brand: "",
  finishOrVariant: "",
  unitId: "unit-sqm",
  rate: "",
};

const groupByOptions = [
  { value: "none", label: "None" },
  { value: "itemFamily", label: "Item Family" },
  { value: "workType", label: "Work Type" },
  { value: "brand", label: "Brand" },
];

const sortOptions = [
  { value: "itemFamily", label: "Item Family" },
  { value: "itemName", label: "Item Name" },
  { value: "workType", label: "Work Type" },
  { value: "brand", label: "Brand" },
  { value: "specification", label: "Specification" },
];

function CostLibraryPage({
  costs,
  units,
  itemFamilies = [],
  onCostsChange,
  onItemFamiliesChange = () => {},
}) {
  const importFileInputRef = useRef(null);
  const [form, setForm] = useState(defaultForm);
  const [sortConfig, setSortConfig] = useState({ key: "itemFamily", direction: "asc" });
  const [groupBy, setGroupBy] = useState("none");
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [csvStatus, setCsvStatus] = useState("");
  const [importMode, setImportMode] = useState("append");

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

  const getUnitLabel = (unitId, fallback = "") =>
    getUnitAbbreviation(units, unitId, fallback, fallback);
  const getCostDisplayName = (cost) => getStructuredItemPresentation(cost).displayName;
  const getFamilyLabel = (value) => String(value || "").trim() || "Unassigned";

  const getItemFamilyOptions = (extraValue = "") => {
    const normalizedExtraValue = String(extraValue || "").trim();

    if (
      normalizedExtraValue &&
      !activeItemFamilies.some((itemFamily) => itemFamily.name === normalizedExtraValue)
    ) {
      return [
        ...activeItemFamilies,
        { id: `legacy-family-${normalizedExtraValue}`, name: normalizedExtraValue, isActive: true },
      ];
    }

    return activeItemFamilies;
  };

  const getUnitIdFromValue = (value) => {
    const normalizedValue = String(value || "").trim().toLowerCase();

    return (
      units.find(
        (unit) =>
          unit.id === value ||
          String(unit.abbreviation || "").trim().toLowerCase() === normalizedValue ||
          String(unit.name || "").trim().toLowerCase() === normalizedValue
      )?.id || ""
    );
  };

  const ensureItemFamiliesExist = (familyNames) => {
    const existingNames = new Set(itemFamilies.map((itemFamily) => itemFamily.name));
    const missingFamilies = familyNames
      .filter(Boolean)
      .filter((familyName) => !existingNames.has(familyName));

    if (!missingFamilies.length) {
      return;
    }

    const nextSortOrder =
      itemFamilies.reduce(
        (highestSortOrder, itemFamily) => Math.max(highestSortOrder, Number(itemFamily.sortOrder || 0)),
        0
      ) + 1;

    onItemFamiliesChange([
      ...itemFamilies,
      ...missingFamilies.map((familyName, index) => ({
        id: `item-family-${Date.now()}-${index}`,
        name: familyName,
        sortOrder: nextSortOrder + index,
        isActive: true,
      })),
    ]);
  };

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const addCost = (event) => {
    event.preventDefault();

    if (!form.itemName.trim() || !form.rate) {
      return;
    }

    ensureItemFamiliesExist([form.itemFamily]);

    onCostsChange([
      ...costs,
      {
        id: `cost-${Date.now()}`,
        itemName: form.itemName.trim(),
        workType: form.workType,
        itemFamily: form.itemFamily,
        specification: form.specification.trim(),
        gradeOrQuality: form.gradeOrQuality.trim(),
        brand: form.brand.trim(),
        finishOrVariant: form.finishOrVariant.trim(),
        displayName: getStructuredItemPresentation(form).displayName,
        unitId: form.unitId,
        unit: getUnitLabel(form.unitId),
        rate: Number(form.rate),
      },
    ]);

    setForm((current) => ({
      ...current,
      itemName: "",
      specification: "",
      gradeOrQuality: "",
      brand: "",
      finishOrVariant: "",
      rate: "",
    }));
  };

  const removeCost = (costId) => {
    onCostsChange(costs.filter((cost) => cost.id !== costId));
  };

  const updateCost = (costId, key, value) => {
    if (key === "itemFamily") {
      ensureItemFamiliesExist([value]);
    }

    onCostsChange(
      costs.map((cost) =>
        cost.id === costId
          ? {
              ...cost,
              displayName: getStructuredItemPresentation({
                ...cost,
                [key]: value,
              }).displayName,
              unit: key === "unitId" ? getUnitLabel(value, cost.unit) : cost.unit,
              [key]: key === "rate" ? Number(value) : value,
            }
          : cost
      )
    );
  };

  const toggleSort = (key) => {
    setSortConfig((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) {
      return "";
    }

    return sortConfig.direction === "asc" ? " ↑" : " ↓";
  };

  const sortableHeader = (label, key) => (
    <button type="button" className="table-sort-button" onClick={() => toggleSort(key)}>
      {label}
      {getSortIndicator(key)}
    </button>
  );

  const sortedFilteredCosts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filteredRows = costs.filter((cost) => {
      if (!normalizedSearch) {
        return true;
      }

      return [
        getCostDisplayName(cost),
        cost.itemName,
        cost.itemFamily,
        cost.workType,
        cost.specification,
        cost.gradeOrQuality,
        cost.brand,
        cost.finishOrVariant,
      ].some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
    });

    const direction = sortConfig.direction === "asc" ? 1 : -1;

    return [...filteredRows].sort((left, right) => {
      const getSortValue = (cost) => {
        if (sortConfig.key === "itemName") {
          return getCostDisplayName(cost);
        }

        return String(cost[sortConfig.key] || "").trim().toLowerCase();
      };

      return (
        getSortValue(left).localeCompare(getSortValue(right), undefined, { sensitivity: "base" }) *
        direction
      );
    });
  }, [costs, searchTerm, sortConfig]);

  const groupedCosts = useMemo(() => {
    if (groupBy === "none") {
      return [];
    }

    return sortedFilteredCosts.reduce((groups, cost) => {
      const groupLabel = getFamilyLabel(cost[groupBy]);
      const existingGroup = groups.find((group) => group.label === groupLabel);

      if (existingGroup) {
        existingGroup.rows.push(cost);
        return groups;
      }

      groups.push({
        id: `${groupBy}-${groupLabel}`,
        label: groupLabel,
        rows: [cost],
      });

      return groups;
    }, []);
  }, [groupBy, sortedFilteredCosts]);

  const toggleGroup = (groupId) => {
    setCollapsedGroups((current) => ({
      ...current,
      [groupId]: !(current[groupId] ?? false),
    }));
  };

  const exportCostsAsCsv = () => {
    if (typeof window === "undefined") {
      return;
    }

    const csvText = convertCostsToCSV(
      costs.map((cost) => ({
        ...cost,
        unit: getUnitLabel(cost.unitId, cost.unit || ""),
        displayName: cost.displayName || getCostDisplayName(cost),
      }))
    );
    const csvBlob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const downloadUrl = window.URL.createObjectURL(csvBlob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = "cost-library-export.csv";
    link.click();
    window.URL.revokeObjectURL(downloadUrl);
    setCsvStatus(`Exported ${costs.length} cost items.`);
  };

  const importCostsFromCsv = async (file) => {
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      const validRows = [];
      const newFamilies = [];
      let skippedRows = 0;

      rows.forEach((row) => {
        const coreName = String(row["Core Name"] || "").trim();
        const importedDisplayName = String(row["Item Name"] || "").trim();
        const itemName = coreName || importedDisplayName;
        const unitValue = String(row.Unit || "").trim();
        const rateValue = String(row.Rate || "").trim();
        const unitId = getUnitIdFromValue(unitValue);

        if (!itemName || !unitId || rateValue === "" || Number.isNaN(Number(rateValue))) {
          skippedRows += 1;
          return;
        }

        const itemFamily = String(row["Item Family"] || "").trim();

        if (itemFamily) {
          newFamilies.push(itemFamily);
        }

        const nextRow = {
          id: `cost-import-${Date.now()}-${validRows.length}`,
          itemFamily,
          itemName,
          workType: String(row["Work Type"] || "").trim(),
          specification: String(row.Specification || "").trim(),
          gradeOrQuality: String(row["Grade / Quality"] || "").trim(),
          brand: String(row.Brand || "").trim(),
          finishOrVariant: String(row["Finish / Variant"] || "").trim(),
          unitId,
          unit: getUnitLabel(unitId, unitValue),
          rate: Number(rateValue),
        };

        validRows.push({
          ...nextRow,
          displayName: getStructuredItemPresentation(nextRow).displayName || importedDisplayName || itemName,
        });
      });

      if (!validRows.length) {
        setCsvStatus("Unable to import CSV. No valid cost rows were found.");
        return;
      }
      if (
        importMode === "replace" &&
        typeof window !== "undefined" &&
        !window.confirm("Replace all cost library entries with the imported CSV data?")
      ) {
        setCsvStatus("CSV import cancelled.");
        return;
      }

      ensureItemFamiliesExist(newFamilies);

      onCostsChange(importMode === "replace" ? validRows : [...costs, ...validRows]);

      setCsvStatus(
        `${validRows.length} cost items imported in ${
          importMode === "replace" ? "replace-all" : "append"
        } mode${
          skippedRows ? `. ${skippedRows} invalid row${skippedRows === 1 ? "" : "s"} skipped.` : "."
        }`
      );
    } catch (error) {
      setCsvStatus("Unable to import CSV. Please choose a valid CSV file.");
    }
  };

  const columns = [
    {
      key: "displayName",
      header: sortableHeader("Item", "itemName"),
      className: "table-col-wide",
      render: (row) => (
        <input
          value={row.displayName || getCostDisplayName(row)}
          readOnly
          aria-label={`Compiled item name for ${row.itemName}`}
        />
      ),
    },
    {
      key: "itemFamily",
      header: sortableHeader("Family", "itemFamily"),
      className: "table-col-medium",
      render: (row) => (
        <select
          value={row.itemFamily || ""}
          onChange={(event) => updateCost(row.id, "itemFamily", event.target.value)}
        >
          <option value="">Unassigned</option>
          {getItemFamilyOptions(row.itemFamily).map((itemFamily) => (
            <option key={itemFamily.id} value={itemFamily.name}>
              {itemFamily.name}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: "itemName",
      header: sortableHeader("Core Name", "itemName"),
      className: "table-col-wide",
      render: (row) => (
        <input
          value={row.itemName}
          onChange={(event) => updateCost(row.id, "itemName", event.target.value)}
        />
      ),
    },
    {
      key: "workType",
      header: sortableHeader("Work Type", "workType"),
      className: "table-col-medium",
      render: (row) => (
        <select
          value={row.workType || ""}
          onChange={(event) => updateCost(row.id, "workType", event.target.value)}
        >
          <option value="">Unassigned</option>
          {workTypeOptions.map((workType) => (
            <option key={workType} value={workType}>
              {workType}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: "specification",
      header: sortableHeader("Spec", "specification"),
      className: "table-col-medium",
      render: (row) => (
        <input
          value={row.specification || ""}
          onChange={(event) => updateCost(row.id, "specification", event.target.value)}
        />
      ),
    },
    {
      key: "gradeOrQuality",
      header: "Grade",
      className: "table-col-medium",
      render: (row) => (
        <input
          value={row.gradeOrQuality || ""}
          onChange={(event) => updateCost(row.id, "gradeOrQuality", event.target.value)}
        />
      ),
    },
    {
      key: "brand",
      header: sortableHeader("Brand", "brand"),
      className: "table-col-medium",
      render: (row) => (
        <input
          value={row.brand || ""}
          onChange={(event) => updateCost(row.id, "brand", event.target.value)}
        />
      ),
    },
    {
      key: "finishOrVariant",
      header: "Finish",
      className: "table-col-medium",
      render: (row) => (
        <input
          value={row.finishOrVariant || ""}
          onChange={(event) => updateCost(row.id, "finishOrVariant", event.target.value)}
        />
      ),
    },
    {
      key: "unitId",
      header: "Unit",
      className: "table-col-narrow",
      render: (row) => (
        <select
          value={row.unitId || ""}
          onChange={(event) => updateCost(row.id, "unitId", event.target.value)}
        >
          <option value="">Unassigned</option>
          {activeUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.abbreviation}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: "rate",
      header: "Rate",
      className: "table-col-number",
      render: (row) => (
        <input
          type="number"
          min="0"
          step="0.01"
          value={row.rate}
          onChange={(event) => updateCost(row.id, "rate", event.target.value)}
        />
      ),
    },
  ];

  return (
    <SectionCard
      title="Cost Library"
      description="Store normalized cost items with controlled item families, compiled naming, grouping, and CSV setup support."
    >
      <div className="cost-library-page">
        <div className="cost-library-topbar">
          <form className="cost-library-form" onSubmit={addCost}>
            <div className="cost-library-form-grid cost-library-form-grid-primary">
              <FormField label="Core item name">
                <input
                  value={form.itemName}
                  onChange={(event) => updateField("itemName", event.target.value)}
                  placeholder="Wall Frame Stud"
                />
              </FormField>

              <FormField label="Item family">
                <select
                  value={form.itemFamily}
                  onChange={(event) => updateField("itemFamily", event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {activeItemFamilies.map((itemFamily) => (
                    <option key={itemFamily.id} value={itemFamily.name}>
                      {itemFamily.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Work type">
                <select
                  value={form.workType}
                  onChange={(event) => updateField("workType", event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {workTypeOptions.map((workType) => (
                    <option key={workType} value={workType}>
                      {workType}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Unit">
                <select
                  value={form.unitId}
                  onChange={(event) => updateField("unitId", event.target.value)}
                >
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
                  min="0"
                  step="0.01"
                  value={form.rate}
                  onChange={(event) => updateField("rate", event.target.value)}
                  placeholder="350"
                />
              </FormField>
            </div>

            <div className="cost-library-form-grid cost-library-form-grid-secondary">
              <FormField label="Specification">
                <input
                  value={form.specification}
                  onChange={(event) => updateField("specification", event.target.value)}
                  placeholder="90x45"
                />
              </FormField>

              <FormField label="Grade / quality">
                <input
                  value={form.gradeOrQuality}
                  onChange={(event) => updateField("gradeOrQuality", event.target.value)}
                  placeholder="MGP10 LOSP"
                />
              </FormField>

              <FormField label="Brand">
                <input
                  value={form.brand}
                  onChange={(event) => updateField("brand", event.target.value)}
                  placeholder="Caroma"
                />
              </FormField>

              <FormField label="Finish / variant">
                <input
                  value={form.finishOrVariant}
                  onChange={(event) => updateField("finishOrVariant", event.target.value)}
                  placeholder="Chrome"
                />
              </FormField>
            </div>

            <div className="cost-library-form-footer">
              <div className="library-compiled-name-preview">
                <span>Compiled name</span>
                <strong>{getStructuredItemPresentation(form).displayName || "Item name preview"}</strong>
              </div>

              <button type="submit" className="primary-button">
                Add cost item
              </button>
            </div>
          </form>

          <div className="cost-library-toolbar">
            <div className="cost-library-toolbar-grid">
              <FormField label="Search">
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search item, family, brand, spec"
                />
              </FormField>

              <FormField label="Sort by">
                <select
                  value={sortConfig.key}
                  onChange={(event) =>
                    setSortConfig((current) => ({ ...current, key: event.target.value || "itemFamily" }))
                  }
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Direction">
                <select
                  value={sortConfig.direction}
                  onChange={(event) =>
                    setSortConfig((current) => ({ ...current, direction: event.target.value }))
                  }
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </FormField>

              <FormField label="Group by">
                <select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}>
                  {groupByOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Import mode">
                <select value={importMode} onChange={(event) => setImportMode(event.target.value)}>
                  <option value="append">Append to existing entries</option>
                  <option value="replace">Replace all existing entries</option>
                </select>
              </FormField>
            </div>

            <div className="action-row cost-library-toolbar-actions">
              <button type="button" className="secondary-button" onClick={exportCostsAsCsv}>
                Export CSV
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => importFileInputRef.current?.click()}
              >
                Import CSV
              </button>
            </div>

            <p className="sidebar-meta">
              Core Name is the fixed source name. Item Name in CSV is the compiled display name.
              Append keeps current items. Replace All clears the existing Cost Library before import.
            </p>
          </div>
        </div>

        <input
          ref={importFileInputRef}
          type="file"
          accept=".csv,text/csv"
          aria-label="Import Cost CSV"
          style={{ position: "absolute", left: "-9999px" }}
          onChange={(event) => {
            const [file] = Array.from(event.target.files || []);
            importCostsFromCsv(file || null);
            event.target.value = "";
          }}
        />

        {csvStatus ? <p className="sidebar-status">{csvStatus}</p> : null}

        <div className="cost-library-table-panel">
          {groupBy === "none" ? (
            <DataTable
              columns={columns}
              rows={sortedFilteredCosts}
              emptyMessage="No cost items added yet."
              wrapClassName="cost-library-table-wrap"
              tableClassName="library-compact-table cost-library-table"
              actionsColumnClassName="table-col-actions"
              renderActions={(row) => (
                <button type="button" className="danger-button" onClick={() => removeCost(row.id)}>
                  Remove
                </button>
              )}
            />
          ) : groupedCosts.length ? (
            <div className="library-group-list">
              {groupedCosts.map((group) => {
                const isCollapsed = collapsedGroups[group.id] ?? false;

                return (
                  <div key={group.id} className="library-group-card">
                    <button
                      type="button"
                      className="library-group-header"
                      onClick={() => toggleGroup(group.id)}
                    >
                      <span>{isCollapsed ? "+" : "-"}</span>
                      <span>{group.label}</span>
                      <span>{group.rows.length}</span>
                    </button>

                    {!isCollapsed ? (
                      <DataTable
                        columns={columns}
                        rows={group.rows}
                        emptyMessage="No cost items."
                        wrapClassName="cost-library-table-wrap"
                        tableClassName="library-compact-table cost-library-table"
                        actionsColumnClassName="table-col-actions"
                        renderActions={(row) => (
                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => removeCost(row.id)}
                          >
                            Remove
                          </button>
                        )}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="empty-state">No grouped cost items found.</p>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

export default CostLibraryPage;
