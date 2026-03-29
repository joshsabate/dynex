import { useEffect, useMemo, useRef, useState } from "react";
import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";
import { createAssemblyId, normalizeAssemblies } from "../utils/assemblies";
import { convertAssembliesToCSV, parseCSV } from "../utils/csvUtils";
import { getStructuredItemPresentation } from "../utils/itemNaming";
import {
  costTypeOptions,
  deliveryTypeOptions,
  findMatchingCost,
  normalizeCosts,
} from "../utils/costs";

const assemblyCsvHeaders = [
  "Assembly Name",
  "Room Type",
  "Assembly Group",
  "Item Name",
  "Cost Type",
  "Delivery Type",
  "Trade",
  "Cost Code",
  "Quantity Formula",
  "Unit",
  "Unit Cost",
];

const defaultAssemblyGroups = [
  "Finishes",
  "Waterproofing",
  "Joinery",
  "Fixtures",
  "Services",
  "Walls & Linings",
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

function createEmptyAssemblyItem(index = 0) {
  return {
    id: `assembly-item-${Date.now()}-${index}`,
    libraryItemId: "",
    itemNameSnapshot: "",
    itemName: "",
    costType: "",
    deliveryType: "",
    tradeId: "",
    trade: "",
    costCodeId: "",
    costCode: "",
    unitId: "",
    unit: "",
    baseRate: "",
    unitCost: "",
    quantityFormula: "",
    qtyRule: "",
    rateOverride: "",
    notes: "",
    isCustomItem: true,
  };
}

function createEmptyAssembly(roomTypes = []) {
  const roomType = sortActiveItems(roomTypes)[0] || { id: "", name: "" };
  return {
    id: "",
    assemblyName: "",
    roomTypeId: roomType.id,
    roomType: roomType.name,
    appliesToRoomTypeId: roomType.id,
    appliesToRoomType: roomType.name,
    assemblyGroup: "",
    assemblyCategory: "",
    notes: "",
    items: [],
  };
}

function cloneAssemblyForEditor(assembly, roomTypes = []) {
  return {
    ...createEmptyAssembly(roomTypes),
    ...assembly,
    notes: cleanText(assembly.notes),
    items: (assembly.items || []).map((item, index) => ({
      ...createEmptyAssemblyItem(index),
      ...item,
      quantityFormula: item.quantityFormula || item.qtyRule || "",
      qtyRule: item.quantityFormula || item.qtyRule || "",
      baseRate: item.baseRate ?? item.unitCost ?? "",
      unitCost: item.baseRate ?? item.unitCost ?? "",
      itemNameSnapshot: item.itemNameSnapshot || item.itemName || "",
      itemName: item.itemNameSnapshot || item.itemName || "",
      isCustomItem: item.isCustomItem !== false,
    })),
  };
}

function getAssemblySourceMix(assembly) {
  const items = assembly.items || [];
  if (!items.length) {
    return "Custom Only";
  }
  const linkedCount = items.filter((item) => !item.isCustomItem).length;
  if (linkedCount === items.length) {
    return "Linked Only";
  }
  if (linkedCount === 0) {
    return "Custom Only";
  }
  return "Mixed";
}

function createCopyName(value, fallback) {
  const base = cleanText(value) || fallback;
  return base.includes("(Copy)") ? base : `${base} (Copy)`;
}

function getTradeLabel(value) {
  return cleanText(value) || "Unassigned";
}

function AssemblyLibraryPage({
  assemblies,
  roomTypes,
  units,
  costs,
  trades,
  costCodes,
  onAssembliesChange,
}) {
  const importFileInputRef = useRef(null);
  const activeRoomTypes = useMemo(() => sortActiveItems(roomTypes), [roomTypes]);
  const activeUnits = useMemo(() => sortActiveItems(units), [units]);
  const activeTrades = useMemo(() => sortActiveItems(trades), [trades]);
  const activeCostCodes = useMemo(() => sortActiveItems(costCodes), [costCodes]);
  const normalizedCosts = useMemo(
    () => normalizeCosts(costs, { units, trades, costCodes }),
    [costCodes, costs, trades, units]
  );
  const normalizedAssemblies = useMemo(
    () =>
      normalizeAssemblies(assemblies, {
        units,
        costs: normalizedCosts,
        trades,
        costCodes,
      }),
    [assemblies, costCodes, normalizedCosts, trades, units]
  );
  const assemblyGroupOptions = useMemo(
    () =>
      [...new Set([
        ...defaultAssemblyGroups,
        ...normalizedAssemblies.map((assembly) => assembly.assemblyGroup),
      ])]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [normalizedAssemblies]
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [activeRoomTypeNav, setActiveRoomTypeNav] = useState("all");
  const [roomTypeFilter, setRoomTypeFilter] = useState("");
  const [assemblyGroupFilter, setAssemblyGroupFilter] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("");
  const [sortKey, setSortKey] = useState("assemblyName");
  const [selectedAssemblyIds, setSelectedAssemblyIds] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [csvStatus, setCsvStatus] = useState("");
  const [editorState, setEditorState] = useState({
    isOpen: false,
    mode: "create",
    assemblyId: "",
    activeItemId: "",
  });
  const [draft, setDraft] = useState(createEmptyAssembly(roomTypes));
  const [validationErrors, setValidationErrors] = useState([]);
  const [costPickerState, setCostPickerState] = useState({
    isOpen: false,
    search: "",
    tradeId: "",
    family: "",
  });

  const roomTypeNavItems = useMemo(() => {
    const counts = normalizedAssemblies.reduce((map, assembly) => {
      const key = assembly.roomTypeId || "unassigned";
      map[key] = (map[key] || 0) + 1;
      return map;
    }, {});

    return [
      { id: "all", label: "All Assemblies", count: normalizedAssemblies.length },
      ...activeRoomTypes.map((roomType) => ({
        id: roomType.id,
        label: roomType.name,
        count: counts[roomType.id] || 0,
      })),
      ...((counts.unassigned || 0) > 0
        ? [{ id: "unassigned", label: "Unassigned", count: counts.unassigned }]
        : []),
    ];
  }, [activeRoomTypes, normalizedAssemblies]);

  const filteredAssemblies = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const rows = normalizedAssemblies.filter((assembly) => {
      const roomTypeKey = assembly.roomTypeId || "unassigned";
      const sourceMix = getAssemblySourceMix(assembly);
      return (
        (activeRoomTypeNav === "all" || roomTypeKey === activeRoomTypeNav) &&
        (!roomTypeFilter || assembly.roomTypeId === roomTypeFilter) &&
        (!assemblyGroupFilter || assembly.assemblyGroup === assemblyGroupFilter) &&
        (!sourceTypeFilter || sourceMix === sourceTypeFilter) &&
        (!search ||
          [
            assembly.assemblyName,
            assembly.roomType,
            assembly.assemblyGroup,
            ...assembly.items.map((item) => item.itemNameSnapshot || item.itemName),
          ].some((value) => cleanText(value).toLowerCase().includes(search)))
      );
    });

    return [...rows].sort((a, b) => {
      if (sortKey === "itemCount") {
        return b.items.length - a.items.length;
      }
      if (sortKey === "roomType") {
        return cleanText(a.roomType).localeCompare(cleanText(b.roomType));
      }
      if (sortKey === "assemblyGroup") {
        return cleanText(a.assemblyGroup).localeCompare(cleanText(b.assemblyGroup));
      }
      return cleanText(a.assemblyName).localeCompare(cleanText(b.assemblyName));
    });
  }, [
    activeRoomTypeNav,
    assemblyGroupFilter,
    normalizedAssemblies,
    roomTypeFilter,
    searchTerm,
    sortKey,
    sourceTypeFilter,
  ]);

  const selectedFilteredAssemblyIds = filteredAssemblies
    .map((assembly) => assembly.id)
    .filter((assemblyId) => selectedAssemblyIds.includes(assemblyId));
  const allFilteredAssembliesSelected =
    filteredAssemblies.length > 0 &&
    selectedFilteredAssemblyIds.length === filteredAssemblies.length;

  const activeItem =
    draft.items.find((item) => item.id === editorState.activeItemId) || null;
  const selectedEditorItemIds = draft.items
    .map((item) => item.id)
    .filter((itemId) => selectedItemIds.includes(itemId));
  const allEditorItemsSelected =
    draft.items.length > 0 && selectedEditorItemIds.length === draft.items.length;
  const costFamilyOptions = useMemo(
    () =>
      [...new Set(normalizedCosts.map((cost) => cleanText(cost.itemFamily)).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b)
      ),
    [normalizedCosts]
  );
  const filteredPickerCosts = useMemo(() => {
    const search = costPickerState.search.trim().toLowerCase();
    return normalizedCosts.filter((cost) => {
      const presentation = getStructuredItemPresentation(cost);
      return (
        (!costPickerState.tradeId || cost.tradeId === costPickerState.tradeId) &&
        (!costPickerState.family || cleanText(cost.itemFamily) === costPickerState.family) &&
        (!search ||
          [
            cost.itemName,
            cost.displayName,
            presentation.primaryLabel,
            presentation.metaLabel,
            cost.trade,
            cost.itemFamily,
          ].some((value) => cleanText(value).toLowerCase().includes(search)))
      );
    });
  }, [costPickerState.family, costPickerState.search, costPickerState.tradeId, normalizedCosts]);

  useEffect(() => {
    if (!costPickerState.isOpen || typeof window === "undefined") {
      return undefined;
    }
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setCostPickerState((current) => ({ ...current, isOpen: false }));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [costPickerState.isOpen]);

  const readFileAsText = (file) =>
    typeof file?.text === "function"
      ? file.text()
      : new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("Unable to read file"));
          reader.readAsText(file);
        });

  const getRoomTypeName = (roomTypeId) =>
    activeRoomTypes.find((roomType) => roomType.id === roomTypeId)?.name || "";
  const getUnitIdFromValue = (value) =>
    activeUnits.find(
      (unit) =>
        unit.id === value ||
        cleanText(unit.abbreviation).toLowerCase() === cleanText(value).toLowerCase() ||
        cleanText(unit.name).toLowerCase() === cleanText(value).toLowerCase()
    )?.id || "";
  const getTradeIdFromValue = (value) =>
    activeTrades.find(
      (trade) =>
        trade.id === value || cleanText(trade.name).toLowerCase() === cleanText(value).toLowerCase()
    )?.id || "";
  const getCostCodeIdFromValue = (value) =>
    activeCostCodes.find(
      (costCode) =>
        costCode.id === value ||
        cleanText(costCode.name).toLowerCase() === cleanText(value).toLowerCase()
    )?.id || "";

  const openCreateEditor = () => {
    setDraft(createEmptyAssembly(roomTypes));
    setSelectedItemIds([]);
    setValidationErrors([]);
    setEditorState({
      isOpen: true,
      mode: "create",
      assemblyId: "",
      activeItemId: "",
    });
  };

  const openEditEditor = (assembly) => {
    const nextDraft = cloneAssemblyForEditor(assembly, roomTypes);
    setDraft(nextDraft);
    setSelectedItemIds([]);
    setValidationErrors([]);
    setEditorState({
      isOpen: true,
      mode: "edit",
      assemblyId: assembly.id,
      activeItemId: nextDraft.items[0]?.id || "",
    });
  };

  const closeEditor = () => {
    setDraft(createEmptyAssembly(roomTypes));
    setSelectedItemIds([]);
    setValidationErrors([]);
    setEditorState({
      isOpen: false,
      mode: "create",
      assemblyId: "",
      activeItemId: "",
    });
  };

  const openCostPicker = () => {
    setCostPickerState({
      isOpen: true,
      search: "",
      tradeId: "",
      family: "",
    });
  };

  const closeCostPicker = () => {
    setCostPickerState((current) => ({ ...current, isOpen: false }));
  };

  const updateAssemblyField = (key, value) =>
    setDraft((current) => {
      if (key === "roomTypeId") {
        const roomType = getRoomTypeName(value);
        return {
          ...current,
          roomTypeId: value,
          roomType,
          appliesToRoomTypeId: value,
          appliesToRoomType: roomType,
        };
      }
      if (key === "assemblyGroup") {
        return { ...current, assemblyGroup: value, assemblyCategory: value };
      }
      return { ...current, [key]: value };
    });

  const selectItemRow = (itemId) => {
    setEditorState((current) => ({ ...current, activeItemId: itemId }));
  };

  const addLinkedCostItem = (costId) => {
    const cost = normalizedCosts.find((item) => item.id === costId);
    if (!cost) {
      return;
    }

    const nextItem = {
      ...createEmptyAssemblyItem(draft.items.length),
      libraryItemId: cost.id,
      itemNameSnapshot: cost.itemName,
      itemName: cost.itemName,
      costType: cost.costType,
      deliveryType: cost.deliveryType,
      tradeId: cost.tradeId,
      trade: cost.trade,
      costCodeId: cost.costCodeId,
      costCode: cost.costCode,
      unitId: cost.unitId,
      unit: cost.unit,
      baseRate: cost.rate,
      unitCost: cost.rate,
      isCustomItem: false,
    };

    setDraft((current) => ({ ...current, items: [...current.items, nextItem] }));
    setEditorState((current) => ({ ...current, activeItemId: nextItem.id }));
    closeCostPicker();
  };

  const addCustomItem = () => {
    const nextItem = createEmptyAssemblyItem(draft.items.length);
    setDraft((current) => ({ ...current, items: [...current.items, nextItem] }));
    setEditorState((current) => ({ ...current, activeItemId: nextItem.id }));
  };

  const updateItemField = (itemId, key, value) =>
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== itemId) {
          return item;
        }
        if (key === "quantityFormula") {
          return { ...item, quantityFormula: value, qtyRule: value };
        }
        if (key === "tradeId") {
          const trade = activeTrades.find((row) => row.id === value) || null;
          return { ...item, tradeId: value, trade: trade?.name || "" };
        }
        if (key === "costCodeId") {
          const costCode = activeCostCodes.find((row) => row.id === value) || null;
          return {
            ...item,
            costCodeId: value,
            costCode: costCode?.name || "",
          };
        }
        if (key === "unitId") {
          const unit = activeUnits.find((row) => row.id === value) || null;
          return { ...item, unitId: value, unit: unit?.abbreviation || "" };
        }
        if (key === "baseRate") {
          return { ...item, baseRate: value, unitCost: value };
        }
        if (key === "itemNameSnapshot") {
          return { ...item, itemNameSnapshot: value, itemName: value };
        }
        return { ...item, [key]: value };
      }),
    }));

  const removeItemRow = (itemIds) => {
    const ids = Array.isArray(itemIds) ? itemIds : [itemIds];
    setDraft((current) => ({
      ...current,
      items: current.items.filter((item) => !ids.includes(item.id)),
    }));
    setSelectedItemIds((current) => current.filter((itemId) => !ids.includes(itemId)));
    setEditorState((current) => ({
      ...current,
      activeItemId: ids.includes(current.activeItemId) ? "" : current.activeItemId,
    }));
  };

  const duplicateItemRow = (itemId) => {
    const sourceItem = draft.items.find((item) => item.id === itemId);
    if (!sourceItem) {
      return;
    }
    const nextItem = {
      ...sourceItem,
      id: `assembly-item-${Date.now()}-${draft.items.length}`,
      itemNameSnapshot: createCopyName(
        sourceItem.itemNameSnapshot || sourceItem.itemName,
        "Assembly Item"
      ),
      itemName: createCopyName(sourceItem.itemNameSnapshot || sourceItem.itemName, "Assembly Item"),
    };
    setDraft((current) => ({ ...current, items: [...current.items, nextItem] }));
    setEditorState((current) => ({ ...current, activeItemId: nextItem.id }));
  };

  const toggleAssemblySelection = (assemblyId) => {
    setSelectedAssemblyIds((current) =>
      current.includes(assemblyId)
        ? current.filter((id) => id !== assemblyId)
        : [...current, assemblyId]
    );
  };

  const toggleSelectAllAssemblies = () => {
    if (allFilteredAssembliesSelected) {
      setSelectedAssemblyIds((current) =>
        current.filter((id) => !selectedFilteredAssemblyIds.includes(id))
      );
      return;
    }
    setSelectedAssemblyIds((current) => [
      ...new Set([...current, ...filteredAssemblies.map((assembly) => assembly.id)]),
    ]);
  };

  const toggleItemSelection = (itemId) => {
    setSelectedItemIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId]
    );
  };

  const toggleSelectAllItems = () => {
    if (allEditorItemsSelected) {
      setSelectedItemIds([]);
      return;
    }
    setSelectedItemIds(draft.items.map((item) => item.id));
  };

  const confirmTypedDelete = (message) => {
    if (typeof window === "undefined") {
      return true;
    }
    return window.prompt(`${message}\n\nType DELETE to confirm.`) === "DELETE";
  };

  const validateDraft = () => {
    const errors = [];
    const nextAssemblyId = draft.id || createAssemblyId(draft);
    if (!cleanText(draft.assemblyName)) {
      errors.push("Assembly Name is required.");
    }
    if (!draft.roomTypeId) {
      errors.push("Room Type is required.");
    }
    if (!cleanText(draft.assemblyGroup)) {
      errors.push("Assembly Group is required.");
    }
    if (!draft.items.length) {
      errors.push("At least one cost item is required.");
    }
    if (!draft.assemblyName.includes("  ")) {
      errors.push("Naming guidance: use format `Element  Type  Optional Spec` where practical.");
    }
    if (
      normalizedAssemblies.find(
        (assembly) => assembly.id === nextAssemblyId && assembly.id !== editorState.assemblyId
      )
    ) {
      errors.push(
        "An assembly with the same name, room type, and assembly group already exists."
      );
    }
    draft.items.forEach((item, index) => {
      const label = `Cost item ${index + 1}`;
      if (!cleanText(item.itemNameSnapshot || item.itemName)) {
        errors.push(`${label}: Item Name is required.`);
      }
      if (!cleanText(item.costType)) {
        errors.push(`${label}: Cost Type is required.`);
      }
      if (!cleanText(item.deliveryType)) {
        errors.push(`${label}: Delivery Type is required.`);
      }
      if (!cleanText(item.tradeId || item.trade)) {
        errors.push(`${label}: Trade is required.`);
      }
      if (!cleanText(item.costCodeId || item.costCode)) {
        errors.push(`${label}: Cost Code is required.`);
      }
      if (!cleanText(item.quantityFormula)) {
        errors.push(`${label}: Quantity Formula is required.`);
      }
      if (!cleanText(item.unitId || item.unit)) {
        errors.push(`${label}: Unit is required.`);
      }
      if (item.baseRate === "" || !Number.isFinite(Number(item.baseRate))) {
        errors.push(`${label}: Unit Cost must be a valid number.`);
      }
    });
    return errors;
  };

  const saveAssembly = (event) => {
    event.preventDefault();
    const errors = validateDraft();
    setValidationErrors(errors);
    if (errors.filter((error) => !error.startsWith("Naming guidance:")).length) {
      return;
    }

    const nextId = draft.id || createAssemblyId(draft);
    const nextAssembly = normalizeAssemblies(
      [
        {
          ...draft,
          id: nextId,
          assemblyId: nextId,
          assemblyCategory: draft.assemblyGroup,
          items: draft.items.map((item) => ({
            ...item,
            quantityFormula: item.quantityFormula,
            qtyRule: item.quantityFormula,
            baseRate: Number(item.baseRate),
            unitCost: Number(item.baseRate),
            rateOverride:
              item.rateOverride === "" || item.rateOverride == null
                ? ""
                : Number(item.rateOverride),
          })),
        },
      ],
      { units, costs: normalizedCosts, trades, costCodes }
    )[0];

    onAssembliesChange(
      editorState.mode === "edit"
        ? normalizedAssemblies.map((assembly) =>
            assembly.id === editorState.assemblyId ? nextAssembly : assembly
          )
        : [...normalizedAssemblies, nextAssembly]
    );
    closeEditor();
  };

  const deleteAssembly = (assemblyId) => {
    if (typeof window !== "undefined") {
      const shouldDelete = window.confirm(
        "Delete this assembly? This action cannot be undone."
      );
      if (!shouldDelete) {
        return;
      }
    }
    onAssembliesChange(
      normalizedAssemblies.filter((assembly) => assembly.id !== assemblyId)
    );
    setSelectedAssemblyIds((current) => current.filter((id) => id !== assemblyId));
    if (editorState.assemblyId === assemblyId) {
      closeEditor();
    }
  };

  const duplicateAssembly = (assemblyId) => {
    const sourceAssembly = normalizedAssemblies.find(
      (assembly) => assembly.id === assemblyId
    );
    if (!sourceAssembly) {
      return;
    }
    const nextDraft = cloneAssemblyForEditor(sourceAssembly, roomTypes);
    nextDraft.id = "";
    nextDraft.assemblyName = createCopyName(
      sourceAssembly.assemblyName,
      "Assembly"
    );
    nextDraft.items = nextDraft.items.map((item, index) => ({
      ...item,
      id: `assembly-item-${Date.now()}-${index}`,
    }));
    const nextAssembly = normalizeAssemblies(
      [
        {
          ...nextDraft,
          id: createAssemblyId(nextDraft),
          assemblyId: createAssemblyId(nextDraft),
          assemblyCategory: nextDraft.assemblyGroup,
        },
      ],
      { units, costs: normalizedCosts, trades, costCodes }
    )[0];
    onAssembliesChange([...normalizedAssemblies, nextAssembly]);
    openEditEditor(nextAssembly);
  };

  const deleteSelectedAssemblies = () => {
    if (!selectedAssemblyIds.length) {
      return;
    }
    if (
      !confirmTypedDelete(
        `Delete ${selectedAssemblyIds.length} selected assembly${
          selectedAssemblyIds.length === 1 ? "" : "ies"
        }?`
      )
    ) {
      return;
    }
    onAssembliesChange(
      normalizedAssemblies.filter(
        (assembly) => !selectedAssemblyIds.includes(assembly.id)
      )
    );
    if (selectedAssemblyIds.includes(editorState.assemblyId)) {
      closeEditor();
    }
    setSelectedAssemblyIds([]);
  };

  const deleteFilteredAssemblies = () => {
    if (!filteredAssemblies.length) {
      return;
    }
    if (
      !confirmTypedDelete(
        `Delete all ${filteredAssemblies.length} assemblies in the current filtered view?`
      )
    ) {
      return;
    }
    const filteredIds = filteredAssemblies.map((assembly) => assembly.id);
    onAssembliesChange(
      normalizedAssemblies.filter((assembly) => !filteredIds.includes(assembly.id))
    );
    if (filteredIds.includes(editorState.assemblyId)) {
      closeEditor();
    }
    setSelectedAssemblyIds([]);
  };

  const deleteSelectedItems = () => {
    if (!selectedItemIds.length) {
      return;
    }
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Delete ${selectedItemIds.length} selected item row${
          selectedItemIds.length === 1 ? "" : "s"
        }?`
      )
    ) {
      return;
    }
    removeItemRow(selectedItemIds);
  };

  const exportAssembliesAsCsv = () => {
    if (typeof window === "undefined") {
      return;
    }
    const csvText = convertAssembliesToCSV(normalizedAssemblies);
    const csvBlob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const downloadUrl = window.URL.createObjectURL(csvBlob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "assemblies-export.csv";
    link.click();
    window.URL.revokeObjectURL(downloadUrl);
    setCsvStatus(
      `Exported ${normalizedAssemblies.reduce(
        (total, assembly) => total + assembly.items.length,
        0
      )} assembly rows.`
    );
  };

  const importAssembliesFromCsv = async (file) => {
    if (!file) {
      return;
    }
    try {
      const csvText = await readFileAsText(file);
      const parsedRows = parseCSV(csvText);
      const parsedHeaders = Object.keys(parsedRows[0] || {});
      const missingHeaders = assemblyCsvHeaders.filter(
        (header) => !parsedHeaders.includes(header)
      );
      if (missingHeaders.length) {
        setCsvStatus(
          `Unable to import CSV. Missing required columns: ${missingHeaders.join(
            ", "
          )}.`
        );
        return;
      }

      const groups = new Map();
      let skippedRows = 0;
      parsedRows.forEach((row) => {
        const assemblyName = cleanText(row["Assembly Name"]);
        const roomType = cleanText(row["Room Type"]);
        const assemblyGroup = cleanText(row["Assembly Group"]);
        const itemName = cleanText(row["Item Name"]);
        const costType = cleanText(row["Cost Type"]);
        const deliveryType = cleanText(row["Delivery Type"]);
        const trade = cleanText(row.Trade);
        const costCode = cleanText(row["Cost Code"]);
        const quantityFormula = cleanText(row["Quantity Formula"]);
        const unit = cleanText(row.Unit);
        const unitCost = Number(cleanText(row["Unit Cost"]));

        if (
          !assemblyName ||
          !roomType ||
          !assemblyGroup ||
          !itemName ||
          !costTypeOptions.includes(costType) ||
          !deliveryTypeOptions.includes(deliveryType) ||
          !trade ||
          !costCode ||
          !quantityFormula ||
          !unit ||
          !Number.isFinite(unitCost)
        ) {
          skippedRows += 1;
          return;
        }

        const roomTypeRecord =
          activeRoomTypes.find((record) => record.name === roomType || record.id === roomType) ||
          null;
        const matchedCost = findMatchingCost(
          normalizedCosts,
          itemName,
          getUnitIdFromValue(unit),
          unit
        );
        const key = `${assemblyName}::${roomType}::${assemblyGroup}`;

        if (!groups.has(key)) {
          groups.set(key, {
            id: createAssemblyId({
              assemblyName,
              roomTypeId: roomTypeRecord?.id || "",
              roomType,
              assemblyGroup,
            }),
            assemblyName,
            roomTypeId: roomTypeRecord?.id || "",
            roomType,
            appliesToRoomTypeId: roomTypeRecord?.id || "",
            appliesToRoomType: roomType,
            assemblyGroup,
            assemblyCategory: assemblyGroup,
            notes: "",
            items: [],
          });
        }

        const group = groups.get(key);
        group.items.push({
          id: `${group.id}-item-${group.items.length + 1}`,
          libraryItemId: matchedCost?.id || "",
          itemNameSnapshot: itemName,
          itemName,
          costType,
          deliveryType,
          tradeId: matchedCost?.tradeId || getTradeIdFromValue(trade),
          trade: matchedCost?.trade || trade,
          costCodeId: matchedCost?.costCodeId || getCostCodeIdFromValue(costCode),
          costCode: matchedCost?.costCode || costCode,
          quantityFormula,
          qtyRule: quantityFormula,
          unitId: matchedCost?.unitId || getUnitIdFromValue(unit),
          unit: matchedCost?.unit || unit,
          baseRate: unitCost,
          unitCost,
          rateOverride: "",
          notes: "",
          isCustomItem: !matchedCost,
        });
      });

      const nextAssemblies = normalizeAssemblies(Array.from(groups.values()), {
        units,
        costs: normalizedCosts,
        trades,
        costCodes,
      });
      if (!nextAssemblies.length) {
        setCsvStatus("Unable to import CSV. No valid assembly rows were found.");
        return;
      }
      onAssembliesChange([...normalizedAssemblies, ...nextAssemblies]);
      setCsvStatus(
        `${nextAssemblies.length} assemblies imported${
          skippedRows
            ? `. ${skippedRows} invalid row${skippedRows === 1 ? "" : "s"} skipped.`
            : "."
        }`
      );
    } catch (error) {
      setCsvStatus("Unable to import CSV. Please choose a valid CSV file.");
    }
  };

  const namingGuidance =
    !draft.assemblyName || draft.assemblyName.includes("  ")
      ? ""
      : "Use format: Element  Type  Optional Spec";

  return (
    <SectionCard
      title="Assembly Library"
      description="Browse assemblies by room type, filter the compact list, and edit assembly headers plus linked/custom items in the side editor."
    >
      <div className="assembly-library-layout">
        <aside className="assembly-library-sidebar">
          <div className="assembly-library-sidebar-header">
            <h3>Room Types</h3>
            <button type="button" className="primary-button" onClick={openCreateEditor}>
              Add Assembly
            </button>
          </div>
          <div className="assembly-library-nav-list">
            {roomTypeNavItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`assembly-library-nav-button${
                  activeRoomTypeNav === item.id ? " is-active" : ""
                }`}
                onClick={() => setActiveRoomTypeNav(item.id)}
              >
                <span>{item.label}</span>
                <span>{item.count}</span>
              </button>
            ))}
          </div>
        </aside>
        <div className="assembly-library-browser">
          <div className="summary-section assembly-library-browser-panel">
            <div className="assembly-library-filter-bar">
              <FormField label="Search">
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search assemblies or items"
                />
              </FormField>
              <FormField label="Group Filter">
                <select
                  value={assemblyGroupFilter}
                  onChange={(event) => setAssemblyGroupFilter(event.target.value)}
                >
                  <option value="">All</option>
                  {assemblyGroupOptions.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Room Type">
                <select
                  value={roomTypeFilter}
                  onChange={(event) => setRoomTypeFilter(event.target.value)}
                >
                  <option value="">All</option>
                  {activeRoomTypes.map((roomType) => (
                    <option key={roomType.id} value={roomType.id}>
                      {roomType.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Source Type">
                <select
                  value={sourceTypeFilter}
                  onChange={(event) => setSourceTypeFilter(event.target.value)}
                >
                  <option value="">All</option>
                  <option value="Linked Only">Linked Only</option>
                  <option value="Custom Only">Custom Only</option>
                  <option value="Mixed">Mixed</option>
                </select>
              </FormField>
              <FormField label="Sort">
                <select
                  value={sortKey}
                  onChange={(event) => setSortKey(event.target.value)}
                >
                  <option value="assemblyName">Assembly Name</option>
                  <option value="roomType">Room Type</option>
                  <option value="assemblyGroup">Assembly Group</option>
                  <option value="itemCount">Item Count</option>
                </select>
              </FormField>
            </div>

            <div className="assembly-library-toolbar-row">
              <div className="assembly-library-toolbar-meta">
                <strong>
                  {roomTypeNavItems.find((item) => item.id === activeRoomTypeNav)?.label ||
                    "All Assemblies"}
                </strong>
                <span>
                  {filteredAssemblies.length} visible assembl
                  {filteredAssemblies.length === 1 ? "y" : "ies"}
                </span>
              </div>
              <div className="action-row">
                {editorState.assemblyId ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => duplicateAssembly(editorState.assemblyId)}
                  >
                    Duplicate Selected
                  </button>
                ) : null}
                <button
                  type="button"
                  className="secondary-button"
                  onClick={deleteFilteredAssemblies}
                >
                  Delete All (Filtered)
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={exportAssembliesAsCsv}
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
              </div>
              <input
                ref={importFileInputRef}
                type="file"
                accept=".csv,text/csv"
                aria-label="Import Assembly CSV"
                style={{ display: "none" }}
                onChange={(event) => {
                  const [file] = event.target.files || [];
                  importAssembliesFromCsv(file);
                  event.target.value = "";
                }}
              />
            </div>

            {csvStatus ? <p className="assembly-library-status">{csvStatus}</p> : null}

            {selectedAssemblyIds.length ? (
              <div className="assembly-library-bulk-bar">
                <strong>{selectedAssemblyIds.length} selected</strong>
                <div className="action-row">
                  <button
                    type="button"
                    className="danger-button"
                    onClick={deleteSelectedAssemblies}
                  >
                    Delete Selected
                  </button>
                </div>
              </div>
            ) : null}

            {filteredAssemblies.length ? (
              <div className="table-wrap assembly-library-table-wrap">
                <table className="data-table assembly-library-table">
                  <colgroup>
                    <col className="assembly-library-col-select" />
                    <col className="assembly-library-col-name" />
                    <col className="assembly-library-col-room" />
                    <col className="assembly-library-col-group" />
                    <col className="assembly-library-col-count" />
                    <col className="assembly-library-col-source" />
                    <col className="assembly-library-col-actions" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={allFilteredAssembliesSelected}
                          aria-label="Select all visible assemblies"
                          onChange={toggleSelectAllAssemblies}
                        />
                      </th>
                      <th>Assembly Name</th>
                      <th>Room Type</th>
                      <th>Assembly Group</th>
                      <th>Item Count</th>
                      <th>Source Mix</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssemblies.map((assembly) => {
                      const isActive = editorState.assemblyId === assembly.id;
                      const isSelected = selectedAssemblyIds.includes(assembly.id);
                      return (
                        <tr
                          key={assembly.id}
                          className={`${isActive ? "assembly-library-row-active" : ""}${
                            isSelected ? " assembly-library-row-selected" : ""
                          }`}
                          onClick={() => openEditEditor(assembly)}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              aria-label={`Select ${assembly.assemblyName}`}
                              onClick={(event) => event.stopPropagation()}
                              onChange={() => toggleAssemblySelection(assembly.id)}
                            />
                          </td>
                          <td>{assembly.assemblyName}</td>
                          <td>{assembly.roomType || "Unassigned"}</td>
                          <td>{assembly.assemblyGroup || "Unassigned"}</td>
                          <td>{assembly.items.length}</td>
                          <td>{getAssemblySourceMix(assembly)}</td>
                          <td>
                            <div className="action-row">
                              <button
                                type="button"
                                className="danger-button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  deleteAssembly(assembly.id);
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
              <p className="empty-state">No assemblies match the current filters.</p>
            )}
          </div>
        </div>
        <div className="assembly-library-editor">
          {editorState.isOpen ? (
            <form className="assembly-editor-panel" onSubmit={saveAssembly}>
              <div className="summary-section room-template-editor-header assembly-library-editor-header">
                <div>
                  <p className="room-template-editor-kicker">
                    {editorState.mode === "edit" ? "Editing" : "New Assembly"}
                  </p>
                  <h3>
                    {editorState.mode === "edit"
                      ? `Editing: ${draft.assemblyName || "Assembly"}`
                      : "Create Assembly"}
                  </h3>
                </div>
                <div className="room-template-editor-header-meta">
                  <span className="room-template-selected-badge">
                    {draft.roomType || "Unassigned Room Type"}
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

              <div className="summary-section room-template-compact-section assembly-library-editor-section assembly-library-editor-section-identity">
                <h3>Identity</h3>
                <div className="form-grid room-template-fields-grid room-template-fields-grid-compact">
                  <FormField label="Assembly Name">
                    <input
                      value={draft.assemblyName}
                      onChange={(event) =>
                        updateAssemblyField("assemblyName", event.target.value)
                      }
                      placeholder="e.g. Wall  Villaboard Lining"
                    />
                  </FormField>
                  <FormField label="Room Type">
                    <select
                      value={draft.roomTypeId}
                      onChange={(event) =>
                        updateAssemblyField("roomTypeId", event.target.value)
                      }
                    >
                      <option value="">Select room type</option>
                      {activeRoomTypes.map((roomType) => (
                        <option key={roomType.id} value={roomType.id}>
                          {roomType.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Assembly Group">
                    <select
                      value={draft.assemblyGroup}
                      onChange={(event) =>
                        updateAssemblyField("assemblyGroup", event.target.value)
                      }
                    >
                      <option value="">Select assembly group</option>
                      {assemblyGroupOptions.map((group) => (
                        <option key={group} value={group}>
                          {group}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
              </div>

              <div className="summary-section room-template-compact-section assembly-library-editor-section assembly-library-editor-section-notes">
                <h3>Notes / Setup</h3>
                <div className="form-grid room-template-fields-grid room-template-fields-grid-compact">
                  <FormField label="Assembly Notes">
                    <textarea
                      rows={3}
                      value={draft.notes}
                      onChange={(event) =>
                        updateAssemblyField("notes", event.target.value)
                      }
                      placeholder="Optional setup or scope notes"
                    />
                  </FormField>
                </div>
                <p className="assembly-library-status">
                  Use format: Element  Type  Optional Spec
                </p>
                {namingGuidance ? (
                  <p className="assembly-library-validation-note">{namingGuidance}</p>
                ) : null}
              </div>

              <div className="summary-section room-template-compact-section assembly-library-editor-section assembly-library-editor-section-items">
                <div className="assembly-library-items-header">
                  <div>
                    <h3>Assembly Items</h3>
                    <p>
                      Linked items inherit library classification and pricing. Custom
                      items stay local to the assembly.
                    </p>
                  </div>
                  <div className="action-row">
                    {editorState.activeItemId ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => duplicateItemRow(editorState.activeItemId)}
                      >
                        Duplicate Item
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={deleteSelectedItems}
                      disabled={!selectedItemIds.length}
                    >
                      Delete Selected Items
                    </button>
                  </div>
                </div>

                <div className="action-row assembly-library-inline-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={openCostPicker}
                  >
                    Add from Cost Library
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={addCustomItem}
                  >
                    Add Custom Item
                  </button>
                </div>

                <div className="table-wrap assembly-library-items-wrap">
                  <table className="data-table assembly-library-items-table">
                    <colgroup>
                      <col className="assembly-library-col-select" />
                      <col className="assembly-library-item-col-name" />
                      <col className="assembly-library-item-col-qty" />
                      <col className="assembly-library-item-col-override" />
                      <col className="assembly-library-col-actions" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            checked={allEditorItemsSelected}
                            aria-label="Select all assembly items"
                            onChange={toggleSelectAllItems}
                          />
                        </th>
                        <th>Item Name</th>
                        <th>Quantity</th>
                        <th>Override Rate</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.items.length ? (
                        draft.items.map((item) => {
                          const isActive = editorState.activeItemId === item.id;
                          const isSelected = selectedItemIds.includes(item.id);
                          const tradeLabel = getTradeLabel(item.trade);
                          return (
                            <tr
                              key={item.id}
                              className={`${isActive ? "assembly-library-row-active" : ""}${
                                isSelected ? " assembly-library-row-selected" : ""
                              }`}
                              onClick={() => selectItemRow(item.id)}
                            >
                              <td>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  aria-label={`Select ${item.itemNameSnapshot || item.itemName}`}
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={() => toggleItemSelection(item.id)}
                                />
                              </td>
                              <td>
                                <div className="assembly-library-item-cell">
                                  <span className="assembly-library-item-primary">
                                    {item.itemNameSnapshot || item.itemName}
                                  </span>
                                  <div className="assembly-library-item-meta">
                                    <span
                                      className={`assembly-library-source-badge ${
                                        item.isCustomItem ? "is-custom" : "is-linked"
                                      }`}
                                    >
                                      {item.isCustomItem ? "Custom" : "Linked"}
                                    </span>
                                    <span>{item.costType || "Unassigned"}</span>
                                    <span>{item.deliveryType || "Unassigned"}</span>
                                    <span>{item.unit || "Unassigned"}</span>
                                    <span>${item.baseRate || 0}</span>
                                    <span
                                      className={`assembly-library-trade-badge ${
                                        tradeLabel === "Unassigned" ? "is-unassigned" : ""
                                      }`}
                                    >
                                      {tradeLabel}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div className="assembly-library-item-qty">
                                  <strong>Qty:</strong>{" "}
                                  {item.quantityFormula || "Not set"}
                                </div>
                              </td>
                              <td>{item.rateOverride || ""}</td>
                              <td>
                                <div className="action-row">
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      duplicateItemRow(item.id);
                                    }}
                                  >
                                    Duplicate
                                  </button>
                                  <button
                                    type="button"
                                    className="danger-button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      if (
                                        typeof window !== "undefined" &&
                                        !window.confirm("Delete this item row?")
                                      ) {
                                        return;
                                      }
                                      removeItemRow(item.id);
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5}>No cost items added yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {activeItem ? (
                  <div className="assembly-library-item-detail">
                    <h3>Selected Item</h3>
                    <div className="form-grid room-template-fields-grid room-template-fields-grid-compact">
                      <FormField label="Item Name">
                        <input
                          value={activeItem.itemNameSnapshot}
                          disabled={!activeItem.isCustomItem}
                          onChange={(event) =>
                            updateItemField(
                              activeItem.id,
                              "itemNameSnapshot",
                              event.target.value
                            )
                          }
                        />
                      </FormField>
                      <FormField label="Source">
                        <input
                          value={activeItem.isCustomItem ? "Custom" : "Linked"}
                          readOnly
                        />
                      </FormField>
                      <FormField label="Cost Type">
                        {activeItem.isCustomItem ? (
                          <select
                            value={activeItem.costType}
                            onChange={(event) =>
                              updateItemField(activeItem.id, "costType", event.target.value)
                            }
                          >
                            <option value="">Select</option>
                            {costTypeOptions.map((costType) => (
                              <option key={costType} value={costType}>
                                {costType}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input value={activeItem.costType} readOnly />
                        )}
                      </FormField>
                      <FormField label="Delivery Type">
                        {activeItem.isCustomItem ? (
                          <select
                            value={activeItem.deliveryType}
                            onChange={(event) =>
                              updateItemField(
                                activeItem.id,
                                "deliveryType",
                                event.target.value
                              )
                            }
                          >
                            <option value="">Select</option>
                            {deliveryTypeOptions.map((deliveryType) => (
                              <option key={deliveryType} value={deliveryType}>
                                {deliveryType}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input value={activeItem.deliveryType} readOnly />
                        )}
                      </FormField>
                      <FormField label="Trade">
                        {activeItem.isCustomItem ? (
                          <select
                            value={activeItem.tradeId}
                            onChange={(event) =>
                              updateItemField(activeItem.id, "tradeId", event.target.value)
                            }
                          >
                            <option value="">Select</option>
                            {activeTrades.map((trade) => (
                              <option key={trade.id} value={trade.id}>
                                {trade.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input value={getTradeLabel(activeItem.trade)} readOnly />
                        )}
                      </FormField>
                      <FormField label="Cost Code">
                        {activeItem.isCustomItem ? (
                          <select
                            value={activeItem.costCodeId}
                            onChange={(event) =>
                              updateItemField(
                                activeItem.id,
                                "costCodeId",
                                event.target.value
                              )
                            }
                          >
                            <option value="">Select</option>
                            {activeCostCodes.map((costCode) => (
                              <option key={costCode.id} value={costCode.id}>
                                {costCode.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input value={activeItem.costCode} readOnly />
                        )}
                      </FormField>
                      <FormField label="Unit">
                        {activeItem.isCustomItem ? (
                          <select
                            value={activeItem.unitId}
                            onChange={(event) =>
                              updateItemField(activeItem.id, "unitId", event.target.value)
                            }
                          >
                            <option value="">Select</option>
                            {activeUnits.map((unit) => (
                              <option key={unit.id} value={unit.id}>
                                {unit.abbreviation}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input value={activeItem.unit} readOnly />
                        )}
                      </FormField>
                      <FormField label="Base Rate">
                        <input
                          type="number"
                          step="0.01"
                          value={activeItem.baseRate}
                          readOnly={!activeItem.isCustomItem}
                          onChange={(event) =>
                            updateItemField(activeItem.id, "baseRate", event.target.value)
                          }
                        />
                      </FormField>
                      <FormField label="Quantity Formula">
                        <div className="assembly-library-quantity-field">
                          <input
                            value={activeItem.quantityFormula}
                            placeholder="e.g. wallArea, floorArea * 1.1"
                            onChange={(event) =>
                              updateItemField(
                                activeItem.id,
                                "quantityFormula",
                                event.target.value
                              )
                            }
                          />
                          <p className="assembly-library-field-hint">
                            Available: wallArea, floorArea, perimeter, ceilingArea
                          </p>
                          <p className="assembly-library-field-hint">
                            Use variables and math operators (*, +, -, /)
                          </p>
                        </div>
                      </FormField>
                      <FormField label="Override Rate">
                        <input
                          type="number"
                          step="0.01"
                          value={activeItem.rateOverride}
                          onChange={(event) =>
                            updateItemField(
                              activeItem.id,
                              "rateOverride",
                              event.target.value
                            )
                          }
                        />
                      </FormField>
                      <FormField label="Notes">
                        <textarea
                          rows={3}
                          value={activeItem.notes}
                          onChange={(event) =>
                            updateItemField(activeItem.id, "notes", event.target.value)
                          }
                        />
                      </FormField>
                    </div>
                  </div>
                ) : null}
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
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={closeEditor}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="primary-button">
                    {editorState.mode === "edit" ? "Save Changes" : "Save Assembly"}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="summary-section">
              <p className="empty-state">
                Select an assembly to edit, or add a new assembly.
              </p>
            </div>
          )}
        </div>
      </div>
      {costPickerState.isOpen ? (
        <div
          className="assembly-library-picker-backdrop"
          onClick={closeCostPicker}
        >
          <div
            className="assembly-library-picker-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="assembly-library-picker-header">
              <div>
                <p className="room-template-editor-kicker">Cost Library Picker</p>
                <h3>Add from Cost Library</h3>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={closeCostPicker}
              >
                Close
              </button>
            </div>

            <div className="assembly-library-picker-filters">
              <FormField label="Search">
                <input
                  autoFocus
                  value={costPickerState.search}
                  onChange={(event) =>
                    setCostPickerState((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Search cost items"
                />
              </FormField>
              <FormField label="Trade">
                <select
                  value={costPickerState.tradeId}
                  onChange={(event) =>
                    setCostPickerState((current) => ({
                      ...current,
                      tradeId: event.target.value,
                    }))
                  }
                >
                  <option value="">All</option>
                  {activeTrades.map((trade) => (
                    <option key={trade.id} value={trade.id}>
                      {trade.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Family">
                <select
                  value={costPickerState.family}
                  onChange={(event) =>
                    setCostPickerState((current) => ({
                      ...current,
                      family: event.target.value,
                    }))
                  }
                >
                  <option value="">All</option>
                  {costFamilyOptions.map((family) => (
                    <option key={family} value={family}>
                      {family}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="assembly-library-picker-results">
              {filteredPickerCosts.length ? (
                filteredPickerCosts.map((cost) => {
                  const presentation = getStructuredItemPresentation(cost);
                  return (
                    <button
                      key={cost.id}
                      type="button"
                      className="assembly-library-picker-row"
                      onClick={() => addLinkedCostItem(cost.id)}
                    >
                      <span className="assembly-library-picker-primary">
                        {presentation.primaryLabel}
                      </span>
                      <span className="assembly-library-picker-meta">
                        {cost.costType}  {cost.unit}  ${cost.rate}  {getTradeLabel(cost.trade)}
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="empty-state">No cost items match the current search.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

export default AssemblyLibraryPage;
