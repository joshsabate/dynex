export function normalizeUnitValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

export function findUnitById(units, unitId) {
  if (!unitId) {
    return null;
  }

  return units.find((unit) => unit.id === unitId) || null;
}

export function findUnitByValue(units, unitValue) {
  const normalizedValue = normalizeUnitValue(unitValue);

  if (!normalizedValue) {
    return null;
  }

  return (
    units.find((unit) => {
      const normalizedName = normalizeUnitValue(unit.name);
      const normalizedAbbreviation = normalizeUnitValue(unit.abbreviation);

      return (
        normalizedValue === normalizedName ||
        normalizedValue === normalizedAbbreviation
      );
    }) || null
  );
}

export function resolveUnit(units, unitId, unitValue) {
  return findUnitById(units, unitId) || findUnitByValue(units, unitValue);
}

export function getUnitAbbreviation(units, unitId, unitValue = "", fallback = "") {
  return resolveUnit(units, unitId, unitValue)?.abbreviation || unitValue || fallback || "";
}

export function getUnitName(units, unitId, unitValue = "", fallback = "") {
  return resolveUnit(units, unitId, unitValue)?.name || unitValue || fallback || "";
}

export function unitsMatch(leftUnitId, leftUnitValue, rightUnitId, rightUnitValue) {
  if (leftUnitId && rightUnitId) {
    return leftUnitId === rightUnitId;
  }

  return normalizeUnitValue(leftUnitValue) === normalizeUnitValue(rightUnitValue);
}

export function isHourUnit(units, unitId, unitValue) {
  return getUnitAbbreviation(units, unitId, unitValue).toUpperCase() === "HR";
}
