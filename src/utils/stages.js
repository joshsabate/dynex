const fallbackStageColor = "#d7ddd5";

export const canonicalStageLibrary = [
  { id: "stage-preliminaries", name: "Preliminaries", sortOrder: 1, isActive: true, color: "#d7aa5a" },
  { id: "stage-site-establishment", name: "Site Establishment", sortOrder: 2, isActive: true, color: "#b75c9f" },
  { id: "stage-demolition", name: "Demolition", sortOrder: 3, isActive: true, color: "#d78476" },
  { id: "stage-base", name: "Base", sortOrder: 4, isActive: true, color: "#8b6f47" },
  { id: "stage-frame", name: "Frame", sortOrder: 5, isActive: true, color: "#7e9685" },
  { id: "stage-building-envelope", name: "Building Envelope", sortOrder: 6, isActive: true, color: "#6f96bf" },
  { id: "stage-pre-plaster", name: "Pre-Plaster", sortOrder: 7, isActive: true, color: "#69a6b2" },
  { id: "stage-lock-up", name: "Lock-Up", sortOrder: 8, isActive: true, color: "#5f7ea8" },
  { id: "stage-first-fix", name: "First Fix", sortOrder: 9, isActive: true, color: "#7ea06f" },
  { id: "stage-second-fix", name: "Second Fix", sortOrder: 10, isActive: true, color: "#aa87c4" },
  { id: "stage-external-works", name: "External Works", sortOrder: 11, isActive: true, color: "#6da38b" },
  { id: "stage-final", name: "Final", sortOrder: 12, isActive: true, color: "#a98a69" },
  { id: "stage-unassigned", name: "Unassigned", sortOrder: 13, isActive: true, color: "#cbd5e1" },
];

function normalizeStageName(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function buildCanonicalStageId(name) {
  const normalizedName = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalizedName ? `stage-${normalizedName}` : "stage-unassigned";
}

export function getOrderedStages(stages = []) {
  return [...stages].sort(
    (left, right) =>
      Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) ||
      String(left.name || "").localeCompare(String(right.name || ""))
  );
}

export function getStageById(stages = []) {
  return Object.fromEntries(stages.map((stage) => [stage.id, stage]));
}

export function normalizeStages(stages = []) {
  const sourceStages = Array.isArray(stages) ? stages : [];
  const canonicalStageIds = new Set(canonicalStageLibrary.map((stage) => stage.id));

  const normalizedCanonicalStages = canonicalStageLibrary.map((canonicalStage) => {
    const matchingStage =
      sourceStages.find((stage) => buildCanonicalStageId(stage.name) === canonicalStage.id) ||
      sourceStages.find((stage) => stage.id === canonicalStage.id) ||
      null;

    return {
      ...canonicalStage,
      isActive: matchingStage?.isActive !== false,
      color: normalizeHexColor(matchingStage?.color || canonicalStage.color),
    };
  });

  const customStages = sourceStages
    .filter((stage) => !canonicalStageIds.has(buildCanonicalStageId(stage.name || stage.id)))
    .map((stage, index) => ({
      id: stage.id || buildCanonicalStageId(stage.name),
      name: String(stage.name || "Custom Stage").trim() || "Custom Stage",
      sortOrder:
        Number.isFinite(Number(stage.sortOrder))
          ? Number(stage.sortOrder)
          : canonicalStageLibrary.length + index + 1,
      isActive: stage.isActive !== false,
      color: normalizeHexColor(stage.color || fallbackStageColor),
    }))
    .sort(
      (left, right) =>
        Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) ||
        String(left.name || "").localeCompare(String(right.name || ""))
    );

  return [...normalizedCanonicalStages, ...customStages];
}

export function getStageDisplayName(stages, stageId, fallbackStageName = "") {
  return (
    stages.find((stage) => stage.id === stageId)?.name ||
    stages.find((stage) => normalizeStageName(stage.name) === normalizeStageName(fallbackStageName))?.name ||
    fallbackStageName ||
    "Unassigned"
  );
}

export function getStageSortOrder(stages, stageId, fallbackStageName = "") {
  return (
    stages.find((stage) => stage.id === stageId)?.sortOrder ??
    stages.find((stage) => normalizeStageName(stage.name) === normalizeStageName(fallbackStageName))
      ?.sortOrder ??
    Number.MAX_SAFE_INTEGER
  );
}

function normalizeHexColor(value) {
  const normalizedValue = String(value || "").trim();

  if (/^#[0-9a-fA-F]{6}$/.test(normalizedValue)) {
    return normalizedValue;
  }

  return fallbackStageColor;
}

function hexToRgb(hexColor) {
  const normalizedHexColor = normalizeHexColor(hexColor).slice(1);

  return {
    red: Number.parseInt(normalizedHexColor.slice(0, 2), 16),
    green: Number.parseInt(normalizedHexColor.slice(2, 4), 16),
    blue: Number.parseInt(normalizedHexColor.slice(4, 6), 16),
  };
}

function toRgba(hexColor, alpha) {
  const { red, green, blue } = hexToRgb(hexColor);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function darkenChannel(value, amount) {
  return Math.max(0, Math.round(value * (1 - amount)));
}

function toTextColor(hexColor) {
  const { red, green, blue } = hexToRgb(hexColor);
  return `rgb(${darkenChannel(red, 0.42)}, ${darkenChannel(green, 0.42)}, ${darkenChannel(
    blue,
    0.42
  )})`;
}

export function getStageColor(stages, stageId, fallbackStageName = "") {
  const matchingStage =
    stages.find((stage) => stage.id === stageId) ||
    stages.find((stage) => normalizeStageName(stage.name) === normalizeStageName(fallbackStageName));

  return normalizeHexColor(matchingStage?.color);
}

export function getStagePresentation(stages, stageId, fallbackStageName = "") {
  const color = getStageColor(stages, stageId, fallbackStageName);

  return {
    backgroundColor: toRgba(color, 0.14),
    borderColor: toRgba(color, 0.32),
    color: toTextColor(color),
  };
}

