import { useEffect, useMemo, useRef, useState } from "react";
import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";
import { convertCostsToCSV, parseCSV } from "../utils/csvUtils";
import { getStructuredItemPresentation, workTypeOptions } from "../utils/itemNaming";
import { getUnitAbbreviation } from "../utils/units";

const columnPreferencesStorageKey = "estimator-app-cost-library-columns";
const legacyValuePrefix = "__legacy__";

const defaultForm = {
  itemName: "",
  workType: "Supply",
  itemFamily: "",
  tradeId: "",
  costCodeId: "",
  specification: "",
  gradeOrQuality: "",
  brand: "",
  finishOrVariant: "",
  unitId: "unit-sqm",
  rate: "",
  sourceLink: "",
};

const defaultFilters = {
  itemFamily: "",
  workType: "",
  tradeId: "",
  costCodeId: "",
  unitId: "",
};

const groupByOptions = [
  { value: "none", label: "None" },
  { value: "itemFamily", label: "Item Family" },
  { value: "workType", label: "Work Type" },
  { value: "tradeId", label: "Trade" },
  { value: "costCodeId", label: "Cost Code" },
  { value: "unitId", label: "Unit" },
];

const sortOptions = [
  { value: "displayName", label: "Item Name" },
  { value: "itemFamily", label: "Item Family" },
  { value: "workType", label: "Work Type" },
  { value: "tradeId", label: "Trade" },
  { value: "costCodeId", label: "Cost Code" },
  { value: "specification", label: "Specification" },
  { value: "unitId", label: "Unit" },
  { value: "rate", label: "Rate" },
];

const defaultColumnOrder = [
  "itemName",
  "displayName",
  "workType",
  "itemFamily",
  "tradeId",
  "costCodeId",
  "specification",
  "gradeOrQuality",
  "brand",
  "finishOrVariant",
  "unitId",
  "rate",
];

const defaultColumnWidths = {
  displayName: 240,
  itemName: 240,
  itemFamily: 132,
  workType: 110,
  tradeId: 132,
  costCodeId: 144,
  specification: 110,
  gradeOrQuality: 118,
  brand: 104,
  finishOrVariant: 110,
  unitId: 74,
  rate: 88,
  actions: 44,
};

function cleanText(value) {
  return String(value || "").trim();
}

function clampColumnWidth(width) {
  return Math.max(64, Math.min(480, Math.round(width)));
}

function getOpenableUrl(value) {
  const trimmedValue = cleanText(value);

  if (!trimmedValue) {
    return "";
  }

  if (/^[a-z]+:\/\//i.test(trimmedValue)) {
    return trimmedValue;
  }

  return `https://${trimmedValue}`;
}

function createLegacyValue(prefix, value) {
  return `${legacyValuePrefix}${prefix}:${encodeURIComponent(value)}`;
}

function isLegacyValue(value) {
  return String(value || "").startsWith(legacyValuePrefix);
}

function moveItem(items, fromIndex, toIndex) {
  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

function readColumnPreferences() {
  if (typeof window === "undefined") {
    return { order: defaultColumnOrder, widths: defaultColumnWidths };
  }

  try {
    const storedValue = JSON.parse(
      window.localStorage.getItem(columnPreferencesStorageKey) || "{}"
    );

    return {
      order:
        storedValue.order?.filter((columnKey) => defaultColumnOrder.includes(columnKey))?.length ===
        defaultColumnOrder.length
          ? storedValue.order
          : defaultColumnOrder,
      widths: {
        ...defaultColumnWidths,
        ...(storedValue.widths || {}),
      },
    };
  } catch (error) {
    return { order: defaultColumnOrder, widths: defaultColumnWidths };
  }
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
  const resizeStateRef = useRef(null);
  const storedColumnPreferences = useMemo(() => readColumnPreferences(), []);
  const [form, setForm] = useState(defaultForm);
  const [sortConfig, setSortConfig] = useState({ key: "displayName", direction: "asc" });
  const [groupBy, setGroupBy] = useState("none");
  const [filters, setFilters] = useState(defaultFilters);
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [csvStatus, setCsvStatus] = useState("");
  const [importMode, setImportMode] = useState("append");
  const [columnOrder, setColumnOrder] = useState(storedColumnPreferences.order);
  const [columnWidths, setColumnWidths] = useState(storedColumnPreferences.widths);
  const [draggedColumnKey, setDraggedColumnKey] = useState("");
  const [activeLinkEditorId, setActiveLinkEditorId] = useState("");

  const activeUnits = useMemo(
    () =>
      [...units]
        .filter((unit) => unit.isActive)
        .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)),
    [units]
  );
  const activeTrades = useMemo(
    () =>
      [...trades]
        .filter((trade) => trade.isActive)
        .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)),
    [trades]
  );
  const activeCostCodes = useMemo(
    () =>
      [...costCodes]
        .filter((costCode) => costCode.isActive)
        .sort(
          (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
        ),
    [costCodes]
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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      columnPreferencesStorageKey,
      JSON.stringify({ order: columnOrder, widths: columnWidths })
    );
  }, [columnOrder, columnWidths]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!resizeStateRef.current) {
        return;
      }

      const { columnKey, startX, startWidth } = resizeStateRef.current;
      const nextWidth = clampColumnWidth(startWidth + (event.clientX - startX));

      setColumnWidths((current) => ({ ...current, [columnKey]: nextWidth }));
    };

    const handlePointerUp = () => {
      resizeStateRef.current = null;
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, []);

  const getUnitLabel = (unitId, fallback = "") =>
    getUnitAbbreviation(units, unitId, fallback, fallback);
  const getTradeName = (tradeId, fallback = "") =>
    trades.find((trade) => trade.id === tradeId)?.name || fallback || "Unassigned";
  const getCostCodeName = (costCodeId, fallback = "") =>
    costCodes.find((costCode) => costCode.id === costCodeId)?.name || fallback || "Unassigned";
  const getResolvedTradeId = (value) => {
    const normalizedValue = cleanText(value).toLowerCase();
    return (
      trades.find(
        (trade) =>
          trade.id === value || cleanText(trade.name).toLowerCase() === normalizedValue
      )?.id || ""
    );
  };
  const getResolvedCostCodeId = (value) => {
    const normalizedValue = cleanText(value).toLowerCase();
    return (
      costCodes.find(
        (costCode) =>
          costCode.id === value || cleanText(costCode.name).toLowerCase() === normalizedValue
      )?.id || ""
    );
  };
  const getUnitIdFromValue = (value) => {
    const normalizedValue = cleanText(value).toLowerCase();
    return (
      units.find(
        (unit) =>
          unit.id === value ||
          cleanText(unit.abbreviation).toLowerCase() === normalizedValue ||
          cleanText(unit.name).toLowerCase() === normalizedValue
      )?.id || ""
    );
  };
  const getCostPresentation = (cost) => getStructuredItemPresentation(cost);
  const getCostDisplayName = (cost) => getCostPresentation(cost).displayName;
  const getFieldGroupLabel = (cost, key) => {
    if (key === "tradeId") {
      return getTradeName(cost.tradeId || getResolvedTradeId(cost.trade), cost.trade);
    }

    if (key === "costCodeId") {
      return getCostCodeName(
        cost.costCodeId || getResolvedCostCodeId(cost.costCode),
        cost.costCode
      );
    }

    if (key === "unitId") {
      return getUnitLabel(cost.unitId || getUnitIdFromValue(cost.unit), cost.unit);
    }

    return cleanText(cost[key]) || "Unassigned";
  };

  const getItemFamilyOptions = (extraValue = "") => {
    const normalizedExtraValue = cleanText(extraValue);

    if (
      normalizedExtraValue &&
      !activeItemFamilies.some((itemFamily) => itemFamily.name === normalizedExtraValue)
    ) {
      return [
        ...activeItemFamilies,
        { id: `legacy-item-family-${normalizedExtraValue}`, name: normalizedExtraValue, isActive: true },
      ];
    }

    return activeItemFamilies;
  };

  const getSelectOptionsWithLegacy = (options, currentId, fallbackLabel, type) => {
    const resolvedId =
      currentId ||
      (type === "trade"
        ? getResolvedTradeId(fallbackLabel)
        : type === "cost-code"
          ? getResolvedCostCodeId(fallbackLabel)
          : type === "unit"
            ? getUnitIdFromValue(fallbackLabel)
            : "");

    if (!fallbackLabel || resolvedId) {
      return options;
    }

    return [
      ...options,
      {
        id: createLegacyValue(type, fallbackLabel),
        name: fallbackLabel,
        abbreviation: fallbackLabel,
        isLegacy: true,
      },
    ];
  };

  const getTradeSelectValue = (tradeId, trade) =>
    tradeId || getResolvedTradeId(trade) || (trade ? createLegacyValue("trade", trade) : "");
  const getCostCodeSelectValue = (costCodeId, costCode) =>
    costCodeId ||
    getResolvedCostCodeId(costCode) ||
    (costCode ? createLegacyValue("cost-code", costCode) : "");
  const getUnitSelectValue = (unitId, unit) =>
    unitId || getUnitIdFromValue(unit) || (unit ? createLegacyValue("unit", unit) : "");

  const ensureItemFamiliesExist = (familyNames) => {
    const existingNames = new Set(itemFamilies.map((itemFamily) => itemFamily.name));
    const missingFamilies = familyNames
      .map((familyName) => cleanText(familyName))
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

    if (!cleanText(form.itemName) || form.rate === "") {
      return;
    }

    ensureItemFamiliesExist([form.itemFamily]);

    onCostsChange([
      ...costs,
      {
        id: `cost-${Date.now()}`,
        itemName: cleanText(form.itemName),
        workType: form.workType,
        itemFamily: cleanText(form.itemFamily),
        tradeId: form.tradeId,
        trade: form.tradeId ? getTradeName(form.tradeId, "") : "",
        costCodeId: form.costCodeId,
        costCode: form.costCodeId ? getCostCodeName(form.costCodeId, "") : "",
        specification: cleanText(form.specification),
        gradeOrQuality: cleanText(form.gradeOrQuality),
        brand: cleanText(form.brand),
        finishOrVariant: cleanText(form.finishOrVariant),
        displayName: getStructuredItemPresentation(form).displayName,
        unitId: form.unitId,
        unit: getUnitLabel(form.unitId),
        rate: Number(form.rate),
        sourceLink: cleanText(form.sourceLink),
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
      sourceLink: "",
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
      costs.map((cost) => {
        if (cost.id !== costId) {
          return cost;
        }

        const nextCost = { ...cost };

        if (key === "tradeId") {
          if (isLegacyValue(value)) {
            return cost;
          }

          nextCost.tradeId = value;
          nextCost.trade = value ? getTradeName(value, cost.trade) : "";
        } else if (key === "costCodeId") {
          if (isLegacyValue(value)) {
            return cost;
          }

          nextCost.costCodeId = value;
          nextCost.costCode = value ? getCostCodeName(value, cost.costCode) : "";
        } else if (key === "unitId") {
          if (isLegacyValue(value)) {
            return cost;
          }

          nextCost.unitId = value;
          nextCost.unit = value ? getUnitLabel(value, cost.unit) : "";
        } else if (key === "rate") {
          nextCost.rate = value === "" ? "" : Number(value);
        } else {
          nextCost[key] = value;
        }

        nextCost.displayName = getStructuredItemPresentation(nextCost).displayName;
        return nextCost;
      })
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

    return sortConfig.direction === "asc" ? " ^" : " v";
  };

  const beginColumnResize = (columnKey, event) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStateRef.current = {
      columnKey,
      startX: event.clientX,
      startWidth: columnWidths[columnKey] || defaultColumnWidths[columnKey],
    };
  };

  const moveColumnByOffset = (columnKey, offset) => {
    setColumnOrder((current) => {
      const currentIndex = current.indexOf(columnKey);
      const nextIndex = currentIndex + offset;

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      return moveItem(current, currentIndex, nextIndex);
    });
  };

  const moveColumnToTarget = (fromKey, toKey) => {
    if (!fromKey || !toKey || fromKey === toKey) {
      return;
    }

    setColumnOrder((current) => {
      const fromIndex = current.indexOf(fromKey);
      const toIndex = current.indexOf(toKey);

      if (fromIndex === -1 || toIndex === -1) {
        return current;
      }

      return moveItem(current, fromIndex, toIndex);
    });
  };

  const resetColumns = () => {
    setColumnOrder(defaultColumnOrder);
    setColumnWidths(defaultColumnWidths);
  };

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
  };

  const sortedFilteredCosts = (() => {
    const normalizedSearch = cleanText(searchTerm).toLowerCase();
    const filteredRows = costs.filter((cost) => {
      if (filters.itemFamily && cleanText(cost.itemFamily) !== cleanText(filters.itemFamily)) {
        return false;
      }

      if (filters.workType && cleanText(cost.workType) !== cleanText(filters.workType)) {
        return false;
      }

      if (filters.tradeId && (cost.tradeId || getResolvedTradeId(cost.trade)) !== filters.tradeId) {
        return false;
      }

      if (
        filters.costCodeId &&
        (cost.costCodeId || getResolvedCostCodeId(cost.costCode)) !== filters.costCodeId
      ) {
        return false;
      }

      if (filters.unitId && (cost.unitId || getUnitIdFromValue(cost.unit)) !== filters.unitId) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        getCostDisplayName(cost),
        cost.itemName,
        cost.itemFamily,
        cost.workType,
        cost.trade,
        getTradeName(cost.tradeId || getResolvedTradeId(cost.trade), cost.trade),
        cost.costCode,
        getCostCodeName(cost.costCodeId || getResolvedCostCodeId(cost.costCode), cost.costCode),
        cost.specification,
        cost.gradeOrQuality,
        cost.brand,
        cost.finishOrVariant,
        cost.unit,
      ].some((value) => cleanText(value).toLowerCase().includes(normalizedSearch));
    });

    const direction = sortConfig.direction === "asc" ? 1 : -1;

    return [...filteredRows].sort((left, right) => {
      const leftPresentation = getCostPresentation(left);
      const rightPresentation = getCostPresentation(right);

      if (sortConfig.key === "rate") {
        return ((Number(left.rate) || 0) - (Number(right.rate) || 0)) * direction;
      }

      const getSortValue = (cost, presentation) => {
        if (sortConfig.key === "displayName") {
          return presentation.sortKey || presentation.displayName.toLowerCase();
        }

        if (sortConfig.key === "tradeId") {
          return getTradeName(cost.tradeId || getResolvedTradeId(cost.trade), cost.trade).toLowerCase();
        }

        if (sortConfig.key === "costCodeId") {
          return getCostCodeName(
            cost.costCodeId || getResolvedCostCodeId(cost.costCode),
            cost.costCode
          ).toLowerCase();
        }

        if (sortConfig.key === "unitId") {
          return getUnitLabel(cost.unitId || getUnitIdFromValue(cost.unit), cost.unit).toLowerCase();
        }

        return cleanText(cost[sortConfig.key]).toLowerCase();
      };

      return (
        getSortValue(left, leftPresentation).localeCompare(getSortValue(right, rightPresentation), undefined, {
          sensitivity: "base",
        }) * direction
      );
    });
  })();

  const groupedCosts = (() => {
    if (groupBy === "none") {
      return [];
    }

    return sortedFilteredCosts.reduce((groups, cost) => {
      const groupLabel = getFieldGroupLabel(cost, groupBy);
      const existingGroup = groups.find((group) => group.label === groupLabel);

      if (existingGroup) {
        existingGroup.rows.push(cost);
        return groups;
      }

      groups.push({ id: `${groupBy}-${groupLabel}`, label: groupLabel, rows: [cost] });
      return groups;
    }, []);
  })();

  const toggleGroup = (groupId) => {
    setCollapsedGroups((current) => ({ ...current, [groupId]: !(current[groupId] ?? false) }));
  };

  const exportCostsAsCsv = () => {
    if (typeof window === "undefined") {
      return;
    }

    const csvText = convertCostsToCSV(
      costs.map((cost) => ({
        ...cost,
        trade: getTradeName(cost.tradeId || getResolvedTradeId(cost.trade), cost.trade || ""),
        costCode: getCostCodeName(
          cost.costCodeId || getResolvedCostCodeId(cost.costCode),
          cost.costCode || ""
        ),
        unit: getUnitLabel(cost.unitId || getUnitIdFromValue(cost.unit), cost.unit || ""),
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
        const coreName = cleanText(row["Core Name"]);
        const importedDisplayName = cleanText(row["Item Name"]);
        const itemName = coreName || importedDisplayName;
        const unitValue = cleanText(row.Unit);
        const rateValue = cleanText(row.Rate);
        const unitId = getUnitIdFromValue(unitValue);
        const tradeValue = cleanText(row.Trade);
        const costCodeValue = cleanText(row["Cost Code"]);
        const sourceLink = cleanText(row["Source Link"]);
        const tradeId = getResolvedTradeId(tradeValue);
        const costCodeId = getResolvedCostCodeId(costCodeValue);

        if (!itemName || !unitId || rateValue === "" || Number.isNaN(Number(rateValue))) {
          skippedRows += 1;
          return;
        }

        const itemFamily = cleanText(row["Item Family"]);

        if (itemFamily) {
          newFamilies.push(itemFamily);
        }

        const nextRow = {
          id: `cost-import-${Date.now()}-${validRows.length}`,
          itemFamily,
          itemName,
          workType: cleanText(row["Work Type"]),
          tradeId,
          trade: tradeId ? getTradeName(tradeId, tradeValue) : tradeValue,
          costCodeId,
          costCode: costCodeId ? getCostCodeName(costCodeId, costCodeValue) : costCodeValue,
          specification: cleanText(row.Specification),
          gradeOrQuality: cleanText(row["Grade / Quality"]),
          brand: cleanText(row.Brand),
          finishOrVariant: cleanText(row["Finish / Variant"]),
          sourceLink,
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

  const allColumns = {
      displayName: {
        key: "displayName",
        label: "Item Name",
        sortableKey: "displayName",
        className: "cost-library-col-display-name cost-library-col-secondary cost-library-group-end-identity",
        render: (row) => {
          const presentation = getCostPresentation(row);

          return (
            <div className="cost-library-item-cell">
              <span>{presentation.displayName}</span>
            </div>
          );
        },
      },
      itemName: {
        key: "itemName",
        label: "Core Name",
        sortableKey: "itemName",
        className: "cost-library-col-item-name",
        render: (row) => (
          <input
            value={row.itemName}
            onChange={(event) => updateCost(row.id, "itemName", event.target.value)}
            aria-label="Core item name"
          />
        ),
      },
      itemFamily: {
        key: "itemFamily",
        label: "Family",
        sortableKey: "itemFamily",
        className: "cost-library-col-item-family cost-library-col-secondary",
        render: (row) => (
          <select
            value={row.itemFamily || ""}
            onChange={(event) => updateCost(row.id, "itemFamily", event.target.value)}
            aria-label="Item family"
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
      workType: {
        key: "workType",
        label: "Work Type",
        sortableKey: "workType",
        className: "cost-library-col-worktype cost-library-col-secondary",
        render: (row) => (
          <select
            value={row.workType || ""}
            onChange={(event) => updateCost(row.id, "workType", event.target.value)}
            aria-label="Work type"
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
      tradeId: {
        key: "tradeId",
        label: "Trade",
        sortableKey: "tradeId",
        className: "cost-library-col-trade cost-library-col-secondary",
        render: (row) => (
          <select
            value={getTradeSelectValue(row.tradeId, row.trade)}
            onChange={(event) => updateCost(row.id, "tradeId", event.target.value)}
            aria-label="Trade"
          >
            <option value="">Unassigned</option>
            {getSelectOptionsWithLegacy(activeTrades, row.tradeId, row.trade, "trade").map((trade) => (
              <option key={trade.id} value={trade.id}>
                {trade.name}
              </option>
            ))}
          </select>
        ),
      },
      costCodeId: {
        key: "costCodeId",
        label: "Cost Code",
        sortableKey: "costCodeId",
        className: "cost-library-col-cost-code cost-library-col-secondary cost-library-group-end-classification",
        render: (row) => (
          <select
            value={getCostCodeSelectValue(row.costCodeId, row.costCode)}
            onChange={(event) => updateCost(row.id, "costCodeId", event.target.value)}
            aria-label="Cost code"
          >
            <option value="">Unassigned</option>
            {getSelectOptionsWithLegacy(
              activeCostCodes,
              row.costCodeId,
              row.costCode,
              "cost-code"
            ).map((costCode) => (
              <option key={costCode.id} value={costCode.id}>
                {costCode.name}
              </option>
            ))}
          </select>
        ),
      },
      specification: {
        key: "specification",
        label: "Spec",
        sortableKey: "specification",
        className: "cost-library-col-specification cost-library-col-secondary",
        render: (row) => (
          <input
            value={row.specification || ""}
            onChange={(event) => updateCost(row.id, "specification", event.target.value)}
            aria-label="Specification"
          />
        ),
      },
      gradeOrQuality: {
        key: "gradeOrQuality",
        label: "Grade",
        sortableKey: "gradeOrQuality",
        className: "cost-library-col-grade cost-library-col-secondary",
        render: (row) => (
          <input
            value={row.gradeOrQuality || ""}
            onChange={(event) => updateCost(row.id, "gradeOrQuality", event.target.value)}
            aria-label="Grade or quality"
          />
        ),
      },
      brand: {
        key: "brand",
        label: "Brand",
        sortableKey: "brand",
        className: "cost-library-col-brand cost-library-col-secondary",
        render: (row) => (
          <input
            value={row.brand || ""}
            onChange={(event) => updateCost(row.id, "brand", event.target.value)}
            aria-label="Brand"
          />
        ),
      },
      finishOrVariant: {
        key: "finishOrVariant",
        label: "Finish",
        sortableKey: "finishOrVariant",
        className: "cost-library-col-finish cost-library-col-secondary cost-library-group-end-details",
        render: (row) => (
          <input
            value={row.finishOrVariant || ""}
            onChange={(event) => updateCost(row.id, "finishOrVariant", event.target.value)}
            aria-label="Finish or variant"
          />
        ),
      },
      unitId: {
        key: "unitId",
        label: "Unit",
        sortableKey: "unitId",
        className: "cost-library-col-unit cost-library-col-utility",
        render: (row) => (
          <select
            value={getUnitSelectValue(row.unitId, row.unit)}
            onChange={(event) => updateCost(row.id, "unitId", event.target.value)}
            aria-label="Unit"
          >
            <option value="">Unassigned</option>
            {getSelectOptionsWithLegacy(activeUnits, row.unitId, row.unit, "unit").map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.abbreviation || unit.name}
              </option>
            ))}
          </select>
        ),
      },
      rate: {
        key: "rate",
        label: "Rate",
        sortableKey: "rate",
        className: "cost-library-col-rate cost-library-col-utility",
        render: (row) => (
          <input
            type="number"
            min="0"
            step="0.01"
            value={row.rate}
            onChange={(event) => updateCost(row.id, "rate", event.target.value)}
            aria-label="Rate"
          />
        ),
      },
  };

  const visibleColumns = columnOrder.map((columnKey) => allColumns[columnKey]).filter(Boolean);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const renderSortHeader = (column) => (
    <button
      type="button"
      className="table-sort-button"
      onClick={() => toggleSort(column.sortableKey || column.key)}
    >
      {column.label}
      {getSortIndicator(column.sortableKey || column.key)}
    </button>
  );

  const renderTable = (rows) => {
    if (!rows.length) {
      return <p className="empty-state">No cost items added yet.</p>;
    }

    return (
      <div className="table-wrap cost-library-table-wrap">
        <table className="data-table cost-library-table">
          <colgroup>
            {visibleColumns.map((column) => (
              <col
                key={column.key}
                style={{ width: `${columnWidths[column.key] || defaultColumnWidths[column.key]}px` }}
              />
            ))}
            <col style={{ width: `${defaultColumnWidths.actions}px` }} />
          </colgroup>
          <thead>
            <tr>
              {visibleColumns.map((column) => (
                <th
                  key={column.key}
                  className={`${column.className || ""} ${
                    draggedColumnKey === column.key ? "is-dragging" : ""
                  }`.trim()}
                  draggable
                  onDragStart={() => setDraggedColumnKey(column.key)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    moveColumnToTarget(draggedColumnKey, column.key);
                    setDraggedColumnKey("");
                  }}
                  onDragEnd={() => setDraggedColumnKey("")}
                >
                  <div className="cost-library-header-cell">
                    {renderSortHeader(column)}
                    <button
                      type="button"
                      className="cost-library-resize-handle"
                      aria-label={`Resize ${column.label} column`}
                      onMouseDown={(event) => beginColumnResize(column.key, event)}
                    />
                  </div>
                </th>
              ))}
              <th className="table-col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {visibleColumns.map((column) => (
                  <td key={column.key} className={column.className || ""}>
                    {column.render(row)}
                  </td>
                ))}
                <td className="table-col-actions">
                  <div className="cost-library-row-actions">
                    <button
                      type="button"
                      className={`cost-library-row-action ${
                        cleanText(row.sourceLink) ? "is-active" : ""
                      }`}
                      aria-label={
                        cleanText(row.sourceLink)
                          ? `Edit source link for ${getCostDisplayName(row)}`
                          : `Add source link for ${getCostDisplayName(row)}`
                      }
                      title={cleanText(row.sourceLink) ? "Edit source link" : "Add source link"}
                      onClick={() =>
                        setActiveLinkEditorId((current) => (current === row.id ? "" : row.id))
                      }
                    >
                      L
                    </button>
                    <button
                      type="button"
                      className="cost-library-row-action"
                      aria-label={`Remove ${getCostDisplayName(row)}`}
                      title="Remove item"
                      onClick={() => removeCost(row.id)}
                    >
                      x
                    </button>
                  </div>
                  {activeLinkEditorId === row.id ? (
                    <div className="cost-library-link-popover">
                      <span className="cost-library-link-popover-label">Source Link</span>
                      <input
                        value={row.sourceLink || ""}
                        onChange={(event) => updateCost(row.id, "sourceLink", event.target.value)}
                        placeholder="https://example.com/reference"
                        aria-label={`Source link for ${getCostDisplayName(row)}`}
                      />
                      <div className="cost-library-link-popover-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={!getOpenableUrl(row.sourceLink)}
                          onClick={() =>
                            window.open(
                              getOpenableUrl(row.sourceLink),
                              "_blank",
                              "noopener,noreferrer"
                            )
                          }
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => updateCost(row.id, "sourceLink", "")}
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setActiveLinkEditorId("")}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <SectionCard
      title="Cost Library"
      description="Store normalized cost items with linked trade, cost code, family, unit, compact filters, and CSV setup support."
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

              <FormField label="Trade">
                <select
                  value={form.tradeId}
                  onChange={(event) => updateField("tradeId", event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {activeTrades.map((trade) => (
                    <option key={trade.id} value={trade.id}>
                      {trade.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Cost code">
                <select
                  value={form.costCodeId}
                  onChange={(event) => updateField("costCodeId", event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {activeCostCodes.map((costCode) => (
                    <option key={costCode.id} value={costCode.id}>
                      {costCode.name}
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

              <FormField label="Source link">
                <input
                  value={form.sourceLink}
                  onChange={(event) => updateField("sourceLink", event.target.value)}
                  placeholder="https://example.com/reference"
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
                  placeholder="Search item, family, trade, spec"
                />
              </FormField>

              <FormField label="Sort by">
                <select
                  value={sortConfig.key}
                  onChange={(event) =>
                    setSortConfig((current) => ({
                      ...current,
                      key: event.target.value || "displayName",
                    }))
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
            </div>

            <div className="cost-library-control-band">
              <FormField label="Import mode">
                <select value={importMode} onChange={(event) => setImportMode(event.target.value)}>
                  <option value="append">Append</option>
                  <option value="replace">Replace all</option>
                </select>
              </FormField>

              <details className="cost-library-control-menu">
                <summary>Filter{activeFilterCount ? ` (${activeFilterCount})` : ""}</summary>
                <div className="cost-library-control-menu-panel">
                  <FormField label="Item family">
                    <select
                      value={filters.itemFamily}
                      onChange={(event) => updateFilter("itemFamily", event.target.value)}
                    >
                      <option value="">All</option>
                      {activeItemFamilies.map((itemFamily) => (
                        <option key={itemFamily.id} value={itemFamily.name}>
                          {itemFamily.name}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Work type">
                    <select
                      value={filters.workType}
                      onChange={(event) => updateFilter("workType", event.target.value)}
                    >
                      <option value="">All</option>
                      {workTypeOptions.map((workType) => (
                        <option key={workType} value={workType}>
                          {workType}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Trade">
                    <select
                      value={filters.tradeId}
                      onChange={(event) => updateFilter("tradeId", event.target.value)}
                    >
                      <option value="">All</option>
                      {activeTrades.map((trade) => (
                        <option key={trade.id} value={trade.id}>
                          {trade.name}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Cost code">
                    <select
                      value={filters.costCodeId}
                      onChange={(event) => updateFilter("costCodeId", event.target.value)}
                    >
                      <option value="">All</option>
                      {activeCostCodes.map((costCode) => (
                        <option key={costCode.id} value={costCode.id}>
                          {costCode.name}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Unit">
                    <select
                      value={filters.unitId}
                      onChange={(event) => updateFilter("unitId", event.target.value)}
                    >
                      <option value="">All</option>
                      {activeUnits.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.abbreviation}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <button type="button" className="secondary-button" onClick={clearFilters}>
                    Clear filters
                  </button>
                </div>
              </details>

              <details className="cost-library-control-menu">
                <summary>Columns</summary>
                <div className="cost-library-control-menu-panel cost-library-columns-panel">
                  {columnOrder.map((columnKey, index) => {
                    const column = allColumns[columnKey];

                    if (!column) {
                      return null;
                    }

                    return (
                      <div key={columnKey} className="cost-library-column-row">
                        <span>{column.label}</span>
                        <input
                          type="range"
                          min="64"
                          max="480"
                          step="2"
                          value={columnWidths[columnKey] || defaultColumnWidths[columnKey]}
                          onChange={(event) =>
                            setColumnWidths((current) => ({
                              ...current,
                              [columnKey]: Number(event.target.value),
                            }))
                          }
                          aria-label={`${column.label} width`}
                        />
                        <div className="cost-library-column-row-actions">
                          <button
                            type="button"
                            className="cost-library-row-action"
                            disabled={index === 0}
                            aria-label={`Move ${column.label} left`}
                            onClick={() => moveColumnByOffset(columnKey, -1)}
                          >
                            {"<"}
                          </button>
                          <button
                            type="button"
                            className="cost-library-row-action"
                            disabled={index === columnOrder.length - 1}
                            aria-label={`Move ${column.label} right`}
                            onClick={() => moveColumnByOffset(columnKey, 1)}
                          >
                            {">"}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  <button type="button" className="secondary-button" onClick={resetColumns}>
                    Reset layout
                  </button>
                </div>
              </details>

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
              Trade and Cost Code are linked to their libraries. Filter and Columns keep the top bar compact while letting you narrow the grid and tune widths.
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
            renderTable(sortedFilteredCosts)
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

                    {!isCollapsed ? renderTable(group.rows) : null}
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
