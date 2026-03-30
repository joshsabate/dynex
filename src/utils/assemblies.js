import { evaluateFormula } from "./quantitySources";
import { getUnitAbbreviation, isHourUnit } from "./units";
import { findMatchingCost, getLegacyWorkType, mapLegacyWorkType } from "./costs";

export const assemblyItemTypeOptions = ["MTL", "LBR", "Other", "EQUIP"];

function cleanText(value) {
  return String(value || "").trim();
}

function resolveAssemblyOptions(options = {}) {
  if (Array.isArray(options)) {
    return {
      units: options,
      costs: [],
      trades: [],
      costCodes: [],
    };
  }

  return {
    units: options.units || [],
    costs: options.costs || [],
    trades: options.trades || [],
    costCodes: options.costCodes || [],
  };
}

function slugifyAssemblyPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toNumberOrValue(value) {
  if (value === "" || value == null) {
    return "";
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : value;
}

export function getDefaultAssemblyItemType(unitId, unit, units = []) {
  return isHourUnit(units, unitId, unit) ? "LBR" : "MTL";
}

export function normalizeAssemblyItemType(value, unitId, unit, units = []) {
  const normalizedValue = String(value || "").trim();

  if (assemblyItemTypeOptions.includes(normalizedValue)) {
    return normalizedValue;
  }

  return getDefaultAssemblyItemType(unitId, unit, units);
}

export function getAssemblyRoomTypeId(assembly = {}) {
  return assembly.roomTypeId || assembly.appliesToRoomTypeId || "";
}

export function getAssemblyRoomTypeName(assembly = {}) {
  return assembly.roomType || assembly.appliesToRoomType || "";
}

export function getAssemblyGroupName(assembly = {}) {
  return assembly.assemblyGroup || assembly.assemblyCategory || "";
}

export function createAssemblyId(assembly = {}) {
  if (assembly.id) {
    return assembly.id;
  }

  if (assembly.assemblyId) {
    return assembly.assemblyId;
  }

  return `assembly-${slugifyAssemblyPart(getAssemblyRoomTypeId(assembly) || getAssemblyRoomTypeName(assembly))}-${slugifyAssemblyPart(
    assembly.assemblyName
  )}-${slugifyAssemblyPart(getAssemblyGroupName(assembly))}`;
}

function getResolvedTrade(trades = [], tradeId, tradeName) {
  const normalizedTradeName = cleanText(tradeName).toLowerCase();
  return (
    trades.find((trade) => trade.id === tradeId) ||
    trades.find((trade) => cleanText(trade.name).toLowerCase() === normalizedTradeName) ||
    null
  );
}

function getResolvedCostCode(costCodes = [], costCodeId, costCodeName) {
  const normalizedCostCodeName = cleanText(costCodeName).toLowerCase();
  return (
    costCodes.find((costCode) => costCode.id === costCodeId) ||
    costCodes.find((costCode) => cleanText(costCode.name).toLowerCase() === normalizedCostCodeName) ||
    null
  );
}

function normalizeAssemblyItem(item = {}, itemIndex, assembly = {}, options = {}) {
  const { units = [], costs = [], trades = [], costCodes = [] } = resolveAssemblyOptions(options);
  const libraryItemId = cleanText(item.libraryItemId || item.costItemId);
  const unitId = item.unitId || "";
  const unit = String(item.unit || getUnitAbbreviation(units, unitId, "", "") || "").trim();
  const legacyClassification = mapLegacyWorkType(item.workType, unitId, unit, units);
  const matchedCost =
    costs.find((cost) => cost.id === libraryItemId) ||
    findMatchingCost(costs, item.itemNameSnapshot || item.itemName, unitId, unit);
  const isCustomItem =
    typeof item.isCustomItem === "boolean" ? item.isCustomItem : !libraryItemId;
  const linkedSource = !isCustomItem ? matchedCost : null;
  const resolvedTrade = getResolvedTrade(
    trades,
    item.tradeId || linkedSource?.tradeId || matchedCost?.tradeId,
    item.trade || linkedSource?.trade || matchedCost?.trade
  );
  const resolvedCostCode = getResolvedCostCode(
    costCodes,
    item.costCodeId || linkedSource?.costCodeId || matchedCost?.costCodeId,
    item.costCode || linkedSource?.costCode || matchedCost?.costCode
  );
  const costType =
    cleanText(linkedSource?.costType) ||
    cleanText(item.costType) ||
    cleanText(item.itemType) ||
    cleanText(matchedCost?.costType) ||
    legacyClassification.costType;
  const deliveryType =
    cleanText(linkedSource?.deliveryType) ||
    cleanText(item.deliveryType) ||
    cleanText(matchedCost?.deliveryType) ||
    legacyClassification.deliveryType;
  const itemNameSnapshot = cleanText(
    linkedSource?.itemName || item.itemNameSnapshot || item.itemName || matchedCost?.itemName
  );
  const normalizedUnitId = linkedSource?.unitId || unitId || matchedCost?.unitId || "";
  const normalizedUnit = cleanText(
    linkedSource?.unit ||
      item.unit ||
      matchedCost?.unit ||
      getUnitAbbreviation(units, normalizedUnitId, "", "")
  );
  const baseRate = toNumberOrValue(
    linkedSource?.rate ?? item.baseRate ?? item.unitCost ?? matchedCost?.rate ?? ""
  );
  const rateOverride = toNumberOrValue(item.rateOverride);
  const resolvedLibraryItemId = cleanText(libraryItemId || matchedCost?.id);

  return {
    ...item,
    id: item.id || `${createAssemblyId(assembly)}-item-${itemIndex + 1}`,
    libraryItemId: resolvedLibraryItemId,
    costItemId: resolvedLibraryItemId,
    itemNameSnapshot,
    itemName: itemNameSnapshot,
    costType,
    deliveryType,
    workType: getLegacyWorkType(costType, deliveryType),
    itemType: costType,
    quantityFormula: String(item.quantityFormula || item.qtyRule || "").trim(),
    qtyRule: String(item.quantityFormula || item.qtyRule || "").trim(),
    tradeId: resolvedTrade?.id || cleanText(item.tradeId),
    trade: resolvedTrade?.name || cleanText(item.trade || linkedSource?.trade || matchedCost?.trade),
    costCodeId: resolvedCostCode?.id || cleanText(item.costCodeId),
    costCode:
      resolvedCostCode?.name ||
      cleanText(item.costCode || linkedSource?.costCode || matchedCost?.costCode),
    unitId: normalizedUnitId,
    unit: normalizedUnit,
    baseRate,
    unitCost: baseRate,
    rateOverride,
    notes: cleanText(item.notes),
    isCustomItem,
  };
}

function normalizeNestedAssembly(assembly = {}, assemblyIndex, options = {}) {
  const roomTypeId = getAssemblyRoomTypeId(assembly);
  const roomType = getAssemblyRoomTypeName(assembly);
  const assemblyGroup = getAssemblyGroupName(assembly);
  const normalizedAssembly = {
    ...assembly,
    id: createAssemblyId(assembly),
    assemblyId: createAssemblyId(assembly),
    assemblyName: String(assembly.assemblyName || "").trim(),
    roomTypeId,
    roomType,
    appliesToRoomTypeId: roomTypeId,
    appliesToRoomType: roomType,
    assemblyGroup,
    assemblyCategory: assemblyGroup,
    items: Array.isArray(assembly.items)
      ? assembly.items.map((item, itemIndex) =>
          normalizeAssemblyItem(item, itemIndex, assembly, options)
        )
      : [],
    sortOrder: assembly.sortOrder ?? assemblyIndex,
  };

  return normalizedAssembly;
}

function normalizeLegacyAssemblyRows(rows = [], options = {}) {
  const groups = new Map();

  rows.forEach((row, rowIndex) => {
    const assemblyName = String(row.assemblyName || "").trim();
    const roomTypeId = getAssemblyRoomTypeId(row);
    const roomType = getAssemblyRoomTypeName(row);
    const assemblyGroup = getAssemblyGroupName(row);
    const assemblyId = createAssemblyId({
      assemblyId: row.assemblyId,
      assemblyName,
      roomTypeId,
      roomType,
      assemblyGroup,
    });
    const groupKey = row.assemblyId || `${assemblyName}::${roomTypeId || roomType}::${assemblyGroup}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        ...row,
        id: assemblyId,
        assemblyId,
        assemblyName,
        roomTypeId,
        roomType,
        appliesToRoomTypeId: roomTypeId,
        appliesToRoomType: roomType,
        assemblyGroup,
        assemblyCategory: assemblyGroup,
        items: [],
        sortOrder: row.sortOrder ?? rowIndex,
      });
    }

    groups.get(groupKey).items.push(
      normalizeAssemblyItem(
        {
          ...row,
          id: row.id,
          quantityFormula: row.quantityFormula || row.qtyRule || "",
        },
        groups.get(groupKey).items.length,
        groups.get(groupKey),
        options
      )
    );
  });

  return Array.from(groups.values()).map((assembly, assemblyIndex) =>
    normalizeNestedAssembly(assembly, assemblyIndex, options)
  );
}

export function normalizeAssemblies(source = [], options = {}) {
  if (!Array.isArray(source)) {
    return [];
  }

  if (!source.length) {
    return [];
  }

  const hasNestedItems = source.some(
    (assembly) => Array.isArray(assembly?.items) && !Object.prototype.hasOwnProperty.call(assembly, "itemName")
  );

  if (hasNestedItems) {
    return source.map((assembly, assemblyIndex) =>
      normalizeNestedAssembly(assembly, assemblyIndex, options)
    );
  }

  return normalizeLegacyAssemblyRows(source, options);
}

export function flattenAssemblyItems(assemblies = []) {
  return normalizeAssemblies(assemblies).flatMap((assembly) =>
    assembly.items.map((item) => ({
      assemblyId: assembly.id,
      assemblyName: assembly.assemblyName,
      roomTypeId: assembly.roomTypeId,
      roomType: assembly.roomType,
      assemblyGroup: assembly.assemblyGroup,
      assemblyCategory: assembly.assemblyGroup,
      ...item,
    }))
  );
}

export function matchesAssemblyRoomType(assembly, roomType, roomTypeId) {
  if (!roomType && !roomTypeId) {
    return true;
  }

  if (roomTypeId && getAssemblyRoomTypeId(assembly)) {
    return getAssemblyRoomTypeId(assembly) === roomTypeId;
  }

  return getAssemblyRoomTypeName(assembly) === roomType;
}

export function getAssemblyQuantity(formula, roomMetrics = {}) {
  const expression = String(formula || "").trim();

  switch (expression) {
    case "1":
      return Number(roomMetrics.quantity || 0);
    case "FloorArea":
      return Number(roomMetrics.floorArea || 0);
    case "Perimeter":
      return Number(roomMetrics.perimeter || 0);
    case "TileWallArea":
      return Number(roomMetrics.tileWallArea || 0);
    case "WaterproofFloorArea":
      return Number(roomMetrics.waterproofFloorArea || 0);
    case "WaterproofWallArea":
      return Number(roomMetrics.waterproofWallArea || 0);
    case "CeilingArea":
      return Number(roomMetrics.ceilingArea || 0);
    case "SkirtingLength":
      return Number(roomMetrics.skirtingLength || 0);
    case "BaseCabinetLength":
      return Number(roomMetrics.baseCabinetLengthTotal || 0);
    case "OverheadCabinetLength":
      return Number(roomMetrics.overheadCabinetLengthTotal || 0);
    case "BenchtopLength":
      return Number(roomMetrics.benchtopLengthTotal || 0);
    case "SplashbackArea":
      return Number(roomMetrics.splashbackArea || 0);
    case "SplashbackLength":
      return Number(roomMetrics.splashbackLengthTotal || 0);
    default:
      return Math.round(evaluateFormula(expression, roomMetrics, roomMetrics) * 100) / 100;
  }
}
