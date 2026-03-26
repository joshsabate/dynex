const fallbackStageColor = "#d7ddd5";

function normalizeStageName(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
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
