import { useEffect, useMemo, useRef, useState } from "react";
import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";
import { createAssemblyId, normalizeAssemblies } from "../utils/assemblies";
import {
  getAssemblyGroupNames,
  getStoredAssemblyGroupNames,
  isAssemblyGroupDefined,
  saveStoredAssemblyGroupNames,
  unassignedAssemblyGroupName,
} from "../utils/assemblyGroups";
import { applyImportMode, convertAssembliesToCSV, parseCSV } from "../utils/csvUtils";
import { getStructuredItemPresentation } from "../utils/itemNaming";
import {
  costTypeOptions,
  deliveryTypeOptions,
  costStatusOptions,
  findMatchingCost,
  normalizeCosts,
} from "../utils/costs";
import {
  buildQuantityFormula,
  getQuantityFormulaOptions,
  parseQuantityFormula,
} from "../utils/quantityFormulaOptions";

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

function buildAssemblyName(element, scope, spec) {
  const parts = [cleanText(element), cleanText(scope), cleanText(spec)].filter(Boolean);
  return parts.join("  ");
}

function deriveAssemblyNameParts(assemblyName) {
  const rawName = cleanText(assemblyName);
  if (!rawName) {
    return { assemblyElement: "", assemblyScope: "", assemblySpec: "" };
  }

  const structuredParts = rawName.split("  ").map((part) => cleanText(part)).filter(Boolean);
  if (structuredParts.length >= 2) {
    return {
      assemblyElement: structuredParts[0],
      assemblyScope: structuredParts[1],
      assemblySpec: structuredParts.slice(2).join("  "),
    };
  }

  const fallbackParts = rawName.split(/\s+/).filter(Boolean);
  return {
    assemblyElement: fallbackParts[0] || "",
    assemblyScope: fallbackParts.slice(1).join(" "),
    assemblySpec: "",
  };
}

function createEmptyAssemblyItem(index = 0) {
  return {
    id: `assembly-item-${Date.now()}-${index}`,
    libraryItemId: "",
    costItemId: "",
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

function createEmptyCostItemDraft(units = []) {
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
    imageUrl: "",
    status: "Active",
    isActive: true,
    notes: "",
    sourceLink: "",
  };
}

function createEmptyAssembly(roomTypes = []) {
  const roomType = sortActiveItems(roomTypes)[0] || { id: "", name: "" };
  return {
    id: "",
    assemblyName: "",
    assemblyElement: "",
    assemblyScope: "",
    assemblySpec: "",
    roomTypeId: roomType.id,
    roomType: roomType.name,
    appliesToRoomTypeId: roomType.id,
    appliesToRoomType: roomType.name,
    assemblyGroup: "",
    assemblyCategory: "",
    imageUrl: "",
    notes: "",
    items: [],
  };
}

const BULK_EDIT_UNCHANGED = "__UNCHANGED__";

function getSharedBulkValue(items, selector) {
  if (!items.length) {
    return "";
  }
  const firstValue = selector(items[0]) ?? "";
  return items.every((item) => (selector(item) ?? "") === firstValue) ? firstValue : "";
}

function cloneAssemblyForEditor(assembly, roomTypes = []) {
  const derivedNameParts = deriveAssemblyNameParts(assembly.assemblyName);
  return {
    ...createEmptyAssembly(roomTypes),
    ...assembly,
    assemblyElement: cleanText(assembly.assemblyElement || derivedNameParts.assemblyElement),
    assemblyScope: cleanText(assembly.assemblyScope || derivedNameParts.assemblyScope),
    assemblySpec: cleanText(assembly.assemblySpec || derivedNameParts.assemblySpec),
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

function getDeliveryTypeTagClassName(deliveryType) {
  switch (cleanText(deliveryType)) {
    case "Supply":
      return "is-supply";
    case "Install":
      return "is-install";
    case "Supply & Install":
      return "is-supply-install";
    case "Labour":
      return "is-labour";
    default:
      return "is-unassigned";
  }
}

function getAssemblyCoreItemsSummary(assembly, costLookupById) {
  const coreItems = [...new Set(
    (assembly.items || [])
      .map((item) => {
        const linkedCost = costLookupById.get(cleanText(item.libraryItemId || item.costItemId));
        return cleanText(linkedCost?.coreName || item.coreName || item.itemNameSnapshot || item.itemName);
      })
      .filter(Boolean)
  )];

  return coreItems.join(" · ");
}

function createCopyName(value, fallback) {
  const base = cleanText(value) || fallback;
  return base.includes("(Copy)") ? base : `${base} (Copy)`;
}

function getTradeLabel(value) {
  return cleanText(value) || "Unassigned";
}

function getCostCodeLabel(value) {
  return cleanText(value) || "Unassigned";
}

function formatCurrencyLabel(value) {
  if (value === "" || value == null) {
    return "Unassigned";
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "Unassigned";
  }

  return `$${numericValue}`;
}

function AssemblyLibraryPage({
  assemblies,
  roomTypes,
  elements = [],
  units,
  costs,
  trades,
  costCodes,
  itemFamilies = [],
  parameters = [],
  onAssembliesChange,
  onCostsChange = () => {},
  onItemFamiliesChange = () => {},
}) {
  const importFileInputRef = useRef(null);
  const activeRoomTypes = useMemo(() => sortActiveItems(roomTypes), [roomTypes]);
  const activeElements = useMemo(() => sortActiveItems(elements), [elements]);
  const activeUnits = useMemo(() => sortActiveItems(units), [units]);
  const activeTrades = useMemo(() => sortActiveItems(trades), [trades]);
  const activeCostCodes = useMemo(() => sortActiveItems(costCodes), [costCodes]);
  const activeItemFamilies = useMemo(() => sortActiveItems(itemFamilies), [itemFamilies]);
  const normalizedCosts = useMemo(
    () => normalizeCosts(costs, { units, trades, costCodes, itemFamilies }),
    [costCodes, costs, itemFamilies, trades, units]
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
  const costLookupById = useMemo(
    () => new Map(normalizedCosts.map((cost) => [cleanText(cost.id), cost])),
    [normalizedCosts]
  );
  const quantityFormulaOptions = useMemo(
    () => getQuantityFormulaOptions(parameters),
    [parameters]
  );
  const quantityFormulaOptionValues = useMemo(
    () => quantityFormulaOptions.map((option) => option.value),
    [quantityFormulaOptions]
  );
  const [managedAssemblyGroups, setManagedAssemblyGroups] = useState(() =>
    getStoredAssemblyGroupNames(typeof window === "undefined" ? null : window.localStorage)
  );
  const assemblyGroupOptions = useMemo(
    () => getAssemblyGroupNames(normalizedAssemblies, managedAssemblyGroups),
    [managedAssemblyGroups, normalizedAssemblies]
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [activeRoomTypeNav, setActiveRoomTypeNav] = useState("all");
  const [roomTypeFilter, setRoomTypeFilter] = useState("");
  const [assemblyGroupFilter, setAssemblyGroupFilter] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("");
  const [sortKey, setSortKey] = useState("assemblyName");
  const [selectedAssemblyIds, setSelectedAssemblyIds] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [bulkEditState, setBulkEditState] = useState({
    isOpen: false,
    values: {
      costType: BULK_EDIT_UNCHANGED,
      deliveryType: BULK_EDIT_UNCHANGED,
      tradeId: BULK_EDIT_UNCHANGED,
      costCodeId: BULK_EDIT_UNCHANGED,
      unitId: BULK_EDIT_UNCHANGED,
      rateOverride: "",
    },
    touched: {},
  });
  const [isAdvancedQtyFormulaMode, setIsAdvancedQtyFormulaMode] = useState(false);
  const [csvStatus, setCsvStatus] = useState("");
  const [importMode, setImportMode] = useState("append");
  const [editorState, setEditorState] = useState({
    isOpen: false,
    mode: "create",
    assemblyId: "",
    activeItemId: "",
  });
  const [draft, setDraft] = useState(createEmptyAssembly(roomTypes));
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);
  const [isItemsManagerOpen, setIsItemsManagerOpen] = useState(false);
  const [dragState, setDragState] = useState({
    draggingItemId: "",
    overItemId: "",
  });
  const [groupManagerState, setGroupManagerState] = useState({
    isOpen: false,
    newGroupName: "",
    editingGroupName: "",
    editValue: "",
    error: "",
  });
  const [validationErrors, setValidationErrors] = useState([]);
  const [costPickerState, setCostPickerState] = useState({
    isOpen: false,
    search: "",
    tradeId: "",
    family: "",
    selectedCostIds: [],
  });
  const [newCostItemState, setNewCostItemState] = useState({
    isOpen: false,
    draft: createEmptyCostItemDraft(units),
    validationErrors: [],
    notice: "",
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
  const activeQuantityFormulaConfig = useMemo(
    () => parseQuantityFormula(activeItem?.quantityFormula, quantityFormulaOptionValues),
    [activeItem?.quantityFormula, quantityFormulaOptionValues]
  );
  const selectedEditorItems = draft.items.filter((item) => selectedItemIds.includes(item.id));
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
  const selectedPickerCostIds = filteredPickerCosts
    .map((cost) => cost.id)
    .filter((costId) => costPickerState.selectedCostIds.includes(costId));
  const allFilteredPickerCostsSelected =
    filteredPickerCosts.length > 0 &&
    selectedPickerCostIds.length === filteredPickerCosts.length;

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    saveStoredAssemblyGroupNames(managedAssemblyGroups, window.localStorage);
  }, [managedAssemblyGroups]);

  useEffect(() => {
    if (!selectedEditorItemIds.length && bulkEditState.isOpen) {
      closeBulkEdit();
    }
  }, [bulkEditState.isOpen, selectedEditorItemIds.length]);

  useEffect(() => {
    if (!activeItem) {
      setIsAdvancedQtyFormulaMode(false);
      return;
    }

    setIsAdvancedQtyFormulaMode(Boolean(activeItem.quantityFormula) && !activeQuantityFormulaConfig.isGuided);
  }, [activeItem?.id, activeItem?.quantityFormula, activeQuantityFormulaConfig.isGuided]);

  useEffect(() => {
    if (
      (!costPickerState.isOpen && !isItemsManagerOpen && !groupManagerState.isOpen) ||
      typeof window === "undefined"
    ) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (costPickerState.isOpen) {
          setCostPickerState((current) => ({ ...current, isOpen: false }));
          return;
        }
        if (groupManagerState.isOpen) {
          setGroupManagerState({
            isOpen: false,
            newGroupName: "",
            editingGroupName: "",
            editValue: "",
            error: "",
          });
          return;
        }
        setIsItemsManagerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [costPickerState.isOpen, groupManagerState.isOpen, isItemsManagerOpen]);

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
    setBulkEditState({
      isOpen: false,
      values: {
        costType: BULK_EDIT_UNCHANGED,
        deliveryType: BULK_EDIT_UNCHANGED,
        tradeId: BULK_EDIT_UNCHANGED,
        costCodeId: BULK_EDIT_UNCHANGED,
        unitId: BULK_EDIT_UNCHANGED,
        rateOverride: "",
      },
      touched: {},
    });
    setValidationErrors([]);
    setIsNotesExpanded(false);
    setIsItemsManagerOpen(false);
    setEditorState({
      isOpen: true,
      mode: "create",
      assemblyId: "",
      activeItemId: "",
    });
  };

  const openEditEditor = (assembly, options = {}) => {
    const nextDraft = cloneAssemblyForEditor(assembly, roomTypes);
    setDraft(nextDraft);
    setSelectedItemIds([]);
    setBulkEditState({
      isOpen: false,
      values: {
        costType: BULK_EDIT_UNCHANGED,
        deliveryType: BULK_EDIT_UNCHANGED,
        tradeId: BULK_EDIT_UNCHANGED,
        costCodeId: BULK_EDIT_UNCHANGED,
        unitId: BULK_EDIT_UNCHANGED,
        rateOverride: "",
      },
      touched: {},
    });
    setValidationErrors([]);
    setIsNotesExpanded(Boolean(nextDraft.notes));
    setIsItemsManagerOpen(Boolean(options.openItemsManager));
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
    setBulkEditState({
      isOpen: false,
      values: {
        costType: BULK_EDIT_UNCHANGED,
        deliveryType: BULK_EDIT_UNCHANGED,
        tradeId: BULK_EDIT_UNCHANGED,
        costCodeId: BULK_EDIT_UNCHANGED,
        unitId: BULK_EDIT_UNCHANGED,
        rateOverride: "",
      },
      touched: {},
    });
    setValidationErrors([]);
    setIsNotesExpanded(false);
    setIsItemsManagerOpen(false);
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
      selectedCostIds: [],
    });
  };

  const closeCostPicker = () => {
    setCostPickerState((current) => ({
      ...current,
      isOpen: false,
      selectedCostIds: [],
    }));
  };

  const openGroupManager = () => {
    setGroupManagerState({
      isOpen: true,
      newGroupName: "",
      editingGroupName: "",
      editValue: "",
      error: "",
    });
  };

  const closeGroupManager = () => {
    setGroupManagerState({
      isOpen: false,
      newGroupName: "",
      editingGroupName: "",
      editValue: "",
      error: "",
    });
  };

  const stopEditingManagedAssemblyGroup = () => {
    setGroupManagerState((current) => ({
      ...current,
      editingGroupName: "",
      editValue: "",
      error: "",
    }));
  };

  const syncAssemblyGroupReferences = (previousGroupName, nextGroupName) => {
    const normalizedPreviousName = cleanText(previousGroupName);
    const normalizedNextName = cleanText(nextGroupName);

    if (!normalizedPreviousName || normalizedPreviousName === normalizedNextName) {
      return;
    }

    onAssembliesChange(
      normalizedAssemblies.map((assembly) =>
        assembly.assemblyGroup === normalizedPreviousName
          ? {
              ...assembly,
              assemblyGroup: normalizedNextName,
              assemblyCategory: normalizedNextName,
            }
          : assembly
      )
    );

    setDraft((current) =>
      current.assemblyGroup === normalizedPreviousName
        ? {
            ...current,
            assemblyGroup: normalizedNextName,
            assemblyCategory: normalizedNextName,
          }
        : current
    );
    setAssemblyGroupFilter((current) =>
      current === normalizedPreviousName ? normalizedNextName : current
    );
  };

  const addManagedAssemblyGroup = () => {
    const nextGroupName = cleanText(groupManagerState.newGroupName);
    if (!nextGroupName) {
      setGroupManagerState((current) => ({
        ...current,
        error: "Group name is required.",
      }));
      return;
    }
    if (assemblyGroupOptions.includes(nextGroupName)) {
      setGroupManagerState((current) => ({
        ...current,
        error: "Group name must be unique.",
      }));
      return;
    }

    setManagedAssemblyGroups((current) =>
      [...new Set([...current, nextGroupName])].sort((left, right) => left.localeCompare(right))
    );
    updateAssemblyField("assemblyGroup", nextGroupName);
    setGroupManagerState({
      isOpen: true,
      newGroupName: "",
      editingGroupName: "",
      editValue: "",
      error: "",
    });
  };

  const startEditingManagedAssemblyGroup = (groupName) => {
    if (groupName === unassignedAssemblyGroupName) {
      return;
    }
    setGroupManagerState((current) => ({
      ...current,
      editingGroupName: groupName,
      editValue: groupName,
      error: "",
    }));
  };

  const saveManagedAssemblyGroupRename = (groupName) => {
    if (groupName === unassignedAssemblyGroupName) {
      setGroupManagerState((current) => ({
        ...current,
        error: `"${unassignedAssemblyGroupName}" cannot be renamed.`,
      }));
      return;
    }
    const nextGroupName = cleanText(groupManagerState.editValue);
    if (!nextGroupName) {
      setGroupManagerState((current) => ({
        ...current,
        error: "Group name is required.",
      }));
      return;
    }
    if (nextGroupName !== groupName && assemblyGroupOptions.includes(nextGroupName)) {
      setGroupManagerState((current) => ({
        ...current,
        error: "Group name must be unique.",
      }));
      return;
    }

    setManagedAssemblyGroups((current) =>
      [...new Set(
        (current.includes(groupName)
          ? current.map((entry) => (entry === groupName ? nextGroupName : entry))
          : [...current, nextGroupName]
        ).filter(Boolean)
      )].sort((left, right) => left.localeCompare(right))
    );
    syncAssemblyGroupReferences(groupName, nextGroupName);
    stopEditingManagedAssemblyGroup();
  };

  const removeManagedAssemblyGroup = (groupName) => {
    if (groupName === unassignedAssemblyGroupName) {
      setGroupManagerState((current) => ({
        ...current,
        error: `"${unassignedAssemblyGroupName}" cannot be deleted.`,
      }));
      return;
    }
    const affectedAssemblies = normalizedAssemblies.filter(
      (assembly) => assembly.assemblyGroup === groupName
    );
    const isInUse = affectedAssemblies.length > 0;
    const message = isInUse
      ? `This group is used by ${affectedAssemblies.length} assemblies. Those assemblies will be reassigned to ${unassignedAssemblyGroupName}.`
      : `Delete "${groupName}"?`;
    if (
      typeof window !== "undefined" &&
      !window.confirm(message)
    ) {
      return;
    }

    setManagedAssemblyGroups((current) => current.filter((entry) => entry !== groupName));
    if (isInUse) {
      syncAssemblyGroupReferences(groupName, unassignedAssemblyGroupName);
    } else {
      setAssemblyGroupFilter((current) =>
        current === groupName ? unassignedAssemblyGroupName : current
      );
      setDraft((current) =>
        current.assemblyGroup === groupName
          ? {
              ...current,
              assemblyGroup: unassignedAssemblyGroupName,
              assemblyCategory: unassignedAssemblyGroupName,
            }
          : current
      );
    }
    stopEditingManagedAssemblyGroup();
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
      if (key === "assemblyElement" || key === "assemblyScope" || key === "assemblySpec") {
        const nextDraft = { ...current, [key]: value };
        nextDraft.assemblyName = buildAssemblyName(
          nextDraft.assemblyElement,
          nextDraft.assemblyScope,
          nextDraft.assemblySpec
        );
        return nextDraft;
      }
      return { ...current, [key]: value };
    });

  const selectItemRow = (itemId) => {
    setEditorState((current) => ({ ...current, activeItemId: itemId }));
  };

  const openItemsManager = () => {
    if (!draft.items.length) {
      setEditorState((current) => ({ ...current, activeItemId: "" }));
    } else if (!editorState.activeItemId) {
      setEditorState((current) => ({
        ...current,
        activeItemId: current.activeItemId || draft.items[0]?.id || "",
      }));
    }
    setIsItemsManagerOpen(true);
  };

  const closeItemsManager = () => {
    setIsItemsManagerOpen(false);
  };

  const appendLinkedCostItem = (cost) => {
    if (!cost) {
      return;
    }

    const nextItem = {
      ...createEmptyAssemblyItem(draft.items.length),
      libraryItemId: cost.id,
      costItemId: cost.id,
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
    setSelectedItemIds([]);
    setIsItemsManagerOpen(true);
  };

  const addLinkedCostItem = (costId) => {
    const cost = normalizedCosts.find((item) => item.id === costId);
    if (!cost) {
      return;
    }

    appendLinkedCostItem(cost);
    closeCostPicker();
  };

  const togglePickerCostSelection = (costId) => {
    setCostPickerState((current) => ({
      ...current,
      selectedCostIds: current.selectedCostIds.includes(costId)
        ? current.selectedCostIds.filter((selectedId) => selectedId !== costId)
        : [...current.selectedCostIds, costId],
    }));
  };

  const toggleSelectAllPickerCosts = () => {
    setCostPickerState((current) => ({
      ...current,
      selectedCostIds: allFilteredPickerCostsSelected
        ? current.selectedCostIds.filter((costId) => !filteredPickerCosts.some((cost) => cost.id === costId))
        : [
            ...new Set([
              ...current.selectedCostIds,
              ...filteredPickerCosts.map((cost) => cost.id),
            ]),
          ],
    }));
  };

  const addSelectedLinkedCostItems = () => {
    if (!costPickerState.selectedCostIds.length) {
      return;
    }

    const selectedCosts = normalizedCosts.filter((cost) =>
      costPickerState.selectedCostIds.includes(cost.id)
    );
    if (!selectedCosts.length) {
      return;
    }
    const itemSeed = Date.now();
    const nextItems = selectedCosts.map((cost, index) => ({
          ...createEmptyAssemblyItem(draft.items.length + index),
          id: `assembly-item-${itemSeed}-${draft.items.length + index}`,
          libraryItemId: cost.id,
          costItemId: cost.id,
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
    }));

    setDraft((current) => ({
      ...current,
      items: [...current.items, ...nextItems],
    }));
    setEditorState((current) => ({
      ...current,
      activeItemId: nextItems[0]?.id || current.activeItemId,
    }));
    closeCostPicker();
  };

  const addCustomItem = () => {
    const nextItem = createEmptyAssemblyItem(draft.items.length);
    setDraft((current) => ({ ...current, items: [...current.items, nextItem] }));
    setEditorState((current) => ({ ...current, activeItemId: nextItem.id }));
    setIsItemsManagerOpen(true);
  };

  const ensureItemFamiliesExist = (familyNames) => {
    const existing = new Set(activeItemFamilies.map((itemFamily) => itemFamily.name));
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

  const openNewCostItemEditor = () => {
    setNewCostItemState({
      isOpen: true,
      draft: createEmptyCostItemDraft(units),
      validationErrors: [],
      notice: "",
    });
  };

  const closeNewCostItemEditor = () => {
    setNewCostItemState((current) => ({
      ...current,
      isOpen: false,
      draft: createEmptyCostItemDraft(units),
      validationErrors: [],
      notice: "",
    }));
  };

  const updateNewCostDraftField = (key, value) =>
    setNewCostItemState((current) => {
      const draftState = current.draft;

      if (key === "unitId") {
        const unit = activeUnits.find((row) => row.id === value) || null;
        return {
          ...current,
          draft: { ...draftState, unitId: value, unit: unit?.abbreviation || "" },
        };
      }

      if (key === "tradeId") {
        const trade = activeTrades.find((row) => row.id === value) || null;
        return {
          ...current,
          draft: { ...draftState, tradeId: value, trade: trade?.name || "" },
        };
      }

      if (key === "costCodeId") {
        const costCode = activeCostCodes.find((row) => row.id === value) || null;
        return {
          ...current,
          draft: { ...draftState, costCodeId: value, costCode: costCode?.name || "" },
        };
      }

      if (key === "itemFamily") {
        return {
          ...current,
          draft: { ...draftState, itemFamily: value, family: value },
        };
      }

      if (key === "itemName") {
        return {
          ...current,
          draft: { ...draftState, itemName: value, coreName: value },
        };
      }

      if (key === "status") {
        return {
          ...current,
          draft: { ...draftState, status: value, isActive: value === "Active" },
        };
      }

      return {
        ...current,
        draft: { ...draftState, [key]: value },
      };
    });

  const validateNewCostDraft = () => {
    const { draft: newCostDraft } = newCostItemState;
    const errors = [];

    if (!cleanText(newCostDraft.itemName)) {
      errors.push("Item Name is required.");
    }
    if (!cleanText(newCostDraft.costType)) {
      errors.push("Cost Type is required.");
    }
    if (!cleanText(newCostDraft.deliveryType)) {
      errors.push("Delivery Type is required.");
    }
    if (!cleanText(newCostDraft.tradeId)) {
      errors.push("Trade is required.");
    }
    if (!cleanText(newCostDraft.costCodeId)) {
      errors.push("Cost Code is required.");
    }
    if (!cleanText(newCostDraft.unitId)) {
      errors.push("Unit is required.");
    }
    if (newCostDraft.rate === "" || !Number.isFinite(Number(newCostDraft.rate))) {
      errors.push("Rate must be a valid number.");
    }

    return errors;
  };

  const saveNewCostItem = (event) => {
    event.preventDefault();

    const errors = validateNewCostDraft();
    if (errors.length) {
      setNewCostItemState((current) => ({
        ...current,
        validationErrors: errors,
        notice: "",
      }));
      return;
    }

    const { draft: newCostDraft } = newCostItemState;
    ensureItemFamiliesExist([newCostDraft.itemFamily]);

    const nextId = newCostDraft.id || `cost-${Date.now()}`;
    const nextCost = normalizeCosts(
      [
        {
          ...newCostDraft,
          id: nextId,
          internalId:
            cleanText(newCostDraft.internalId) || cleanText(newCostDraft.id) || nextId,
          rate: Number(newCostDraft.rate),
        },
      ],
      { units, trades, costCodes, itemFamilies }
    )[0];

    onCostsChange([...normalizedCosts, nextCost]);
    appendLinkedCostItem(nextCost);
    setNewCostItemState({
      isOpen: false,
      draft: createEmptyCostItemDraft(units),
      validationErrors: [],
      notice: "Cost item created and added to assembly.",
    });
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
    const nextItems = draft.items.filter((item) => !ids.includes(item.id));
    setDraft((current) => ({
      ...current,
      items: current.items.filter((item) => !ids.includes(item.id)),
    }));
    setSelectedItemIds((current) => current.filter((itemId) => !ids.includes(itemId)));
    setEditorState((current) => ({
      ...current,
      activeItemId: ids.includes(current.activeItemId) ? nextItems[0]?.id || "" : current.activeItemId,
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

  const duplicateSelectedItems = () => {
    const itemIds = selectedItemIds.length
      ? selectedItemIds
      : activeItem
        ? [activeItem.id]
        : [];
    if (!itemIds.length) {
      return;
    }

    const sourceItems = draft.items.filter((item) => itemIds.includes(item.id));
    if (!sourceItems.length) {
      return;
    }

    const duplicatedItems = sourceItems.map((item, index) => ({
      ...item,
      id: `assembly-item-${Date.now()}-${draft.items.length + index}`,
      itemNameSnapshot: createCopyName(item.itemNameSnapshot || item.itemName, "Assembly Item"),
      itemName: createCopyName(item.itemNameSnapshot || item.itemName, "Assembly Item"),
    }));

    setDraft((current) => ({
      ...current,
      items: [...current.items, ...duplicatedItems],
    }));
    setSelectedItemIds(duplicatedItems.map((item) => item.id));
    setEditorState((current) => ({
      ...current,
      activeItemId: duplicatedItems[0]?.id || current.activeItemId,
    }));
  };

  const reorderDraftItems = (fromItemId, toItemId) => {
    if (!fromItemId || !toItemId || fromItemId === toItemId) {
      return;
    }

    setDraft((current) => {
      const sourceIndex = current.items.findIndex((item) => item.id === fromItemId);
      const targetIndex = current.items.findIndex((item) => item.id === toItemId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return current;
      }

      const nextItems = [...current.items];
      const [movedItem] = nextItems.splice(sourceIndex, 1);
      nextItems.splice(targetIndex, 0, movedItem);
      return {
        ...current,
        items: nextItems,
      };
    });
  };

  const handleItemDragStart = (itemId) => {
    setDragState({
      draggingItemId: itemId,
      overItemId: itemId,
    });
  };

  const handleItemDragEnter = (itemId) => {
    setDragState((current) => ({
      ...current,
      overItemId: itemId,
    }));
  };

  const handleItemDrop = (itemId) => {
    const draggingItemId = dragState.draggingItemId;
    reorderDraftItems(draggingItemId, itemId);
    setDragState({
      draggingItemId: "",
      overItemId: "",
    });
  };

  const clearItemDragState = () => {
    setDragState({
      draggingItemId: "",
      overItemId: "",
    });
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

  const openBulkEdit = () => {
    if (!selectedEditorItems.length) {
      return;
    }
    setBulkEditState({
      isOpen: true,
      values: {
        costType: getSharedBulkValue(selectedEditorItems, (item) => item.costType) || BULK_EDIT_UNCHANGED,
        deliveryType:
          getSharedBulkValue(selectedEditorItems, (item) => item.deliveryType) || BULK_EDIT_UNCHANGED,
        tradeId: getSharedBulkValue(selectedEditorItems, (item) => item.tradeId) || BULK_EDIT_UNCHANGED,
        costCodeId:
          getSharedBulkValue(selectedEditorItems, (item) => item.costCodeId) || BULK_EDIT_UNCHANGED,
        unitId: getSharedBulkValue(selectedEditorItems, (item) => item.unitId) || BULK_EDIT_UNCHANGED,
        rateOverride: getSharedBulkValue(selectedEditorItems, (item) => String(item.rateOverride ?? "")),
      },
      touched: {},
    });
  };

  const closeBulkEdit = () =>
    setBulkEditState((current) => ({
      ...current,
      isOpen: false,
      touched: {},
    }));

  const updateBulkEditField = (field, value) =>
    setBulkEditState((current) => ({
      ...current,
      values: {
        ...current.values,
        [field]: value,
      },
      touched: {
        ...current.touched,
        [field]: true,
      },
    }));

  const updateGuidedQuantityFormula = (field, value) => {
    if (!activeItem) {
      return;
    }

    const nextBaseParameter =
      field === "baseParameter" ? value : activeQuantityFormulaConfig.baseParameter;
    const nextOperator = field === "operator" ? value : activeQuantityFormulaConfig.operator || "*";
    const nextFactor = field === "factor" ? value : activeQuantityFormulaConfig.factor;

    updateItemField(
      activeItem.id,
      "quantityFormula",
      buildQuantityFormula(nextBaseParameter, nextOperator, nextFactor)
    );
  };

  const applyBulkEdit = () => {
    if (!selectedEditorItemIds.length) {
      return;
    }

    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (!selectedEditorItemIds.includes(item.id)) {
          return item;
        }

        let nextItem = { ...item };

        if (bulkEditState.touched.costType) {
          nextItem.costType =
            bulkEditState.values.costType === BULK_EDIT_UNCHANGED ? nextItem.costType : bulkEditState.values.costType;
        }

        if (bulkEditState.touched.deliveryType) {
          nextItem.deliveryType =
            bulkEditState.values.deliveryType === BULK_EDIT_UNCHANGED
              ? nextItem.deliveryType
              : bulkEditState.values.deliveryType;
        }

        if (bulkEditState.touched.tradeId) {
          if (bulkEditState.values.tradeId === BULK_EDIT_UNCHANGED) {
            nextItem = nextItem;
          } else {
            const trade = activeTrades.find((row) => row.id === bulkEditState.values.tradeId) || null;
            nextItem.tradeId = bulkEditState.values.tradeId;
            nextItem.trade = trade?.name || "";
          }
        }

        if (bulkEditState.touched.costCodeId) {
          if (bulkEditState.values.costCodeId !== BULK_EDIT_UNCHANGED) {
            const costCode =
              activeCostCodes.find((row) => row.id === bulkEditState.values.costCodeId) || null;
            nextItem.costCodeId = bulkEditState.values.costCodeId;
            nextItem.costCode = costCode?.name || "";
          }
        }

        if (bulkEditState.touched.unitId) {
          if (bulkEditState.values.unitId !== BULK_EDIT_UNCHANGED) {
            const unit = activeUnits.find((row) => row.id === bulkEditState.values.unitId) || null;
            nextItem.unitId = bulkEditState.values.unitId;
            nextItem.unit = unit?.abbreviation || "";
          }
        }

        if (bulkEditState.touched.rateOverride) {
          nextItem.rateOverride = bulkEditState.values.rateOverride;
        }

        return nextItem;
      }),
    }));

    closeBulkEdit();
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
    if (!cleanText(draft.assemblyElement)) {
      errors.push("Element is required.");
    }
    if (!cleanText(draft.assemblyScope)) {
      errors.push("Scope is required.");
    }
    if (!cleanText(draft.assemblyName)) {
      errors.push("Generated Assembly Name is required.");
    }
    if (!draft.roomTypeId) {
      errors.push("Room Type is required.");
    }
    if (!cleanText(draft.assemblyGroup)) {
      errors.push("Assembly Group is required.");
    }
    if (
      cleanText(draft.assemblyGroup) &&
      !isAssemblyGroupDefined(draft.assemblyGroup, normalizedAssemblies, managedAssemblyGroups)
    ) {
      errors.push("Assembly Group must come from the managed assembly group list.");
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
      if (item.isCustomItem && !cleanText(item.tradeId || item.trade)) {
        errors.push(`${label}: Trade is required.`);
      }
      if (item.isCustomItem && !cleanText(item.costCodeId || item.costCode)) {
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
    nextDraft.assemblySpec = createCopyName(sourceAssembly.assemblySpec, "Copy");
    nextDraft.assemblyName = buildAssemblyName(
      nextDraft.assemblyElement,
      nextDraft.assemblyScope,
      nextDraft.assemblySpec
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
          const notes = cleanText(row.Notes);

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
          if (notes && !group.notes) {
            group.notes = notes;
          }
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
        const mergeResult = applyImportMode({
          existingItems: normalizedAssemblies,
          importedItems: nextAssemblies,
          mode: importMode,
          getMatchKey: (existing, incoming) =>
            (cleanText(existing.id) && cleanText(existing.id) === cleanText(incoming.id)) ||
            (cleanText(existing.assemblyName) === cleanText(incoming.assemblyName) &&
              cleanText(existing.roomType) === cleanText(incoming.roomType) &&
              cleanText(existing.assemblyGroup) === cleanText(incoming.assemblyGroup)),
          shouldConfirmOverride: () =>
            typeof window === "undefined" ||
            window.confirm("Override all existing Assembly Library items with the imported CSV?"),
        });

        if (!mergeResult) {
          return;
        }

        onAssembliesChange(mergeResult.items);
        setCsvStatus(
          `${mergeResult.summary.added} added, ${mergeResult.summary.replaced} replaced, ${
            skippedRows + mergeResult.summary.skipped
          } skipped.`
        );
    } catch (error) {
      setCsvStatus("Unable to import CSV. Please choose a valid CSV file.");
    }
  };

  const namingGuidance =
    draft.assemblyName || draft.assemblyElement || draft.assemblyScope || draft.assemblySpec
      ? buildAssemblyName(draft.assemblyElement, draft.assemblyScope, draft.assemblySpec)
      : "";
  const selectedAssemblyGroupLabel = draft.assemblyGroup || "No group selected";
  const selectedAssemblyGroupFilterLabel = assemblyGroupFilter || "All groups";

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
                <div className="assembly-library-name-field">
                  <select
                    className="assembly-library-group-select"
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
                  <p className="assembly-library-selected-value">
                    Selected: {selectedAssemblyGroupFilterLabel}
                  </p>
                </div>
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
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssemblies.map((assembly) => {
                      const isActive = editorState.assemblyId === assembly.id;
                      const isSelected = selectedAssemblyIds.includes(assembly.id);
                      const coreItemsSummary = getAssemblyCoreItemsSummary(assembly, costLookupById);
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
                          <td>
                            <div className="assembly-library-name-display">
                              {assembly.imageUrl ? (
                                <img
                                  className="library-image-thumb"
                                  src={assembly.imageUrl}
                                  alt=""
                                  loading="lazy"
                                />
                              ) : null}
                              <span className="assembly-library-name-fulltext">
                                {assembly.assemblyName}
                              </span>
                              <div className="assembly-library-name-main">
                                {assembly.assemblyName || "Untitled Assembly"}
                              </div>
                              {coreItemsSummary ? (
                                <div className="assembly-library-name-secondary" title={coreItemsSummary}>
                                  {coreItemsSummary}
                                </div>
                              ) : null}
                            </div>
                          </td>
                          <td>{assembly.roomType || "Unassigned"}</td>
                          <td>{assembly.assemblyGroup || "Unassigned"}</td>
                          <td>{assembly.items.length}</td>
                          <td>
                            <div className="action-row assembly-library-row-icon-actions">
                              <button
                                type="button"
                                className="secondary-button assembly-library-icon-button"
                                aria-label={`Manage Items for ${assembly.assemblyName}`}
                                title="Manage Items"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditEditor(assembly, { openItemsManager: true });
                                }}
                              >
                                ::
                              </button>
                              <button
                                type="button"
                                className="danger-button assembly-library-icon-button"
                                aria-label={`Delete ${assembly.assemblyName}`}
                                title="Delete Assembly"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  deleteAssembly(assembly.id);
                                }}
                              >
                                X
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
                  <div className="field">
                    <label htmlFor="assembly-element-input">Element</label>
                    <div className="assembly-library-name-field">
                      <input
                        id="assembly-element-input"
                        list="assembly-element-options"
                        value={draft.assemblyElement}
                        onChange={(event) =>
                          updateAssemblyField("assemblyElement", event.target.value)
                        }
                        placeholder="e.g. Wall"
                      />
                      <datalist id="assembly-element-options">
                        {activeElements.map((element) => (
                          <option key={element.id} value={element.name} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                  <FormField label="Scope">
                    <input
                      value={draft.assemblyScope}
                      onChange={(event) =>
                        updateAssemblyField("assemblyScope", event.target.value)
                      }
                      placeholder="e.g. Villaboard Lining"
                    />
                  </FormField>
                  <FormField label="Optional Spec">
                    <input
                      value={draft.assemblySpec}
                      onChange={(event) =>
                        updateAssemblyField("assemblySpec", event.target.value)
                      }
                      placeholder="e.g. 900mm"
                    />
                  </FormField>
                  <div className="field">
                    <label htmlFor="assembly-name-input">Assembly Name</label>
                    <div className="assembly-library-name-field">
                      <input
                        id="assembly-name-input"
                        value={draft.assemblyName}
                        readOnly
                        placeholder="Generated from Element, Scope, and Optional Spec"
                        aria-describedby="assembly-name-format-hint"
                      />
                      <p id="assembly-name-format-hint" className="assembly-library-field-hint">
                        Generated automatically as: Element  Scope  Optional Spec
                      </p>
                      {namingGuidance ? (
                        <p className="assembly-library-selected-value">
                          Preview: {namingGuidance}
                        </p>
                      ) : null}
                    </div>
                  </div>
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
                  <div className="field">
                    <label htmlFor="assembly-group-select">Assembly Group</label>
                    <div className="assembly-library-group-field">
                      <select
                        id="assembly-group-select"
                        className="assembly-library-group-select"
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
                      <button
                        type="button"
                        className="secondary-button assembly-library-manage-button"
                        onClick={openGroupManager}
                      >
                        Manage Groups
                      </button>
                    </div>
                    <p className="assembly-library-selected-value">
                      Selected: {selectedAssemblyGroupLabel}
                    </p>
                  </div>
                  <FormField label="Image URL">
                    <input
                      value={draft.imageUrl || ""}
                      onChange={(event) =>
                        updateAssemblyField("imageUrl", event.target.value)
                      }
                      placeholder="https://example.com/assembly-image.jpg"
                    />
                  </FormField>
                </div>
                {draft.imageUrl ? (
                  <div className="library-image-preview">
                    <img src={draft.imageUrl} alt="" loading="lazy" />
                  </div>
                ) : null}
              </div>

              <div className="summary-section room-template-compact-section assembly-library-editor-section assembly-library-editor-section-notes">
                <div className="assembly-library-compact-header">
                  <div>
                    <h3>Notes / Setup</h3>
                    <p>Optional scope notes for assembly-specific context.</p>
                  </div>
                  <button
                    type="button"
                    className="secondary-button assembly-library-manage-button"
                    onClick={() => setIsNotesExpanded((current) => !current)}
                  >
                    {isNotesExpanded || draft.notes ? "Hide Notes" : "Add Notes"}
                  </button>
                </div>
                {isNotesExpanded || draft.notes ? (
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
                ) : (
                  <p className="assembly-library-status">
                    Notes are hidden until needed.
                  </p>
                )}
              </div>

              <div className="summary-section room-template-compact-section assembly-library-editor-section assembly-library-editor-section-items">
                <div className="assembly-library-compact-header">
                  <div>
                    <h3>Assembly Items</h3>
                    <p>
                      Manage linked and custom items in a wider editor so the list and
                      item details stay readable.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={openItemsManager}
                  >
                    Manage Assembly Items
                  </button>
                </div>
                <div className="assembly-library-items-summary">
                  <div className="assembly-library-items-summary-card">
                    <strong>{draft.items.length}</strong>
                    <span>Total items</span>
                  </div>
                  <div className="assembly-library-items-summary-card">
                    <strong>{draft.items.filter((item) => !item.isCustomItem).length}</strong>
                    <span>Linked items</span>
                  </div>
                  <div className="assembly-library-items-summary-card">
                    <strong>{draft.items.filter((item) => item.isCustomItem).length}</strong>
                    <span>Custom items</span>
                  </div>
                </div>
                <p className="assembly-library-status">
                  Linked items stay read-only for inherited fields. Custom items keep editable trade and cost code fields.
                </p>
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
      {groupManagerState.isOpen ? (
        <div
          className="assembly-library-drawer-backdrop assembly-library-modal-backdrop"
          onClick={closeGroupManager}
        >
          <div
            className="assembly-library-drawer assembly-library-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="assembly-library-drawer-header">
              <div>
                <p className="assembly-library-drawer-kicker">Assembly Groups</p>
                <h3>Manage Groups</h3>
              </div>
              <button type="button" className="secondary-button" onClick={closeGroupManager}>
                Close
              </button>
            </div>
            <div className="assembly-library-drawer-form">
              <div className="assembly-library-drawer-section">
                <div className="field">
                  <label htmlFor="assembly-group-add-input">Add Group</label>
                  <div className="assembly-library-group-field">
                    <input
                      id="assembly-group-add-input"
                      autoFocus
                      value={groupManagerState.newGroupName}
                      onChange={(event) =>
                        setGroupManagerState((current) => ({
                          ...current,
                          newGroupName: event.target.value,
                        }))
                      }
                      placeholder="e.g. Ceilings"
                    />
                    <button
                      type="button"
                      className="primary-button assembly-library-manage-button"
                      onClick={addManagedAssemblyGroup}
                    >
                      Add Group
                    </button>
                  </div>
                </div>
                <p className="assembly-library-field-hint">
                  Groups in use stay available automatically. Added groups are shared across Assembly Library filters and editors on this device.
                </p>
              </div>
              <div className="assembly-library-group-list">
                {assemblyGroupOptions.map((groupName) => {
                  const isInUse = normalizedAssemblies.some(
                    (assembly) => assembly.assemblyGroup === groupName
                  );
                  const isEditing = groupManagerState.editingGroupName === groupName;
                  const isProtectedGroup = groupName === unassignedAssemblyGroupName;
                  return (
                    <div key={groupName} className="assembly-library-group-row">
                      <div className="assembly-library-group-row-main">
                        {isEditing ? (
                          <div className="assembly-library-group-edit-row">
                            <input
                              autoFocus
                              value={groupManagerState.editValue}
                              onChange={(event) =>
                                setGroupManagerState((current) => ({
                                  ...current,
                                  editValue: event.target.value,
                                  error: "",
                                }))
                              }
                              placeholder="Assembly group name"
                            />
                          </div>
                        ) : (
                          <>
                            <strong>{groupName}</strong>
                            <p>
                              {isProtectedGroup
                                ? "Fallback group for deleted or unassigned assemblies"
                                : isInUse
                                ? "In use by existing assemblies"
                                : "Available for new assemblies"}
                            </p>
                          </>
                        )}
                      </div>
                      <span
                        className={`assembly-library-source-badge ${
                          isProtectedGroup
                            ? "is-protected"
                            : isInUse
                              ? "is-linked"
                              : "is-custom"
                        }`}
                      >
                        {isProtectedGroup ? "Protected" : isInUse ? "In Use" : "Managed"}
                      </span>
                      <div className="assembly-library-group-row-actions">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              className="secondary-button assembly-library-icon-button"
                              aria-label={`Save ${groupName}`}
                              title="Save"
                              onClick={() => saveManagedAssemblyGroupRename(groupName)}
                            >
                              S
                            </button>
                            <button
                              type="button"
                              className="secondary-button assembly-library-icon-button"
                              aria-label={`Cancel rename for ${groupName}`}
                              title="Cancel"
                              onClick={stopEditingManagedAssemblyGroup}
                            >
                              X
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="secondary-button assembly-library-icon-button"
                              aria-label={`Rename ${groupName}`}
                              title="Rename"
                              onClick={() => startEditingManagedAssemblyGroup(groupName)}
                              disabled={isProtectedGroup}
                            >
                              R
                            </button>
                            <button
                              type="button"
                              className="danger-button assembly-library-icon-button"
                              aria-label={`Delete ${groupName}`}
                              title="Delete"
                              onClick={() => removeManagedAssemblyGroup(groupName)}
                              disabled={isProtectedGroup}
                            >
                              D
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {groupManagerState.error ? (
                <p className="assembly-library-validation-note">{groupManagerState.error}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {isItemsManagerOpen ? (
        <div
          className="assembly-library-drawer-backdrop assembly-library-modal-backdrop"
          onClick={closeItemsManager}
        >
          <div
            className="assembly-library-drawer assembly-library-modal assembly-library-item-modal assembly-library-items-manager-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="assembly-library-drawer-header">
              <div>
                <p className="assembly-library-drawer-kicker">Assembly Items</p>
                <h3>Manage Assembly Items</h3>
              </div>
              <button type="button" className="secondary-button" onClick={closeItemsManager}>
                Close
              </button>
            </div>
            <div className="assembly-library-drawer-form">
              <div className="assembly-library-items-manager-toolbar">
                <div className="action-row assembly-library-inline-actions">
                  <button type="button" className="primary-button" onClick={openCostPicker}>
                    Add from Cost Library
                  </button>
                  <button
                    type="button"
                    className="secondary-button assembly-library-create-cost-button"
                    onClick={openNewCostItemEditor}
                  >
                    Create New Cost Item
                  </button>
                  <button type="button" className="secondary-button" onClick={addCustomItem}>
                    Add Custom Item
                  </button>
                </div>
                <label className="assembly-library-select-all">
                  <input
                    type="checkbox"
                    checked={allEditorItemsSelected}
                    aria-label="Select all assembly items"
                    onChange={toggleSelectAllItems}
                  />
                  <span>Select all</span>
                </label>
              </div>
              {newCostItemState.notice ? (
                <p className="assembly-library-items-manager-notice">
                  {newCostItemState.notice}
                </p>
              ) : null}
              {selectedEditorItemIds.length ? (
                <div className="assembly-library-items-bulk-bar">
                  <span className="assembly-library-items-bulk-count">
                    {selectedEditorItemIds.length} selected
                  </span>
                  <div className="action-row assembly-library-inline-actions">
                    <button type="button" className="secondary-button" onClick={openBulkEdit}>
                      Bulk Edit
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={duplicateSelectedItems}
                    >
                      Duplicate Selected
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={deleteSelectedItems}
                    >
                      Delete Selected Items
                    </button>
                  </div>
                </div>
              ) : null}
              {bulkEditState.isOpen ? (
                <div className="assembly-library-items-bulk-editor">
                  <div className="assembly-library-item-detail-header">
                    <div>
                      <p className="assembly-library-drawer-kicker">Bulk Edit</p>
                      <h3>Selected Items</h3>
                    </div>
                    <div className="assembly-library-item-detail-actions">
                      <button type="button" className="secondary-button" onClick={closeBulkEdit}>
                        Cancel
                      </button>
                      <button type="button" className="primary-button" onClick={applyBulkEdit}>
                        Apply Changes
                      </button>
                    </div>
                  </div>
                  <div className="form-grid room-template-fields-grid room-template-fields-grid-compact">
                    <FormField label="Cost Type">
                      <select
                        value={bulkEditState.values.costType}
                        onChange={(event) => updateBulkEditField("costType", event.target.value)}
                      >
                        <option value={BULK_EDIT_UNCHANGED}>Mixed / keep existing</option>
                        {costTypeOptions.map((costType) => (
                          <option key={costType} value={costType}>
                            {costType}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Delivery Type">
                      <select
                        value={bulkEditState.values.deliveryType}
                        onChange={(event) => updateBulkEditField("deliveryType", event.target.value)}
                      >
                        <option value={BULK_EDIT_UNCHANGED}>Mixed / keep existing</option>
                        {deliveryTypeOptions.map((deliveryType) => (
                          <option key={deliveryType} value={deliveryType}>
                            {deliveryType}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Trade">
                      <select
                        value={bulkEditState.values.tradeId}
                        onChange={(event) => updateBulkEditField("tradeId", event.target.value)}
                      >
                        <option value={BULK_EDIT_UNCHANGED}>Mixed / keep existing</option>
                        {activeTrades.map((trade) => (
                          <option key={trade.id} value={trade.id}>
                            {trade.name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Cost Code">
                      <select
                        value={bulkEditState.values.costCodeId}
                        onChange={(event) => updateBulkEditField("costCodeId", event.target.value)}
                      >
                        <option value={BULK_EDIT_UNCHANGED}>Mixed / keep existing</option>
                        {activeCostCodes.map((costCode) => (
                          <option key={costCode.id} value={costCode.id}>
                            {costCode.name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Unit">
                      <select
                        value={bulkEditState.values.unitId}
                        onChange={(event) => updateBulkEditField("unitId", event.target.value)}
                      >
                        <option value={BULK_EDIT_UNCHANGED}>Mixed / keep existing</option>
                        {activeUnits.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.abbreviation}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Override Rate">
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={bulkEditState.values.rateOverride}
                        placeholder="Mixed / leave unchanged"
                        onChange={(event) => updateBulkEditField("rateOverride", event.target.value)}
                      />
                    </FormField>
                  </div>
                </div>
              ) : null}
              <div className="assembly-library-items-manager-layout">
                <div className="assembly-library-items-manager-list-pane">
                  <div className="assembly-library-items-manager-list">
                      {draft.items.length ? (
                        draft.items.map((item) => {
                          const isActive = editorState.activeItemId === item.id;
                          const isSelected = selectedItemIds.includes(item.id);
                          const tradeLabel = getTradeLabel(item.trade);
                          return (
                            <div
                              key={item.id}
                              className={`assembly-library-manager-card${
                                isActive ? " is-active" : ""
                              }${isSelected ? " is-selected" : ""}${
                                item.isCustomItem ? " is-custom-item" : ""
                              }${
                                dragState.overItemId === item.id ? " is-drag-over" : ""
                              }`}
                              draggable
                              onClick={() => selectItemRow(item.id)}
                              onDragStart={() => handleItemDragStart(item.id)}
                              onDragEnter={() => handleItemDragEnter(item.id)}
                              onDragOver={(event) => event.preventDefault()}
                              onDragEnd={clearItemDragState}
                              onDrop={() => handleItemDrop(item.id)}
                            >
                              <div
                                className="assembly-library-manager-card-handle"
                                aria-label={`Reorder ${item.itemNameSnapshot || item.itemName}`}
                              >
                                ::
                              </div>
                              <div className="assembly-library-manager-card-toggle">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  aria-label={`Select ${item.itemNameSnapshot || item.itemName}`}
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={() => toggleItemSelection(item.id)}
                                />
                              </div>
                              <div className="assembly-library-manager-card-body">
                                <div className="assembly-library-manager-card-title">
                                  {item.itemNameSnapshot || item.itemName || "Untitled Item"}
                                </div>
                                <div className="assembly-library-manager-card-meta">
                                  <span>{item.costType || "Unassigned"}</span>
                                  <span
                                    className={`assembly-library-delivery-tag ${getDeliveryTypeTagClassName(
                                      item.deliveryType
                                    )}`}
                                  >
                                    {item.deliveryType || "Unassigned"}
                                  </span>
                                  <span>{item.unit || "Unassigned"}</span>
                                  <span>{formatCurrencyLabel(item.baseRate)}</span>
                                  <span
                                    className={
                                      tradeLabel === "Unassigned"
                                        ? "assembly-library-manager-meta-muted"
                                        : ""
                                    }
                                  >
                                    {tradeLabel}
                                  </span>
                                  <span
                                    className={`assembly-library-source-badge ${
                                      item.isCustomItem ? "is-custom" : "is-linked"
                                    }`}
                                  >
                                    {item.isCustomItem ? "Custom" : "Linked"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="empty-state">No cost items added yet.</p>
                      )}
                    </div>
                  </div>
                  {activeItem ? (
                  <>
                    <div
                      className={`assembly-library-item-detail assembly-library-item-detail-locked${
                        activeItem.isCustomItem ? " is-custom-item" : ""
                      }`}
                    >
                      <div className="assembly-library-item-detail-header">
                        <div>
                          <p className="assembly-library-drawer-kicker">Locked / Inherited</p>
                          <h3>Library Fields</h3>
                        </div>
                      </div>
                      {activeItem.isCustomItem ? (
                        <div className="assembly-library-custom-mode-banner">
                          <span className="assembly-library-source-badge is-custom">
                            Custom Item Mode
                          </span>
                          <p>
                            This item is assembly-only and will not be saved to the Cost Library.
                          </p>
                        </div>
                      ) : null}
                      <div className="form-grid room-template-fields-grid room-template-fields-grid-compact">
                        <FormField label="Item Name">
                          <input
                            value={activeItem.itemNameSnapshot}
                            readOnly={!activeItem.isCustomItem}
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
                          <input value={activeItem.isCustomItem ? "Custom" : "Linked"} readOnly />
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
                            <input value={activeItem.costType || "Unassigned"} readOnly />
                          )}
                        </FormField>
                        <FormField label="Delivery Type">
                          {activeItem.isCustomItem ? (
                            <select
                              value={activeItem.deliveryType}
                              onChange={(event) =>
                                updateItemField(activeItem.id, "deliveryType", event.target.value)
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
                            <input value={activeItem.deliveryType || "Unassigned"} readOnly />
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
                                updateItemField(activeItem.id, "costCodeId", event.target.value)
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
                            <input value={getCostCodeLabel(activeItem.costCode)} readOnly />
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
                            <input value={activeItem.unit || "Unassigned"} readOnly />
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
                        <FormField label="Link ID">
                          <input value={activeItem.libraryItemId || "Unassigned"} readOnly />
                        </FormField>
                      </div>
                    </div>
                    <div
                      className={`assembly-library-item-detail assembly-library-item-detail-editable${
                        activeItem.isCustomItem ? " is-custom-item" : ""
                      }`}
                    >
                      <div className="assembly-library-item-detail-header">
                        <div>
                          <p className="assembly-library-drawer-kicker">Editable</p>
                          <h3>Assembly Use Fields</h3>
                        </div>
                        <div className="assembly-library-item-detail-actions">
                          <button
                            type="button"
                            className="secondary-button assembly-library-icon-button"
                            aria-label="Duplicate Item"
                            title="Duplicate Item"
                            onClick={() => duplicateItemRow(activeItem.id)}
                          >
                            ⧉
                          </button>
                          <button
                            type="button"
                            className="danger-button assembly-library-icon-button"
                            aria-label="Delete Item"
                            title="Delete Item"
                            onClick={() => {
                              if (
                                typeof window !== "undefined" &&
                                !window.confirm("Delete this item row?")
                              ) {
                                return;
                              }
                              removeItemRow(activeItem.id);
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      <div className="form-grid room-template-fields-grid room-template-fields-grid-compact">
                        <div className="field">
                          <label>Quantity Formula</label>
                          <div className="assembly-library-quantity-field">
                            {!isAdvancedQtyFormulaMode ? (
                              <div className="assembly-library-quantity-builder">
                                <div className="assembly-library-quantity-builder-grid">
                                  <FormField label="Base Parameter">
                                    <select
                                      value={activeQuantityFormulaConfig.baseParameter}
                                      onChange={(event) =>
                                        updateGuidedQuantityFormula("baseParameter", event.target.value)
                                      }
                                    >
                                      <option value="">Select parameter</option>
                                      {quantityFormulaOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label} ({option.value})
                                        </option>
                                      ))}
                                    </select>
                                  </FormField>
                                  <FormField label="Operator">
                                    <select
                                      value={activeQuantityFormulaConfig.operator || "*"}
                                      onChange={(event) =>
                                        updateGuidedQuantityFormula("operator", event.target.value)
                                      }
                                    >
                                      <option value="*">*</option>
                                      <option value="/">/</option>
                                      <option value="+">+</option>
                                      <option value="-">-</option>
                                    </select>
                                  </FormField>
                                  <FormField label="Factor">
                                    <input
                                      type="number"
                                      step="0.01"
                                      inputMode="decimal"
                                      value={activeQuantityFormulaConfig.factor || ""}
                                      placeholder="Optional"
                                      onChange={(event) =>
                                        updateGuidedQuantityFormula("factor", event.target.value)
                                      }
                                    />
                                  </FormField>
                                </div>
                                <p className="assembly-library-quantity-preview">
                                  {buildQuantityFormula(
                                    activeQuantityFormulaConfig.baseParameter,
                                    activeQuantityFormulaConfig.operator,
                                    activeQuantityFormulaConfig.factor
                                  ) || "Select a parameter to build the formula"}
                                </p>
                              </div>
                            ) : (
                              <input
                                value={activeItem.quantityFormula || ""}
                                placeholder="e.g. floorArea * 1.1"
                                onChange={(event) =>
                                  updateItemField(activeItem.id, "quantityFormula", event.target.value)
                                }
                              />
                            )}
                            <button
                              type="button"
                              className="secondary-button assembly-library-inline-toggle"
                              onClick={() =>
                                setIsAdvancedQtyFormulaMode((current) => !current)
                              }
                            >
                              {isAdvancedQtyFormulaMode ? "Use Guided Builder" : "Use Advanced Formula"}
                            </button>
                            <p className="assembly-library-field-hint">
                              Choose from predefined room metrics and parameter library values, then add
                              an optional operator and factor.
                            </p>
                          </div>
                        </div>
                        <FormField label="Override Rate">
                          <input
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            value={activeItem.rateOverride ?? ""}
                            placeholder="Leave blank to use base rate"
                            onChange={(event) =>
                              updateItemField(activeItem.id, "rateOverride", event.target.value)
                            }
                          />
                        </FormField>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="assembly-library-item-detail assembly-library-item-detail-empty">
                    <h3>Selected Item</h3>
                    <p className="empty-state">
                      Select an item to view inherited details and edit quantity and override rate.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {newCostItemState.isOpen ? (
        <div
          className="assembly-library-nested-backdrop"
          onClick={closeNewCostItemEditor}
        >
          <div
            className="assembly-library-nested-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <form className="assembly-editor-panel cost-library-editor" onSubmit={saveNewCostItem}>
              <div className="summary-section room-template-editor-header cost-library-editor-header">
                <div>
                  <p className="room-template-editor-kicker">Assembly Workflow</p>
                  <h3>Create Cost Item</h3>
                  <p className="cost-library-editor-subtitle">
                    Save a reusable Cost Library item, then link it to this assembly immediately.
                  </p>
                </div>
                <div className="room-template-editor-header-meta">
                  <span className="room-template-selected-badge">
                    {newCostItemState.draft.trade || "Unassigned Trade"}
                  </span>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={closeNewCostItemEditor}
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
                      value={newCostItemState.draft.itemName}
                      onChange={(event) =>
                        updateNewCostDraftField("itemName", event.target.value)
                      }
                      placeholder="Floor Tile"
                    />
                  </FormField>

                  <FormField label="Item Name">
                    <input value={newCostItemState.draft.itemName || ""} readOnly />
                  </FormField>

                  <FormField label="Status">
                    <select
                      value={newCostItemState.draft.status}
                      onChange={(event) =>
                        updateNewCostDraftField("status", event.target.value)
                      }
                    >
                      {costStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Image URL">
                    <input
                      value={newCostItemState.draft.imageUrl || ""}
                      onChange={(event) =>
                        updateNewCostDraftField("imageUrl", event.target.value)
                      }
                      placeholder="https://example.com/item-image.jpg"
                    />
                  </FormField>
                </div>
                {newCostItemState.draft.imageUrl ? (
                  <div className="library-image-preview">
                    <img src={newCostItemState.draft.imageUrl} alt="" loading="lazy" />
                  </div>
                ) : null}
              </div>

              <div className="summary-section room-template-compact-section cost-library-editor-section cost-library-editor-section-classification">
                <h3>Classification</h3>
                <div className="form-grid room-template-fields-grid room-template-fields-grid-compact">
                  <FormField label="Cost Type">
                    <select
                      value={newCostItemState.draft.costType}
                      onChange={(event) =>
                        updateNewCostDraftField("costType", event.target.value)
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
                      value={newCostItemState.draft.deliveryType}
                      onChange={(event) =>
                        updateNewCostDraftField("deliveryType", event.target.value)
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
                      value={newCostItemState.draft.itemFamily}
                      onChange={(event) =>
                        updateNewCostDraftField("itemFamily", event.target.value)
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
                      value={newCostItemState.draft.tradeId}
                      onChange={(event) =>
                        updateNewCostDraftField("tradeId", event.target.value)
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
                      value={newCostItemState.draft.costCodeId}
                      onChange={(event) =>
                        updateNewCostDraftField("costCodeId", event.target.value)
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
                      value={newCostItemState.draft.specification}
                      onChange={(event) =>
                        updateNewCostDraftField("specification", event.target.value)
                      }
                      placeholder="600x600"
                    />
                  </FormField>

                  <FormField label="Grade">
                    <input
                      value={newCostItemState.draft.gradeOrQuality}
                      onChange={(event) =>
                        updateNewCostDraftField("gradeOrQuality", event.target.value)
                      }
                      placeholder="Premium"
                    />
                  </FormField>

                  <FormField label="Finish">
                    <input
                      value={newCostItemState.draft.finishOrVariant}
                      onChange={(event) =>
                        updateNewCostDraftField("finishOrVariant", event.target.value)
                      }
                      placeholder="Matt"
                    />
                  </FormField>

                  <FormField label="Brand">
                    <input
                      value={newCostItemState.draft.brand}
                      onChange={(event) =>
                        updateNewCostDraftField("brand", event.target.value)
                      }
                      placeholder="ABC"
                    />
                  </FormField>

                  <FormField label="Source Link">
                    <input
                      value={newCostItemState.draft.sourceLink}
                      onChange={(event) =>
                        updateNewCostDraftField("sourceLink", event.target.value)
                      }
                      placeholder="https://supplier.example/item"
                    />
                  </FormField>

                  <FormField label="Notes">
                    <textarea
                      rows={4}
                      value={newCostItemState.draft.notes}
                      onChange={(event) =>
                        updateNewCostDraftField("notes", event.target.value)
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
                      value={newCostItemState.draft.unitId}
                      onChange={(event) =>
                        updateNewCostDraftField("unitId", event.target.value)
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
                      value={newCostItemState.draft.rate}
                      onChange={(event) =>
                        updateNewCostDraftField("rate", event.target.value)
                      }
                    />
                  </FormField>
                </div>
              </div>

              {newCostItemState.validationErrors.length ? (
                <div className="summary-section room-template-compact-section assembly-library-validation">
                  {newCostItemState.validationErrors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              ) : null}

              <div className="assembly-library-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeNewCostItemEditor}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  Save to Cost Library and Add to Assembly
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
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
              <div className="action-row">
                <button
                  type="button"
                  className="primary-button"
                  onClick={addSelectedLinkedCostItems}
                  disabled={!costPickerState.selectedCostIds.length}
                >
                  Add Selected
                  {costPickerState.selectedCostIds.length
                    ? ` (${costPickerState.selectedCostIds.length})`
                    : ""}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeCostPicker}
                >
                  Close
                </button>
              </div>
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
            <div className="assembly-library-picker-toolbar">
              <label className="assembly-library-select-all">
                <input
                  type="checkbox"
                  checked={allFilteredPickerCostsSelected}
                  aria-label="Select all visible cost items"
                  onChange={toggleSelectAllPickerCosts}
                />
                <span>Select all</span>
              </label>
              <span className="assembly-library-items-bulk-count">
                {costPickerState.selectedCostIds.length} selected
              </span>
            </div>

            <div className="assembly-library-picker-results">
              {filteredPickerCosts.length ? (
                filteredPickerCosts.map((cost) => {
                  const presentation = getStructuredItemPresentation(cost);
                  const isSelected = costPickerState.selectedCostIds.includes(cost.id);
                  return (
                    <button
                      key={cost.id}
                      type="button"
                      className={`assembly-library-picker-row${isSelected ? " is-selected" : ""}`}
                      onClick={() => togglePickerCostSelection(cost.id)}
                    >
                      <span className="assembly-library-picker-checkbox">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          aria-label={`Select ${presentation.primaryLabel}`}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => togglePickerCostSelection(cost.id)}
                        />
                      </span>
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
