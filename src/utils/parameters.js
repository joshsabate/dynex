export const parameterTypeOptions = ["Input", "Derived", "System"];

export const parameterCategoryDefinitions = [
  { name: "Core Geometry", tone: "core-geometry" },
  { name: "Derived", tone: "derived" },
  { name: "Openings", tone: "openings" },
  { name: "Wet Area", tone: "wet-area" },
  { name: "Waterproofing", tone: "waterproofing" },
  { name: "Linings", tone: "linings" },
  { name: "Tiling", tone: "tiling" },
  { name: "Joinery", tone: "joinery" },
  { name: "Fixtures & Fittings", tone: "fixtures-fittings" },
  { name: "Plumbing", tone: "plumbing" },
  { name: "Electrical", tone: "electrical" },
  { name: "HVAC & Ventilation", tone: "hvac-ventilation" },
  { name: "Finishes", tone: "finishes" },
  { name: "Structure", tone: "structure" },
  { name: "Exterior", tone: "exterior" },
  { name: "Site & Preliminaries", tone: "site-preliminaries" },
  { name: "Labour & Overheads", tone: "labour-overheads" },
  { name: "General / Misc", tone: "general-misc" },
];

export const parameterCategoryOptions = parameterCategoryDefinitions.map(
  (category) => category.name
);

const parameterCategoryAliasMap = {
  coregeometry: "Core Geometry",
  derived: "Derived",
  openings: "Openings",
  wetarea: "Wet Area",
  waterproofing: "Waterproofing",
  linings: "Linings",
  tiling: "Tiling",
  joinery: "Joinery",
  fixturesfittings: "Fixtures & Fittings",
  plumbing: "Plumbing",
  electrical: "Electrical",
  hvacventilation: "HVAC & Ventilation",
  finishes: "Finishes",
  structure: "Structure",
  exterior: "Exterior",
  sitepreliminaries: "Site & Preliminaries",
  siteprelims: "Site & Preliminaries",
  labouroverheads: "Labour & Overheads",
  laboroverheads: "Labour & Overheads",
  generalmisc: "General / Misc",
  general: "General / Misc",
  misc: "General / Misc",
};

const seededParameterSpecs = [
  ["length", "Length", "Input", "Core Geometry", "number", "m", 0, true, ""],
  ["width", "Width", "Input", "Core Geometry", "number", "m", 0, true, ""],
  ["height", "Height", "Input", "Core Geometry", "number", "m", 2.7, true, ""],
  ["ceilingHeight", "Ceiling Height", "Input", "Core Geometry", "number", "m", 2.7, false, ""],
  ["roomCount", "Room Count", "Input", "Core Geometry", "number", "ea", 1, false, ""],
  ["floorArea", "Floor Area", "Derived", "Derived", "number", "sqm", "", false, "length * width"],
  ["ceilingArea", "Ceiling Area", "Derived", "Derived", "number", "sqm", "", false, "floorArea"],
  ["wallArea", "Wall Area", "Derived", "Derived", "number", "sqm", "", false, "perimeter * height"],
  ["perimeter", "Perimeter", "Derived", "Derived", "number", "m", "", false, "(length + width) * 2"],
  ["netWallArea", "Net Wall Area", "Derived", "Derived", "number", "sqm", "", false, "wallArea - windowArea"],
  ["roomVolume", "Room Volume", "Derived", "Derived", "number", "m3", "", false, "length * width * height"],
  ["doorCount", "Door Count", "Input", "Openings", "number", "ea", 0, false, ""],
  ["doorArea", "Door Area", "Input", "Openings", "number", "sqm", 0, false, ""],
  ["windowCount", "Window Count", "Input", "Openings", "number", "ea", 0, false, ""],
  ["windowArea", "Window Area", "Input", "Openings", "number", "sqm", 0, false, ""],
  ["externalDoorCount", "External Door Count", "Input", "Openings", "number", "ea", 0, false, ""],
  ["internalDoorCount", "Internal Door Count", "Input", "Openings", "number", "ea", 0, false, ""],
  ["waterproofWallHeight", "Waterproof Wall Height", "Input", "Wet Area", "number", "m", 0, false, ""],
  ["waterproofWallArea", "Waterproof Wall Area", "Input", "Wet Area", "number", "sqm", 0, false, ""],
  ["showerArea", "Shower Area", "Input", "Wet Area", "number", "sqm", 0, false, ""],
  ["showerWallArea", "Shower Wall Area", "Input", "Wet Area", "number", "sqm", 0, false, ""],
  ["showerCount", "Shower Count", "Input", "Wet Area", "number", "ea", 0, false, ""],
  ["bathCount", "Bath Count", "Input", "Wet Area", "number", "ea", 0, false, ""],
  ["bathroomCorners", "Bathroom Corners", "Input", "Wet Area", "number", "ea", 0, false, ""],
  ["floorWasteCount", "Floor Waste Count", "Input", "Wet Area", "number", "ea", 0, false, ""],
  ["nicheCount", "Niche Count", "Input", "Wet Area", "number", "ea", 0, false, ""],
  ["hobLength", "Hob Length", "Input", "Wet Area", "number", "m", 0, false, ""],
  ["upturnLength", "Upturn Length", "Input", "Waterproofing", "number", "m", 0, false, ""],
  ["movementJointLength", "Movement Joint Length", "Input", "Waterproofing", "number", "m", 0, false, ""],
  ["puddleFlangeCount", "Puddle Flange Count", "Input", "Waterproofing", "number", "ea", 0, false, ""],
  ["liningWallArea", "Lining Wall Area", "Input", "Linings", "number", "sqm", 0, false, ""],
  ["liningCeilingArea", "Lining Ceiling Area", "Input", "Linings", "number", "sqm", 0, false, ""],
  ["corniceLength", "Cornice Length", "Input", "Linings", "number", "m", 0, false, ""],
  ["skirtingLength", "Skirting Length", "Input", "Linings", "number", "m", 0, false, ""],
  ["architraveLength", "Architrave Length", "Input", "Linings", "number", "m", 0, false, ""],
  ["externalCornerLength", "External Corner Length", "Input", "Linings", "number", "m", 0, false, ""],
  ["tileHeight", "Tile Height", "Input", "Tiling", "number", "m", 0, false, ""],
  ["wallTileArea", "Wall Tile Area", "Input", "Tiling", "number", "sqm", 0, false, ""],
  ["floorTileArea", "Floor Tile Area", "Input", "Tiling", "number", "sqm", 0, false, ""],
  ["splashbackArea", "Splashback Area", "Input", "Tiling", "number", "sqm", 0, false, ""],
  ["splashbackLength", "Splashback Length", "Input", "Tiling", "number", "m", 0, false, ""],
  ["splashbackHeight", "Splashback Height", "Input", "Tiling", "number", "m", 0.6, false, ""],
  ["tileWasteFactor", "Tile Waste Factor", "Input", "Tiling", "number", "%", 10, false, ""],
  ["groutArea", "Grout Area", "Input", "Tiling", "number", "sqm", 0, false, ""],
  ["trimLength", "Trim Length", "Input", "Tiling", "number", "m", 0, false, ""],
  ["baseCabinetLength", "Base Cabinet Length", "Input", "Joinery", "number", "m", 0, false, ""],
  ["overheadCabinetLength", "Overhead Cabinet Length", "Input", "Joinery", "number", "m", 0, false, ""],
  ["tallCabinetCount", "Tall Cabinet Count", "Input", "Joinery", "number", "ea", 0, false, ""],
  ["benchtopLength", "Benchtop Length", "Input", "Joinery", "number", "m", 0, false, ""],
  ["benchtopArea", "Benchtop Area", "Input", "Joinery", "number", "sqm", 0, false, ""],
  ["islandLength", "Island Length", "Input", "Joinery", "number", "m", 0, false, ""],
  ["islandArea", "Island Area", "Input", "Joinery", "number", "sqm", 0, false, ""],
  ["vanityCount", "Vanity Count", "Input", "Joinery", "number", "ea", 0, false, ""],
  ["vanityLength", "Vanity Length", "Input", "Joinery", "number", "m", 0, false, ""],
  ["robeLength", "Robe Length", "Input", "Joinery", "number", "m", 0, false, ""],
  ["shelfLength", "Shelf Length", "Input", "Joinery", "number", "m", 0, false, ""],
  ["mirrorCount", "Mirror Count", "Input", "Fixtures & Fittings", "number", "ea", 0, false, ""],
  ["basinCount", "Basin Count", "Input", "Fixtures & Fittings", "number", "ea", 0, false, ""],
  ["tapwareSetCount", "Tapware Set Count", "Input", "Fixtures & Fittings", "number", "ea", 0, false, ""],
  ["accessorySetCount", "Accessory Set Count", "Input", "Fixtures & Fittings", "number", "ea", 0, false, ""],
  ["towelRailCount", "Towel Rail Count", "Input", "Fixtures & Fittings", "number", "ea", 0, false, ""],
  ["toiletRollHolderCount", "Toilet Roll Holder Count", "Input", "Fixtures & Fittings", "number", "ea", 0, false, ""],
  ["hookCount", "Hook Count", "Input", "Fixtures & Fittings", "number", "ea", 0, false, ""],
  ["showerScreenLength", "Shower Screen Length", "Input", "Fixtures & Fittings", "number", "m", 0, false, ""],
  ["fixtureCount", "Fixture Count", "Input", "Plumbing", "number", "ea", 0, false, ""],
  ["hotColdPointCount", "Hot Cold Point Count", "Input", "Plumbing", "number", "ea", 0, false, ""],
  ["wastePointCount", "Waste Point Count", "Input", "Plumbing", "number", "ea", 0, false, ""],
  ["sanitaryFixtureCount", "Sanitary Fixture Count", "Input", "Plumbing", "number", "ea", 0, false, ""],
  ["waterPointCount", "Water Point Count", "Input", "Plumbing", "number", "ea", 0, false, ""],
  ["gasPointCount", "Gas Point Count", "Input", "Plumbing", "number", "ea", 0, false, ""],
  ["lightCount", "Light Count", "Input", "Electrical", "number", "ea", 0, false, ""],
  ["powerPointCount", "Power Point Count", "Input", "Electrical", "number", "ea", 0, false, ""],
  ["switchCount", "Switch Count", "Input", "Electrical", "number", "ea", 0, false, ""],
  ["dataPointCount", "Data Point Count", "Input", "Electrical", "number", "ea", 0, false, ""],
  ["fanCount", "Fan Count", "Input", "Electrical", "number", "ea", 0, false, ""],
  ["exhaustFanCount", "Exhaust Fan Count", "Input", "Electrical", "number", "ea", 0, false, ""],
  ["applianceConnectionCount", "Appliance Connection Count", "Input", "Electrical", "number", "ea", 0, false, ""],
  ["supplyVentCount", "Supply Vent Count", "Input", "HVAC & Ventilation", "number", "ea", 0, false, ""],
  ["returnVentCount", "Return Vent Count", "Input", "HVAC & Ventilation", "number", "ea", 0, false, ""],
  ["ductLength", "Duct Length", "Input", "HVAC & Ventilation", "number", "m", 0, false, ""],
  ["splitSystemCount", "Split System Count", "Input", "HVAC & Ventilation", "number", "ea", 0, false, ""],
  ["exhaustLength", "Exhaust Length", "Input", "HVAC & Ventilation", "number", "m", 0, false, ""],
  ["paintWallArea", "Paint Wall Area", "Input", "Finishes", "number", "sqm", 0, false, ""],
  ["paintCeilingArea", "Paint Ceiling Area", "Input", "Finishes", "number", "sqm", 0, false, ""],
  ["paintTrimLength", "Paint Trim Length", "Input", "Finishes", "number", "m", 0, false, ""],
  ["sealantLength", "Sealant Length", "Input", "Finishes", "number", "m", 0, false, ""],
  ["caulkingLength", "Caulking Length", "Input", "Finishes", "number", "m", 0, false, ""],
  ["footingLength", "Footing Length", "Input", "Structure", "number", "m", 0, false, ""],
  ["slabArea", "Slab Area", "Input", "Structure", "number", "sqm", 0, false, ""],
  ["frameWallLength", "Frame Wall Length", "Input", "Structure", "number", "m", 0, false, ""],
  ["structuralSteelWeight", "Structural Steel Weight", "Input", "Structure", "number", "kg", 0, false, ""],
  ["beamLength", "Beam Length", "Input", "Structure", "number", "m", 0, false, ""],
  ["postCount", "Post Count", "Input", "Structure", "number", "ea", 0, false, ""],
  ["trussCount", "Truss Count", "Input", "Structure", "number", "ea", 0, false, ""],
  ["roofArea", "Roof Area", "Input", "Structure", "number", "sqm", 0, false, ""],
  ["claddingArea", "Cladding Area", "Input", "Exterior", "number", "sqm", 0, false, ""],
  ["eavesArea", "Eaves Area", "Input", "Exterior", "number", "sqm", 0, false, ""],
  ["fasciaLength", "Fascia Length", "Input", "Exterior", "number", "m", 0, false, ""],
  ["gutterLength", "Gutter Length", "Input", "Exterior", "number", "m", 0, false, ""],
  ["downpipeCount", "Downpipe Count", "Input", "Exterior", "number", "ea", 0, false, ""],
  ["deckArea", "Deck Area", "Input", "Exterior", "number", "sqm", 0, false, ""],
  ["pavingArea", "Paving Area", "Input", "Exterior", "number", "sqm", 0, false, ""],
  ["drivewayArea", "Driveway Area", "Input", "Exterior", "number", "sqm", 0, false, ""],
  ["fencingLength", "Fencing Length", "Input", "Exterior", "number", "m", 0, false, ""],
  ["retainingWallLength", "Retaining Wall Length", "Input", "Exterior", "number", "m", 0, false, ""],
  ["siteArea", "Site Area", "Input", "Site & Preliminaries", "number", "sqm", 0, false, ""],
  ["scaffoldArea", "Scaffold Area", "Input", "Site & Preliminaries", "number", "sqm", 0, false, ""],
  ["demolitionArea", "Demolition Area", "Input", "Site & Preliminaries", "number", "sqm", 0, false, ""],
  ["demolitionVolume", "Demolition Volume", "Input", "Site & Preliminaries", "number", "m3", 0, false, ""],
  ["skipBinCount", "Skip Bin Count", "Input", "Site & Preliminaries", "number", "ea", 0, false, ""],
  ["protectionArea", "Protection Area", "Input", "Site & Preliminaries", "number", "sqm", 0, false, ""],
  ["totalLabourHours", "Total Labour Hours", "Derived", "Labour & Overheads", "number", "hr", "", false, ""],
  ["supervisionHours", "Supervision Hours", "Input", "Labour & Overheads", "number", "hr", 0, false, ""],
  ["siteCleanHours", "Site Clean Hours", "Input", "Labour & Overheads", "number", "hr", 0, false, ""],
  ["projectWeeks", "Project Weeks", "Input", "Labour & Overheads", "number", "week", 0, false, ""],
  ["projectDays", "Project Days", "Input", "Labour & Overheads", "number", "day", 0, false, ""],
  ["itemCount", "Item Count", "System", "General / Misc", "number", "ea", 0, false, ""],
  ["setCount", "Set Count", "Input", "General / Misc", "number", "ea", 0, false, ""],
  ["allowanceQty", "Allowance Quantity", "Input", "General / Misc", "number", "ea", 0, false, ""],
];

const derivedKeys = new Set([
  "floorArea",
  "ceilingArea",
  "wallArea",
  "perimeter",
  "netWallArea",
  "roomVolume",
]);

const systemKeys = new Set(["itemCount"]);

export function normalizeParameterKey(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, character) => character.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "")
    .replace(/^[A-Z]/, (character) => character.toLowerCase());
}

function normalizeCategoryToken(value) {
  return String(value || "")
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function normalizeParameterCategory(value) {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    return "General / Misc";
  }

  const normalizedToken = normalizeCategoryToken(normalizedValue);
  return parameterCategoryAliasMap[normalizedToken] || "General / Misc";
}

export function inferParameterType(key) {
  const normalizedKey = normalizeParameterKey(key);
  if (systemKeys.has(normalizedKey)) {
    return "System";
  }
  if (derivedKeys.has(normalizedKey)) {
    return "Derived";
  }
  return "Input";
}

export function normalizeParameterType(value, key = "") {
  const normalizedValue = String(value || "").trim();
  if (parameterTypeOptions.includes(normalizedValue)) {
    return normalizedValue;
  }
  return inferParameterType(key);
}

export function normalizeManagedParameter(parameter = {}) {
  const normalizedKey = normalizeParameterKey(parameter.key);
  const normalizedDefaultValue =
    parameter.defaultValue == null ? "" : parameter.defaultValue;
  const normalizedSortOrder = Number(parameter.sortOrder);
  const normalizedParameterType = normalizeParameterType(
    parameter.parameterType,
    normalizedKey
  );

  const defaults = {
    id: "",
    key: "",
    label: "",
    parameterType: "Input",
    inputType: "number",
    unit: "",
    defaultValue: "",
    required: false,
    sortOrder: 0,
    formula: "",
    description: "",
    category: "General / Misc",
    status: "Active",
  };

  return {
    ...defaults,
    ...parameter,
    key: normalizedKey,
    parameterType: normalizedParameterType,
    defaultValue: normalizedDefaultValue,
    required: Boolean(parameter.required),
    sortOrder: Number.isFinite(normalizedSortOrder)
      ? normalizedSortOrder
      : defaults.sortOrder,
    formula:
      normalizedParameterType === "Derived"
        ? String(parameter.formula || "").trim()
        : "",
    label: String(parameter.label || "").trim(),
    inputType: String(parameter.inputType || defaults.inputType).trim() === "text"
      ? "text"
      : "number",
    unit: String(parameter.unit || "").trim(),
    description: String(parameter.description || "").trim(),
    category: normalizeParameterCategory(parameter.category),
    status: String(parameter.status || defaults.status).trim() || defaults.status,
  };
}

export function sortManagedParameters(parameters) {
  return [...parameters].sort(
    (left, right) =>
      Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) ||
      left.label.localeCompare(right.label) ||
      left.key.localeCompare(right.key)
  );
}

function createSeededParameter(
  [key, label, parameterType, category, inputType, unit, defaultValue, required, formula],
  index
) {
  return normalizeManagedParameter({
    id: `parameter-${key}`,
    key,
    label,
    parameterType,
    inputType,
    unit,
    defaultValue,
    required,
    sortOrder: (index + 1) * 10,
    formula,
    category,
    status: "Active",
  });
}

export function buildInitialParameterLibrary() {
  return seededParameterSpecs.map(createSeededParameter);
}

export function mergeSeededParameters(parameters = []) {
  const normalizedExisting = Array.isArray(parameters)
    ? parameters.map((parameter) => normalizeManagedParameter(parameter))
    : [];
  const existingKeys = new Set(
    normalizedExisting.map((parameter) => parameter.key).filter(Boolean)
  );
  const missingSeededParameters = buildInitialParameterLibrary().filter(
    (parameter) => !existingKeys.has(parameter.key)
  );

  return [...normalizedExisting, ...missingSeededParameters];
}
