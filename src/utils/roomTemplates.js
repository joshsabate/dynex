import { buildRoomParameterFormValues, getRoomTypeParameterDefinitions } from "./roomTypeParameters";

function toNumber(value, fallback = 0) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function toBoolean(value, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

function cloneLine(line = {}, index = 0, prefix = "line") {
  return {
    id: line.id || `${prefix}-${Date.now()}-${index + 1}`,
    ...line,
  };
}

export const derivedMetricOptions = [
  { key: "floorArea", label: "Floor Area" },
  { key: "perimeter", label: "Perimeter" },
  { key: "tileWallArea", label: "Tile Wall Area" },
  { key: "waterproofFloorArea", label: "Waterproof Floor Area" },
  { key: "waterproofWallArea", label: "Waterproof Wall Area" },
  { key: "ceilingArea", label: "Ceiling Area" },
  { key: "skirtingLength", label: "Skirting Length" },
  { key: "baseCabinetLengthTotal", label: "Base Cabinet Length" },
  { key: "overheadCabinetLengthTotal", label: "Overhead Cabinet Length" },
  { key: "benchtopLengthTotal", label: "Benchtop Length" },
  { key: "splashbackLengthTotal", label: "Splashback Length" },
  { key: "splashbackArea", label: "Splashback Area" },
  { key: "quantity", label: "Room Quantity" },
];

export function getTemplateAssemblies(template = {}) {
  return [...(template.assemblyIds || template.defaultAssemblyIds || [])];
}

export function getTemplateManualItems(template = {}) {
  return [...(template.manualItems || template.customItems || template.defaultCustomItems || [])];
}

export function getTemplateLabourItems(template = {}) {
  return [...(template.labourItems || [])];
}

function normalizeTemplateLine(line = {}, index = 0, type = "manual") {
  return {
    id: line.id || `${type}-${index + 1}`,
    costItemId: line.costItemId || line.labourItemId || "",
    labourItemId: line.labourItemId || "",
    stageId: line.stageId || "",
    stage: line.stage || "",
    elementId: line.elementId || "",
    element: line.element || "",
    tradeId: line.tradeId || "",
    trade: line.trade || "",
    costCodeId: line.costCodeId || "",
    costCode: line.costCode || "",
    itemName: line.itemName || "",
    unitId: line.unitId || "",
    unit: line.unit || "",
    include: toBoolean(line.include, true),
    sortOrder: toNumber(line.sortOrder, (index + 1) * 10),
    quantitySourceType: line.quantitySourceType || "fixed",
    parameterKey: line.parameterKey || "",
    derivedMetricKey: line.derivedMetricKey || "",
    formula: line.formula || "",
    fixedQty:
      line.fixedQty === "" || line.fixedQty == null
        ? line.quantity == null
          ? 1
          : toNumber(line.quantity, 1)
        : toNumber(line.fixedQty, 1),
    rate:
      line.rate === "" || line.rate == null
        ? 0
        : toNumber(line.rate, 0),
  };
}

function coerceParameterValue(parameterDefinition, value) {
  if (parameterDefinition.inputType === "number") {
    return toNumber(value, 0);
  }

  return String(value ?? "");
}

export function normalizeRoomTemplate(template = {}, roomTypes = [], parameters = []) {
  const roomType =
    roomTypes.find((candidate) => candidate.id === template.roomTypeId) || {
      id: template.roomTypeId || "",
      name: template.roomType || "",
    };
  const sourceValues = {
    ...(template.defaults || {}),
    ...template,
  };
  const parameterDefinitions = getRoomTypeParameterDefinitions(roomType, parameters);
  const parameterValues = buildRoomParameterFormValues(roomType, sourceValues, parameters);
  const normalizedValues = parameterDefinitions.reduce(
    (nextValues, parameterDefinition) => ({
      ...nextValues,
      [parameterDefinition.key]: coerceParameterValue(
        parameterDefinition,
        parameterValues[parameterDefinition.key]
      ),
    }),
    {}
  );

  return {
    id: template.id || "",
    name: template.name || "",
    roomTypeId: roomType.id || "",
    roomType: roomType.name || template.roomType || "Unassigned",
    quantity: toNumber(sourceValues.quantity, 1),
    include: toBoolean(sourceValues.include, true),
    assemblyIds: getTemplateAssemblies(template),
    manualItems: getTemplateManualItems(template).map((line, index) =>
      normalizeTemplateLine(line, index, "manual-item")
    ),
    labourItems: getTemplateLabourItems(template).map((line, index) =>
      normalizeTemplateLine(line, index, "labour-item")
    ),
    ...normalizedValues,
  };
}

export function serializeRoomTemplate(template = {}, roomTypes = [], parameters = []) {
  const normalizedTemplate = normalizeRoomTemplate(template, roomTypes, parameters);
  const roomType =
    roomTypes.find((candidate) => candidate.id === normalizedTemplate.roomTypeId) || {
      id: normalizedTemplate.roomTypeId,
      name: normalizedTemplate.roomType,
    };
  const parameterDefinitions = getRoomTypeParameterDefinitions(roomType, parameters);
  const parameterValues = parameterDefinitions.reduce(
    (nextValues, parameterDefinition) => ({
      ...nextValues,
      [parameterDefinition.key]: normalizedTemplate[parameterDefinition.key],
    }),
    {}
  );

  return {
    id: normalizedTemplate.id,
    name: normalizedTemplate.name,
    roomTypeId: normalizedTemplate.roomTypeId,
    roomType: normalizedTemplate.roomType,
    quantity: normalizedTemplate.quantity,
    include: normalizedTemplate.include,
    assemblyIds: [...normalizedTemplate.assemblyIds],
    manualItems: normalizedTemplate.manualItems.map((line, index) =>
      cloneLine(normalizeTemplateLine(line, index, "manual-item"), index, "manual-item")
    ),
    labourItems: normalizedTemplate.labourItems.map((line, index) =>
      cloneLine(normalizeTemplateLine(line, index, "labour-item"), index, "labour-item")
    ),
    ...parameterValues,
  };
}

export function createEmptyRoomTemplate(roomType = {}, parameters = []) {
  const nextRoomType = {
    id: roomType.id || "",
    name: roomType.name || "",
  };
  const parameterValues = buildRoomParameterFormValues(nextRoomType, {}, parameters);

  return {
    id: "",
    name: "",
    roomTypeId: nextRoomType.id,
    roomType: nextRoomType.name,
    quantity: 1,
    include: true,
    assemblyIds: [],
    manualItems: [],
    labourItems: [],
    ...Object.fromEntries(
      Object.entries(parameterValues).map(([key, value]) => [key, toNumber(value, value)])
    ),
  };
}

export function duplicateRoomTemplate(template = {}, roomTypes = [], parameters = []) {
  const normalizedTemplate = normalizeRoomTemplate(template, roomTypes, parameters);
  const timestamp = Date.now();

  return {
    ...normalizedTemplate,
    id: `room-template-${timestamp}`,
    name: `${normalizedTemplate.name} Copy`,
    manualItems: normalizedTemplate.manualItems.map((line, index) => ({
      ...line,
      id: `manual-item-${timestamp}-${index + 1}`,
    })),
    labourItems: normalizedTemplate.labourItems.map((line, index) => ({
      ...line,
      id: `labour-item-${timestamp}-${index + 1}`,
    })),
  };
}

export function instantiateRoomTemplate(template = {}, roomTypes = [], parameters = []) {
  const normalizedTemplate = normalizeRoomTemplate(template, roomTypes, parameters);
  const timestamp = Date.now();

  return {
    ...normalizedTemplate,
    id: `project-room-${timestamp}`,
    templateId: normalizedTemplate.id,
    assemblyIds: [...normalizedTemplate.assemblyIds],
    manualItems: normalizedTemplate.manualItems.map((line, index) => ({
      ...line,
      id: `project-room-manual-item-${timestamp}-${index + 1}`,
    })),
    labourItems: normalizedTemplate.labourItems.map((line, index) => ({
      ...line,
      id: `project-room-labour-item-${timestamp}-${index + 1}`,
    })),
  };
}
