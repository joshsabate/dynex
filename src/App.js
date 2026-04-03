import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import AssemblyLibraryPage from "./pages/AssemblyLibraryPage";
import AssemblyLineLibraryPage from "./pages/AssemblyLineLibraryPage";
import CostLibraryPage from "./pages/CostLibraryPage";
import CostCodeLibraryPage from "./pages/CostCodeLibraryPage";
import EstimateWorkspacePage, {
  EstimateWorkspaceViewSwitcher,
} from "./pages/EstimateWorkspacePage";
import EstimateOutputPage from "./pages/EstimateOutputPage";
import LabourSummaryPage from "./pages/LabourSummaryPage";
import MissingRatesPage from "./pages/MissingRatesPage";
import ParameterLibraryPage from "./pages/ParameterLibraryPage";
import ProjectDetailsPage from "./pages/ProjectDetailsPage";
import RoomTypeLibraryPage from "./pages/RoomTypeLibraryPage";
import RoomInputsPage from "./pages/RoomInputsPage";
import SummaryDashboardPage from "./pages/SummaryDashboardPage";
import ElementLibraryPage from "./pages/ElementLibraryPage";
import ItemFamilyLibraryPage from "./pages/ItemFamilyLibraryPage";
import StageLibraryPage from "./pages/StageLibraryPage";
import TradeLibraryPage from "./pages/TradeLibraryPage";
import UnitLibraryPage from "./pages/UnitLibraryPage";
import {
  initialAssemblies,
  initialAssemblyLineTemplates,
  initialCostCodes,
  initialCosts,
  initialElements,
  initialItemFamilies,
  initialParameters,
  initialRoomTypes,
  initialRooms,
  initialStages,
  initialTrades,
  initialUnits,
} from "./data/seedData";
import {
  generateEstimateRows,
  generateManualEstimateBuilderRows,
  summarizeEstimateRows,
} from "./utils/estimateRows";
import { normalizeAssemblies } from "./utils/assemblies";
import { normalizeCosts } from "./utils/costs";
import { mergeSeededParameters } from "./utils/parameters";
import { getStageIntegrity, normalizeStageBoundRecord } from "./utils/stageIntegrity";
import { buildCanonicalStageId, canonicalStageLibrary, normalizeStages } from "./utils/stages";
import { fetchDynexLibraryState } from "./lib/librarySupabase";
import { hasSupabaseCredentials } from "./lib/supabase";
import useSupabaseCollectionSync from "./hooks/useSupabaseCollectionSync";

const legacyLocalStorageKey = "estimator-app-project";
const globalLibrariesStorageKey = "estimator-app-global-libraries";
const libraryDataStorageKey = "estimator-app-library-data";
const projectDataStorageKey = "estimator-app-project-data";
const projectFileFormat = "estimator-app-project-file";
const projectFileVersion = 1;
const defaultProjectName = "Untitled Project";
const defaultEstimateName = "Untitled Estimate";

const pages = [
  { id: "estimate-builder", label: "Estimate Builder", icon: "◫", group: "Workflow" },
  { id: "summary", label: "Summary Dashboard", icon: "◧", group: "Workflow" },
  { id: "labour-summary", label: "Labour Summary", icon: "◌", group: "Workflow" },
  { id: "missing-rates", label: "Missing Rates", icon: "!", group: "Workflow" },
  { id: "estimate", label: "Estimate Output", icon: "≡", group: "Workflow" },
  { id: "stages", label: "Stage Library", icon: "◔", group: "Core Libraries" },
  { id: "trades", label: "Trade Library", icon: "⇄", group: "Core Libraries" },
  { id: "elements", label: "Element Library", icon: "▣", group: "Core Libraries" },
  { id: "parameters", label: "Parameter Library", icon: "⌘", group: "Core Libraries" },
  { id: "units", label: "Unit Library", icon: "#", group: "Core Libraries" },
  { id: "cost-codes", label: "Cost Code Library", icon: "⌗", group: "Core Libraries" },
  { id: "costs", label: "Cost Library", icon: "$", group: "Core Libraries" },
  { id: "item-families", label: "Item Family Library", icon: "@", group: "Core Libraries" },
  { id: "room-types", label: "Room Type Library", icon: "⌂", group: "Room Setup" },
  { id: "rooms", label: "Room Library", icon: "▤", group: "Room Setup" },
  { id: "assembly-lines", label: "Assembly Line Library", icon: "─", group: "Room Setup" },
  { id: "assemblies", label: "Assembly Library", icon: "▦", group: "Room Setup" },
];

function getSidebarGroupClassName(groupName) {
  switch (groupName) {
    case "Workflow":
      return "nav-group-workflow";
    case "Core Libraries":
      return "nav-group-core-libraries";
    case "Room Setup":
      return "nav-group-room-setup";
    default:
      return "";
  }
}

function getSidebarButtonPriorityClassName(pageId) {
  if (
    [
      "estimate-builder",
      "estimate",
      "costs",
      "parameters",
      "room-types",
      "rooms",
      "assembly-lines",
      "assemblies",
    ].includes(pageId)
  ) {
    return "nav-button-primary";
  }

  if (
    [
      "summary",
      "labour-summary",
      "missing-rates",
      "cost-codes",
      "item-families",
    ].includes(pageId)
  ) {
    return "nav-button-secondary";
  }

  if (["stages", "trades", "elements", "units"].includes(pageId)) {
    return "nav-button-tertiary";
  }

  return "";
}

function getDefaultGlobalLibraries() {
  return {
    roomTypes: initialRoomTypes,
    parameters: initialParameters,
    units: initialUnits,
    costCodes: initialCostCodes,
    stages: initialStages,
    trades: initialTrades,
    itemFamilies: initialItemFamilies,
    elements: initialElements,
  };
}

function getDefaultLibraryData() {
  return {
    roomTemplates: initialRooms,
    assemblyLineTemplates: initialAssemblyLineTemplates,
    assemblies: initialAssemblies,
    costs: initialCosts,
  };
}

function getDefaultProjectData() {
  const now = new Date().toISOString();

  return {
    localProjectId: createLocalProjectId(),
    createdAt: now,
    updatedAt: now,
    projectName: defaultProjectName,
    estimateName: defaultEstimateName,
    clientName: "",
    projectAddress: "",
    contactDetails: "",
    projectManager: "",
    estimator: "",
    revision: "Rev 0",
    revisionNumber: 0,
    projectRooms: [],
    estimateSections: [],
    manualEstimateLines: [],
    generatedRowSectionAssignments: {},
    estimateRowOverrides: {},
    parameterLibraryUiState: {
      expandedCategories: {},
    },
    lastSavedAt: "",
    lastBackupAt: "",
    lastFileName: "",
  };
}

function createLocalProjectId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `local-project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getRevisionNumber(value, fallback = 0) {
  const match = String(value || "").match(/(\d+)/);

  return match ? Number(match[1]) : fallback;
}

function buildRevisionLabel(revisionNumber) {
  return `Rev ${revisionNumber}`;
}

function readStoredJson(storageKey) {
  if (typeof window === "undefined") {
    return null;
  }

  const savedValue = window.localStorage.getItem(storageKey);

  if (!savedValue) {
    return null;
  }

  try {
    return JSON.parse(savedValue);
  } catch (error) {
    return null;
  }
}

function createLoadResult(data, sources) {
  return { data, sources };
}

function loadGlobalLibraries() {
  const defaultGlobalLibraries = getDefaultGlobalLibraries();
  const savedLibraries = readStoredJson(globalLibrariesStorageKey);

  if (savedLibraries) {
    return createLoadResult(
      {
        ...defaultGlobalLibraries,
        ...savedLibraries,
        roomTypes: savedLibraries.roomTypes || defaultGlobalLibraries.roomTypes,
        parameters: mergeSeededParameters(
          savedLibraries.parameters || defaultGlobalLibraries.parameters
        ),
        units: savedLibraries.units || defaultGlobalLibraries.units,
        costCodes: savedLibraries.costCodes || defaultGlobalLibraries.costCodes,
        stages: savedLibraries.stages || defaultGlobalLibraries.stages,
        trades: savedLibraries.trades || defaultGlobalLibraries.trades,
        itemFamilies: savedLibraries.itemFamilies || defaultGlobalLibraries.itemFamilies,
        elements: savedLibraries.elements || defaultGlobalLibraries.elements,
      },
      {
        roomTypes: "localStorage:global-libraries",
        parameters: "localStorage:global-libraries",
        units: "localStorage:global-libraries",
        costCodes: "localStorage:global-libraries",
        stages: "localStorage:global-libraries",
        trades: "localStorage:global-libraries",
        itemFamilies: "localStorage:global-libraries",
        elements: "localStorage:global-libraries",
      }
    );
  }

  const legacyProjectState = readStoredJson(legacyLocalStorageKey);

  if (!legacyProjectState) {
    return createLoadResult(defaultGlobalLibraries, {
      roomTypes: "seed/default",
      parameters: "seed/default",
      units: "seed/default",
      costCodes: "seed/default",
      stages: "seed/default",
      trades: "seed/default",
      itemFamilies: "seed/default",
      elements: "seed/default",
    });
  }

  return createLoadResult(
    {
      ...defaultGlobalLibraries,
      roomTypes: legacyProjectState.roomTypes || defaultGlobalLibraries.roomTypes,
      parameters: mergeSeededParameters(defaultGlobalLibraries.parameters),
      units: legacyProjectState.units || defaultGlobalLibraries.units,
      costCodes: legacyProjectState.costCodes || defaultGlobalLibraries.costCodes,
      stages: legacyProjectState.stages || defaultGlobalLibraries.stages,
      trades: legacyProjectState.trades || defaultGlobalLibraries.trades,
      itemFamilies: legacyProjectState.itemFamilies || defaultGlobalLibraries.itemFamilies,
      elements: legacyProjectState.elements || defaultGlobalLibraries.elements,
    },
    {
      roomTypes: legacyProjectState.roomTypes ? "localStorage:legacy-project" : "seed/default",
      parameters: "seed/default",
      units: legacyProjectState.units ? "localStorage:legacy-project" : "seed/default",
      costCodes: legacyProjectState.costCodes ? "localStorage:legacy-project" : "seed/default",
      stages: legacyProjectState.stages ? "localStorage:legacy-project" : "seed/default",
      trades: legacyProjectState.trades ? "localStorage:legacy-project" : "seed/default",
      itemFamilies: legacyProjectState.itemFamilies ? "localStorage:legacy-project" : "seed/default",
      elements: legacyProjectState.elements ? "localStorage:legacy-project" : "seed/default",
    }
  );
}

function loadLibraryData() {
  const defaultLibraryData = getDefaultLibraryData();
  const savedLibraryData = readStoredJson(libraryDataStorageKey);

  if (savedLibraryData) {
    return createLoadResult(
      {
        ...defaultLibraryData,
        ...savedLibraryData,
        roomTemplates: savedLibraryData.roomTemplates || defaultLibraryData.roomTemplates,
        assemblyLineTemplates:
          savedLibraryData.assemblyLineTemplates || defaultLibraryData.assemblyLineTemplates,
        assemblies: savedLibraryData.assemblies || defaultLibraryData.assemblies,
        costs: savedLibraryData.costs || defaultLibraryData.costs,
      },
      {
        roomTemplates: "localStorage:library-data",
        assemblyLineTemplates: "localStorage:library-data",
        assemblies: "localStorage:library-data",
        costs: "localStorage:library-data",
      }
    );
  }

  const legacyProjectState = readStoredJson(legacyLocalStorageKey);

  if (!legacyProjectState) {
    return createLoadResult(defaultLibraryData, {
      roomTemplates: "seed/default",
      assemblyLineTemplates: "seed/default",
      assemblies: "seed/default",
      costs: "seed/default",
    });
  }

  return createLoadResult(
    {
      ...defaultLibraryData,
      roomTemplates:
        legacyProjectState.roomTemplates ||
        legacyProjectState.rooms ||
        defaultLibraryData.roomTemplates,
      assemblyLineTemplates:
        legacyProjectState.assemblyLineTemplates || defaultLibraryData.assemblyLineTemplates,
      assemblies: legacyProjectState.assemblies || defaultLibraryData.assemblies,
      costs: legacyProjectState.costs || defaultLibraryData.costs,
    },
    {
      roomTemplates:
        legacyProjectState.roomTemplates || legacyProjectState.rooms
          ? "localStorage:legacy-project"
          : "seed/default",
      assemblyLineTemplates: legacyProjectState.assemblyLineTemplates
        ? "localStorage:legacy-project"
        : "seed/default",
      assemblies: legacyProjectState.assemblies ? "localStorage:legacy-project" : "seed/default",
      costs: legacyProjectState.costs ? "localStorage:legacy-project" : "seed/default",
    }
  );
}

function loadProjectData() {
  const defaultProjectData = getDefaultProjectData();
  const savedProjectData = readStoredJson(projectDataStorageKey);

  if (savedProjectData) {
    return createLoadResult(
      {
        ...defaultProjectData,
        ...savedProjectData,
        localProjectId: savedProjectData.localProjectId || defaultProjectData.localProjectId,
        createdAt: savedProjectData.createdAt || defaultProjectData.createdAt,
        updatedAt: savedProjectData.updatedAt || defaultProjectData.updatedAt,
        estimateName:
          savedProjectData.estimateName ||
          savedProjectData.projectName ||
          defaultProjectData.estimateName,
        projectAddress: savedProjectData.projectAddress || defaultProjectData.projectAddress,
        contactDetails: savedProjectData.contactDetails || defaultProjectData.contactDetails,
        projectManager: savedProjectData.projectManager || defaultProjectData.projectManager,
        estimator: savedProjectData.estimator || defaultProjectData.estimator,
        revisionNumber:
          savedProjectData.revisionNumber ?? getRevisionNumber(savedProjectData.revision, 0),
        projectRooms: savedProjectData.projectRooms || defaultProjectData.projectRooms,
        estimateSections: savedProjectData.estimateSections || defaultProjectData.estimateSections,
        manualEstimateLines:
          savedProjectData.manualEstimateLines || defaultProjectData.manualEstimateLines,
        generatedRowSectionAssignments:
          savedProjectData.generatedRowSectionAssignments ||
          defaultProjectData.generatedRowSectionAssignments,
        estimateRowOverrides:
          savedProjectData.estimateRowOverrides || defaultProjectData.estimateRowOverrides,
        lastSavedAt: savedProjectData.lastSavedAt || defaultProjectData.lastSavedAt,
        lastBackupAt: savedProjectData.lastBackupAt || defaultProjectData.lastBackupAt,
        lastFileName: savedProjectData.lastFileName || defaultProjectData.lastFileName,
      },
      { projectData: "localStorage:project-data" }
    );
  }

  const legacyProjectState = readStoredJson(legacyLocalStorageKey);

  if (!legacyProjectState) {
    return createLoadResult(defaultProjectData, { projectData: "seed/default" });
  }

  return createLoadResult(
    {
      ...defaultProjectData,
      localProjectId: legacyProjectState.localProjectId || defaultProjectData.localProjectId,
      createdAt: legacyProjectState.createdAt || defaultProjectData.createdAt,
      updatedAt: legacyProjectState.updatedAt || defaultProjectData.updatedAt,
      projectName: legacyProjectState.projectName || defaultProjectData.projectName,
      estimateName:
        legacyProjectState.estimateName ||
        legacyProjectState.projectName ||
        defaultProjectData.estimateName,
      clientName: legacyProjectState.clientName || defaultProjectData.clientName,
      projectAddress: defaultProjectData.projectAddress,
      contactDetails: defaultProjectData.contactDetails,
      projectManager: defaultProjectData.projectManager,
      estimator: defaultProjectData.estimator,
      revision: legacyProjectState.revision || defaultProjectData.revision,
      revisionNumber:
        legacyProjectState.revisionNumber ??
        getRevisionNumber(legacyProjectState.revision, defaultProjectData.revisionNumber),
      projectRooms: defaultProjectData.projectRooms,
      estimateSections: legacyProjectState.estimateSections || defaultProjectData.estimateSections,
      manualEstimateLines:
        legacyProjectState.manualEstimateLines || defaultProjectData.manualEstimateLines,
      generatedRowSectionAssignments:
        legacyProjectState.generatedRowSectionAssignments ||
        defaultProjectData.generatedRowSectionAssignments,
      estimateRowOverrides:
        legacyProjectState.estimateRowOverrides || defaultProjectData.estimateRowOverrides,
      lastSavedAt: legacyProjectState.lastSavedAt || defaultProjectData.lastSavedAt,
      lastBackupAt: legacyProjectState.lastBackupAt || defaultProjectData.lastBackupAt,
      lastFileName: legacyProjectState.lastFileName || defaultProjectData.lastFileName,
    },
    { projectData: "localStorage:legacy-project" }
  );
}

function loadAppState() {
  const globalLibraries = loadGlobalLibraries();
  const libraryData = loadLibraryData();
  const projectData = loadProjectData();

  return {
    appState: {
      ...globalLibraries.data,
      ...libraryData.data,
      ...projectData.data,
    },
    startupSources: {
      ...globalLibraries.sources,
      ...libraryData.sources,
      ...projectData.sources,
      startupPrecedence: [
        "1. localStorage:global-libraries / library-data / project-data",
        "2. localStorage:legacy-project",
        "3. seed/default",
      ],
    },
  };
}

function getInitialRestoreStatus(startupSources = {}) {
  const costCodesSource = startupSources.costCodes || "seed/default";
  const costsSource = startupSources.costs || "seed/default";
  const assembliesSource = startupSources.assemblies || "seed/default";

  return `Startup sources: Cost Codes ${costCodesSource}; Costs ${costsSource}; Assemblies ${assembliesSource}.`;
}

function logStartupSources(startupSources = {}) {
  if (typeof console === "undefined") {
    return;
  }

  console.info("[Dynex] Startup library sources", startupSources);
}

function formatLastSaved(value) {
  if (!value) {
    return "Not saved yet";
  }

  const parsedValue = new Date(value);

  if (Number.isNaN(parsedValue.getTime())) {
    return "Not saved yet";
  }

  return parsedValue.toLocaleString();
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeStageOverrides(rowOverrides, stages) {
  return Object.fromEntries(
    Object.entries(rowOverrides || {}).map(([rowId, override]) => {
      if (!isRecord(override) || !Object.prototype.hasOwnProperty.call(override, "stageId")) {
        return [rowId, override];
      }

      const integrity = getStageIntegrity(override.stageId, stages, override.stage);
      const { stage, ...rest } = override;

      return [
        rowId,
        {
          ...rest,
          stageId: integrity.stageId,
        },
      ];
    })
  );
}

function normalizeAppState(source = {}) {
  const defaultGlobalLibraries = getDefaultGlobalLibraries();
  const defaultLibraryData = getDefaultLibraryData();
  const defaultProjectData = getDefaultProjectData();
  const normalizedUnits = Array.isArray(source.units) ? source.units : defaultGlobalLibraries.units;
  const normalizedTrades = Array.isArray(source.trades) ? source.trades : defaultGlobalLibraries.trades;
  const normalizedCostCodes = Array.isArray(source.costCodes)
    ? source.costCodes
    : defaultGlobalLibraries.costCodes;
  const normalizedItemFamilies = Array.isArray(source.itemFamilies)
    ? source.itemFamilies
    : defaultGlobalLibraries.itemFamilies;
  const normalizedStages = normalizeStages(
    Array.isArray(source.stages) ? source.stages : defaultGlobalLibraries.stages
  );
  const normalizedCosts = normalizeCosts(
    Array.isArray(source.costs) ? source.costs : defaultLibraryData.costs,
    {
      units: normalizedUnits,
      trades: normalizedTrades,
      costCodes: normalizedCostCodes,
      itemFamilies: normalizedItemFamilies,
    }
  );

  return {
    ...defaultGlobalLibraries,
    ...defaultLibraryData,
    ...defaultProjectData,
    ...source,
    localProjectId: source.localProjectId || defaultProjectData.localProjectId,
    createdAt: source.createdAt || defaultProjectData.createdAt,
    updatedAt: source.updatedAt || defaultProjectData.updatedAt,
    roomTypes: Array.isArray(source.roomTypes)
      ? source.roomTypes
      : defaultGlobalLibraries.roomTypes,
    parameters: Array.isArray(source.parameters)
      ? source.parameters
      : defaultGlobalLibraries.parameters,
    units: normalizedUnits,
    costCodes: normalizedCostCodes,
    stages: normalizedStages,
    trades: normalizedTrades,
    itemFamilies: normalizedItemFamilies,
    elements: Array.isArray(source.elements)
      ? source.elements
      : defaultGlobalLibraries.elements,
    roomTemplates: Array.isArray(source.roomTemplates)
      ? source.roomTemplates
      : Array.isArray(source.rooms)
        ? source.rooms
        : defaultLibraryData.roomTemplates,
    assemblyLineTemplates: Array.isArray(source.assemblyLineTemplates)
      ? source.assemblyLineTemplates
      : defaultLibraryData.assemblyLineTemplates,
    assemblies: normalizeAssemblies(
      Array.isArray(source.assemblies) ? source.assemblies : defaultLibraryData.assemblies,
      {
        units: normalizedUnits,
        costs: normalizedCosts,
        trades: normalizedTrades,
        costCodes: normalizedCostCodes,
      }
    ),
    costs: normalizedCosts,
    projectName: source.projectName ?? defaultProjectData.projectName,
    estimateName:
      source.estimateName ?? source.projectName ?? defaultProjectData.estimateName,
    clientName: source.clientName ?? defaultProjectData.clientName,
    projectAddress: source.projectAddress ?? defaultProjectData.projectAddress,
    contactDetails: source.contactDetails ?? defaultProjectData.contactDetails,
    projectManager: source.projectManager ?? defaultProjectData.projectManager,
    estimator: source.estimator ?? defaultProjectData.estimator,
    revision: source.revision ?? defaultProjectData.revision,
    revisionNumber:
      source.revisionNumber ?? getRevisionNumber(source.revision, defaultProjectData.revisionNumber),
    projectRooms: Array.isArray(source.projectRooms)
      ? source.projectRooms
      : defaultProjectData.projectRooms,
    estimateSections: (Array.isArray(source.estimateSections)
      ? source.estimateSections
      : defaultProjectData.estimateSections
    ).map((section) =>
      normalizeStageBoundRecord(section, normalizedStages, { context: "estimate-section" })
    ),
    manualEstimateLines: (Array.isArray(source.manualEstimateLines)
      ? source.manualEstimateLines
      : defaultProjectData.manualEstimateLines
    ).map((line) =>
      normalizeStageBoundRecord(line, normalizedStages, { context: "manual-estimate-line" })
    ),
    generatedRowSectionAssignments: isRecord(source.generatedRowSectionAssignments)
      ? source.generatedRowSectionAssignments
      : defaultProjectData.generatedRowSectionAssignments,
    estimateRowOverrides: normalizeStageOverrides(
      isRecord(source.estimateRowOverrides)
        ? source.estimateRowOverrides
        : defaultProjectData.estimateRowOverrides,
      normalizedStages
    ),
    parameterLibraryUiState: isRecord(source.parameterLibraryUiState)
      ? {
          ...defaultProjectData.parameterLibraryUiState,
          ...source.parameterLibraryUiState,
          expandedCategories: isRecord(source.parameterLibraryUiState.expandedCategories)
            ? source.parameterLibraryUiState.expandedCategories
            : defaultProjectData.parameterLibraryUiState.expandedCategories,
        }
      : defaultProjectData.parameterLibraryUiState,
    lastSavedAt: source.lastSavedAt ?? defaultProjectData.lastSavedAt,
    lastBackupAt: source.lastBackupAt ?? defaultProjectData.lastBackupAt,
    lastFileName: source.lastFileName ?? defaultProjectData.lastFileName,
  };
}

function getStoredStages(stages = []) {
  const canonicalStagesById = new Map(canonicalStageLibrary.map((stage) => [stage.id, stage]));

  return (stages || []).filter((stage) => {
    const canonicalStage =
      canonicalStagesById.get(stage.id) ||
      canonicalStagesById.get(buildCanonicalStageId(stage.name));

    if (!canonicalStage) {
      return true;
    }

    return (
      stage.name !== canonicalStage.name ||
      Number(stage.sortOrder ?? 0) !== Number(canonicalStage.sortOrder ?? 0) ||
      stage.isActive !== canonicalStage.isActive ||
      String(stage.color || "") !== String(canonicalStage.color || "")
    );
  });
}
function splitAppStateForStorage(appState) {
  return {
    globalLibraries: {
      roomTypes: appState.roomTypes,
      parameters: appState.parameters,
      units: appState.units,
      costCodes: appState.costCodes,
      stages: getStoredStages(appState.stages),
      trades: appState.trades,
      itemFamilies: appState.itemFamilies,
      elements: appState.elements,
    },
    libraryData: {
      roomTemplates: appState.roomTemplates,
      assemblyLineTemplates: appState.assemblyLineTemplates,
      assemblies: appState.assemblies,
      costs: appState.costs,
    },
    projectData: {
      projectName: appState.projectName,
      estimateName: appState.estimateName,
      clientName: appState.clientName,
      projectAddress: appState.projectAddress,
      contactDetails: appState.contactDetails,
      projectManager: appState.projectManager,
      estimator: appState.estimator,
      revision: appState.revision,
      localProjectId: appState.localProjectId,
      createdAt: appState.createdAt,
      updatedAt: appState.updatedAt,
      revisionNumber: appState.revisionNumber,
      projectRooms: appState.projectRooms,
      estimateSections: appState.estimateSections,
      manualEstimateLines: appState.manualEstimateLines,
      generatedRowSectionAssignments: appState.generatedRowSectionAssignments,
      estimateRowOverrides: appState.estimateRowOverrides,
      parameterLibraryUiState: appState.parameterLibraryUiState,
      lastSavedAt: appState.lastSavedAt,
      lastBackupAt: appState.lastBackupAt,
      lastFileName: appState.lastFileName,
    },
  };
}

function persistAppStateToLocalStorage(appState) {
  if (typeof window === "undefined") {
    return;
  }

  const { globalLibraries, libraryData, projectData } = splitAppStateForStorage({
    ...appState,
    lastBackupAt: new Date().toISOString(),
  });

  if (!hasSupabaseCredentials) {
    window.localStorage.setItem(globalLibrariesStorageKey, JSON.stringify(globalLibraries));
    window.localStorage.setItem(libraryDataStorageKey, JSON.stringify(libraryData));
  } else {
    window.localStorage.removeItem(globalLibrariesStorageKey);
    window.localStorage.removeItem(libraryDataStorageKey);
  }

  window.localStorage.setItem(projectDataStorageKey, JSON.stringify(projectData));
  window.localStorage.removeItem(legacyLocalStorageKey);
}

function isCanvasDebugLoggingEnabled() {
  if (typeof window === "undefined" || process.env.NODE_ENV !== "development") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  const value = String(params.get("canvasDebug") || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "on";
}

function sanitizeFileNamePart(value) {
  return String(value || "")
    .trim()
    .split("")
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("")
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readFileAsText(file) {
  if (typeof file?.text === "function") {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsText(file);
  });
}

function buildProjectFileName(projectName, revision) {
  const normalizedProjectName = sanitizeFileNamePart(projectName);
  const normalizedRevision = sanitizeFileNamePart(revision);
  const fileName = [normalizedProjectName, normalizedRevision].filter(Boolean).join(" ");

  return `${fileName || "estimator-project"}.json`;
}

function buildComparableAppState(appState) {
  return JSON.stringify({
    localProjectId: appState.localProjectId,
    createdAt: appState.createdAt,
    revisionNumber: appState.revisionNumber,
    projectName: appState.projectName,
    estimateName: appState.estimateName,
    clientName: appState.clientName,
    projectAddress: appState.projectAddress,
    contactDetails: appState.contactDetails,
    projectManager: appState.projectManager,
    estimator: appState.estimator,
    revision: appState.revision,
    roomTypes: appState.roomTypes,
    parameters: appState.parameters,
    units: appState.units,
    costCodes: appState.costCodes,
    stages: appState.stages,
    trades: appState.trades,
    itemFamilies: appState.itemFamilies,
    elements: appState.elements,
    roomTemplates: appState.roomTemplates,
    assemblies: appState.assemblies,
    costs: appState.costs,
    projectRooms: appState.projectRooms,
    estimateSections: appState.estimateSections,
    manualEstimateLines: appState.manualEstimateLines,
    generatedRowSectionAssignments: appState.generatedRowSectionAssignments,
    estimateRowOverrides: appState.estimateRowOverrides,
    parameterLibraryUiState: appState.parameterLibraryUiState,
  });
}

function buildProjectFilePayload(appState, savedAt) {
  return {
    format: projectFileFormat,
    version: projectFileVersion,
    savedAt,
    appState: {
      ...appState,
      lastSavedAt: savedAt,
    },
  };
}

function normalizeImportedProjectFile(fileData) {
  if (!isRecord(fileData)) {
    throw new Error("Invalid project file");
  }

  const importedAppState = isRecord(fileData.appState)
    ? {
        ...fileData.appState,
        lastSavedAt: fileData.appState.lastSavedAt ?? fileData.savedAt ?? "",
      }
    : fileData;

  return normalizeAppState(importedAppState);
}

function App() {
  const initialLoadResult = useMemo(() => loadAppState(), []);
  const initialProjectState = useMemo(
    () => normalizeAppState(initialLoadResult.appState),
    [initialLoadResult]
  );
  const initialProjectStatus = useMemo(
    () => getInitialRestoreStatus(initialLoadResult.startupSources),
    [initialLoadResult]
  );
  const initialSavedSnapshot = useMemo(
    () => buildComparableAppState(initialProjectState),
    [initialProjectState]
  );
  const [activePage, setActivePage] = useState("estimate-builder");
  const [roomTypes, setRoomTypes] = useState(initialProjectState.roomTypes);
  const [parameters, setParameters] = useState(initialProjectState.parameters);
  const [units, setUnits] = useState(initialProjectState.units);
  const [costCodes, setCostCodes] = useState(initialProjectState.costCodes);
  const [itemFamilies, setItemFamilies] = useState(initialProjectState.itemFamilies);
  const [localProjectId, setLocalProjectId] = useState(initialProjectState.localProjectId);
  const [createdAt, setCreatedAt] = useState(initialProjectState.createdAt);
  const [updatedAt, setUpdatedAt] = useState(initialProjectState.updatedAt);
  const [projectName, setProjectName] = useState(initialProjectState.projectName);
  const [estimateName, setEstimateName] = useState(initialProjectState.estimateName);
  const [clientName, setClientName] = useState(initialProjectState.clientName);
  const [projectAddress, setProjectAddress] = useState(initialProjectState.projectAddress);
  const [contactDetails, setContactDetails] = useState(initialProjectState.contactDetails);
  const [projectManager, setProjectManager] = useState(initialProjectState.projectManager);
  const [estimator, setEstimator] = useState(initialProjectState.estimator);
  const [revision, setRevision] = useState(initialProjectState.revision);
  const [revisionNumber, setRevisionNumber] = useState(initialProjectState.revisionNumber);
  const [roomTemplates, setRoomTemplates] = useState(initialProjectState.roomTemplates);
  const [assemblyLineTemplates, setAssemblyLineTemplates] = useState(
    initialProjectState.assemblyLineTemplates
  );
  const [projectRooms, setProjectRooms] = useState(initialProjectState.projectRooms);
  const [estimateSections, setEstimateSections] = useState(initialProjectState.estimateSections);
  const [manualEstimateLines, setManualEstimateLines] = useState(
    initialProjectState.manualEstimateLines
  );
  const [generatedRowSectionAssignments, setGeneratedRowSectionAssignments] = useState(
    initialProjectState.generatedRowSectionAssignments
  );
  const [parameterLibraryUiState, setParameterLibraryUiState] = useState(
    initialProjectState.parameterLibraryUiState
  );
  const [stages, setStages] = useState(initialProjectState.stages);
  const [trades, setTrades] = useState(initialProjectState.trades);
  const [elements, setElements] = useState(initialProjectState.elements);
  const [assemblies, setAssemblies] = useState(initialProjectState.assemblies);
  const [costs, setCosts] = useState(initialProjectState.costs);
  const [estimateRowOverrides, setEstimateRowOverrides] = useState(
    initialProjectState.estimateRowOverrides
  );
  const [lastSavedAt, setLastSavedAt] = useState(initialProjectState.lastSavedAt);
  const [lastBackupAt, setLastBackupAt] = useState(initialProjectState.lastBackupAt);
  const [lastFileName, setLastFileName] = useState(initialProjectState.lastFileName);
  const [projectStatus, setProjectStatus] = useState(initialProjectStatus);
  const [supabaseLibrariesReady, setSupabaseLibrariesReady] = useState(!hasSupabaseCredentials);
  const [savedSnapshot, setSavedSnapshot] = useState(initialSavedSnapshot);
  const [estimateWorkspaceView, setEstimateWorkspaceView] = useState("builder");
  const previousComparableSnapshotRef = useRef(initialSavedSnapshot);
  const startupSourcesRef = useRef(initialLoadResult.startupSources);
  const projectFileInputRef = useRef(null);
  const projectMenuRef = useRef(null);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [workspaceTopbarPortalTarget, setWorkspaceTopbarPortalTarget] = useState(null);
  const currentAppState = useMemo(
    () => ({
      localProjectId,
      createdAt,
      updatedAt,
      roomTypes,
      parameters,
      units,
      costCodes,
      itemFamilies,
      projectName,
      estimateName,
      clientName,
      projectAddress,
      contactDetails,
      projectManager,
      estimator,
      revision,
      revisionNumber,
      roomTemplates,
      assemblyLineTemplates,
      projectRooms,
      estimateSections,
      manualEstimateLines,
      generatedRowSectionAssignments,
      parameterLibraryUiState,
      stages,
      trades,
      elements,
      assemblies,
      costs,
      estimateRowOverrides,
      lastSavedAt,
      lastBackupAt,
      lastFileName,
    }),
    [
      localProjectId,
      createdAt,
      updatedAt,
      roomTypes,
      parameters,
      units,
      costCodes,
      itemFamilies,
      projectName,
      estimateName,
      clientName,
      projectAddress,
      contactDetails,
      projectManager,
      estimator,
      revision,
      revisionNumber,
      roomTemplates,
      assemblyLineTemplates,
      projectRooms,
      estimateSections,
      manualEstimateLines,
      generatedRowSectionAssignments,
      parameterLibraryUiState,
      stages,
      trades,
      elements,
      assemblies,
      costs,
      estimateRowOverrides,
      lastSavedAt,
      lastBackupAt,
      lastFileName,
    ]
  );
  const isSupabaseLibrarySyncEnabled = hasSupabaseCredentials && supabaseLibrariesReady;

  useSupabaseCollectionSync({
    items: roomTypes,
    libraryKey: "roomTypes",
    enabled: isSupabaseLibrarySyncEnabled,
  });
  useSupabaseCollectionSync({
    items: parameters,
    libraryKey: "parameters",
    enabled: isSupabaseLibrarySyncEnabled,
  });
  useSupabaseCollectionSync({
    items: units,
    libraryKey: "units",
    enabled: isSupabaseLibrarySyncEnabled,
  });
  useSupabaseCollectionSync({
    items: costCodes,
    libraryKey: "costCodes",
    enabled: isSupabaseLibrarySyncEnabled,
  });
  useSupabaseCollectionSync({
    items: stages,
    libraryKey: "stages",
    enabled: isSupabaseLibrarySyncEnabled,
  });
  useSupabaseCollectionSync({
    items: trades,
    libraryKey: "trades",
    enabled: isSupabaseLibrarySyncEnabled,
  });
  useSupabaseCollectionSync({
    items: itemFamilies,
    libraryKey: "itemFamilies",
    enabled: isSupabaseLibrarySyncEnabled,
  });
  useSupabaseCollectionSync({
    items: elements,
    libraryKey: "elements",
    enabled: isSupabaseLibrarySyncEnabled,
  });
  useSupabaseCollectionSync({
    items: roomTemplates,
    libraryKey: "roomTemplates",
    enabled: isSupabaseLibrarySyncEnabled,
  });
  useSupabaseCollectionSync({
    items: assemblyLineTemplates,
    libraryKey: "assemblyLineTemplates",
    enabled: isSupabaseLibrarySyncEnabled,
  });
  useSupabaseCollectionSync({
    items: assemblies,
    libraryKey: "assemblies",
    enabled: isSupabaseLibrarySyncEnabled,
  });
  useSupabaseCollectionSync({
    items: costs,
    libraryKey: "costs",
    enabled: isSupabaseLibrarySyncEnabled,
  });

  const comparableSnapshot = useMemo(
    () => buildComparableAppState(currentAppState),
    [currentAppState]
  );
  const hasUnsavedChanges = comparableSnapshot !== savedSnapshot;
  const lastSavedIndicatorValue = useMemo(() => {
    const candidates = [lastSavedAt, lastBackupAt].filter(Boolean);

    if (!candidates.length) {
      return "";
    }

    return candidates.reduce((latest, current) =>
      new Date(current).getTime() > new Date(latest).getTime() ? current : latest
    );
  }, [lastBackupAt, lastSavedAt]);
  const pageGroups = useMemo(
    () =>
      pages.reduce((groups, page) => {
        if (!groups[page.group]) {
          groups[page.group] = [];
        }

        groups[page.group].push(page);
        return groups;
      }, {}),
    []
  );
  const activeEstimateSectionIds = useMemo(
    () => new Set(estimateSections.map((section) => section.id)),
    [estimateSections]
  );
  const committedProjectRooms = useMemo(
    () =>
      projectRooms.filter(
        (room) => room.sectionId && activeEstimateSectionIds.has(room.sectionId)
      ),
    [activeEstimateSectionIds, projectRooms]
  );
  const committedManualEstimateLines = useMemo(
    () =>
      manualEstimateLines.filter(
        (line) => line.sectionId && activeEstimateSectionIds.has(line.sectionId)
      ),
    [activeEstimateSectionIds, manualEstimateLines]
  );

  const estimateRows = useMemo(() => {
    return generateEstimateRows(
      committedProjectRooms,
      assemblies,
      costs,
      estimateRowOverrides,
      stages,
      trades,
      elements,
      units,
      costCodes
    ).filter((row) => !row.removed);
  }, [
    assemblies,
    committedProjectRooms,
    costs,
    estimateRowOverrides,
    stages,
    trades,
    elements,
    units,
    costCodes,
  ]);

  const manualBuilderRows = useMemo(() => {
    return generateManualEstimateBuilderRows(
      committedManualEstimateLines,
      estimateRowOverrides,
      estimateSections,
      stages,
      trades,
      elements,
      units,
      costCodes
    ).filter((row) => !row.removed);
  }, [
    committedManualEstimateLines,
    estimateRowOverrides,
    estimateSections,
    stages,
    trades,
    elements,
    units,
    costCodes,
  ]);

  const estimateSummary = useMemo(() => {
    return summarizeEstimateRows(estimateRows);
  }, [estimateRows]);

  const handleEstimateRowChange = (rowId, updates) => {
    const normalizedUpdates =
      Object.prototype.hasOwnProperty.call(updates || {}, "stageId")
        ? {
            ...Object.fromEntries(
              Object.entries(updates || {}).filter(([key]) => key !== "stage")
            ),
            stageId: getStageIntegrity(updates.stageId, stages, updates.stage).stageId,
          }
        : updates;

    setEstimateRowOverrides((current) => {
      const nextEstimateRowOverrides = {
        ...current,
        [rowId]: {
          ...(current[rowId] || {}),
          ...normalizedUpdates,
        },
      };
      console.log("Updated row", rowId, nextEstimateRowOverrides[rowId]?.stageId ?? "");

      persistAppStateToLocalStorage({
        ...currentAppState,
        estimateRowOverrides: nextEstimateRowOverrides,
      });

      if (process.env.NODE_ENV !== "production" && isCanvasDebugLoggingEnabled()) {
        console.info("[Canvas Grid] Persist row override", {
          rowId,
          stageId: nextEstimateRowOverrides[rowId]?.stageId ?? "",
          canvasColumn: nextEstimateRowOverrides[rowId]?.canvasColumn ?? "",
          canvasTrack: nextEstimateRowOverrides[rowId]?.canvasTrack ?? "",
        });
      }

      return nextEstimateRowOverrides;
    });
  };

  const handleEstimateSectionsChange = (nextSections) => {
    setEstimateSections(
      (nextSections || []).map((section) =>
        normalizeStageBoundRecord(section, stages, { context: "estimate-section" })
      )
    );
  };

  const handleManualEstimateLinesChange = (nextLines) => {
    setManualEstimateLines(
      (nextLines || []).map((line) =>
        normalizeStageBoundRecord(line, stages, { context: "manual-estimate-line" })
      )
    );
  };

  useEffect(() => {
    if (!hasSupabaseCredentials) {
      setSupabaseLibrariesReady(true);
      return undefined;
    }

    let isMounted = true;

    async function hydrateLibrariesFromSupabase() {
      try {
        const libraryState = await fetchDynexLibraryState();

        if (!isMounted || !libraryState) {
          return;
        }

        if (Array.isArray(libraryState.roomTypes)) {
          setRoomTypes(libraryState.roomTypes);
        }
        if (Array.isArray(libraryState.parameters)) {
          setParameters(libraryState.parameters);
        }
        if (Array.isArray(libraryState.units)) {
          setUnits(libraryState.units);
        }
        if (Array.isArray(libraryState.costCodes)) {
          setCostCodes(libraryState.costCodes);
        }
        if (Array.isArray(libraryState.stages)) {
          setStages(libraryState.stages);
        }
        if (Array.isArray(libraryState.trades)) {
          setTrades(libraryState.trades);
        }
        if (Array.isArray(libraryState.itemFamilies)) {
          setItemFamilies(libraryState.itemFamilies);
        }
        if (Array.isArray(libraryState.elements)) {
          setElements(libraryState.elements);
        }
        if (Array.isArray(libraryState.roomTemplates)) {
          setRoomTemplates(libraryState.roomTemplates);
        }
        if (Array.isArray(libraryState.assemblyLineTemplates)) {
          setAssemblyLineTemplates(libraryState.assemblyLineTemplates);
        }
        if (Array.isArray(libraryState.assemblies)) {
          setAssemblies(libraryState.assemblies);
        }
        if (Array.isArray(libraryState.costs)) {
          setCosts(libraryState.costs);
        }
      } catch (error) {
        console.error("Failed to hydrate libraries from Supabase:", error);
      } finally {
        if (isMounted) {
          setSupabaseLibrariesReady(true);
        }
      }
    }

    hydrateLibrariesFromSupabase();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    persistAppStateToLocalStorage(currentAppState);
  }, [currentAppState]);

  useEffect(() => {
    logStartupSources(startupSourcesRef.current);
  }, []);

  useEffect(() => {
    if (!isProjectMenuOpen || typeof document === "undefined") {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (projectMenuRef.current?.contains(event.target)) {
        return;
      }

      setIsProjectMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isProjectMenuOpen]);

  useEffect(() => {
    if (comparableSnapshot === previousComparableSnapshotRef.current) {
      return;
    }

    previousComparableSnapshotRef.current = comparableSnapshot;
    setUpdatedAt(new Date().toISOString());
  }, [comparableSnapshot]);

  const applyAppState = (nextAppState, statusMessage, options = {}) => {
    const normalizedAppState = normalizeAppState(nextAppState);

    setLocalProjectId(normalizedAppState.localProjectId);
    setCreatedAt(normalizedAppState.createdAt);
    setUpdatedAt(normalizedAppState.updatedAt);
    setRoomTypes(normalizedAppState.roomTypes);
    setParameters(normalizedAppState.parameters);
    setUnits(normalizedAppState.units);
    setCostCodes(normalizedAppState.costCodes);
    setItemFamilies(normalizedAppState.itemFamilies);
    setProjectName(normalizedAppState.projectName);
    setEstimateName(normalizedAppState.estimateName);
    setClientName(normalizedAppState.clientName);
    setProjectAddress(normalizedAppState.projectAddress);
    setContactDetails(normalizedAppState.contactDetails);
    setProjectManager(normalizedAppState.projectManager);
    setEstimator(normalizedAppState.estimator);
    setRevision(normalizedAppState.revision);
    setRevisionNumber(normalizedAppState.revisionNumber);
    setRoomTemplates(normalizedAppState.roomTemplates);
    setAssemblyLineTemplates(normalizedAppState.assemblyLineTemplates);
    setProjectRooms(normalizedAppState.projectRooms);
    setEstimateSections(normalizedAppState.estimateSections);
    setManualEstimateLines(normalizedAppState.manualEstimateLines);
    setGeneratedRowSectionAssignments(normalizedAppState.generatedRowSectionAssignments);
    setParameterLibraryUiState(normalizedAppState.parameterLibraryUiState);
    setStages(normalizedAppState.stages);
    setTrades(normalizedAppState.trades);
    setElements(normalizedAppState.elements);
    setAssemblies(normalizedAppState.assemblies);
    setCosts(normalizedAppState.costs);
    setEstimateRowOverrides(normalizedAppState.estimateRowOverrides);
    setLastSavedAt(normalizedAppState.lastSavedAt);
    setLastBackupAt(normalizedAppState.lastBackupAt);
    setLastFileName(normalizedAppState.lastFileName);
    persistAppStateToLocalStorage(normalizedAppState);
    if (options.markAsSaved) {
      const nextSavedSnapshot = buildComparableAppState(normalizedAppState);
      previousComparableSnapshotRef.current = nextSavedSnapshot;
      setSavedSnapshot(nextSavedSnapshot);
    }
    setProjectStatus(statusMessage);
  };

  const handleStagesChange = (nextStages) => {
    applyAppState(
      {
        ...currentAppState,
        stages: nextStages,
      },
      "Stage library updated."
    );
  };

  const confirmDiscardUnsavedChanges = (actionLabel) => {
    if (!hasUnsavedChanges || typeof window === "undefined") {
      return true;
    }

    return window.confirm(
      `You have unsaved changes. Do you want to ${actionLabel} and discard them?`
    );
  };

  const promptForFileName = (suggestedFileName) => {
    if (typeof window === "undefined") {
      return suggestedFileName;
    }

    const promptedValue = window.prompt("Save project as", suggestedFileName);

    if (promptedValue == null) {
      return null;
    }

    const normalizedFileName = sanitizeFileNamePart(promptedValue) || suggestedFileName;

    return normalizedFileName.toLowerCase().endsWith(".json")
      ? normalizedFileName
      : `${normalizedFileName}.json`;
  };

  const getSuggestedFileName = (appState = currentAppState) =>
    buildProjectFileName(appState.estimateName || appState.projectName, appState.revision);

  const exportProjectFile = (nextAppState, fileName, successMessage) => {
    if (typeof window === "undefined") {
      return false;
    }

    const savedAt = new Date().toISOString();
    const finalizedAppState = normalizeAppState({
      ...nextAppState,
      updatedAt: savedAt,
      lastSavedAt: savedAt,
      lastBackupAt: savedAt,
      lastFileName: fileName,
    });
    const projectFilePayload = buildProjectFilePayload(finalizedAppState, savedAt);
    const fileBlob = new Blob([JSON.stringify(projectFilePayload, null, 2)], {
      type: "application/json",
    });
    const downloadUrl = window.URL.createObjectURL(fileBlob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(downloadUrl);

    applyAppState(finalizedAppState, successMessage, { markAsSaved: true });
    return true;
  };

  const saveProjectToFile = () => {
    exportProjectFile(
      currentAppState,
      lastFileName || getSuggestedFileName(),
      "Project file saved."
    );
  };

  const saveProjectAs = () => {
    const fileName = promptForFileName(getSuggestedFileName());

    if (!fileName) {
      return;
    }

    exportProjectFile(currentAppState, fileName, "Project saved as a new file.");
  };

  const saveAsRevision = () => {
    const nextRevisionNumber = revisionNumber + 1;
    const nextRevision = buildRevisionLabel(nextRevisionNumber);
    const nextAppState = {
      ...currentAppState,
      revision: nextRevision,
      revisionNumber: nextRevisionNumber,
    };
    const fileName = promptForFileName(getSuggestedFileName(nextAppState));

    if (!fileName) {
      return;
    }

    exportProjectFile(nextAppState, fileName, `Saved as revision ${nextRevision}.`);
  };

  const beginOpenProject = () => confirmDiscardUnsavedChanges("open another project");

  const openProjectFromFile = async (file) => {
    if (!file) {
      return;
    }

    try {
      const fileContents = await readFileAsText(file);
      const parsedFile = JSON.parse(fileContents);
      const nextProjectState = normalizeImportedProjectFile({
        ...parsedFile,
        appState: isRecord(parsedFile.appState)
          ? {
              ...parsedFile.appState,
              lastFileName: file.name,
            }
          : {
              ...parsedFile,
              lastFileName: file.name,
            },
      });

      applyAppState(nextProjectState, `Opened project file: ${file.name}`, {
        markAsSaved: true,
      });
      console.info("[Dynex] Imported project file source", {
        projectData: "imported-project-file",
        costCodes: "imported-project-file",
        costs: "imported-project-file",
        assemblies: "imported-project-file",
        fileName: file.name,
      });
    } catch (error) {
      setProjectStatus("Unable to open project file. Please choose a valid project JSON file.");
    }
  };

  const resetProject = () => {
    if (!confirmDiscardUnsavedChanges("start a new project")) {
      return;
    }

    const nextProjectState = {
      ...currentAppState,
      ...getDefaultProjectData(),
    };

    applyAppState(nextProjectState, "Started a new project.", { markAsSaved: true });
  };

  const openProjectPicker = () => {
    if (beginOpenProject()) {
      projectFileInputRef.current?.click();
    }
    setIsProjectMenuOpen(false);
  };

  const runProjectMenuAction = (action) => {
    setIsProjectMenuOpen(false);
    action();
  };

  const projectMenuLabel = `${projectName || "Project"} (${revision || "Rev 0"})`;

  return (
    <div>
      <div className="app-shell">
        <aside className="sidebar">
        {false ? (
        <button
          type="button"
          className={[
            "nav-button",
            "nav-button-secondary",
            activePage === "project-details" ? "active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setActivePage("project-details")}
        >
          <span className="nav-button-icon" aria-hidden="true">
            ⌘
          </span>
          <span className="nav-button-label">Project Details</span>
        </button>
        ) : null}

        <nav className="nav-list" aria-label="App sections">
          {Object.entries(pageGroups).map(([groupName, groupPages]) => (
            <div
              key={groupName}
              className={["nav-group", getSidebarGroupClassName(groupName)]
                .filter(Boolean)
                .join(" ")}
            >
              <p className="nav-group-label">{groupName}</p>
              <div className="nav-group-items">
                {groupPages.map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    className={
                      [
                        "nav-button",
                        getSidebarButtonPriorityClassName(page.id),
                        page.id === activePage ? "active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")
                    }
                    onClick={() => setActivePage(page.id)}
                  >
                    <span className="nav-button-icon" aria-hidden="true">
                      {page.icon}
                    </span>
                    <span className="nav-button-label">{page.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

        <main className="content">
        <header className="app-topbar">
          <div className="app-header">
            <div className="app-header__left">
              <div className="app-topbar-identity" aria-label="dynex identity">
                dynex
              </div>
              {activePage === "estimate-builder" ? (
                <EstimateWorkspaceViewSwitcher
                  activeView={estimateWorkspaceView}
                  onViewChange={setEstimateWorkspaceView}
                  className="app-header__workspace-switcher"
                />
              ) : null}
            </div>

            <div className="app-header__center" ref={setWorkspaceTopbarPortalTarget} />

            <div className="app-header__right">
              <div className="project-menu" ref={projectMenuRef}>
                <button
                  type="button"
                  className="project-menu-trigger"
                  aria-label="Project menu"
                  aria-expanded={isProjectMenuOpen}
                  onClick={() => setIsProjectMenuOpen((current) => !current)}
                >
                  <span className="project-menu-trigger-label">{projectMenuLabel}</span>
                  <span className="project-menu-trigger-caret" aria-hidden="true">
                    {isProjectMenuOpen ? "v" : ">"}
                  </span>
                </button>

                {isProjectMenuOpen ? (
                  <div className="project-menu-panel" role="menu" aria-label="Project actions">
                    <div className="project-menu-summary">
                      <strong>{projectName || "Untitled Project"}</strong>
                      <span>{revision || "Rev 0"}</span>
                    </div>

                    <button
                      type="button"
                      className="project-menu-item"
                      role="menuitem"
                      onClick={() => runProjectMenuAction(() => setActivePage("project-details"))}
                    >
                      Project Details
                    </button>
                    <button
                      type="button"
                      className="project-menu-item"
                      role="menuitem"
                      onClick={() => runProjectMenuAction(resetProject)}
                    >
                      New Project
                    </button>
                    <button
                      type="button"
                      className="project-menu-item"
                      role="menuitem"
                      onClick={openProjectPicker}
                    >
                      Open Project
                    </button>
                    <button
                      type="button"
                      className="project-menu-item"
                      role="menuitem"
                      onClick={() => runProjectMenuAction(saveProjectToFile)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="project-menu-item"
                      role="menuitem"
                      onClick={() => runProjectMenuAction(saveProjectAs)}
                    >
                      Save As
                    </button>
                    <button
                      type="button"
                      className="project-menu-item"
                      role="menuitem"
                      onClick={() => runProjectMenuAction(saveAsRevision)}
                    >
                      Save Revision
                    </button>
                    <button
                      type="button"
                      className="project-menu-item"
                      role="menuitem"
                      onClick={openProjectPicker}
                    >
                      Import JSON
                    </button>
                    <button
                      type="button"
                      className="project-menu-item"
                      role="menuitem"
                      onClick={() => runProjectMenuAction(saveProjectToFile)}
                    >
                      Export JSON
                    </button>
                  </div>
                ) : null}

                <input
                  ref={projectFileInputRef}
                  type="file"
                  accept=".json,application/json"
                  aria-label="Open Project File"
                  hidden
                  onChange={(event) => {
                    const [file] = Array.from(event.target.files || []);
                    openProjectFromFile(file || null);
                    event.target.value = "";
                  }}
                />
              </div>
            </div>
          </div>
        </header>

        <div
          className={[
            "content-body",
            activePage === "estimate-builder" ? "content-body--workspace" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
        {activePage === "project-details" && (
          <ProjectDetailsPage
            projectName={projectName}
            estimateName={estimateName}
            clientName={clientName}
            projectAddress={projectAddress}
            contactDetails={contactDetails}
            projectManager={projectManager}
            estimator={estimator}
            revision={revision}
            localProjectId={localProjectId}
            createdAt={createdAt}
            updatedAt={updatedAt}
            hasUnsavedChanges={hasUnsavedChanges}
            lastSavedAt={formatLastSaved(lastSavedIndicatorValue)}
            lastBackupAt={formatLastSaved(lastBackupAt)}
            lastFileName={lastFileName || "Not saved yet"}
            projectStatus={projectStatus}
            onProjectNameChange={setProjectName}
            onEstimateNameChange={setEstimateName}
            onClientNameChange={setClientName}
            onProjectAddressChange={setProjectAddress}
            onContactDetailsChange={setContactDetails}
            onProjectManagerChange={setProjectManager}
            onEstimatorChange={setEstimator}
            onRevisionChange={(value) => {
              setRevision(value);
              setRevisionNumber(getRevisionNumber(value, revisionNumber));
            }}
            onSaveProject={saveProjectToFile}
            onSaveProjectAs={saveProjectAs}
            onSaveAsRevision={saveAsRevision}
            onBeginOpenProject={beginOpenProject}
            onOpenProject={openProjectFromFile}
            onResetProject={resetProject}
          />
        )}

        {activePage === "stages" && (
          <StageLibraryPage stages={stages} onStagesChange={handleStagesChange} />
        )}

        {activePage === "trades" && (
          <TradeLibraryPage trades={trades} onTradesChange={setTrades} />
        )}

        {activePage === "item-families" && (
          <ItemFamilyLibraryPage
            itemFamilies={itemFamilies}
            onItemFamiliesChange={setItemFamilies}
          />
        )}

        {activePage === "elements" && (
          <ElementLibraryPage elements={elements} onElementsChange={setElements} />
        )}

        {activePage === "parameters" && (
          <ParameterLibraryPage
            parameters={parameters}
            onParametersChange={setParameters}
            expandedCategories={parameterLibraryUiState?.expandedCategories || {}}
            onExpandedCategoriesChange={(expandedCategories) =>
              setParameterLibraryUiState((current) => ({
                ...(current || {}),
                expandedCategories,
              }))
            }
          />
        )}

        {activePage === "room-types" && (
          <RoomTypeLibraryPage
            roomTypes={roomTypes}
            parameters={parameters}
            onRoomTypesChange={setRoomTypes}
          />
        )}

        {activePage === "units" && (
          <UnitLibraryPage units={units} onUnitsChange={setUnits} />
        )}

        {activePage === "cost-codes" && (
          <CostCodeLibraryPage costCodes={costCodes} onCostCodesChange={setCostCodes} />
        )}

        {activePage === "rooms" && (
          <RoomInputsPage
            rooms={roomTemplates}
            assemblies={assemblies}
            roomTypes={roomTypes}
            parameters={parameters}
            costs={costs}
            stages={stages}
            trades={trades}
            elements={elements}
            units={units}
            costCodes={costCodes}
            onRoomsChange={setRoomTemplates}
          />
        )}

        {activePage === "summary" && <SummaryDashboardPage rows={estimateRows} />}

        {activePage === "labour-summary" && <LabourSummaryPage rows={estimateRows} />}

        {activePage === "missing-rates" && <MissingRatesPage rows={estimateRows} />}

        {activePage === "assembly-lines" && (
          <AssemblyLineLibraryPage
            assemblyLineTemplates={assemblyLineTemplates}
            costs={costs}
            trades={trades}
            costCodes={costCodes}
            units={units}
            roomTypes={roomTypes}
            elements={elements}
            parameters={parameters}
            onAssemblyLineTemplatesChange={setAssemblyLineTemplates}
          />
        )}

        {activePage === "assemblies" && (
          <AssemblyLibraryPage
            assemblies={assemblies}
            stages={stages}
            trades={trades}
            elements={elements}
            roomTypes={roomTypes}
            costCodes={costCodes}
            itemFamilies={itemFamilies}
            units={units}
            costs={costs}
            assemblyLineTemplates={assemblyLineTemplates}
            parameters={parameters}
            onAssembliesChange={setAssemblies}
            onCostsChange={setCosts}
            onItemFamiliesChange={setItemFamilies}
          />
        )}

        {activePage === "costs" && (
          <CostLibraryPage
            costs={costs}
            units={units}
            trades={trades}
            costCodes={costCodes}
            itemFamilies={itemFamilies}
            onCostsChange={setCosts}
            onItemFamiliesChange={setItemFamilies}
          />
        )}

        {activePage === "estimate-builder" && (
          <EstimateWorkspacePage
            projectName={projectName}
            estimateName={estimateName}
            estimateRevision={revision}
            sections={estimateSections}
            manualLines={manualEstimateLines}
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
            onSectionsChange={handleEstimateSectionsChange}
            onManualLinesChange={handleManualEstimateLinesChange}
            onProjectRoomsChange={setProjectRooms}
            onEstimateNameChange={setEstimateName}
            onEstimateRevisionChange={(value) => {
              setRevision(value);
              setRevisionNumber(getRevisionNumber(value, revisionNumber));
            }}
            onRowOverrideChange={handleEstimateRowChange}
            generatedRows={estimateRows.filter((row) => row.source === "generated")}
            manualBuilderRows={manualBuilderRows}
            generatedRowSectionAssignments={generatedRowSectionAssignments}
            onGeneratedRowSectionAssignmentsChange={setGeneratedRowSectionAssignments}
            activeView={estimateWorkspaceView}
            onActiveViewChange={setEstimateWorkspaceView}
            topBarPortalTarget={workspaceTopbarPortalTarget}
          />
        )}

        {activePage === "estimate" && (
          <EstimateOutputPage
            rows={estimateRows}
            manualBuilderRows={manualBuilderRows}
            summary={estimateSummary}
            sections={estimateSections}
            generatedRowSectionAssignments={generatedRowSectionAssignments}
            stages={stages}
            onRowOverrideChange={handleEstimateRowChange}
          />
        )}
        </div>
        </main>
      </div>
    </div>
  );
}

export default App;





