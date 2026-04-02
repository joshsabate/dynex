import { buildCanonicalStageId } from "./stages";

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizeStageToken(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/^stage[\s:_-]*/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sortStages(stages = []) {
  return [...stages].sort(
    (left, right) =>
      Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) ||
      String(left.name || "").localeCompare(String(right.name || ""))
  );
}

export function getDefaultStageId(stages = []) {
  const sortedStages = sortStages(stages);
  const activeStages = sortedStages.filter((stage) => stage.isActive !== false);
  return activeStages[0]?.id || sortedStages[0]?.id || "";
}

export function findStageById(stageId, stages = []) {
  const normalizedStageId = cleanText(stageId);
  return stages.find((stage) => cleanText(stage.id) === normalizedStageId) || null;
}

export function isStageIdValid(stageId, stages = []) {
  return Boolean(findStageById(stageId, stages));
}

export function findStageIdByLegacyValue(value, stages = []) {
  const normalizedValue = cleanText(value);

  if (!normalizedValue) {
    return "";
  }

  const exactStage = findStageById(normalizedValue, stages);

  if (exactStage) {
    return exactStage.id;
  }

  const canonicalId = buildCanonicalStageId(normalizedValue);
  const canonicalStage = findStageById(canonicalId, stages);

  if (canonicalStage) {
    return canonicalStage.id;
  }

  const legacyStageIdMap = {
    "stage-structural": "stage-frame",
    structural: "stage-frame",
    "stage-rough-in": "stage-first-fix",
    "rough-in": "stage-first-fix",
    roughin: "stage-first-fix",
    "stage-waterproofing": "stage-pre-plaster",
    waterproofing: "stage-pre-plaster",
    "stage-finishes": "stage-second-fix",
    finishes: "stage-second-fix",
    "stage-fixtures": "stage-second-fix",
    fixtures: "stage-second-fix",
    "stage-services": "stage-first-fix",
    services: "stage-first-fix",
  };
  const mappedStageId = legacyStageIdMap[normalizedValue.toLowerCase()];

  if (mappedStageId && findStageById(mappedStageId, stages)) {
    return mappedStageId;
  }

  const sortedStages = sortStages(stages);
  const numericIndex = Number(normalizedValue);

  if (/^\d+$/.test(normalizedValue) && Number.isInteger(numericIndex)) {
    if (numericIndex >= 1 && numericIndex <= sortedStages.length) {
      return sortedStages[numericIndex - 1]?.id || "";
    }

    if (numericIndex >= 0 && numericIndex < sortedStages.length) {
      return sortedStages[numericIndex]?.id || "";
    }
  }

  const normalizedToken = normalizeStageToken(normalizedValue);
  const tokenMatch = sortedStages.find((stage) => {
    const stageIdToken = normalizeStageToken(stage.id);
    const stageNameToken = normalizeStageToken(stage.name);
    return stageIdToken === normalizedToken || stageNameToken === normalizedToken;
  });

  return tokenMatch?.id || "";
}

export function getStageIntegrity(stageId, stages = [], fallbackStageName = "", options = {}) {
  const rawStageId = cleanText(stageId);
  const fallbackStageId =
    cleanText(options.defaultStageId) ||
    findStageIdByLegacyValue("stage-unassigned", stages) ||
    getDefaultStageId(stages);
  if (!stages.length) {
    return {
      stageId: rawStageId,
      stageName: cleanText(fallbackStageName),
      isValid: Boolean(rawStageId),
      wasNormalized: false,
      reason: rawStageId ? "valid" : "blank",
      originalStageId: rawStageId,
    };
  }

  const directStage = findStageById(rawStageId, stages);

  if (directStage) {
    return {
      stageId: directStage.id,
      stageName: directStage.name,
      isValid: true,
      wasNormalized: false,
      reason: "valid",
      originalStageId: rawStageId,
    };
  }

  const normalizedStageId =
    findStageIdByLegacyValue(rawStageId, stages) ||
    findStageIdByLegacyValue(fallbackStageName, stages) ||
    fallbackStageId;
  const normalizedStage = findStageById(normalizedStageId, stages);

  return {
    stageId: normalizedStage?.id || "",
    stageName: normalizedStage?.name || "",
    isValid: false,
    wasNormalized: Boolean(normalizedStage?.id),
    reason: rawStageId ? (/^\d+$/.test(rawStageId) ? "numeric" : "unknown") : "blank",
    originalStageId: rawStageId,
  };
}

function isCanvasDebugEnabled() {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return false;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const queryValue = cleanText(params.get("canvasDebug")).toLowerCase();

    if (queryValue === "1" || queryValue === "true" || queryValue === "on") {
      return true;
    }

    return window.localStorage.getItem("estimator-app-canvas-debug") === "true";
  } catch {
    return false;
  }
}

export function shouldLogStageIntegrityWarnings() {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") {
    return false;
  }

  try {
    return (
      window.localStorage.getItem("estimator-app-builder-debug") === "true" ||
      isCanvasDebugEnabled()
    );
  } catch {
    return false;
  }
}

export function logInvalidStageWarning({
  context = "stage",
  rowId = "",
  stageId = "",
  fallbackStageName = "",
  normalizedStageId = "",
  reason = "",
}) {
  if (!shouldLogStageIntegrityWarnings()) {
    return;
  }

  console.warn("[Stage Integrity] Invalid stage reference normalized", {
    context,
    rowId,
    stageId,
    fallbackStageName,
    normalizedStageId,
    reason,
  });
}

export function normalizeStageBoundRecord(record = {}, stages = [], options = {}) {
  const integrity = getStageIntegrity(record.stageId, stages, record.stage, options);
  const { stage, ...rest } = record;

  if (!integrity.isValid) {
    logInvalidStageWarning({
      context: options.context || "record",
      rowId: record.id || "",
      stageId: integrity.originalStageId,
      fallbackStageName: record.stage || "",
      normalizedStageId: integrity.stageId,
      reason: integrity.reason,
    });
  }

  return {
    ...rest,
    stageId: integrity.stageId,
    ...(options.preserveStageName ? { stage: integrity.stageName || stage || "" } : {}),
  };
}
