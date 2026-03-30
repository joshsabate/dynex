const defaultManagedParameters = [
  {
    id: "parameter-length",
    key: "length",
    label: "Length",
    inputType: "number",
    unit: "m",
    defaultValue: 0,
  },
  {
    id: "parameter-width",
    key: "width",
    label: "Width",
    inputType: "number",
    unit: "m",
    defaultValue: 0,
  },
  {
    id: "parameter-height",
    key: "height",
    label: "Height",
    inputType: "number",
    unit: "m",
    defaultValue: 2.7,
  },
  {
    id: "parameter-tile-height",
    key: "tileHeight",
    label: "Tile Height",
    inputType: "number",
    unit: "m",
    defaultValue: 0,
  },
  {
    id: "parameter-waterproof-wall-height",
    key: "waterproofWallHeight",
    label: "Waterproof Wall Height",
    inputType: "number",
    unit: "m",
    defaultValue: 0,
  },
  {
    id: "parameter-base-cabinet-length",
    key: "baseCabinetLength",
    label: "Base Cabinet Length",
    inputType: "number",
    unit: "m",
    defaultValue: 0,
  },
  {
    id: "parameter-overhead-cabinet-length",
    key: "overheadCabinetLength",
    label: "Overhead Cabinet Length",
    inputType: "number",
    unit: "m",
    defaultValue: 0,
  },
  {
    id: "parameter-benchtop-length",
    key: "benchtopLength",
    label: "Benchtop Length",
    inputType: "number",
    unit: "m",
    defaultValue: 0,
  },
  {
    id: "parameter-splashback-length",
    key: "splashbackLength",
    label: "Splashback Length",
    inputType: "number",
    unit: "m",
    defaultValue: 0,
  },
  {
    id: "parameter-splashback-height",
    key: "splashbackHeight",
    label: "Splashback Height",
    inputType: "number",
    unit: "m",
    defaultValue: 0.6,
  },
];

export function normalizeParameterKey(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, character) => character.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "")
    .replace(/^[A-Z]/, (character) => character.toLowerCase());
}

export function normalizeManagedParameter(parameter = {}) {
  const normalizedKey = normalizeParameterKey(parameter.key);
  const normalizedDefaultValue =
    parameter.defaultValue == null ? "" : parameter.defaultValue;

  const defaults = {
    id: "",
    key: "",
    label: "",
    inputType: "number",
    unit: "",
    defaultValue: "",
    description: "",
    category: "",
    status: "Active",
  };

  return {
    ...defaults,
    ...parameter,
    key: normalizedKey,
    defaultValue: normalizedDefaultValue,
    label: String(parameter.label || "").trim(),
    unit: String(parameter.unit || "").trim(),
    description: String(parameter.description || "").trim(),
    category: String(parameter.category || "").trim(),
    status: String(parameter.status || defaults.status).trim() || defaults.status,
  };
}

export function sortManagedParameters(parameters) {
  return [...parameters].sort(
    (left, right) => left.label.localeCompare(right.label) || left.key.localeCompare(right.key)
  );
}

export function buildInitialParameterLibrary() {
  return defaultManagedParameters.map((parameter) => ({
    ...normalizeManagedParameter(parameter),
  }));
}
