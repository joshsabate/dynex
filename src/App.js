import { useEffect, useMemo, useState } from "react";
import "./App.css";
import AssemblyLibraryPage from "./pages/AssemblyLibraryPage";
import CostLibraryPage from "./pages/CostLibraryPage";
import CostCodeLibraryPage from "./pages/CostCodeLibraryPage";
import EstimateBuilderPage from "./pages/EstimateBuilderPage";
import EstimateOutputPage from "./pages/EstimateOutputPage";
import LabourSummaryPage from "./pages/LabourSummaryPage";
import MissingRatesPage from "./pages/MissingRatesPage";
import ParameterLibraryPage from "./pages/ParameterLibraryPage";
import ProjectDetailsPage from "./pages/ProjectDetailsPage";
import RoomTypeLibraryPage from "./pages/RoomTypeLibraryPage";
import RoomInputsPage from "./pages/RoomInputsPage";
import SummaryDashboardPage from "./pages/SummaryDashboardPage";
import ElementLibraryPage from "./pages/ElementLibraryPage";
import StageLibraryPage from "./pages/StageLibraryPage";
import TradeLibraryPage from "./pages/TradeLibraryPage";
import UnitLibraryPage from "./pages/UnitLibraryPage";
import {
  initialAssemblies,
  initialCostCodes,
  initialCosts,
  initialElements,
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

const legacyLocalStorageKey = "estimator-app-project";
const globalLibrariesStorageKey = "estimator-app-global-libraries";
const libraryDataStorageKey = "estimator-app-library-data";
const projectDataStorageKey = "estimator-app-project-data";
const projectFileFormat = "estimator-app-project-file";
const projectFileVersion = 1;

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
  { id: "room-types", label: "Room Type Library", icon: "⌂", group: "Room Setup" },
  { id: "rooms", label: "Room Library", icon: "▤", group: "Room Setup" },
  { id: "assemblies", label: "Assembly Library", icon: "▦", group: "Room Setup" },
];

function getDefaultGlobalLibraries() {
  return {
    roomTypes: initialRoomTypes,
    parameters: initialParameters,
    units: initialUnits,
    costCodes: initialCostCodes,
    stages: initialStages,
    trades: initialTrades,
    elements: initialElements,
  };
}

function getDefaultLibraryData() {
  return {
    roomTemplates: initialRooms,
    assemblies: initialAssemblies,
    costs: initialCosts,
  };
}

function getDefaultProjectData() {
  return {
    projectName: "Untitled Project",
    clientName: "",
    projectAddress: "",
    contactDetails: "",
    projectManager: "",
    estimator: "",
    revision: "Rev 0",
    projectRooms: [],
    estimateSections: [],
    manualEstimateLines: [],
    generatedRowSectionAssignments: {},
    estimateRowOverrides: {},
    lastSavedAt: "",
  };
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

function loadGlobalLibraries() {
  const defaultGlobalLibraries = getDefaultGlobalLibraries();
  const savedLibraries = readStoredJson(globalLibrariesStorageKey);

  if (savedLibraries) {
    return {
      ...defaultGlobalLibraries,
      ...savedLibraries,
      roomTypes: savedLibraries.roomTypes || defaultGlobalLibraries.roomTypes,
      parameters: savedLibraries.parameters || defaultGlobalLibraries.parameters,
      units: savedLibraries.units || defaultGlobalLibraries.units,
      costCodes: savedLibraries.costCodes || defaultGlobalLibraries.costCodes,
      stages: savedLibraries.stages || defaultGlobalLibraries.stages,
      trades: savedLibraries.trades || defaultGlobalLibraries.trades,
      elements: savedLibraries.elements || defaultGlobalLibraries.elements,
    };
  }

  const legacyProjectState = readStoredJson(legacyLocalStorageKey);

  if (!legacyProjectState) {
    return defaultGlobalLibraries;
  }

  return {
    ...defaultGlobalLibraries,
    roomTypes: legacyProjectState.roomTypes || defaultGlobalLibraries.roomTypes,
    parameters: defaultGlobalLibraries.parameters,
    units: legacyProjectState.units || defaultGlobalLibraries.units,
    costCodes: legacyProjectState.costCodes || defaultGlobalLibraries.costCodes,
    stages: legacyProjectState.stages || defaultGlobalLibraries.stages,
    trades: legacyProjectState.trades || defaultGlobalLibraries.trades,
    elements: legacyProjectState.elements || defaultGlobalLibraries.elements,
  };
}

function loadLibraryData() {
  const defaultLibraryData = getDefaultLibraryData();
  const savedLibraryData = readStoredJson(libraryDataStorageKey);

  if (savedLibraryData) {
    return {
      ...defaultLibraryData,
      ...savedLibraryData,
      roomTemplates: savedLibraryData.roomTemplates || defaultLibraryData.roomTemplates,
      assemblies: savedLibraryData.assemblies || defaultLibraryData.assemblies,
      costs: savedLibraryData.costs || defaultLibraryData.costs,
    };
  }

  const legacyProjectState = readStoredJson(legacyLocalStorageKey);

  if (!legacyProjectState) {
    return defaultLibraryData;
  }

  return {
    ...defaultLibraryData,
    roomTemplates:
      legacyProjectState.roomTemplates ||
      legacyProjectState.rooms ||
      defaultLibraryData.roomTemplates,
    assemblies: legacyProjectState.assemblies || defaultLibraryData.assemblies,
    costs: legacyProjectState.costs || defaultLibraryData.costs,
  };
}

function loadProjectData() {
  const defaultProjectData = getDefaultProjectData();
  const savedProjectData = readStoredJson(projectDataStorageKey);

  if (savedProjectData) {
    return {
      ...defaultProjectData,
      ...savedProjectData,
      projectAddress: savedProjectData.projectAddress || defaultProjectData.projectAddress,
      contactDetails: savedProjectData.contactDetails || defaultProjectData.contactDetails,
      projectManager: savedProjectData.projectManager || defaultProjectData.projectManager,
      estimator: savedProjectData.estimator || defaultProjectData.estimator,
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
    };
  }

  const legacyProjectState = readStoredJson(legacyLocalStorageKey);

  if (!legacyProjectState) {
    return defaultProjectData;
  }

  return {
    ...defaultProjectData,
    projectName: legacyProjectState.projectName || defaultProjectData.projectName,
    clientName: legacyProjectState.clientName || defaultProjectData.clientName,
    projectAddress: defaultProjectData.projectAddress,
    contactDetails: defaultProjectData.contactDetails,
    projectManager: defaultProjectData.projectManager,
    estimator: defaultProjectData.estimator,
    revision: legacyProjectState.revision || defaultProjectData.revision,
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
  };
}

function loadAppState() {
  return {
    ...loadGlobalLibraries(),
    ...loadLibraryData(),
    ...loadProjectData(),
  };
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

function normalizeAppState(source = {}) {
  const defaultGlobalLibraries = getDefaultGlobalLibraries();
  const defaultLibraryData = getDefaultLibraryData();
  const defaultProjectData = getDefaultProjectData();

  return {
    ...defaultGlobalLibraries,
    ...defaultLibraryData,
    ...defaultProjectData,
    ...source,
    roomTypes: Array.isArray(source.roomTypes)
      ? source.roomTypes
      : defaultGlobalLibraries.roomTypes,
    parameters: Array.isArray(source.parameters)
      ? source.parameters
      : defaultGlobalLibraries.parameters,
    units: Array.isArray(source.units) ? source.units : defaultGlobalLibraries.units,
    costCodes: Array.isArray(source.costCodes)
      ? source.costCodes
      : defaultGlobalLibraries.costCodes,
    stages: Array.isArray(source.stages) ? source.stages : defaultGlobalLibraries.stages,
    trades: Array.isArray(source.trades) ? source.trades : defaultGlobalLibraries.trades,
    elements: Array.isArray(source.elements)
      ? source.elements
      : defaultGlobalLibraries.elements,
    roomTemplates: Array.isArray(source.roomTemplates)
      ? source.roomTemplates
      : Array.isArray(source.rooms)
        ? source.rooms
        : defaultLibraryData.roomTemplates,
    assemblies: Array.isArray(source.assemblies)
      ? source.assemblies
      : defaultLibraryData.assemblies,
    costs: Array.isArray(source.costs) ? source.costs : defaultLibraryData.costs,
    projectName: source.projectName ?? defaultProjectData.projectName,
    clientName: source.clientName ?? defaultProjectData.clientName,
    projectAddress: source.projectAddress ?? defaultProjectData.projectAddress,
    contactDetails: source.contactDetails ?? defaultProjectData.contactDetails,
    projectManager: source.projectManager ?? defaultProjectData.projectManager,
    estimator: source.estimator ?? defaultProjectData.estimator,
    revision: source.revision ?? defaultProjectData.revision,
    projectRooms: Array.isArray(source.projectRooms)
      ? source.projectRooms
      : defaultProjectData.projectRooms,
    estimateSections: Array.isArray(source.estimateSections)
      ? source.estimateSections
      : defaultProjectData.estimateSections,
    manualEstimateLines: Array.isArray(source.manualEstimateLines)
      ? source.manualEstimateLines
      : defaultProjectData.manualEstimateLines,
    generatedRowSectionAssignments: isRecord(source.generatedRowSectionAssignments)
      ? source.generatedRowSectionAssignments
      : defaultProjectData.generatedRowSectionAssignments,
    estimateRowOverrides: isRecord(source.estimateRowOverrides)
      ? source.estimateRowOverrides
      : defaultProjectData.estimateRowOverrides,
    lastSavedAt: source.lastSavedAt ?? defaultProjectData.lastSavedAt,
  };
}

function splitAppStateForStorage(appState) {
  return {
    globalLibraries: {
      roomTypes: appState.roomTypes,
      parameters: appState.parameters,
      units: appState.units,
      costCodes: appState.costCodes,
      stages: appState.stages,
      trades: appState.trades,
      elements: appState.elements,
    },
    libraryData: {
      roomTemplates: appState.roomTemplates,
      assemblies: appState.assemblies,
      costs: appState.costs,
    },
    projectData: {
      projectName: appState.projectName,
      clientName: appState.clientName,
      projectAddress: appState.projectAddress,
      contactDetails: appState.contactDetails,
      projectManager: appState.projectManager,
      estimator: appState.estimator,
      revision: appState.revision,
      projectRooms: appState.projectRooms,
      estimateSections: appState.estimateSections,
      manualEstimateLines: appState.manualEstimateLines,
      generatedRowSectionAssignments: appState.generatedRowSectionAssignments,
      estimateRowOverrides: appState.estimateRowOverrides,
      lastSavedAt: appState.lastSavedAt,
    },
  };
}

function persistAppStateToLocalStorage(appState) {
  if (typeof window === "undefined") {
    return;
  }

  const { globalLibraries, libraryData, projectData } = splitAppStateForStorage(appState);

  window.localStorage.setItem(globalLibrariesStorageKey, JSON.stringify(globalLibraries));
  window.localStorage.setItem(libraryDataStorageKey, JSON.stringify(libraryData));
  window.localStorage.setItem(projectDataStorageKey, JSON.stringify(projectData));
  window.localStorage.removeItem(legacyLocalStorageKey);
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
  const initialProjectState = useMemo(() => loadAppState(), []);
  const [activePage, setActivePage] = useState("estimate-builder");
  const [roomTypes, setRoomTypes] = useState(initialProjectState.roomTypes);
  const [parameters, setParameters] = useState(initialProjectState.parameters);
  const [units, setUnits] = useState(initialProjectState.units);
  const [costCodes, setCostCodes] = useState(initialProjectState.costCodes);
  const [projectName, setProjectName] = useState(initialProjectState.projectName);
  const [clientName, setClientName] = useState(initialProjectState.clientName);
  const [projectAddress, setProjectAddress] = useState(initialProjectState.projectAddress);
  const [contactDetails, setContactDetails] = useState(initialProjectState.contactDetails);
  const [projectManager, setProjectManager] = useState(initialProjectState.projectManager);
  const [estimator, setEstimator] = useState(initialProjectState.estimator);
  const [revision, setRevision] = useState(initialProjectState.revision);
  const [roomTemplates, setRoomTemplates] = useState(initialProjectState.roomTemplates);
  const [projectRooms, setProjectRooms] = useState(initialProjectState.projectRooms);
  const [estimateSections, setEstimateSections] = useState(initialProjectState.estimateSections);
  const [manualEstimateLines, setManualEstimateLines] = useState(
    initialProjectState.manualEstimateLines
  );
  const [generatedRowSectionAssignments, setGeneratedRowSectionAssignments] = useState(
    initialProjectState.generatedRowSectionAssignments
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
  const [projectStatus, setProjectStatus] = useState("");
  const currentAppState = useMemo(
    () => ({
      roomTypes,
      parameters,
      units,
      costCodes,
      projectName,
      clientName,
      projectAddress,
      contactDetails,
      projectManager,
      estimator,
      revision,
      roomTemplates,
      projectRooms,
      estimateSections,
      manualEstimateLines,
      generatedRowSectionAssignments,
      stages,
      trades,
      elements,
      assemblies,
      costs,
      estimateRowOverrides,
      lastSavedAt,
    }),
    [
      roomTypes,
      parameters,
      units,
      costCodes,
      projectName,
      clientName,
      projectAddress,
      contactDetails,
      projectManager,
      estimator,
      revision,
      roomTemplates,
      projectRooms,
      estimateSections,
      manualEstimateLines,
      generatedRowSectionAssignments,
      stages,
      trades,
      elements,
      assemblies,
      costs,
      estimateRowOverrides,
      lastSavedAt,
    ]
  );
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
    setEstimateRowOverrides((current) => ({
      ...current,
      [rowId]: {
        ...(current[rowId] || {}),
        ...updates,
      },
    }));
  };

  useEffect(() => {
    persistAppStateToLocalStorage(currentAppState);
  }, [currentAppState]);

  const applyAppState = (nextAppState, statusMessage) => {
    setRoomTypes(nextAppState.roomTypes);
    setParameters(nextAppState.parameters);
    setUnits(nextAppState.units);
    setCostCodes(nextAppState.costCodes);
    setProjectName(nextAppState.projectName);
    setClientName(nextAppState.clientName);
    setProjectAddress(nextAppState.projectAddress);
    setContactDetails(nextAppState.contactDetails);
    setProjectManager(nextAppState.projectManager);
    setEstimator(nextAppState.estimator);
    setRevision(nextAppState.revision);
    setRoomTemplates(nextAppState.roomTemplates);
    setProjectRooms(nextAppState.projectRooms);
    setEstimateSections(nextAppState.estimateSections);
    setManualEstimateLines(nextAppState.manualEstimateLines);
    setGeneratedRowSectionAssignments(nextAppState.generatedRowSectionAssignments);
    setStages(nextAppState.stages);
    setTrades(nextAppState.trades);
    setElements(nextAppState.elements);
    setAssemblies(nextAppState.assemblies);
    setCosts(nextAppState.costs);
    setEstimateRowOverrides(nextAppState.estimateRowOverrides);
    setLastSavedAt(nextAppState.lastSavedAt);
    persistAppStateToLocalStorage(nextAppState);
    setProjectStatus(statusMessage);
  };

  const saveProjectToFile = () => {
    if (typeof window === "undefined") {
      return;
    }

    const savedAt = new Date().toISOString();
    const nextAppState = {
      ...currentAppState,
      lastSavedAt: savedAt,
    };
    const projectFilePayload = buildProjectFilePayload(nextAppState, savedAt);
    const fileBlob = new Blob([JSON.stringify(projectFilePayload, null, 2)], {
      type: "application/json",
    });
    const downloadUrl = window.URL.createObjectURL(fileBlob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = buildProjectFileName(projectName, revision);
    link.click();
    window.URL.revokeObjectURL(downloadUrl);

    persistAppStateToLocalStorage(nextAppState);
    setLastSavedAt(savedAt);
    setProjectStatus("Project file saved.");
  };

  const openProjectFromFile = async (file) => {
    if (!file) {
      return;
    }

    try {
      const fileContents = await readFileAsText(file);
      const parsedFile = JSON.parse(fileContents);
      const nextProjectState = normalizeImportedProjectFile(parsedFile);

      applyAppState(nextProjectState, `Opened project file: ${file.name}`);
    } catch (error) {
      setProjectStatus("Unable to open project file. Please choose a valid project JSON file.");
    }
  };

  const resetProject = () => {
    const nextProjectState = {
      ...currentAppState,
      ...getDefaultProjectData(),
    };

    applyAppState(nextProjectState, "Started a new project.");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          type="button"
          className={["nav-button", activePage === "project-details" ? "active" : ""].filter(Boolean).join(" ")}
          onClick={() => setActivePage("project-details")}
        >
          <span className="nav-button-icon" aria-hidden="true">
            ⌘
          </span>
          <span className="nav-button-label">Project Details</span>
        </button>

        <nav className="nav-list" aria-label="App sections">
          {Object.entries(pageGroups).map(([groupName, groupPages]) => (
            <div key={groupName} className="nav-group">
              <p className="nav-group-label">{groupName}</p>
              <div className="nav-group-items">
                {groupPages.map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    className={
                      [
                        "nav-button",
                        page.id === "estimate-builder" ? "nav-button-priority" : "",
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
        {activePage === "project-details" && (
          <ProjectDetailsPage
            projectName={projectName}
            clientName={clientName}
            projectAddress={projectAddress}
            contactDetails={contactDetails}
            projectManager={projectManager}
            estimator={estimator}
            revision={revision}
            lastSavedAt={formatLastSaved(lastSavedAt)}
            projectStatus={projectStatus}
            onProjectNameChange={setProjectName}
            onClientNameChange={setClientName}
            onProjectAddressChange={setProjectAddress}
            onContactDetailsChange={setContactDetails}
            onProjectManagerChange={setProjectManager}
            onEstimatorChange={setEstimator}
            onRevisionChange={setRevision}
            onSaveProject={saveProjectToFile}
            onOpenProject={openProjectFromFile}
            onResetProject={resetProject}
          />
        )}

        {activePage === "stages" && (
          <StageLibraryPage stages={stages} onStagesChange={setStages} />
        )}

        {activePage === "trades" && (
          <TradeLibraryPage trades={trades} onTradesChange={setTrades} />
        )}

        {activePage === "elements" && (
          <ElementLibraryPage elements={elements} onElementsChange={setElements} />
        )}

        {activePage === "parameters" && (
          <ParameterLibraryPage parameters={parameters} onParametersChange={setParameters} />
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

        {activePage === "assemblies" && (
          <AssemblyLibraryPage
            assemblies={assemblies}
            stages={stages}
            trades={trades}
            elements={elements}
            roomTypes={roomTypes}
            costCodes={costCodes}
            units={units}
            costs={costs}
            onAssembliesChange={setAssemblies}
          />
        )}

        {activePage === "costs" && (
          <CostLibraryPage costs={costs} units={units} onCostsChange={setCosts} />
        )}

        {activePage === "estimate-builder" && (
          <EstimateBuilderPage
            estimateName={projectName}
            estimateRevision={revision}
            sections={estimateSections}
            manualLines={manualEstimateLines}
            stages={stages}
            trades={trades}
            elements={elements}
            costCodes={costCodes}
            units={units}
            costs={costs}
            assemblies={assemblies}
            roomTemplates={roomTemplates}
            parameters={parameters}
            projectRooms={projectRooms}
            onSectionsChange={setEstimateSections}
            onManualLinesChange={setManualEstimateLines}
            onProjectRoomsChange={setProjectRooms}
            onEstimateNameChange={setProjectName}
            onEstimateRevisionChange={setRevision}
            onGeneratedRowOverrideChange={handleEstimateRowChange}
            generatedRows={estimateRows.filter((row) => row.source === "generated")}
            generatedRowSectionAssignments={generatedRowSectionAssignments}
            onGeneratedRowSectionAssignmentsChange={setGeneratedRowSectionAssignments}
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
      </main>
    </div>
  );
}

export default App;
