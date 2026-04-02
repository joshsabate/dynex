import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";
import { normalizeAssemblies } from "../utils/assemblies";
import {
  getBuilderDebugRowUpdates,
  isBuilderDebugEnabled,
  logBuilderDebugRowUpdate,
  recordBuilderDebugRowUpdate,
  setBuilderDebugEnabled,
} from "../utils/builderDebug";
import { getStageDisplayName, getStageSortOrder } from "../utils/stages";
import { getAssemblyGroupId, getAssemblyGroups } from "../utils/assemblyGroups";
import { getStructuredItemPresentation, getWorkTypeTone, workTypeOptions } from "../utils/itemNaming";
import { instantiateRoomTemplate } from "../utils/roomTemplates";
import { getDefaultStageId, getStageIntegrity } from "../utils/stageIntegrity";
import { getUnitAbbreviation, isHourUnit } from "../utils/units";

const defaultSectionForm = {
  name: "",
  parentSectionId: "",
  sortOrder: "1",
};

const defaultManualLineForm = {
  itemName: "",
  displayNameOverride: "",
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
  sourceLink: "",
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
  sourceLink: "",
  stageId: "",
  costCodeId: "",
  tradeId: "",
  elementId: "",
};

const defaultToolbarFilters = {
  workType: "",
  tradeId: "",
  itemFamily: "",
  stageId: "",
};

const builderGroupOptions = [
  { value: "none", label: "None" },
  { value: "itemFamily", label: "Family" },
  { value: "stage", label: "Stage" },
  { value: "trade", label: "Trade" },
  { value: "workType", label: "Work Type" },
];

const estimateSortOptions = [
  { value: "sortOrder", label: "Sort Order" },
  { value: "item", label: "Item Name" },
  { value: "workType", label: "Work Type" },
  { value: "stage", label: "Stage" },
  { value: "trade", label: "Trade" },
  { value: "room", label: "Room" },
  { value: "assembly", label: "Assembly" },
];

const estimateBuilderColumnStorageKey = "estimate-builder-column-widths-v3";
const defaultEstimateColumnWidths = {
  coreName: 110,
  detailedName: 620,
  workType: 96,
  stage: 92,
  trade: 98,
  costCode: 122,
  quantity: 56,
  unit: 64,
  rate: 74,
  total: 108,
  actions: 176,
};
const minimumEstimateColumnWidths = {
  coreName: 110,
  detailedName: 360,
  workType: 96,
  stage: 92,
  trade: 98,
  costCode: 122,
  quantity: 56,
  unit: 64,
  rate: 74,
  total: 108,
  actions: 176,
};

const internalLabourTradeMatchers = ["carpentry", "supervision", "trade support"];
const tradeCostCodeAliasRules = [
  {
    tradeMatchers: ["electrical"],
    costCodeMatchers: ["electrical", "15"],
  },
  {
    tradeMatchers: ["joinery", "stone", "cabinet", "cabinetry"],
    costCodeMatchers: ["joinery", "cabinet", "stone", "20"],
  },
];

function createDefaultSectionCostItemForm(sectionStageId = "") {
  return {
    searchTerm: "",
    costId: "",
    quantity: "1",
    notes: "",
    sourceLink: "",
    stageId: sectionStageId,
    costCodeId: "",
    tradeId: "",
    elementId: "",
  };
}

function createDefaultSectionAssemblyForm(sectionStageId = "") {
  return {
    searchTerm: "",
    assemblyId: "",
    stageId: sectionStageId,
  };
}

function toNumber(value, fallback = 0) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function cleanText(value) {
  return String(value || "").trim();
}

function getDefaultWorkTypeFromCost(cost, units) {
  if (!cost) {
    return "";
  }

  return cleanText(cost.workType) || (isHourUnit(units, cost.unitId, cost.unit) ? "Labour" : "");
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

function getBuilderDebugSourceType(row) {
  if (row.sourceAssemblyId || row.assemblyId) {
    return "assembly";
  }

  if (row.sourceCostItemId) {
    return "costItem";
  }

  return "manual";
}

function renderIconActionButton({
  label,
  icon,
  className = "secondary-button",
  onClick,
  disabled = false,
}) {
  return (
    <button
      type="button"
      className={`estimate-builder-icon-button ${className}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}

function normalizeMatchText(value) {
  return cleanText(value).toLowerCase();
}

const estimateColumns = [
  { key: "coreName", label: "Core Item", className: "estimate-builder-col-core" },
  { key: "detailedName", label: "Detailed Item", className: "estimate-builder-col-detail" },
  { key: "workType", label: "Work Type", className: "estimate-builder-col-worktype" },
  { key: "stage", label: "Stage", className: "estimate-builder-col-stage" },
  { key: "trade", label: "Trade", className: "estimate-builder-col-trade" },
  { key: "costCode", label: "Cost Code", className: "estimate-builder-col-cost-code" },
  { key: "quantity", label: "Qty", className: "estimate-builder-col-qty" },
  { key: "unit", label: "Unit", className: "estimate-builder-col-unit" },
  { key: "rate", label: "Rate", className: "estimate-builder-col-rate" },
  { key: "total", label: "Line Total", className: "estimate-builder-col-total" },
  { key: "actions", label: "Actions", className: "estimate-builder-col-actions" },
];

const ESTIMATE_BUILDER_GRID_TEMPLATE =
  "110px minmax(620px, 1fr) 96px 92px 98px 122px 56px 64px 74px 108px 176px";
const ESTIMATE_SECTION_TONE_COUNT = 3;
const DEFAULT_GST_RATE = 0.1;

function getStoredEstimateColumnWidths() {
  if (typeof window === "undefined") {
    return defaultEstimateColumnWidths;
  }

  try {
    const parsedValue = JSON.parse(window.localStorage.getItem(estimateBuilderColumnStorageKey) || "{}");

    return Object.fromEntries(
      Object.entries(defaultEstimateColumnWidths).map(([key, value]) => [
        key,
        Math.max(minimumEstimateColumnWidths[key], Number(parsedValue[key]) || value),
      ])
    );
  } catch (error) {
    return defaultEstimateColumnWidths;
  }
}

function getStableSectionToneIndex(sectionId) {
  const normalizedId = cleanText(sectionId);

  if (!normalizedId) {
    return 0;
  }

  let hash = 0;
  for (let index = 0; index < normalizedId.length; index += 1) {
    hash = (hash * 31 + normalizedId.charCodeAt(index)) >>> 0;
  }

  return hash % ESTIMATE_SECTION_TONE_COUNT;
}

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
  topBarPortalTarget,
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
  const [builderSearchTerm, setBuilderSearchTerm] = useState("");
  const [builderFilters, setBuilderFilters] = useState(defaultToolbarFilters);
  const [builderSort, setBuilderSort] = useState({ key: "sortOrder", direction: "asc" });
  const [builderGroupBy, setBuilderGroupBy] = useState("none");
  const [activeRowPanel, setActiveRowPanel] = useState({ rowId: "", panel: "" });
  const [estimateColumnWidths, setEstimateColumnWidths] = useState(getStoredEstimateColumnWidths);
  const [activeColumnResize, setActiveColumnResize] = useState(null);
  const [lastSelectedStageId, setLastSelectedStageId] = useState("");
  const [debugMode, setDebugMode] = useState(() => isBuilderDebugEnabled());
  const [debugRowUpdates, setDebugRowUpdates] = useState(() => getBuilderDebugRowUpdates());
  const [flashingRowIds, setFlashingRowIds] = useState({});
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [markupPercent, setMarkupPercent] = useState("0");

  useEffect(() => {
    window.localStorage.setItem(
      estimateBuilderColumnStorageKey,
      JSON.stringify(estimateColumnWidths)
    );
  }, [estimateColumnWidths]);

  useEffect(() => {
    setBuilderDebugEnabled(debugMode);
  }, [debugMode]);

  useEffect(() => {
    if (!debugMode) {
      return undefined;
    }

    let previousUpdates = getBuilderDebugRowUpdates();
    setDebugRowUpdates(previousUpdates);
    const recentRowIds = Object.keys(previousUpdates).filter(
      (rowId) => Date.now() - Number(previousUpdates[rowId]?.updatedAt || 0) < 2500
    );

    if (recentRowIds.length) {
      setFlashingRowIds((current) => ({
        ...current,
        ...Object.fromEntries(recentRowIds.map((rowId) => [rowId, true])),
      }));
      recentRowIds.forEach((rowId) => {
        window.setTimeout(() => {
          setFlashingRowIds((current) => {
            const nextState = { ...current };
            delete nextState[rowId];
            return nextState;
          });
        }, 1800);
      });
    }

    const intervalId = window.setInterval(() => {
      const nextUpdates = getBuilderDebugRowUpdates();
      const changedRowIds = Object.keys(nextUpdates).filter(
        (rowId) => nextUpdates[rowId]?.updatedAt !== previousUpdates[rowId]?.updatedAt
      );

      if (changedRowIds.length) {
        setDebugRowUpdates(nextUpdates);
        setFlashingRowIds((current) => ({
          ...current,
          ...Object.fromEntries(changedRowIds.map((rowId) => [rowId, true])),
        }));
        changedRowIds.forEach((rowId) => {
          window.setTimeout(() => {
            setFlashingRowIds((current) => {
              const nextState = { ...current };
              delete nextState[rowId];
              return nextState;
            });
          }, 1800);
        });
        previousUpdates = nextUpdates;
      }
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [debugMode]);

  useEffect(() => {
    if (!activeColumnResize) {
      return undefined;
    }

    const handlePointerMove = (event) => {
      const nextWidth = Math.max(
        minimumEstimateColumnWidths[activeColumnResize.key],
        activeColumnResize.startWidth + (event.clientX - activeColumnResize.startX)
      );

      setEstimateColumnWidths((current) => ({
        ...current,
        [activeColumnResize.key]: nextWidth,
      }));
    };

    const handlePointerUp = () => {
      setActiveColumnResize(null);
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, [activeColumnResize]);

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

  useEffect(() => {
    if (!lastSelectedStageId && activeStages[0]?.id) {
      setLastSelectedStageId(activeStages[0].id);
    }
  }, [activeStages, lastSelectedStageId]);

  const resolvePreferredStageId = (preferredStageId = "") => {
    const preferredIntegrity = getStageIntegrity(preferredStageId, activeStages);

    if (preferredIntegrity.stageId) {
      return preferredIntegrity.stageId;
    }

    return getStageIntegrity(lastSelectedStageId, activeStages, "", {
      defaultStageId: getDefaultStageId(activeStages),
    }).stageId;
  };

  const emitRowDebugUpdate = (row, updatedFrom) => {
    if (!debugMode || !row?.id) {
      return;
    }

    const nextEntry = recordBuilderDebugRowUpdate(row, updatedFrom);
    logBuilderDebugRowUpdate(row, updatedFrom);
    setDebugRowUpdates((current) => ({
      ...current,
      [row.id]: nextEntry,
    }));
    setFlashingRowIds((current) => ({
      ...current,
      [row.id]: true,
    }));
    window.setTimeout(() => {
      setFlashingRowIds((current) => {
        const nextState = { ...current };
        delete nextState[row.id];
        return nextState;
      });
    }, 1800);
  };
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
  const normalizedAssemblyGroups = useMemo(
    () => normalizeAssemblies(assemblies, { units, costs: sortedCosts, trades, costCodes }),
    [assemblies, units, sortedCosts, trades, costCodes]
  );

  const getStageName = (stageId, fallback = "") =>
    getStageIntegrity(stageId, stages, fallback, { defaultStageId: getDefaultStageId(activeStages) })
      .stageName || fallback || "Unassigned";
  const getTradeName = (tradeId, fallback = "") =>
    trades.find((trade) => trade.id === tradeId)?.name || fallback || "Unassigned";
  const getCostCodeName = (costCodeId, fallback = "") =>
    costCodes.find((costCode) => costCode.id === costCodeId)?.name || fallback || "Unassigned";
  const getTradeRecord = (tradeId) => trades.find((trade) => trade.id === tradeId) || null;
  const isInternalLabourTrade = (tradeId, fallbackTrade = "") => {
    const tradeName = normalizeMatchText(getTradeRecord(tradeId)?.name || fallbackTrade);
    return internalLabourTradeMatchers.some((matcher) => tradeName.includes(matcher));
  };
  const getAutoAssignedCostCodeId = (tradeId, fallbackTrade = "", currentCostCodeId = "") => {
    const tradeName = normalizeMatchText(getTradeRecord(tradeId)?.name || fallbackTrade);

    if (!tradeName) {
      return currentCostCodeId || "";
    }

    const directMatch = activeCostCodes.find((costCode) =>
      normalizeMatchText(costCode.name).includes(tradeName)
    );

    if (directMatch) {
      return directMatch.id;
    }

    const aliasMatch = tradeCostCodeAliasRules.find((rule) =>
      rule.tradeMatchers.some((matcher) => tradeName.includes(matcher))
    );

    if (aliasMatch) {
      const matchedCostCode = activeCostCodes.find((costCode) => {
        const costCodeName = normalizeMatchText(costCode.name);
        const costCodeCode = normalizeMatchText(costCode.code || "");

        return aliasMatch.costCodeMatchers.some(
          (matcher) => costCodeName.includes(matcher) || costCodeCode.includes(matcher)
        );
      });

      if (matchedCostCode) {
        return matchedCostCode.id;
      }
    }

    return currentCostCodeId || "";
  };
  const resolveTradeDrivenCostCodeId = (tradeId, fallbackTrade = "", currentCostCodeId = "") =>
    isInternalLabourTrade(tradeId, fallbackTrade)
      ? currentCostCodeId || getAutoAssignedCostCodeId(tradeId, fallbackTrade, currentCostCodeId)
      : getAutoAssignedCostCodeId(tradeId, fallbackTrade, currentCostCodeId);
  const getUnitName = (unitId, fallback = "") =>
    getUnitAbbreviation(units, unitId, fallback, fallback) || "Unassigned";
  const getCostDisplayName = (cost) => getStructuredItemPresentation(cost).displayName;
  const getRowRate = (row) => row.unitRate ?? row.rate ?? "";
  const getDisplayedRowTotal = (row) => {
    const quantity = Number(row.quantity ?? 0);
    const rate = Number(getRowRate(row));

    if (row.include === false) {
      return 0;
    }

    if (!Number.isFinite(quantity) || !Number.isFinite(rate)) {
      return 0;
    }

    return quantity * rate;
  };
  const getRowSortValue = (row, key) => {
    switch (key) {
      case "item":
        return (row.itemSortKey || getStructuredItemPresentation(row).sortKey || "").toLowerCase();
      case "workType":
        return cleanText(row.workType).toLowerCase();
      case "stage":
        return getStageSortOrder(stages, row.stageId);
      case "trade":
        return cleanText(row.trade || getTradeName(row.tradeId, "")).toLowerCase();
      case "room":
        return cleanText(row.roomName).toLowerCase();
      case "assembly":
        return cleanText(row.assemblyName || row.sourceAssemblyName).toLowerCase();
      default:
        return Number(row.sortOrder ?? 0);
    }
  };
  const compareEstimateRows = (left, right) => {
    if (builderSort.key === "sortOrder") {
      const direction = builderSort.direction === "asc" ? 1 : -1;
      return (
        (Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0)) * direction ||
        getStructuredItemPresentation(left).displayName.localeCompare(
          getStructuredItemPresentation(right).displayName
        )
      );
    }

    const leftValue = getRowSortValue(left, builderSort.key);
    const rightValue = getRowSortValue(right, builderSort.key);
    const direction = builderSort.direction === "asc" ? 1 : -1;
    return (
      String(leftValue).localeCompare(String(rightValue), undefined, { sensitivity: "base" }) * direction ||
      Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0)
    );
  };
  const matchesBuilderRow = (row) => {
    if (builderFilters.workType && cleanText(row.workType) !== cleanText(builderFilters.workType)) {
      return false;
    }

    if (builderFilters.tradeId && cleanText(row.tradeId) !== cleanText(builderFilters.tradeId)) {
      return false;
    }

    if (
      builderFilters.itemFamily &&
      cleanText(row.itemFamily) !== cleanText(builderFilters.itemFamily)
    ) {
      return false;
    }

    if (builderFilters.stageId && cleanText(row.stageId) !== cleanText(builderFilters.stageId)) {
      return false;
    }

    const normalizedSearch = cleanText(builderSearchTerm).toLowerCase();

    if (!normalizedSearch) {
      return true;
    }

    return [
      row.displayName,
      row.displayPrimary,
      row.displayMeta,
      row.itemName,
      row.itemFamily,
      row.trade,
      row.notes,
      row.roomName,
      row.assemblyName,
      row.sourceAssemblyName,
      row.workType,
    ].some((value) => cleanText(value).toLowerCase().includes(normalizedSearch));
  };
  const estimateGridTemplate = [
    `${estimateColumnWidths.coreName}px`,
    `minmax(${estimateColumnWidths.detailedName}px, 1fr)`,
    `${estimateColumnWidths.workType}px`,
    `${estimateColumnWidths.stage}px`,
    `${estimateColumnWidths.trade}px`,
    `${estimateColumnWidths.costCode}px`,
    `${estimateColumnWidths.quantity}px`,
    `${estimateColumnWidths.unit}px`,
    `${estimateColumnWidths.rate}px`,
    `${estimateColumnWidths.total}px`,
    `${estimateColumnWidths.actions}px`,
  ].join(" ");
  const estimateGridMinWidth = Object.values(estimateColumnWidths).reduce(
    (total, value) => total + value,
    0
  );
  const estimateGridStyle = {
    "--estimate-grid-template": estimateGridTemplate || ESTIMATE_BUILDER_GRID_TEMPLATE,
    "--estimate-grid-min-width": `${estimateGridMinWidth}px`,
  };
  const activeBuilderFilterCount = Object.values(builderFilters).filter(Boolean).length;
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
        minimumFractionDigits: 2,
      }),
    []
  );

  const getBuilderGroupLabel = (row) => {
    switch (builderGroupBy) {
      case "itemFamily":
        return cleanText(row.itemFamily) || "Unassigned";
      case "stage":
        return getStageDisplayName(stages, row.stageId);
      case "trade":
        return cleanText(row.trade) || getTradeName(row.tradeId) || "Unassigned";
      case "workType":
        return cleanText(row.workType) || "Unassigned";
      default:
        return "";
    }
  };

  const groupEstimateRows = (rows) => {
    if (builderGroupBy === "none") {
      return [{ key: "all", label: "", rows }];
    }

    const groupedRows = rows.reduce((groups, row) => {
      const label = getBuilderGroupLabel(row);

      if (!groups[label]) {
        groups[label] = [];
      }

      groups[label].push(row);
      return groups;
    }, {});

    return Object.entries(groupedRows)
      .map(([label, grouped]) => ({
        key: label,
        label,
        rows: grouped,
        sortOrder:
          builderGroupBy === "stage"
            ? getStageSortOrder(stages, grouped[0]?.stageId)
            : Number.MAX_SAFE_INTEGER,
      }))
      .sort(
        (left, right) =>
          Number(left.sortOrder ?? Number.MAX_SAFE_INTEGER) -
            Number(right.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
          String(left.label).localeCompare(String(right.label))
      );
  };

  const toggleRowPanel = (rowId, panel) => {
    setActiveRowPanel((current) =>
      current.rowId === rowId && current.panel === panel ? { rowId: "", panel: "" } : { rowId, panel }
    );
  };

  const updateManualLine = (lineId, key, value) => {
    if (key === "stageId") {
      console.log("Builder stage change", lineId, value);
      const nextManualLines = manualLines.map((line) => {
        if (line.id !== lineId) {
          return line;
        }

        const nextLine = {
          ...line,
          stageId: value,
        };
        emitRowDebugUpdate(nextLine, "builder");
        return nextLine;
      });

      onManualLinesChange(nextManualLines);
      return;
    }

    const nextManualLines = manualLines.map((line) => {
        if (line.id !== lineId) {
          return line;
        }

        if (key === "include") {
          const nextLine = {
            ...line,
            include: value,
          };
          emitRowDebugUpdate(nextLine, "builder");
          return nextLine;
        }

        if (key === "unitId") {
          const nextLine = {
            ...line,
            unitId: value,
            unit: getUnitAbbreviation(units, value, line.unit, line.unit),
          };
          emitRowDebugUpdate(nextLine, "builder");
          return nextLine;
        }

        if (key === "tradeId") {
          const nextCostCodeId = resolveTradeDrivenCostCodeId(value, "", line.costCodeId);
          const nextLine = {
            ...line,
            tradeId: value,
            costCodeId: nextCostCodeId,
            costCode: getCostCodeName(nextCostCodeId, line.costCode),
          };
          emitRowDebugUpdate(nextLine, "builder");
          return nextLine;
        }

        if (key === "costCodeId") {
          const nextLine = {
            ...line,
            costCodeId: value,
            costCode: getCostCodeName(value, line.costCode),
          };
          emitRowDebugUpdate(nextLine, "builder");
          return nextLine;
        }

        if (["quantity", "rate", "sortOrder"].includes(key)) {
          const nextLine = {
            ...line,
            [key]: value === "" ? 0 : toNumber(value),
            ...(key === "quantity" ? { takeoffApplied: null } : {}),
          };
          emitRowDebugUpdate(nextLine, "builder");
          return nextLine;
        }

        const nextLine = {
          ...line,
          [key]: value,
        };
        emitRowDebugUpdate(nextLine, "builder");
        return nextLine;
      });

    onManualLinesChange(nextManualLines);
  };

  const updateGeneratedRow = (row, key, value) => {
    if (key === "remove") {
      emitRowDebugUpdate({ ...row, removed: true }, "builder");
      onGeneratedRowOverrideChange(row.id, { removed: true });
      return;
    }

    if (key === "include") {
      emitRowDebugUpdate({ ...row, include: value }, "builder");
      onGeneratedRowOverrideChange(row.id, { includeOverride: value });
      return;
    }

    if (key === "quantity") {
      emitRowDebugUpdate({ ...row, quantity: value }, "builder");
      onGeneratedRowOverrideChange(row.id, { quantityOverride: value, takeoffApplied: null });
      return;
    }

    if (key === "rate") {
      emitRowDebugUpdate({ ...row, unitRate: value }, "builder");
      onGeneratedRowOverrideChange(row.id, { rateOverride: value });
      return;
    }

    if (key === "sortOrder") {
      emitRowDebugUpdate({ ...row, sortOrder: value }, "builder");
      onGeneratedRowOverrideChange(row.id, { sortOrder: value });
      return;
    }

    if (key === "stageId") {
      console.log("Builder stage change", row.id, value);
      emitRowDebugUpdate(
        { ...row, stageId: value, stage: getStageName(value, "") },
        "builder"
      );
      onGeneratedRowOverrideChange(row.id, {
        stageId: value,
      });
      return;
    }

    if (key === "tradeId") {
      const nextCostCodeId = resolveTradeDrivenCostCodeId(value, "", row.costCodeId);
      emitRowDebugUpdate(
        {
          ...row,
          tradeId: value,
          trade: getTradeName(value, ""),
          costCodeId: nextCostCodeId,
          costCode: getCostCodeName(nextCostCodeId, row.costCode),
        },
        "builder"
      );
      onGeneratedRowOverrideChange(row.id, {
        tradeId: value,
        trade: getTradeName(value, ""),
        costCodeId: nextCostCodeId,
        costCode: getCostCodeName(nextCostCodeId, row.costCode),
      });
      return;
    }

    if (key === "costCodeId") {
      emitRowDebugUpdate(
        { ...row, costCodeId: value, costCode: getCostCodeName(value, row.costCode) },
        "builder"
      );
      onGeneratedRowOverrideChange(row.id, {
        costCodeId: value,
        costCode: getCostCodeName(value, row.costCode),
      });
      return;
    }

    if (key === "unitId") {
      emitRowDebugUpdate(
        { ...row, unitId: value, unit: getUnitAbbreviation(units, value, row.unit, row.unit) },
        "builder"
      );
      onGeneratedRowOverrideChange(row.id, {
        unitId: value,
        unit: getUnitAbbreviation(units, value, row.unit, row.unit),
      });
      return;
    }

    emitRowDebugUpdate({ ...row, [key]: value }, "builder");
    onGeneratedRowOverrideChange(row.id, { [key]: value });
  };

  const renderEstimateGridHeader = () => (
    <div
      className="estimate-builder-grid estimate-builder-grid-header"
      role="row"
      style={estimateGridStyle}
    >
      {estimateColumns.map((column) => (
        <div
          key={column.key}
          className={`estimate-builder-grid-cell ${column.className}`}
          role="columnheader"
        >
          <div className="cost-library-header-cell estimate-builder-header-cell">
            <span className="estimate-builder-header-label">{column.label}</span>
          </div>
          {column.key !== "actions" ? (
            <button
              type="button"
              className="cost-library-resize-handle estimate-builder-column-resize-handle"
              aria-label={`Resize ${column.label} column`}
              onMouseDown={(event) => {
                event.preventDefault();
                setActiveColumnResize({
                  key: column.key,
                  startX: event.clientX,
                  startWidth: estimateColumnWidths[column.key],
                });
              }}
            />
          ) : null}
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
    const openableSourceLink = getOpenableUrl(row.sourceLink);
    const hasNotes = cleanText(row.notes);
    const hasSourceLink = cleanText(row.sourceLink);
    const debugEntry = debugRowUpdates[row.id] || null;
    const rowStageIntegrity = getStageIntegrity(row.stageId, stages, row.stage, {
      defaultStageId: getDefaultStageId(activeStages),
    });
    const resolvedStageName = getStageDisplayName(stages, rowStageIntegrity.stageId);
    const resolvedStageSortOrder = getStageSortOrder(stages, rowStageIntegrity.stageId);
    const isNotesPanelOpen = activeRowPanel.rowId === row.id && activeRowPanel.panel === "notes";
    const isSourcePanelOpen = activeRowPanel.rowId === row.id && activeRowPanel.panel === "source";
    const renderEstimateDataCell = (columnKey, key) => {
      switch (columnKey) {
        case "coreName":
          return (
            <div key={key} className="estimate-builder-grid-cell estimate-builder-col-core">
              <input
                className="estimate-builder-inline-control estimate-builder-core-input"
                aria-label={`Core item name for ${row.itemName}`}
                value={row.itemName || ""}
                onChange={(event) => onRowFieldChange("itemName", event.target.value)}
                placeholder="Core item"
              />
            </div>
          );
        case "detailedName":
          return (
            <div key={key} className="estimate-builder-grid-cell estimate-builder-col-detail">
              <textarea
                className="estimate-builder-inline-control estimate-builder-detail-input"
                aria-label={`Detailed item name for ${row.itemName}`}
                value={
                  row.displayNameOverride ||
                  itemPresentation.structuredDisplayName ||
                  row.displayName ||
                  ""
                }
                onChange={(event) => onRowFieldChange("displayNameOverride", event.target.value)}
                placeholder="Detailed item name"
                rows={1}
              />
            </div>
          );
        case "workType":
          return (
            <div key={key} className="estimate-builder-grid-cell estimate-builder-col-worktype">
              {row.workType ? (
                <span className={`estimate-builder-worktype-badge is-${workTypeTone || "default"}`}>
                  {row.workType}
                </span>
              ) : null}
            </div>
          );
        case "stage":
          return (
            <div key={key} className="estimate-builder-grid-cell estimate-builder-col-stage">
              <select
                className="estimate-builder-inline-control"
                aria-label={`Stage for ${row.itemName}`}
                value={rowStageIntegrity.stageId || ""}
                onChange={(event) => onRowFieldChange("stageId", event.target.value)}
              >
                {activeStages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>
          );
        case "trade":
          return (
            <div key={key} className="estimate-builder-grid-cell estimate-builder-col-trade">
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
          );
        case "costCode":
          return (
            <div key={key} className="estimate-builder-grid-cell estimate-builder-col-cost-code">
              <select
                className="estimate-builder-inline-control estimate-builder-inline-subtle"
                aria-label={`Cost code for ${row.itemName}`}
                value={row.costCodeId || ""}
                onChange={(event) => onRowFieldChange("costCodeId", event.target.value)}
              >
                <option value="">Auto</option>
                {activeCostCodes.map((costCode) => (
                  <option key={costCode.id} value={costCode.id}>
                    {costCode.code ? `${costCode.code}  ${costCode.name}` : costCode.name}
                  </option>
                ))}
              </select>
            </div>
          );
        case "quantity":
          return (
            <div key={key} className="estimate-builder-grid-cell estimate-builder-col-qty">
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
          );
        case "unit":
          return (
            <div key={key} className="estimate-builder-grid-cell estimate-builder-col-unit">
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
          );
        case "rate":
          return (
            <div key={key} className="estimate-builder-grid-cell estimate-builder-col-rate">
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
          );
        case "total":
          return (
            <div key={key} className="estimate-builder-grid-cell estimate-builder-col-total">
              {getDisplayedRowTotal(row).toFixed(2)}
            </div>
          );
        default:
          return null;
      }
    };

    return (
    <div
      key={row.id}
      className={`estimate-builder-grid estimate-builder-grid-row ${
        row.include === false ? "estimate-builder-grid-row-excluded" : ""
      } ${
        debugMode && flashingRowIds[row.id] ? "estimate-builder-grid-row-flash" : ""
      } ${
        options.className || ""
      }`.trim()}
      role="row"
      style={estimateGridStyle}
      data-testid={`builder-row-${row.id}`}
    >
      {estimateColumns
        .filter((column) => column.key !== "actions")
        .map((column) => renderEstimateDataCell(column.key, column.key))}
      <div className="estimate-builder-grid-cell estimate-builder-col-actions">
        <div className="estimate-builder-row-actions">
          {renderIconActionButton({
            label: hasSourceLink ? "Edit source link" : "Add source link",
            icon: "\uD83D\uDD17",
            className: hasSourceLink
              ? "secondary-button estimate-builder-icon-button-active estimate-builder-icon-button-has-data"
              : "secondary-button",
            onClick: () => toggleRowPanel(row.id, "source"),
          })}
          {renderIconActionButton({
            label: hasNotes ? "Edit notes" : "Add notes",
            icon: "\uD83D\uDCDD",
            className: hasNotes
              ? "secondary-button estimate-builder-icon-button-active estimate-builder-icon-button-has-data"
              : "secondary-button",
            onClick: () => toggleRowPanel(row.id, "notes"),
          })}
          {actionButton}
        </div>
        {isSourcePanelOpen ? (
          <div className="estimate-builder-row-popover">
            <span className="estimate-builder-row-popover-label">Source Link</span>
            <input
              className="estimate-builder-inline-control"
              aria-label={`Source link for ${row.itemName}`}
              type="url"
              value={row.sourceLink || ""}
              onChange={(event) => onRowFieldChange("sourceLink", event.target.value)}
              placeholder="https://example.com/reference"
            />
            <div className="estimate-builder-row-popover-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={!openableSourceLink}
                onClick={() => window.open(openableSourceLink, "_blank", "noopener,noreferrer")}
              >
                Open
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => onRowFieldChange("sourceLink", "")}
              >
                Clear
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setActiveRowPanel({ rowId: "", panel: "" })}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
        {isNotesPanelOpen ? (
          <div className="estimate-builder-row-popover">
            <span className="estimate-builder-row-popover-label">Notes</span>
            <textarea
              className="estimate-builder-inline-control estimate-builder-row-textarea"
              aria-label={`Notes for ${row.itemName}`}
              value={row.notes || ""}
              onChange={(event) => onRowFieldChange("notes", event.target.value)}
              placeholder="Line notes"
              rows={3}
            />
            <div className="estimate-builder-row-popover-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => onRowFieldChange("notes", "")}
              >
                Clear
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setActiveRowPanel({ rowId: "", panel: "" })}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
        {debugMode ? (
          <div className="estimate-builder-debug-inline" data-testid={`builder-debug-row-${row.id}`}>
            <span>{`id: ${row.id}`}</span>
            <span>{`stageId: ${rowStageIntegrity.stageId || "-"}`}</span>
            <span>{`stageName: ${resolvedStageName || "-"}`}</span>
            <span>{`stageSortOrder: ${Number.isFinite(resolvedStageSortOrder) ? resolvedStageSortOrder : "-"}`}</span>
            <span>{`stageIntegrity: ${rowStageIntegrity.isValid ? "VALID" : "INVALID"}`}</span>
            <span>{`canvasColumn: ${row.canvasColumn ?? "-"}`}</span>
            <span>{`canvasTrack: ${row.canvasTrack ?? "-"}`}</span>
            <span>{`sourceType: ${getBuilderDebugSourceType(row)}`}</span>
            <span>{`lastUpdatedFrom: ${debugEntry?.updatedFrom || "-"}`}</span>
          </div>
        ) : null}
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

  const renderGroupedEstimateRows = (rows, renderRow, emptyMessage) => {
    if (!rows.length) {
      return <p className="empty-state estimate-builder-inline-empty">{emptyMessage}</p>;
    }

    return groupEstimateRows(rows).map((group) => (
      <div
        key={`${builderGroupBy}-${group.key || "all"}`}
        className={builderGroupBy === "none" ? "" : "estimate-builder-row-group"}
      >
        {builderGroupBy !== "none" ? (
          <div className="estimate-builder-row-group-header">
            <span>{group.label}</span>
            <span>{group.rows.length}</span>
          </div>
        ) : null}
        <div className="estimate-builder-row-group-body">{group.rows.map(renderRow)}</div>
      </div>
    ));
  };

  const getSectionTotal = (sectionId) => {
    const nestedSectionIds = new Set(getNestedSectionIds(sectionId));
    const roomSectionIdById = new Map(projectRooms.map((room) => [room.id, room.sectionId]));
    const manualTotal = manualLines.reduce((total, line) => {
      if (!nestedSectionIds.has(line.sectionId)) {
        return total;
      }

      return total + getDisplayedRowTotal(line);
    }, 0);
    const generatedTotal = generatedRows.reduce((total, row) => {
      const rowSectionId = roomSectionIdById.get(row.roomId);

      if (!nestedSectionIds.has(rowSectionId)) {
        return total;
      }

      return total + getDisplayedRowTotal(row);
    }, 0);

    return manualTotal + generatedTotal;
  };

  const builderGrandTotal =
    manualLines.reduce((total, line) => total + getDisplayedRowTotal(line), 0) +
    generatedRows.reduce((total, row) => total + getDisplayedRowTotal(row), 0);
  const normalizedMarkupPercent = Math.max(0, toNumber(markupPercent, 0));
  const markupAmount = builderGrandTotal * (normalizedMarkupPercent / 100);
  const subtotalWithMarkup = builderGrandTotal + markupAmount;
  const gstAmount = subtotalWithMarkup * DEFAULT_GST_RATE;
  const subtotalWithGst = subtotalWithMarkup + gstAmount;
  const builderTotal = subtotalWithGst;


  const renderSectionActionButtons = (section) => (
    <div className="estimate-builder-section-actions" aria-label={`Section actions for ${section.name}`}>
      {renderIconActionButton({
        label: "Add Room",
        icon: "Room",
        className:
          "estimate-builder-section-action estimate-builder-section-action-wide estimate-builder-section-action-room",
        onClick: () => openSectionAction(section, "room"),
      })}
      {renderIconActionButton({
        label: "Add Assembly",
        icon: "Assembly",
        className:
          "estimate-builder-section-action estimate-builder-section-action-wide estimate-builder-section-action-assembly",
        onClick: () => openSectionAction(section, "assembly"),
      })}
      {renderIconActionButton({
        label: "Add Cost Item",
        icon: "Cost Item",
        className:
          "estimate-builder-section-action estimate-builder-section-action-wide estimate-builder-section-action-cost",
        onClick: () => openSectionAction(section, "cost-item"),
      })}
      {renderIconActionButton({
        label: "Add Manual Item",
        icon: "Manual",
        className:
          "estimate-builder-section-action estimate-builder-section-action-wide estimate-builder-section-action-manual",
        onClick: () => openSectionAction(section, "manual-item"),
      })}
      {renderIconActionButton({
        label: "Add Manual Labour",
        icon: "Labour",
        className:
          "estimate-builder-section-action estimate-builder-section-action-wide estimate-builder-section-action-labour",
        onClick: () => openSectionAction(section, "manual-labour"),
      })}
      {renderIconActionButton({
        label: "Add Child Section",
        icon: "Child",
        className:
          "estimate-builder-section-action estimate-builder-section-action-wide estimate-builder-section-action-child",
        onClick: () => openSectionAction(section, "child-section"),
      })}
    </div>
  );

  const updateSectionForm = (key, value) => {
    setSectionForm((current) => ({ ...current, [key]: value }));
  };

  const moveSection = (sectionId, direction) => {
    const topLevelSections = sortedSections.filter((section) => !section.parentSectionId);
    const currentIndex = topLevelSections.findIndex((section) => section.id === sectionId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= topLevelSections.length) {
      return;
    }

    const reorderedSections = [...topLevelSections];
    const [movedSection] = reorderedSections.splice(currentIndex, 1);
    reorderedSections.splice(nextIndex, 0, movedSection);

    const nextSortOrderById = Object.fromEntries(
      reorderedSections.map((section, index) => [section.id, (index + 1) * 10])
    );

    onSectionsChange(
      sections.map((section) =>
        !section.parentSectionId && Object.prototype.hasOwnProperty.call(nextSortOrderById, section.id)
          ? { ...section, sortOrder: nextSortOrderById[section.id] }
          : section
      )
    );
  };

  const updateManualLineForm = (key, value) => {
    setManualLineForm((current) => ({
      ...current,
      unit:
        key === "unitId"
          ? getUnitAbbreviation(units, value, current.unit, current.unit)
          : current.unit,
      costCodeId:
        key === "tradeId"
          ? resolveTradeDrivenCostCodeId(value, "", current.costCodeId)
          : current.costCodeId,
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
    setManualLabourForm((current) => ({
      ...current,
      costCodeId:
        key === "tradeId"
          ? resolveTradeDrivenCostCodeId(value, "", current.costCodeId)
          : current.costCodeId,
      [key]: value,
    }));
  };

  const updateBuilderFilter = (key, value) => {
    setBuilderFilters((current) => ({ ...current, [key]: value }));
  };

  const clearBuilderFilters = () => {
    setBuilderFilters(defaultToolbarFilters);
  };

  const updateSectionCostItemForm = (sectionId, key, value) => {
    if (key === "stageId" && value) {
      setLastSelectedStageId(value);
    }

    const selectedCost = key === "costId" ? sortedCosts.find((cost) => cost.id === value) : null;
    const currentForm =
      costItemFormBySection[sectionId] || createDefaultSectionCostItemForm(resolvePreferredStageId());
    const nextTradeId = key === "tradeId" ? value : currentForm.tradeId;

    setCostItemFormBySection((current) => ({
      ...current,
      [sectionId]: {
        ...currentForm,
        costCodeId:
          key === "costId"
            ? resolveTradeDrivenCostCodeId(
                selectedCost?.tradeId || current[sectionId]?.tradeId || "",
                selectedCost?.trade || "",
                selectedCost?.costCodeId || current[sectionId]?.costCodeId || ""
              )
            : key === "tradeId"
              ? resolveTradeDrivenCostCodeId(value, "", currentForm.costCodeId)
            : current[sectionId]?.costCodeId,
        tradeId:
          key === "costId"
            ? selectedCost?.tradeId || current[sectionId]?.tradeId || ""
            : key === "tradeId"
              ? nextTradeId
              : current[sectionId]?.tradeId,
        sourceLink:
          key === "costId"
            ? selectedCost?.sourceLink || current[sectionId]?.sourceLink || ""
            : current[sectionId]?.sourceLink,
        [key]: value,
      },
    }));
  };

  const updateSectionAssemblyForm = (sectionId, key, value) => {
    if (key === "stageId" && value) {
      setLastSelectedStageId(value);
    }

    setAssemblyFormBySection((current) => ({
      ...current,
      [sectionId]: {
        ...(current[sectionId] || createDefaultSectionAssemblyForm(resolvePreferredStageId())),
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
        [section.id]: createDefaultSectionCostItemForm(resolvePreferredStageId()),
      }));
    }

    if (action === "assembly" && !assemblyFormBySection[section.id]) {
      setAssemblyFormBySection((current) => ({
        ...current,
        [section.id]: createDefaultSectionAssemblyForm(resolvePreferredStageId()),
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
        stageId: resolvePreferredStageId(),
      });
    }

    if (action === "manual-labour") {
      setManualLabourForm({
        ...defaultManualLabourForm,
        stageId: resolvePreferredStageId(),
      });
    }

    if (action === "child-section") {
      const childCount = sections.filter((child) => child.parentSectionId === section.id).length;

      setSectionForm({
        ...defaultSectionForm,
        parentSectionId: section.id,
        sortOrder: String(childCount + 1),
      });
    }
  };

  const closeSectionAction = () => {
    setActiveSectionAction({ sectionId: "", action: "" });
  };

  const revealSectionContent = (sectionId, options = {}) => {
    if (!sectionId) {
      return;
    }

    setCollapsedSections((current) => ({
      ...current,
      [sectionId]: false,
      ...(options.childSectionId ? { [options.childSectionId]: false } : {}),
    }));

    if (options.roomId) {
      setCollapsedProjectRooms((current) => ({
        ...current,
        [options.roomId]: false,
      }));
    }

    if (options.assemblyGroupId) {
      setCollapsedAssemblyGroups((current) => ({
        ...current,
        [`${sectionId}-${options.assemblyGroupId}`]: false,
      }));
    }
  };

  const isSectionCollapsed = (sectionId) => collapsedSections[sectionId] ?? true;
  const isProjectRoomCollapsed = (roomId) => collapsedProjectRooms[roomId] ?? true;
  const getNestedSectionIds = (sectionId) => {
    const nestedIds = [];
    const queue = [sectionId];

    while (queue.length) {
      const currentId = queue.shift();

      if (!currentId) {
        continue;
      }

      nestedIds.push(currentId);
      sections
        .filter((section) => (section.parentSectionId || "") === currentId)
        .forEach((section) => {
          queue.push(section.id);
        });
    }

    return nestedIds;
  };
  const setAllSectionsCollapsed = (isCollapsed) => {
    setCollapsedSections(
      Object.fromEntries(sortedSections.map((section) => [section.id, isCollapsed]))
    );
  };
  const setAllHierarchyCollapsed = (isCollapsed) => {
    setAllSectionsCollapsed(isCollapsed);
    setCollapsedProjectRooms(
      Object.fromEntries(projectRooms.map((room) => [room.id, isCollapsed]))
    );
    setCollapsedAssemblyGroups(
      Object.fromEntries(
        sections.flatMap((section) =>
          manualLines
            .filter((line) => line.sectionId === section.id && line.sourceAssemblyId)
            .map((line) => [`${section.id}-${line.sourceAssemblyId}`, isCollapsed])
        )
      )
    );
  };
  const setSectionHierarchyCollapsed = (sectionId, isCollapsed) => {
    const nestedSectionIds = getNestedSectionIds(sectionId);

    setCollapsedSections((current) => ({
      ...current,
      ...Object.fromEntries(nestedSectionIds.map((nestedSectionId) => [nestedSectionId, isCollapsed])),
    }));
    setCollapsedProjectRooms((current) => ({
      ...current,
      ...Object.fromEntries(
        projectRooms
          .filter((room) => nestedSectionIds.includes(room.sectionId))
          .map((room) => [room.id, isCollapsed])
      ),
    }));
    setCollapsedAssemblyGroups((current) => ({
      ...current,
      ...Object.fromEntries(
        nestedSectionIds.flatMap((nestedSectionId) =>
          manualLines
            .filter((line) => line.sectionId === nestedSectionId && line.sourceAssemblyId)
            .map((line) => [`${nestedSectionId}-${line.sourceAssemblyId}`, isCollapsed])
        )
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
        stageId: "",
        sortOrder: Number(sectionForm.sortOrder),
      },
    ]);

    setSectionForm((current) => ({
      ...defaultSectionForm,
      parentSectionId: current.parentSectionId,
      sortOrder: current.sortOrder,
    }));
    setIsSectionModalOpen(false);
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

  const removeAssemblyGroup = (sectionId, assemblyId) => {
    onManualLinesChange(
      manualLines.filter(
        (line) => !(line.sectionId === sectionId && line.sourceAssemblyId === assemblyId)
      )
    );
    setCollapsedAssemblyGroups((current) => {
      const nextState = { ...current };
      delete nextState[`${sectionId}-${assemblyId}`];
      return nextState;
    });
  };

  const addProjectRoomToSection = (section) => {
    const template = roomTemplates.find((roomTemplate) => roomTemplate.id === projectRoomForm.roomTemplateId);

    if (!template) {
      return;
    }

    const instantiatedRoom = instantiateRoomTemplate(template, [], parameters);

    const nextRoom = {
      ...instantiatedRoom,
      name: projectRoomForm.name.trim() || template.name,
      sectionId: section.id,
    };

    onProjectRoomsChange([
      ...projectRooms,
      nextRoom,
    ]);
    revealSectionContent(section.id, { roomId: nextRoom.id });

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

    const nextLine = {
      id: `manual-estimate-line-${Date.now()}`,
      sortOrder: nextSortOrder,
      include: true,
      ...line,
    };

    onManualLinesChange([
      ...manualLines,
      nextLine,
    ]);
    return nextLine;
  };

  const addCostItemToSection = (section) => {
    const sectionCostForm = costItemFormBySection[section.id];
    const selectedCost = sortedCosts.find((cost) => cost.id === sectionCostForm?.costId);
    const selectedStageId = resolvePreferredStageId(sectionCostForm?.stageId || "");

    if (!selectedCost || !selectedStageId) {
      return;
    }

    setLastSelectedStageId(selectedStageId);

    const nextLine = {
      itemName: selectedCost.itemName,
      displayNameOverride: "",
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
      stageId: selectedStageId,
      sectionId: section.id,
      costCodeId: resolveTradeDrivenCostCodeId(
        sectionCostForm.tradeId || selectedCost.tradeId || "",
        selectedCost.trade || "",
        sectionCostForm.costCodeId || selectedCost.costCodeId || ""
      ),
      tradeId: sectionCostForm.tradeId || selectedCost.tradeId || "",
      elementId: sectionCostForm.elementId,
      notes: sectionCostForm.notes,
      sourceLink: sectionCostForm.sourceLink || selectedCost.sourceLink || "",
      itemImageUrl: selectedCost.imageUrl || "",
      sourceCostItemId: selectedCost.id,
    };
    const createdLine = appendManualLine(nextLine);
    emitRowDebugUpdate(createdLine, "builder");
    revealSectionContent(section.id);

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

    const selectedStageId = resolvePreferredStageId(manualLineForm.stageId || "");

    if (!selectedStageId) {
      return;
    }

    setLastSelectedStageId(selectedStageId);

    appendManualLine({
      itemName: manualLineForm.itemName,
      displayNameOverride: manualLineForm.displayNameOverride,
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
      stageId: selectedStageId,
      sectionId: section.id,
      costCodeId: resolveTradeDrivenCostCodeId(
        manualLineForm.tradeId,
        "",
        manualLineForm.costCodeId
      ),
      tradeId: manualLineForm.tradeId,
      elementId: manualLineForm.elementId,
      notes: manualLineForm.notes,
      sourceLink: manualLineForm.sourceLink,
    });
    revealSectionContent(section.id);

    setManualLineForm({
      ...defaultManualLineForm,
      sectionId: section.id,
      stageId: selectedStageId,
    });
    closeSectionAction();
  };

  const addManualLabourToSection = (section) => {
    const selectedCost = labourCosts.find((cost) => cost.id === manualLabourForm.costId);
    const selectedStageId = resolvePreferredStageId(manualLabourForm.stageId || "");

    if (!selectedCost || !selectedStageId) {
      return;
    }

    setLastSelectedStageId(selectedStageId);

    appendManualLine({
      itemName: selectedCost.itemName,
      displayNameOverride: "",
      workType: cleanText(selectedCost.workType) || "Labour",
      itemFamily: selectedCost.itemFamily || "",
      specification: selectedCost.specification || "",
      gradeOrQuality: selectedCost.gradeOrQuality || "",
      brand: selectedCost.brand || "",
      finishOrVariant: selectedCost.finishOrVariant || "",
      unitId: selectedCost.unitId || "unit-hr",
      unit: getUnitAbbreviation(units, selectedCost.unitId || "unit-hr", selectedCost.unit || "HR", ""),
      quantity: Number(manualLabourForm.quantity),
      rate: Number(selectedCost.rate || 0),
      stageId: selectedStageId,
      sectionId: section.id,
      costCodeId: resolveTradeDrivenCostCodeId(
        manualLabourForm.tradeId || selectedCost.tradeId || "",
        selectedCost.trade || "",
        manualLabourForm.costCodeId || selectedCost.costCodeId || ""
      ),
      tradeId: manualLabourForm.tradeId || selectedCost.tradeId || "",
      elementId: manualLabourForm.elementId,
      notes: manualLabourForm.notes,
      sourceLink: manualLabourForm.sourceLink || selectedCost.sourceLink || "",
      itemImageUrl: selectedCost.imageUrl || "",
      sourceCostItemId: selectedCost.id,
    });
    revealSectionContent(section.id);

    setManualLabourForm({
      ...defaultManualLabourForm,
      stageId: selectedStageId,
    });
    closeSectionAction();
  };

  const addAssemblyToSection = (section) => {
    const sectionAssemblyForm = assemblyFormBySection[section.id];
    const selectedAssemblyId = sectionAssemblyForm?.assemblyId;
    const selectedStageId = resolvePreferredStageId(sectionAssemblyForm?.stageId || "");

    if (!selectedAssemblyId || !selectedStageId) {
      return;
    }

    const selectedAssembly = normalizedAssemblyGroups.find(
      (assemblyGroup) => getAssemblyGroupId(assemblyGroup) === selectedAssemblyId
    );
    const selectedAssemblyRows = [...(selectedAssembly?.items || [])].sort(
      (left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0)
    );

    if (!selectedAssembly || !selectedAssemblyRows.length) {
      return;
    }

    setLastSelectedStageId(selectedStageId);

    let nextSortOrder =
      manualLines
        .filter((line) => line.sectionId === section.id)
        .reduce(
          (highestSortOrder, existingLine) => Math.max(highestSortOrder, Number(existingLine.sortOrder ?? 0)),
          0
        ) + 10;

    const nextAssemblyLines = selectedAssemblyRows.map((assemblyRow) => {
      const linkedCost = sortedCosts.find((cost) => cost.id === assemblyRow.costItemId);
      const itemName =
        assemblyRow.itemNameSnapshot ||
        assemblyRow.itemName ||
        linkedCost?.itemName ||
        "Unassigned";
      const notes = assemblyRow.notes || "";

      const line = {
        id: `manual-estimate-line-${Date.now()}-${assemblyRow.id}-${nextSortOrder}`,
        itemName,
        displayNameOverride: assemblyRow.displayNameOverride || "",
        workType: assemblyRow.workType || linkedCost?.workType || "",
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
        rate: Number(
          linkedCost?.rate ??
            assemblyRow.baseRate ??
            assemblyRow.unitCost ??
            assemblyRow.rateOverride ??
            0
        ),
        stageId: selectedStageId,
        sectionId: section.id,
        costCodeId: resolveTradeDrivenCostCodeId(
          assemblyRow.tradeId || linkedCost?.tradeId || "",
          assemblyRow.trade || linkedCost?.trade || "",
          assemblyRow.costCodeId || linkedCost?.costCodeId || ""
        ),
        tradeId: assemblyRow.tradeId || linkedCost?.tradeId || "",
        elementId: assemblyRow.elementId || selectedAssembly.elementId || "",
        notes,
        sourceLink: assemblyRow.sourceLink || linkedCost?.sourceLink || "",
        imageUrl: assemblyRow.imageUrl || "",
        assemblyImageUrl: selectedAssembly.imageUrl || "",
        itemImageUrl: linkedCost?.imageUrl || "",
        sortOrder: nextSortOrder,
        sourceAssemblyId: selectedAssemblyId,
        sourceAssemblyName: selectedAssembly.assemblyName,
        sourceAssemblyRowId: assemblyRow.id,
        sourceCostItemId: assemblyRow.costItemId || "",
        sourceQtyRule: assemblyRow.qtyRule || "",
      };

      nextSortOrder += 10;
      return line;
    });

    nextAssemblyLines.forEach((line) => emitRowDebugUpdate(line, "builder"));
    onManualLinesChange([...manualLines, ...nextAssemblyLines]);
    revealSectionContent(section.id, { assemblyGroupId: selectedAssemblyId });
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

    const nextChildSection = {
      id: `estimate-section-${Date.now()}`,
      name: sectionForm.name,
      parentSectionId: section.id,
      stageId: "",
      sortOrder: Number(sectionForm.sortOrder),
    };

    onSectionsChange([
      ...sections,
      nextChildSection,
    ]);
    revealSectionContent(section.id, { childSectionId: nextChildSection.id });

    setSectionForm({
      ...defaultSectionForm,
      parentSectionId: section.id,
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
      .sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0));
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
          const topLevelToneClass =
            depth === 0
              ? `estimate-builder-section--tone-${getStableSectionToneIndex(section.id)}`
              : "";
          const sectionLines = manualLines
            .filter((line) => line.sectionId === section.id)
            .filter(matchesBuilderRow)
            .sort(compareEstimateRows);
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
              rows: group.rows.sort(compareEstimateRows),
            }))
            .sort((left, right) => left.name.localeCompare(right.name));
          const standaloneSectionLines = sectionLines.filter((line) => !line.sourceAssemblyId);
          const sectionRooms = projectRooms.filter((room) =>
            room.sectionId === section.id &&
            generatedRows.some((row) => row.roomId === room.id && matchesBuilderRow(row))
          );
          const sectionCostForm = costItemFormBySection[section.id];
          const sectionAssemblyForm = assemblyFormBySection[section.id];
          const selectedCost = sortedCosts.find((cost) => cost.id === sectionCostForm?.costId);
          const isActiveActionSection = activeSectionAction.sectionId === section.id;
          const isCollapsed = isSectionCollapsed(section.id);
          const sectionSubtotal = getSectionTotal(section.id);
          const topLevelSections = sortedSections.filter((candidateSection) => !candidateSection.parentSectionId);
          const topLevelSectionIndex = topLevelSections.findIndex(
            (candidateSection) => candidateSection.id === section.id
          );
          const canMoveSectionUp = depth === 0 && topLevelSectionIndex > 0;
          const canMoveSectionDown =
            depth === 0 &&
            topLevelSectionIndex >= 0 &&
            topLevelSectionIndex < topLevelSections.length - 1;

          return (
            <div
              key={section.id}
              className={[
                "estimate-builder-section",
                depth === 0 ? "estimate-builder-section--main" : "estimate-builder-section--child",
                depth > 0 ? "estimate-builder-section--nested" : "",
                topLevelToneClass,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="estimate-builder-section-header">
                <div className="estimate-builder-section-title">
                  <button
                    type="button"
                    className={[
                      "estimate-group-toggle",
                      depth === 0
                        ? "estimate-group-toggle--main-section"
                        : "estimate-group-toggle--child-section",
                      isCollapsed ? "" : "is-expanded",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-label={section.name}
                    onClick={() => toggleSection(section.id)}
                  >
                    <span aria-hidden="true">{"\u203A"}</span>
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
                  {renderIconActionButton({
                    label: "Expand Section",
                    icon: "+",
                    className:
                      "estimate-builder-section-action estimate-builder-section-action-neutral estimate-builder-section-action-icon",
                    onClick: () => setSectionHierarchyCollapsed(section.id, false),
                  })}
                  {renderIconActionButton({
                    label: "Collapse Section",
                    icon: "-",
                    className:
                      "estimate-builder-section-action estimate-builder-section-action-neutral estimate-builder-section-action-icon",
                    onClick: () => setSectionHierarchyCollapsed(section.id, true),
                  })}
                  {depth === 0 ? (
                    <>
                      {renderIconActionButton({
                        label: "Move Section Up",
                        icon: "↑",
                        className:
                          "estimate-builder-section-action estimate-builder-section-action-neutral estimate-builder-section-action-icon",
                        onClick: () => moveSection(section.id, -1),
                        disabled: !canMoveSectionUp,
                      })}
                      {renderIconActionButton({
                        label: "Move Section Down",
                        icon: "↓",
                        className:
                          "estimate-builder-section-action estimate-builder-section-action-neutral estimate-builder-section-action-icon",
                        onClick: () => moveSection(section.id, 1),
                        disabled: !canMoveSectionDown,
                      })}
                    </>
                  ) : null}
                  <span className="estimate-builder-section-subtotal">
                    <span>Subtotal</span>
                    <strong>{currencyFormatter.format(sectionSubtotal)}</strong>
                  </span>
                  {renderIconActionButton({
                    label: "Remove",
                    icon: "×",
                    className: "danger-button estimate-builder-toolbar-remove-button",
                    onClick: () => removeSection(section.id),
                  })}
                </div>
              </div>

              {!isCollapsed ? (
                <>
                  {rendersInlineSectionActionForms &&
                  isActiveActionSection &&
                  activeSectionAction.action === "room" ? (
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

                  {rendersInlineSectionActionForms &&
                  isActiveActionSection &&
                  activeSectionAction.action === "assembly" &&
                  sectionAssemblyForm ? (
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

                      <FormField label="Stage">
                        <select
                          value={sectionAssemblyForm.stageId}
                          onChange={(event) =>
                            updateSectionAssemblyForm(section.id, "stageId", event.target.value)
                          }
                        >
                          <option value="">Select stage</option>
                          {activeStages.map((stage) => (
                            <option key={stage.id} value={stage.id}>
                              {stage.name}
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

                  {rendersInlineSectionActionForms &&
                  isActiveActionSection &&
                  activeSectionAction.action === "cost-item" &&
                  sectionCostForm ? (
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
                            <option value="">Select stage</option>
                            {activeStages.map((stage) => (
                              <option key={stage.id} value={stage.id}>
                                {stage.name}
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

                        {isInternalLabourTrade(sectionCostForm.tradeId) ? (
                          <FormField label="Cost code override">
                            <select
                              value={sectionCostForm.costCodeId}
                              onChange={(event) =>
                                updateSectionCostItemForm(section.id, "costCodeId", event.target.value)
                              }
                            >
                              <option value="">Auto</option>
                              {activeCostCodes.map((costCode) => (
                                <option key={costCode.id} value={costCode.id}>
                                  {costCode.name}
                                </option>
                              ))}
                            </select>
                          </FormField>
                        ) : null}

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

                        <FormField label="Source link">
                          <input
                            value={sectionCostForm.sourceLink}
                            onChange={(event) =>
                              updateSectionCostItemForm(section.id, "sourceLink", event.target.value)
                            }
                            placeholder="Optional reference URL"
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

                  {rendersInlineSectionActionForms &&
                  isActiveActionSection &&
                  activeSectionAction.action === "manual-item" ? (
                    <div className="summary-section estimate-builder-inline-form">
                      <div className="form-grid estimate-builder-inline-grid">
                        <FormField label="Item name">
                          <input
                            value={manualLineForm.itemName}
                            onChange={(event) => updateManualLineForm("itemName", event.target.value)}
                            placeholder="Custom estimate item"
                          />
                        </FormField>

                        <FormField label="Display item name">
                          <input
                            value={manualLineForm.displayNameOverride}
                            onChange={(event) =>
                              updateManualLineForm("displayNameOverride", event.target.value)
                            }
                            placeholder="Optional detailed display name"
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
                            <option value="">Select stage</option>
                            {activeStages.map((stage) => (
                              <option key={stage.id} value={stage.id}>
                                {stage.name}
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

                        {isInternalLabourTrade(manualLineForm.tradeId) ? (
                          <FormField label="Cost code override">
                            <select
                              value={manualLineForm.costCodeId}
                              onChange={(event) => updateManualLineForm("costCodeId", event.target.value)}
                            >
                              <option value="">Auto</option>
                              {activeCostCodes.map((costCode) => (
                                <option key={costCode.id} value={costCode.id}>
                                  {costCode.name}
                                </option>
                              ))}
                            </select>
                          </FormField>
                        ) : null}

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

                        <FormField label="Source link">
                          <input
                            value={manualLineForm.sourceLink}
                            onChange={(event) => updateManualLineForm("sourceLink", event.target.value)}
                            placeholder="Optional reference URL"
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

                  {rendersInlineSectionActionForms &&
                  isActiveActionSection &&
                  activeSectionAction.action === "manual-labour" ? (
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
                            <option value="">Select stage</option>
                            {activeStages.map((stage) => (
                              <option key={stage.id} value={stage.id}>
                                {stage.name}
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

                        {isInternalLabourTrade(manualLabourForm.tradeId) ? (
                          <FormField label="Cost code override">
                            <select
                              value={manualLabourForm.costCodeId}
                              onChange={(event) => updateManualLabourForm("costCodeId", event.target.value)}
                            >
                              <option value="">Auto</option>
                              {activeCostCodes.map((costCode) => (
                                <option key={costCode.id} value={costCode.id}>
                                  {costCode.name}
                                </option>
                              ))}
                            </select>
                          </FormField>
                        ) : null}

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

                        <FormField label="Source link">
                          <input
                            value={manualLabourForm.sourceLink}
                            onChange={(event) =>
                              updateManualLabourForm("sourceLink", event.target.value)
                            }
                            placeholder="Optional reference URL"
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

                  {rendersInlineSectionActionForms &&
                  isActiveActionSection &&
                  activeSectionAction.action === "child-section" ? (
                    <div className="summary-section estimate-builder-inline-form">
                      <div className="form-grid estimate-builder-inline-grid">
                        <FormField label="Child section name">
                          <input
                            value={sectionForm.name}
                            onChange={(event) => updateSectionForm("name", event.target.value)}
                            placeholder="Subsection"
                          />
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
                      {sectionRooms.length ? (
                        <div className="estimate-builder-room-list">
                          {sectionRooms.map((room) => {
                            const roomRows = generatedRows
                              .filter((row) => row.roomId === room.id)
                              .filter(matchesBuilderRow)
                              .sort(compareEstimateRows);
                            const isRoomCollapsed = isProjectRoomCollapsed(room.id);

                            return (
                              <div key={room.id} className="estimate-builder-group-block estimate-builder-room-block">
                                <div className="estimate-builder-room-header">
                                  <div className="estimate-builder-group-title">
                                    <button
                                      type="button"
                                      className={[
                                        "estimate-group-toggle",
                                        "estimate-group-toggle--main-section",
                                        isRoomCollapsed ? "" : "is-expanded",
                                      ]
                                        .filter(Boolean)
                                        .join(" ")}
                                      aria-label={room.name}
                                      onClick={() => toggleProjectRoom(room.id)}
                                    >
                                      <span aria-hidden="true">{"\u203A"}</span>
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
                                      className="secondary-button estimate-builder-section-action estimate-builder-section-action-neutral estimate-builder-room-remove-button"
                                      onClick={() => removeProjectRoom(room.id)}
                                    >
                                      Remove Room
                                    </button>
                                  </div>
                                </div>

                                {!isRoomCollapsed ? (
                                  <div className="estimate-builder-room-rows">
                                    {renderGroupedEstimateRows(
                                      roomRows,
                                      (row) =>
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
                                        ),
                                      "No generated room rows in this section."
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
                                      className={[
                                        "estimate-group-toggle",
                                        "estimate-group-toggle--subsection",
                                        isAssemblyCollapsed ? "" : "is-expanded",
                                      ]
                                        .filter(Boolean)
                                        .join(" ")}
                                      aria-label={assemblyGroup.name}
                                      onClick={() => toggleAssemblyGroup(groupCollapseKey)}
                                    >
                                      <span aria-hidden="true">{"\u203A"}</span>
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
                                    <button
                                      type="button"
                                      className="secondary-button estimate-builder-section-action estimate-builder-section-action-neutral estimate-builder-assembly-remove-button"
                                      onClick={() => removeAssemblyGroup(section.id, assemblyGroup.id)}
                                    >
                                      Remove Assembly
                                    </button>
                                  </div>
                                </div>

                                {!isAssemblyCollapsed ? (
                                  <div className="estimate-builder-room-rows">
                                    {renderGroupedEstimateRows(
                                      assemblyGroup.rows,
                                      (row) =>
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
                                      ),
                                      "No assembly rows in this group."
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
                          {renderGroupedEstimateRows(
                            standaloneSectionLines,
                            (row) =>
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
                            ),
                            "No manual lines in this section."
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

  const rendersInlineSectionActionForms = false;
  const activeActionSection = activeSectionAction.sectionId
    ? sections.find((section) => section.id === activeSectionAction.sectionId) || null
    : null;
  const activeSectionCostForm = activeActionSection
    ? costItemFormBySection[activeActionSection.id]
    : null;
  const activeSectionAssemblyForm = activeActionSection
    ? assemblyFormBySection[activeActionSection.id]
    : null;
  const activeSelectedCost = sortedCosts.find((cost) => cost.id === activeSectionCostForm?.costId);
  const activeSectionActionTitleMap = {
    room: "Add Room",
    assembly: "Add Assembly",
    "cost-item": "Add Cost Item",
    "manual-item": "Add Manual Item",
    "manual-labour": "Add Labour",
    "child-section": "Add Child Section",
  };

  const renderSectionActionModalBody = () => {
    if (!activeActionSection) {
      return null;
    }

    if (activeSectionAction.action === "room") {
      return (
        <div className="estimate-builder-inline-form">
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

          <div className="action-row estimate-builder-modal-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => addProjectRoomToSection(activeActionSection)}
            >
              Add Room
            </button>
            <button type="button" className="secondary-button" onClick={closeSectionAction}>
              Cancel
            </button>
          </div>
        </div>
      );
    }

    if (activeSectionAction.action === "assembly" && activeSectionAssemblyForm) {
      return (
        <div className="estimate-builder-inline-form">
          <FormField label="Search assemblies">
            <input
              value={activeSectionAssemblyForm.searchTerm}
              onChange={(event) =>
                updateSectionAssemblyForm(activeActionSection.id, "searchTerm", event.target.value)
              }
              placeholder="Search assembly"
            />
          </FormField>

          <FormField label="Assembly">
            <select
              value={activeSectionAssemblyForm.assemblyId}
              onChange={(event) =>
                updateSectionAssemblyForm(activeActionSection.id, "assemblyId", event.target.value)
              }
            >
              <option value="">Select assembly</option>
              {getFilteredAssemblies(activeActionSection.id).map((assembly) => (
                <option key={assembly.id} value={assembly.id}>
                  {assembly.assemblyName}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Stage">
            <select
              value={activeSectionAssemblyForm.stageId}
              onChange={(event) =>
                updateSectionAssemblyForm(activeActionSection.id, "stageId", event.target.value)
              }
            >
              <option value="">Select stage</option>
              {activeStages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </FormField>

          <div className="action-row estimate-builder-modal-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => addAssemblyToSection(activeActionSection)}
            >
              Add Assembly
            </button>
            <button type="button" className="secondary-button" onClick={closeSectionAction}>
              Cancel
            </button>
          </div>
        </div>
      );
    }

    if (activeSectionAction.action === "cost-item" && activeSectionCostForm) {
      return (
        <div className="estimate-builder-inline-form">
          <FormField label="Search cost items">
            <input
              value={activeSectionCostForm.searchTerm}
              onChange={(event) =>
                updateSectionCostItemForm(activeActionSection.id, "searchTerm", event.target.value)
              }
              placeholder="Search cost item"
            />
          </FormField>

          <FormField label="Cost item">
            <select
              value={activeSectionCostForm.costId}
              onChange={(event) =>
                updateSectionCostItemForm(activeActionSection.id, "costId", event.target.value)
              }
            >
              <option value="">Select cost item</option>
              {getFilteredCosts(activeActionSection.id).map((cost) => (
                <option key={cost.id} value={cost.id}>
                  {getCostDisplayName(cost)}
                </option>
              ))}
            </select>
          </FormField>

          {activeSelectedCost ? (
            <p className="empty-state">
              {getCostDisplayName(activeSelectedCost)} |{" "}
              {getUnitName(activeSelectedCost.unitId, activeSelectedCost.unit)} | Rate{" "}
              {activeSelectedCost.rate}
            </p>
          ) : null}

          <div className="form-grid estimate-builder-inline-grid">
            <FormField label="Quantity">
              <input
                type="number"
                min="0"
                step="0.01"
                value={activeSectionCostForm.quantity}
                onChange={(event) =>
                  updateSectionCostItemForm(activeActionSection.id, "quantity", event.target.value)
                }
              />
            </FormField>

            <FormField label="Stage">
              <select
                value={activeSectionCostForm.stageId}
                onChange={(event) =>
                  updateSectionCostItemForm(activeActionSection.id, "stageId", event.target.value)
                }
              >
                <option value="">Select stage</option>
                {activeStages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Trade">
              <select
                value={activeSectionCostForm.tradeId}
                onChange={(event) =>
                  updateSectionCostItemForm(activeActionSection.id, "tradeId", event.target.value)
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

            {isInternalLabourTrade(activeSectionCostForm.tradeId) ? (
              <FormField label="Cost code override">
                <select
                  value={activeSectionCostForm.costCodeId}
                  onChange={(event) =>
                    updateSectionCostItemForm(activeActionSection.id, "costCodeId", event.target.value)
                  }
                >
                  <option value="">Auto</option>
                  {activeCostCodes.map((costCode) => (
                    <option key={costCode.id} value={costCode.id}>
                      {costCode.name}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : null}

            <FormField label="Element">
              <select
                value={activeSectionCostForm.elementId}
                onChange={(event) =>
                  updateSectionCostItemForm(activeActionSection.id, "elementId", event.target.value)
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
                value={activeSectionCostForm.notes}
                onChange={(event) =>
                  updateSectionCostItemForm(activeActionSection.id, "notes", event.target.value)
                }
                placeholder="Optional notes"
              />
            </FormField>

            <FormField label="Source link">
              <input
                value={activeSectionCostForm.sourceLink}
                onChange={(event) =>
                  updateSectionCostItemForm(activeActionSection.id, "sourceLink", event.target.value)
                }
                placeholder="Optional reference URL"
              />
            </FormField>
          </div>

          <div className="action-row estimate-builder-modal-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => addCostItemToSection(activeActionSection)}
            >
              Add Selected Cost Item
            </button>
            <button type="button" className="secondary-button" onClick={closeSectionAction}>
              Cancel
            </button>
          </div>
        </div>
      );
    }

    if (activeSectionAction.action === "manual-item") {
      return (
        <div className="estimate-builder-inline-form">
          <div className="form-grid estimate-builder-inline-grid">
            <FormField label="Item name">
              <input
                value={manualLineForm.itemName}
                onChange={(event) => updateManualLineForm("itemName", event.target.value)}
                placeholder="Custom estimate item"
              />
            </FormField>

            <FormField label="Display item name">
              <input
                value={manualLineForm.displayNameOverride}
                onChange={(event) => updateManualLineForm("displayNameOverride", event.target.value)}
                placeholder="Optional detailed display name"
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
                onChange={(event) => updateManualLineForm("gradeOrQuality", event.target.value)}
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
                onChange={(event) => updateManualLineForm("finishOrVariant", event.target.value)}
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
                <option value="">Select stage</option>
                {activeStages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
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

            {isInternalLabourTrade(manualLineForm.tradeId) ? (
              <FormField label="Cost code override">
                <select
                  value={manualLineForm.costCodeId}
                  onChange={(event) => updateManualLineForm("costCodeId", event.target.value)}
                >
                  <option value="">Auto</option>
                  {activeCostCodes.map((costCode) => (
                    <option key={costCode.id} value={costCode.id}>
                      {costCode.name}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : null}

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

            <FormField label="Source link">
              <input
                value={manualLineForm.sourceLink}
                onChange={(event) => updateManualLineForm("sourceLink", event.target.value)}
                placeholder="Optional reference URL"
              />
            </FormField>
          </div>

          <div className="action-row estimate-builder-modal-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => addManualItemToSection(activeActionSection)}
            >
              Add Manual Item
            </button>
            <button type="button" className="secondary-button" onClick={closeSectionAction}>
              Cancel
            </button>
          </div>
        </div>
      );
    }

    if (activeSectionAction.action === "manual-labour") {
      return (
        <div className="estimate-builder-inline-form">
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
                <option value="">Select stage</option>
                {activeStages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
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

            {isInternalLabourTrade(manualLabourForm.tradeId) ? (
              <FormField label="Cost code override">
                <select
                  value={manualLabourForm.costCodeId}
                  onChange={(event) => updateManualLabourForm("costCodeId", event.target.value)}
                >
                  <option value="">Auto</option>
                  {activeCostCodes.map((costCode) => (
                    <option key={costCode.id} value={costCode.id}>
                      {costCode.name}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : null}

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

            <FormField label="Source link">
              <input
                value={manualLabourForm.sourceLink}
                onChange={(event) => updateManualLabourForm("sourceLink", event.target.value)}
                placeholder="Optional reference URL"
              />
            </FormField>
          </div>

          <div className="action-row estimate-builder-modal-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => addManualLabourToSection(activeActionSection)}
            >
              Add Manual Labour
            </button>
            <button type="button" className="secondary-button" onClick={closeSectionAction}>
              Cancel
            </button>
          </div>
        </div>
      );
    }

    if (activeSectionAction.action === "child-section") {
      return (
        <div className="estimate-builder-inline-form">
          <div className="form-grid estimate-builder-inline-grid">
            <FormField label="Child section name">
              <input
                value={sectionForm.name}
                onChange={(event) => updateSectionForm("name", event.target.value)}
                placeholder="Subsection"
              />
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

          <div className="action-row estimate-builder-modal-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => addChildSection(activeActionSection)}
            >
              Add Child Section
            </button>
            <button type="button" className="secondary-button" onClick={closeSectionAction}>
              Cancel
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  const sectionActionModal =
    activeActionSection && activeSectionAction.action
      ? (
          <div
            className="estimate-builder-modal-backdrop"
            role="presentation"
            onClick={closeSectionAction}
          >
            <div
              className="estimate-builder-modal estimate-builder-modal--wide"
              role="dialog"
              aria-modal="true"
              aria-label={activeSectionActionTitleMap[activeSectionAction.action] || "Section action"}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="estimate-builder-modal-form">
                <div className="estimate-builder-modal-header">
                  <div>
                    <p className="room-template-editor-kicker">Estimate Builder</p>
                    <h3>{activeSectionActionTitleMap[activeSectionAction.action] || "Section action"}</h3>
                    <p className="estimate-builder-modal-subtitle">{activeActionSection.name}</p>
                  </div>
                  <button
                    type="button"
                    className="secondary-button estimate-workspace-topbar-button"
                    onClick={closeSectionAction}
                  >
                    Close
                  </button>
                </div>
                <div className="estimate-builder-modal-content">{renderSectionActionModalBody()}</div>
              </div>
            </div>
          </div>
        )
      : null;

  const builderTopBarContent =
    topBarPortalTarget && typeof document !== "undefined"
      ? createPortal(
          <div className="estimate-workspace-topbar__controls estimate-workspace-topbar__controls--builder">
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
                {renderIconActionButton({
                  label: "Expand everything",
                  icon: "+*",
                  onClick: () => setAllHierarchyCollapsed(false),
                })}
                {renderIconActionButton({
                  label: "Collapse everything",
                  icon: "-*",
                  onClick: () => setAllHierarchyCollapsed(true),
                })}
              </>
            ) : null}
            <button
              type="button"
              className="secondary-button estimate-workspace-topbar-button"
              onClick={() => setIsSectionModalOpen(true)}
            >
              New Section
            </button>
            {process.env.NODE_ENV !== "production" ? (
              <button
                type="button"
                className={[
                  "secondary-button",
                  "estimate-builder-debug-toggle",
                  "estimate-workspace-topbar-button",
                  debugMode ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-testid="builder-debug-toggle"
                onClick={() => setDebugMode((current) => !current)}
              >
                {`Debug ${debugMode ? "On" : "Off"}`}
              </button>
            ) : null}
            <input
              className="estimate-builder-toolbar-search estimate-workspace-topbar-search"
              value={builderSearchTerm}
              onChange={(event) => setBuilderSearchTerm(event.target.value)}
              placeholder="Search"
              aria-label="Search estimate items"
            />
            <select
              className="estimate-workspace-topbar-select"
              aria-label="Sort estimate items"
              value={builderSort.key}
              onChange={(event) =>
                setBuilderSort((current) => ({ ...current, key: event.target.value }))
              }
            >
              {estimateSortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="estimate-workspace-topbar-select"
              aria-label="Sort direction"
              value={builderSort.direction}
              onChange={(event) =>
                setBuilderSort((current) => ({ ...current, direction: event.target.value }))
              }
            >
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </select>
            <select
              className="estimate-workspace-topbar-select"
              aria-label="Group estimate items"
              value={builderGroupBy}
              onChange={(event) => setBuilderGroupBy(event.target.value)}
            >
              {builderGroupOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <details className="estimate-builder-toolbar-menu estimate-workspace-topbar-menu">
              <summary
                className="toolbar-icon-button estimate-workspace-topbar-button"
                aria-label={`Filter estimate items${
                  activeBuilderFilterCount ? ` (${activeBuilderFilterCount} active)` : ""
                }`}
                title={`Filter estimate items${
                  activeBuilderFilterCount ? ` (${activeBuilderFilterCount} active)` : ""
                }`}
              >
                <span aria-hidden="true">F</span>
              </summary>
              <div className="estimate-builder-toolbar-menu-panel estimate-workspace-topbar-menu-panel">
                <FormField label="Work type">
                  <select
                    value={builderFilters.workType}
                    onChange={(event) => updateBuilderFilter("workType", event.target.value)}
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
                    value={builderFilters.tradeId}
                    onChange={(event) => updateBuilderFilter("tradeId", event.target.value)}
                  >
                    <option value="">All</option>
                    {activeTrades.map((trade) => (
                      <option key={trade.id} value={trade.id}>
                        {trade.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Item family">
                  <select
                    value={builderFilters.itemFamily}
                    onChange={(event) => updateBuilderFilter("itemFamily", event.target.value)}
                  >
                    <option value="">All</option>
                    {activeItemFamilies.map((itemFamily) => (
                      <option key={itemFamily.id} value={itemFamily.name}>
                        {itemFamily.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Stage">
                  <select
                    value={builderFilters.stageId}
                    onChange={(event) => updateBuilderFilter("stageId", event.target.value)}
                  >
                    <option value="">All</option>
                    {activeStages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <button
                  type="button"
                  className="estimate-builder-icon-button secondary-button"
                  onClick={clearBuilderFilters}
                  aria-label="Clear filters"
                  title="Clear filters"
                >
                  <span aria-hidden="true">x</span>
                </button>
              </div>
            </details>
          </div>,
          topBarPortalTarget
        )
      : null;
  const shouldRenderLegacyBodyToolbar = topBarPortalTarget === undefined;

  return (
    <SectionCard className="estimate-workspace-shell estimate-builder-shell">
      {builderTopBarContent}
      {shouldRenderLegacyBodyToolbar ? (
        <div className="estimate-builder-toolbar">
        <div className="estimate-builder-toolbar-left">
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
              {renderIconActionButton({
                label: "Expand everything",
                icon: "+*",
                onClick: () => setAllHierarchyCollapsed(false),
              })}
              {renderIconActionButton({
                label: "Collapse everything",
                icon: "-*",
                onClick: () => setAllHierarchyCollapsed(true),
              })}
            </>
          ) : null}
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

        <div className="estimate-builder-toolbar-right">
          {process.env.NODE_ENV !== "production" ? (
            <button
              type="button"
              className={[
                "secondary-button",
                "estimate-builder-debug-toggle",
                debugMode ? "is-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-testid="builder-debug-toggle"
              onClick={() => setDebugMode((current) => !current)}
            >
              {`Debug Mode: ${debugMode ? "ON" : "OFF"}`}
            </button>
          ) : null}
          <FormField label="Search">
            <input
              className="estimate-builder-toolbar-search"
              value={builderSearchTerm}
              onChange={(event) => setBuilderSearchTerm(event.target.value)}
              placeholder="Search item, family, trade, room"
            />
          </FormField>

          <FormField label="Sort">
            <select
              value={builderSort.key}
              onChange={(event) =>
                setBuilderSort((current) => ({ ...current, key: event.target.value }))
              }
            >
              {estimateSortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Dir">
            <select
              value={builderSort.direction}
              onChange={(event) =>
                setBuilderSort((current) => ({ ...current, direction: event.target.value }))
              }
            >
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </select>
          </FormField>

          <FormField label="Group">
            <select value={builderGroupBy} onChange={(event) => setBuilderGroupBy(event.target.value)}>
              {builderGroupOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          <details className="estimate-builder-toolbar-menu">
            <summary
              className="toolbar-icon-button"
              aria-label={`Filter estimate items${activeBuilderFilterCount ? ` (${activeBuilderFilterCount} active)` : ""}`}
              title={`Filter estimate items${activeBuilderFilterCount ? ` (${activeBuilderFilterCount} active)` : ""}`}
            >
              <span aria-hidden="true">⛃</span>
            </summary>
            <div className="estimate-builder-toolbar-menu-panel">
              <FormField label="Work type">
                <select
                  value={builderFilters.workType}
                  onChange={(event) => updateBuilderFilter("workType", event.target.value)}
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
                  value={builderFilters.tradeId}
                  onChange={(event) => updateBuilderFilter("tradeId", event.target.value)}
                >
                  <option value="">All</option>
                  {activeTrades.map((trade) => (
                    <option key={trade.id} value={trade.id}>
                      {trade.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Item family">
                <select
                  value={builderFilters.itemFamily}
                  onChange={(event) => updateBuilderFilter("itemFamily", event.target.value)}
                >
                  <option value="">All</option>
                  {activeItemFamilies.map((itemFamily) => (
                    <option key={itemFamily.id} value={itemFamily.name}>
                      {itemFamily.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Stage">
                <select
                  value={builderFilters.stageId}
                  onChange={(event) => updateBuilderFilter("stageId", event.target.value)}
                >
                  <option value="">All</option>
                  {activeStages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <button
                type="button"
                className="estimate-builder-icon-button secondary-button"
                onClick={clearBuilderFilters}
                aria-label="Clear filters"
                title="Clear filters"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          </details>

        </div>
        </div>
      ) : null}

      <div className="estimate-builder-main">
        <div className="estimate-builder-content-scroll">
          <div className="estimate-builder-global-header">
            {renderEstimateGridHeader()}
          </div>
          <div className="estimate-builder-tree-panel">
            {sortedSections.length ? (
              renderSectionTree()
            ) : (
              <p className="empty-state">No estimate sections added yet.</p>
            )}

            {manualLines.length && !sortedSections.length ? (
              <p className="empty-state">Manual lines need sections to be visible.</p>
            ) : null}

            <div className="estimate-builder-summary-panel" aria-label="Estimate totals">
              <div className="estimate-builder-summary-controls">
                <label className="estimate-builder-summary-markup" htmlFor="estimate-builder-markup-percent">
                  <span>Markup %</span>
                  <div className="estimate-builder-summary-markup-input">
                    <input
                      id="estimate-builder-markup-percent"
                      type="number"
                      min="0"
                      step="0.1"
                      inputMode="decimal"
                      value={markupPercent}
                      onChange={(event) => setMarkupPercent(event.target.value)}
                    />
                    <span aria-hidden="true">%</span>
                  </div>
                </label>
              </div>
              <table className="summary-table estimate-builder-summary-table">
                <tbody>
                  <tr>
                    <th scope="row">Subtotal</th>
                    <td>{currencyFormatter.format(builderGrandTotal)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Subtotal + Markup</th>
                    <td>{currencyFormatter.format(subtotalWithMarkup)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Subtotal + GST</th>
                    <td>{currencyFormatter.format(subtotalWithGst)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Total</th>
                    <td>{currencyFormatter.format(builderTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      {sectionActionModal}
      {isSectionModalOpen ? (
        <div
          className="estimate-builder-modal-backdrop"
          role="presentation"
          onClick={() => setIsSectionModalOpen(false)}
        >
          <div
            className="estimate-builder-modal"
            role="dialog"
            aria-modal="true"
            aria-label="New section"
            onClick={(event) => event.stopPropagation()}
          >
            <form className="estimate-builder-modal-form" onSubmit={addSection}>
              <div className="estimate-builder-modal-header">
                <div>
                  <p className="room-template-editor-kicker">Estimate Workspace</p>
                  <h3>New Section</h3>
                </div>
                <button
                  type="button"
                  className="secondary-button estimate-workspace-topbar-button"
                  onClick={() => setIsSectionModalOpen(false)}
                >
                  Close
                </button>
              </div>
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
              <div className="estimate-builder-modal-actions">
                <button type="submit" className="primary-button">
                  Add Section
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

export default EstimateBuilderPage;
