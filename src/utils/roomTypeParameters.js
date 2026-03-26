import { normalizeManagedParameter } from "./parameters";

const coreParameterDefinitions = [
  {
    key: "length",
    label: "Length",
    inputType: "number",
    unit: "m",
    defaultValue: 0,
    isRequired: true,
    sortOrder: 1,
  },
  {
    key: "width",
    label: "Width",
    inputType: "number",
    unit: "m",
    defaultValue: 0,
    isRequired: true,
    sortOrder: 2,
  },
  {
    key: "height",
    label: "Height",
    inputType: "number",
    unit: "m",
    defaultValue: 2.7,
    isRequired: true,
    sortOrder: 3,
  },
];

const roomTypeParameterDefinitionsByType = {
  "room-type-bathroom": [
    ...coreParameterDefinitions,
    {
      key: "tileHeight",
      label: "Tile Height",
      inputType: "number",
      unit: "m",
      defaultValue: 2.1,
      isRequired: false,
      sortOrder: 10,
    },
    {
      key: "waterproofWallHeight",
      label: "Waterproof Wall Height",
      inputType: "number",
      unit: "m",
      defaultValue: 1.2,
      isRequired: false,
      sortOrder: 11,
    },
  ],
  "room-type-kitchen": [
    ...coreParameterDefinitions,
    {
      key: "tileHeight",
      label: "Tile Height",
      inputType: "number",
      unit: "m",
      defaultValue: 0.6,
      isRequired: false,
      sortOrder: 10,
    },
    {
      key: "waterproofWallHeight",
      label: "Waterproof Wall Height",
      inputType: "number",
      unit: "m",
      defaultValue: 0,
      isRequired: false,
      sortOrder: 11,
    },
    {
      key: "baseCabinetLength",
      label: "Base Cabinet Length",
      inputType: "number",
      unit: "m",
      defaultValue: 0,
      isRequired: false,
      sortOrder: 20,
    },
    {
      key: "overheadCabinetLength",
      label: "Overhead Cabinet Length",
      inputType: "number",
      unit: "m",
      defaultValue: 0,
      isRequired: false,
      sortOrder: 21,
    },
    {
      key: "benchtopLength",
      label: "Benchtop Length",
      inputType: "number",
      unit: "m",
      defaultValue: 0,
      isRequired: false,
      sortOrder: 22,
    },
    {
      key: "splashbackLength",
      label: "Splashback Length",
      inputType: "number",
      unit: "m",
      defaultValue: 0,
      isRequired: false,
      sortOrder: 23,
    },
    {
      key: "splashbackHeight",
      label: "Splashback Height",
      inputType: "number",
      unit: "m",
      defaultValue: 0.6,
      isRequired: false,
      sortOrder: 24,
    },
  ],
  "room-type-bedroom": [...coreParameterDefinitions],
  "room-type-living": [...coreParameterDefinitions],
  "room-type-service": [
    ...coreParameterDefinitions,
    {
      key: "tileHeight",
      label: "Tile Height",
      inputType: "number",
      unit: "m",
      defaultValue: 0.6,
      isRequired: false,
      sortOrder: 10,
    },
    {
      key: "waterproofWallHeight",
      label: "Waterproof Wall Height",
      inputType: "number",
      unit: "m",
      defaultValue: 0,
      isRequired: false,
      sortOrder: 11,
    },
    {
      key: "baseCabinetLength",
      label: "Base Cabinet Length",
      inputType: "number",
      unit: "m",
      defaultValue: 0,
      isRequired: false,
      sortOrder: 20,
    },
    {
      key: "overheadCabinetLength",
      label: "Overhead Cabinet Length",
      inputType: "number",
      unit: "m",
      defaultValue: 0,
      isRequired: false,
      sortOrder: 21,
    },
    {
      key: "benchtopLength",
      label: "Benchtop Length",
      inputType: "number",
      unit: "m",
      defaultValue: 0,
      isRequired: false,
      sortOrder: 22,
    },
    {
      key: "splashbackLength",
      label: "Splashback Length",
      inputType: "number",
      unit: "m",
      defaultValue: 0,
      isRequired: false,
      sortOrder: 23,
    },
    {
      key: "splashbackHeight",
      label: "Splashback Height",
      inputType: "number",
      unit: "m",
      defaultValue: 0.6,
      isRequired: false,
      sortOrder: 24,
    },
  ],
};

function sortParameterDefinitions(parameterDefinitions) {
  return [...parameterDefinitions].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label)
  );
}

function getManagedParameterMaps(parameters = []) {
  const normalizedParameters = parameters.map(normalizeManagedParameter);

  return {
    byId: Object.fromEntries(normalizedParameters.map((parameter) => [parameter.id, parameter])),
    byKey: Object.fromEntries(normalizedParameters.map((parameter) => [parameter.key, parameter])),
  };
}

function getManagedParameter(parameterDefinition, parameterMaps) {
  if (parameterDefinition.parameterId && parameterMaps.byId[parameterDefinition.parameterId]) {
    return parameterMaps.byId[parameterDefinition.parameterId];
  }

  if (parameterDefinition.key && parameterMaps.byKey[parameterDefinition.key]) {
    return parameterMaps.byKey[parameterDefinition.key];
  }

  return null;
}

function normalizeParameterDefinition(parameterDefinition, parameterMaps) {
  const managedParameter = getManagedParameter(parameterDefinition, parameterMaps);
  const hasManagedParameter = Boolean(managedParameter);
  const resolvedDefaultValue =
    parameterDefinition.defaultValue === "" || parameterDefinition.defaultValue == null
      ? managedParameter?.defaultValue ?? 0
      : parameterDefinition.defaultValue;

  return {
    parameterId: managedParameter?.id || parameterDefinition.parameterId || "",
    key: hasManagedParameter ? managedParameter.key : parameterDefinition.key || "",
    label: hasManagedParameter ? managedParameter.label : parameterDefinition.label || "",
    inputType: hasManagedParameter
      ? managedParameter.inputType
      : parameterDefinition.inputType || "number",
    unit: hasManagedParameter
      ? managedParameter.unit
      : parameterDefinition.unit ?? parameterDefinition.unitText ?? "",
    unitText: hasManagedParameter
      ? managedParameter.unit
      : parameterDefinition.unit ?? parameterDefinition.unitText ?? "",
    defaultValue: resolvedDefaultValue,
    isRequired: Boolean(parameterDefinition.isRequired),
    sortOrder: Number(parameterDefinition.sortOrder ?? 0),
    isManaged: hasManagedParameter,
  };
}

function getFallbackRoomTypeKey(roomType = {}) {
  if (roomType.id && roomTypeParameterDefinitionsByType[roomType.id]) {
    return roomType.id;
  }

  const normalizedName = String(roomType.name || "").trim().toLowerCase();

  switch (normalizedName) {
    case "bathroom":
      return "room-type-bathroom";
    case "kitchen":
      return "room-type-kitchen";
    case "bedroom":
      return "room-type-bedroom";
    case "living":
    case "living room":
      return "room-type-living";
    case "service":
    case "service / laundry":
    case "service/laundry":
    case "laundry":
      return "room-type-service";
    default:
      return "room-type-bedroom";
  }
}

export function getRoomTypeParameterDefinitions(roomType = {}, parameters = []) {
  const parameterMaps = getManagedParameterMaps(parameters);
  const roomTypeDefinitions = Array.isArray(roomType.parameterDefinitions)
    ? roomType.parameterDefinitions.map((parameterDefinition) =>
        normalizeParameterDefinition(parameterDefinition, parameterMaps)
      )
    : (roomTypeParameterDefinitionsByType[getFallbackRoomTypeKey(roomType)] || coreParameterDefinitions).map(
        (parameterDefinition) => normalizeParameterDefinition(parameterDefinition, parameterMaps)
      );

  return sortParameterDefinitions(roomTypeDefinitions);
}

export function serializeRoomTypeParameterDefinitions(parameterDefinitions = [], parameters = []) {
  const parameterMaps = getManagedParameterMaps(parameters);

  return parameterDefinitions.map((parameterDefinition) => {
    const managedParameter = getManagedParameter(parameterDefinition, parameterMaps);
    const nextDefinition = {
      defaultValue:
        parameterDefinition.defaultValue == null ? "" : parameterDefinition.defaultValue,
      isRequired: Boolean(parameterDefinition.isRequired),
      sortOrder: Number(parameterDefinition.sortOrder ?? 0),
    };

    if (managedParameter) {
      return {
        parameterId: managedParameter.id,
        ...nextDefinition,
      };
    }

    return {
      key: parameterDefinition.key,
      label: parameterDefinition.label,
      inputType: parameterDefinition.inputType || "number",
      unit: parameterDefinition.unit ?? parameterDefinition.unitText ?? "",
      defaultValue: nextDefinition.defaultValue,
      isRequired: nextDefinition.isRequired,
      sortOrder: nextDefinition.sortOrder,
    };
  });
}

export function buildRoomParameterFormValues(roomType = {}, existingValues = {}, parameters = []) {
  return getRoomTypeParameterDefinitions(roomType, parameters).reduce(
    (nextValues, parameterDefinition) => {
      const existingValue = existingValues[parameterDefinition.key];

      return {
        ...nextValues,
        [parameterDefinition.key]:
          existingValue == null || existingValue === ""
            ? String(parameterDefinition.defaultValue ?? "")
            : String(existingValue),
      };
    },
    { ...existingValues }
  );
}

export function buildInitialRoomTypeParameterDefinitions(roomTypeId, parameters = []) {
  return serializeRoomTypeParameterDefinitions(
    getRoomTypeParameterDefinitions({ id: roomTypeId }, parameters),
    parameters
  );
}
