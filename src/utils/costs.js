import { getStructuredItemPresentation } from "./itemNaming";
import { getUnitAbbreviation, isHourUnit, resolveUnit } from "./units";

export const costTypeOptions = ["MTL", "LBR", "SUB", "EQUIP", "OTH"];
export const deliveryTypeOptions = [
  "Supply",
  "Install",
  "Supply & Install",
  "Labour Only",
  "Equipment",
  "Fee / Allowance",
];
export const costStatusOptions = ["Active", "Inactive"];

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeLookupName(value) {
  return cleanText(value).toLowerCase();
}

export function mapLegacyWorkType(workType, unitId, unit, units = []) {
  switch (cleanText(workType).toLowerCase()) {
    case "supply":
      return { costType: "MTL", deliveryType: "Supply" };
    case "install":
      return { costType: "LBR", deliveryType: "Install" };
    case "supply & install":
      return { costType: "SUB", deliveryType: "Supply & Install" };
    case "labour":
      return { costType: "LBR", deliveryType: "Labour Only" };
    case "equipment":
      return { costType: "EQUIP", deliveryType: "Equipment" };
    default:
      if (isHourUnit(units, unitId, unit)) {
        return { costType: "LBR", deliveryType: "Labour Only" };
      }

      if (cleanText(unit)) {
        return { costType: "MTL", deliveryType: "Supply" };
      }

      return { costType: "OTH", deliveryType: "Fee / Allowance" };
  }
}

export function getLegacyWorkType(costType, deliveryType) {
  switch (cleanText(deliveryType).toLowerCase()) {
    case "supply":
      return "Supply";
    case "install":
      return "Install";
    case "supply & install":
      return "Supply & Install";
    case "labour only":
      return "Labour";
    case "equipment":
      return "Equipment";
    default:
      switch (cleanText(costType).toLowerCase()) {
        case "lbr":
          return "Labour";
        case "equip":
          return "Equipment";
        default:
          return "";
      }
  }
}

function getResolvedTrade(trades = [], tradeId, tradeName) {
  const normalizedTrade = normalizeLookupName(tradeName);
  return (
    trades.find((trade) => trade.id === tradeId) ||
    trades.find((trade) => normalizeLookupName(trade.name) === normalizedTrade) ||
    null
  );
}

function getResolvedCostCode(costCodes = [], costCodeId, costCodeName) {
  const normalizedCostCode = normalizeLookupName(costCodeName);
  return (
    costCodes.find((costCode) => costCode.id === costCodeId) ||
    costCodes.find((costCode) => normalizeLookupName(costCode.name) === normalizedCostCode) ||
    null
  );
}

function getResolvedFamily(itemFamilies = [], familyName) {
  const normalizedFamily = normalizeLookupName(familyName);
  return (
    itemFamilies.find((itemFamily) => normalizeLookupName(itemFamily.name) === normalizedFamily) ||
    null
  );
}

function toNumberOrBlank(value) {
  if (value === "" || value == null) {
    return "";
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : "";
}

export function normalizeCostItem(source = {}, index, options = {}) {
  const { units = [], trades = [], costCodes = [], itemFamilies = [] } = options;
  const resolvedTrade = getResolvedTrade(trades, source.tradeId, source.trade);
  const resolvedCostCode = getResolvedCostCode(costCodes, source.costCodeId, source.costCode);
  const resolvedFamily = getResolvedFamily(itemFamilies, source.itemFamily || source.family);
  const resolvedUnit = resolveUnit(units, source.unitId, source.unit);
  const unitId = source.unitId || resolvedUnit?.id || "";
  const unit = cleanText(source.unit || resolvedUnit?.abbreviation || getUnitAbbreviation(units, unitId, "", ""));
  const legacyClassification = mapLegacyWorkType(source.workType, unitId, unit, units);
  const costType = costTypeOptions.includes(cleanText(source.costType))
    ? cleanText(source.costType)
    : legacyClassification.costType;
  const deliveryType = deliveryTypeOptions.includes(cleanText(source.deliveryType))
    ? cleanText(source.deliveryType)
    : legacyClassification.deliveryType;
  const status = cleanText(source.status) === "Inactive" || source.isActive === false ? "Inactive" : "Active";
  const itemName = cleanText(source.itemName || source.coreName);
  const normalizedCost = {
    ...source,
    id: source.id || `cost-${Date.now()}-${index}`,
    internalId: cleanText(source.internalId) || cleanText(source.id) || `cost-${index + 1}`,
    coreName: itemName,
    itemName,
    costType,
    deliveryType,
    workType: getLegacyWorkType(costType, deliveryType),
    itemFamily: cleanText(source.itemFamily || source.family || resolvedFamily?.name),
    family: cleanText(source.itemFamily || source.family || resolvedFamily?.name),
    tradeId: resolvedTrade?.id || cleanText(source.tradeId),
    trade: resolvedTrade?.name || cleanText(source.trade),
    costCodeId: resolvedCostCode?.id || cleanText(source.costCodeId),
    costCode: resolvedCostCode?.name || cleanText(source.costCode),
    specification: cleanText(source.specification || source.spec),
    spec: cleanText(source.specification || source.spec),
    gradeOrQuality: cleanText(source.gradeOrQuality || source.grade),
    grade: cleanText(source.gradeOrQuality || source.grade),
    brand: cleanText(source.brand),
    finishOrVariant: cleanText(source.finishOrVariant || source.finish),
    finish: cleanText(source.finishOrVariant || source.finish),
    unitId,
    unit,
    rate: toNumberOrBlank(source.rate),
    imageUrl: cleanText(source.imageUrl),
    status,
    isActive: status === "Active",
    notes: cleanText(source.notes),
    sourceLink: cleanText(source.sourceLink),
  };

  return {
    ...normalizedCost,
    displayName: getStructuredItemPresentation(normalizedCost).displayName,
  };
}

export function normalizeCosts(source = [], options = {}) {
  if (!Array.isArray(source)) {
    return [];
  }

  return source.map((cost, index) => normalizeCostItem(cost, index, options));
}

export function findMatchingCost(costs = [], itemName, unitId = "", unit = "") {
  const normalizedItemName = normalizeLookupName(itemName);

  return (
    costs.find(
      (cost) =>
        normalizeLookupName(cost.itemName) === normalizedItemName &&
        (!unitId || cost.unitId === unitId || normalizeLookupName(cost.unit) === normalizeLookupName(unit))
    ) ||
    costs.find((cost) => normalizeLookupName(cost.itemName) === normalizedItemName) ||
    null
  );
}
