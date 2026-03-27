import { calculateRoomMetrics, getQtyRuleQuantity } from "./roomMetrics";
import { getAssemblyGroupId } from "./assemblyGroups";
import { getStructuredItemPresentation } from "./itemNaming";
import { resolveQuantitySource } from "./quantitySources";
import { getTemplateLabourItems, getTemplateManualItems } from "./roomTemplates";
import { getUnitAbbreviation, unitsMatch } from "./units";

function roundValue(value) {
  return Math.round(value * 100) / 100;
}

function toNumber(value) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function hasOverride(rowOverride, key) {
  return Object.prototype.hasOwnProperty.call(rowOverride || {}, key);
}

function getStageName(stages, stageId, fallbackStage) {
  return stages.find((stage) => stage.id === stageId)?.name || fallbackStage || "Unassigned";
}

function getTradeName(trades, tradeId, fallbackTrade) {
  return trades.find((trade) => trade.id === tradeId)?.name || fallbackTrade || "Unassigned";
}

function getElementName(elements, elementId, fallbackElement) {
  return (
    elements.find((element) => element.id === elementId)?.name ||
    fallbackElement ||
    "Unassigned"
  );
}

function getCostCodeName(costCodes, costCodeId, fallbackCostCode) {
  return (
    costCodes.find((costCode) => costCode.id === costCodeId)?.name ||
    fallbackCostCode ||
    "Unassigned"
  );
}

function getSectionName(sections, sectionId, fallbackSection) {
  return sections.find((section) => section.id === sectionId)?.name || fallbackSection || "Unassigned";
}

function findCostRow(costRows, costItemId, itemName, unitId, unit) {
  if (costItemId) {
    const linkedCost = costRows.find((cost) => cost.id === costItemId);

    if (linkedCost) {
      return linkedCost;
    }
  }

  return (
    costRows.find(
      (cost) =>
        cost.itemName === itemName &&
        unitsMatch(cost.unitId, cost.unit, unitId, unit)
    ) || null
  );
}

function buildEstimateRow(baseRow, rowOverride) {
  const removed = rowOverride?.removed === true;
  const includeOverride =
    typeof rowOverride?.includeOverride === "boolean"
      ? rowOverride.includeOverride
      : undefined;
  const quantityOverride =
    rowOverride?.quantityOverride === "" || rowOverride?.quantityOverride == null
      ? undefined
      : toNumber(rowOverride.quantityOverride);
  const rateOverride =
    rowOverride?.rateOverride === "" || rowOverride?.rateOverride == null
      ? undefined
      : toNumber(rowOverride.rateOverride);
  const stageId = hasOverride(rowOverride, "stageId") ? rowOverride.stageId : baseRow.stageId;
  const stage = hasOverride(rowOverride, "stage") ? rowOverride.stage : baseRow.stage;
  const tradeId = hasOverride(rowOverride, "tradeId") ? rowOverride.tradeId : baseRow.tradeId;
  const trade = hasOverride(rowOverride, "trade") ? rowOverride.trade : baseRow.trade;
  const costCodeId = hasOverride(rowOverride, "costCodeId")
    ? rowOverride.costCodeId
    : baseRow.costCodeId;
  const costCode = hasOverride(rowOverride, "costCode")
    ? rowOverride.costCode
    : baseRow.costCode;
  const unitId = hasOverride(rowOverride, "unitId") ? rowOverride.unitId : baseRow.unitId;
  const unit = hasOverride(rowOverride, "unit") ? rowOverride.unit : baseRow.unit;
  const itemName = hasOverride(rowOverride, "itemName") ? rowOverride.itemName : baseRow.itemName;
  const workType = hasOverride(rowOverride, "workType") ? rowOverride.workType : baseRow.workType;
  const displayNameOverride = hasOverride(rowOverride, "displayNameOverride")
    ? rowOverride.displayNameOverride
    : baseRow.displayNameOverride;
  const itemFamily = hasOverride(rowOverride, "itemFamily")
    ? rowOverride.itemFamily
    : baseRow.itemFamily;
  const specification = hasOverride(rowOverride, "specification")
    ? rowOverride.specification
    : baseRow.specification;
  const gradeOrQuality = hasOverride(rowOverride, "gradeOrQuality")
    ? rowOverride.gradeOrQuality
    : baseRow.gradeOrQuality;
  const brand = hasOverride(rowOverride, "brand") ? rowOverride.brand : baseRow.brand;
  const finishOrVariant = hasOverride(rowOverride, "finishOrVariant")
    ? rowOverride.finishOrVariant
    : baseRow.finishOrVariant;
  const sortOrder =
    rowOverride?.sortOrder === "" || rowOverride?.sortOrder == null
      ? baseRow.sortOrder
      : toNumber(rowOverride.sortOrder);
  const include = includeOverride ?? baseRow.generatedInclude;
  const quantity = roundValue(quantityOverride ?? baseRow.generatedQuantity);
  const unitRate = roundValue(rateOverride ?? baseRow.generatedRate);
  const total = include ? roundValue(quantity * unitRate) : 0;
  const itemPresentation = getStructuredItemPresentation({
    itemName,
    displayNameOverride,
    workType,
    itemFamily,
    specification,
    gradeOrQuality,
    brand,
    finishOrVariant,
  });

  return {
    ...baseRow,
    stageId,
    stage,
    tradeId,
    trade,
    costCodeId,
    costCode,
    itemName,
    displayNameOverride,
    workType,
    itemFamily,
    specification,
    gradeOrQuality,
    brand,
    finishOrVariant,
    unitId,
    unit,
    includeOverride,
    quantityOverride,
    rateOverride,
    removed,
    sortOrder,
    notes: hasOverride(rowOverride, "notes") ? rowOverride.notes : baseRow.notes || "",
    sourceLink: hasOverride(rowOverride, "sourceLink")
      ? rowOverride.sourceLink
      : baseRow.sourceLink || "",
    displayName: itemPresentation.displayName,
    displayPrimary: itemPresentation.primaryLabel,
    displayMeta: itemPresentation.metaLabel,
    hasStructuredNaming: itemPresentation.hasStructuredNaming,
    itemSortKey: itemPresentation.sortKey || String(itemName || "").toLowerCase(),
    include,
    quantity,
    unitRate,
    total,
    missingRate: include && unitRate <= 0,
  };
}

function buildTemplateLineRow({
  room,
  line,
  rowId,
  costs,
  stages,
  trades,
  elements,
  units,
  costCodes,
  rowOverrides,
  source,
  assemblyName,
}) {
  const roomMetrics = calculateRoomMetrics(room);
  const costRow = findCostRow(costs, line.costItemId, line.itemName, line.unitId, line.unit);
  const quantity = resolveQuantitySource(line, room, roomMetrics);

  return buildEstimateRow(
    {
      id: rowId,
      roomId: room.id,
      roomName: room.name,
      roomType: room.roomType,
      sectionId: room.sectionId || "",
      assemblyId: "",
      assemblyCategory: source === "manual-room-labour" ? "Manual Labour" : "Manual Item",
      assemblyName,
      stageId: line.stageId || "",
      stage: getStageName(stages, line.stageId, line.stage),
      elementId: line.elementId || "",
      element: getElementName(elements, line.elementId, line.element),
      tradeId: line.tradeId || costRow?.tradeId || "",
      trade: getTradeName(trades, line.tradeId || costRow?.tradeId, line.trade || costRow?.trade),
      costCodeId: line.costCodeId || costRow?.costCodeId || "",
      costCode: getCostCodeName(
        costCodes,
        line.costCodeId || costRow?.costCodeId,
        line.costCode || costRow?.costCode
      ),
      itemName: costRow?.itemName || line.itemName || "Unassigned",
      displayNameOverride: line.displayNameOverride || "",
      workType: line.workType || costRow?.workType || (source === "manual-room-labour" ? "Labour" : ""),
      itemFamily: line.itemFamily || costRow?.itemFamily || "",
      specification: line.specification || costRow?.specification || "",
      gradeOrQuality: line.gradeOrQuality || costRow?.gradeOrQuality || "",
      brand: line.brand || costRow?.brand || "",
      finishOrVariant: line.finishOrVariant || costRow?.finishOrVariant || "",
      qtyRule:
        line.quantitySourceType === "fixed"
          ? "Manual"
          : `Manual:${line.quantitySourceType}`,
      unitId: costRow?.unitId || line.unitId || "",
      unit: getUnitAbbreviation(units, costRow?.unitId || line.unitId, costRow?.unit || line.unit),
      generatedInclude: line.include !== false,
      generatedQuantity: quantity,
      generatedRate: costRow?.rate ?? toNumber(line.rate),
      laborHours: source === "manual-room-labour" ? quantity : 0,
      laborHoursPerUnit: 0,
      sortOrder: line.sortOrder ?? 0,
      source,
      sourceLink: line.sourceLink || costRow?.sourceLink || "",
    },
    rowOverrides[rowId]
  );
}

function buildLaborRow({
  room,
  assemblyId,
  assemblyRow,
  laborCostRow,
  laborHours,
  rowOverrides,
  units,
}) {
  const rowId = `${room.id}-${assemblyId}-${assemblyRow.id}-labor`;

  return buildEstimateRow(
    {
      id: rowId,
      roomId: room.id,
      roomName: room.name,
      roomType: room.roomType,
      sectionId: room.sectionId || "",
      assemblyId,
      assemblyCategory: assemblyRow.assemblyCategory,
      assemblyName: `${assemblyRow.assemblyName} Labour`,
      stageId: assemblyRow.stageId || "",
      stage: assemblyRow.stage,
      elementId: assemblyRow.elementId || "",
      element: assemblyRow.element,
      tradeId: assemblyRow.tradeId || laborCostRow?.tradeId || "",
      trade: assemblyRow.trade || laborCostRow?.trade,
      costCodeId: assemblyRow.costCodeId || laborCostRow?.costCodeId || "",
      costCode: assemblyRow.costCode || laborCostRow?.costCode,
      itemName: laborCostRow?.itemName || assemblyRow.laborCostItemName,
      displayNameOverride: assemblyRow.displayNameOverride || "",
      workType: "Labour",
      itemFamily: assemblyRow.itemFamily || laborCostRow?.itemFamily || "",
      specification: assemblyRow.specification || laborCostRow?.specification || "",
      gradeOrQuality: assemblyRow.gradeOrQuality || laborCostRow?.gradeOrQuality || "",
      brand: assemblyRow.brand || laborCostRow?.brand || "",
      finishOrVariant: assemblyRow.finishOrVariant || laborCostRow?.finishOrVariant || "",
      qtyRule: "LaborHours",
      unitId: laborCostRow?.unitId || "unit-hr",
      unit: getUnitAbbreviation(units, laborCostRow?.unitId || "unit-hr", laborCostRow?.unit || "HR"),
      generatedInclude: true,
      generatedQuantity: laborHours,
      generatedRate: laborCostRow?.rate || 0,
      laborHours,
      laborHoursPerUnit: assemblyRow.laborHoursPerUnit || 0,
      sortOrder: (assemblyRow.sortOrder ?? 0) + 0.1,
      source: "generated",
      sourceLink: assemblyRow.sourceLink || laborCostRow?.sourceLink || "",
    },
    rowOverrides[rowId]
  );
}

export function generateEstimateRows(
  rooms,
  assemblyRows,
  costRows,
  rowOverrides = {},
  stages = [],
  trades = [],
  elements = [],
  units = [],
  costCodes = []
) {
  return rooms
    .filter((room) => room.include)
    .flatMap((room) => {
      const roomMetrics = calculateRoomMetrics(room);
      const selectedAssemblyIds = room.assemblyIds || [];

      const generatedRows = selectedAssemblyIds.flatMap((assemblyId) =>
        assemblyRows
          .filter((assemblyRow) => getAssemblyGroupId(assemblyRow) === assemblyId)
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((assemblyRow) => {
            const quantity = roundValue(
              getQtyRuleQuantity(assemblyRow.qtyRule, roomMetrics)
            );
            const costRow = findCostRow(
              costRows,
              assemblyRow.costItemId,
              assemblyRow.itemName,
              assemblyRow.unitId,
              assemblyRow.unit
            );
            const unitRate = costRow?.rate || 0;
            const rowId = `${room.id}-${assemblyId}-${assemblyRow.id}`;
            const laborHours = roundValue(
              quantity * toNumber(assemblyRow.laborHoursPerUnit)
            );
            const laborCostRow = findCostRow(
              costRows,
              assemblyRow.laborCostItemId,
              assemblyRow.laborCostItemName,
              "unit-hr",
              "HR"
            );

            const materialRow = buildEstimateRow(
              {
                id: rowId,
                roomId: room.id,
                roomName: room.name,
                roomType: room.roomType,
                assemblyId,
                assemblyCategory: assemblyRow.assemblyCategory,
                assemblyName: assemblyRow.assemblyName,
                stageId: assemblyRow.stageId || "",
                stage: getStageName(stages, assemblyRow.stageId, assemblyRow.stage),
                elementId: assemblyRow.elementId || "",
                element: getElementName(elements, assemblyRow.elementId, assemblyRow.element),
                tradeId: assemblyRow.tradeId || costRow?.tradeId || "",
                trade: getTradeName(
                  trades,
                  assemblyRow.tradeId || costRow?.tradeId,
                  assemblyRow.trade || costRow?.trade
                ),
                costCodeId: assemblyRow.costCodeId || costRow?.costCodeId || "",
                costCode: getCostCodeName(
                  costCodes,
                  assemblyRow.costCodeId || costRow?.costCodeId,
                  assemblyRow.costCode || costRow?.costCode
                ),
                itemName: assemblyRow.itemName,
                displayNameOverride: assemblyRow.displayNameOverride || "",
                workType: assemblyRow.workType || costRow?.workType || "",
                itemFamily: assemblyRow.itemFamily || costRow?.itemFamily || "",
                specification: assemblyRow.specification || costRow?.specification || "",
                gradeOrQuality: assemblyRow.gradeOrQuality || costRow?.gradeOrQuality || "",
                brand: assemblyRow.brand || costRow?.brand || "",
                finishOrVariant: assemblyRow.finishOrVariant || costRow?.finishOrVariant || "",
                qtyRule: assemblyRow.qtyRule,
                unitId: assemblyRow.unitId || costRow?.unitId || "",
                unit: getUnitAbbreviation(
                  units,
                  assemblyRow.unitId || costRow?.unitId,
                  assemblyRow.unit || costRow?.unit
                ),
                generatedInclude: true,
                generatedQuantity: quantity,
                generatedRate: unitRate,
                laborHours,
                laborHoursPerUnit: assemblyRow.laborHoursPerUnit || 0,
                sortOrder: assemblyRow.sortOrder ?? 0,
                source: "generated",
                sourceLink: assemblyRow.sourceLink || costRow?.sourceLink || "",
              },
              rowOverrides[rowId]
            );

            if (!laborHours || !assemblyRow.laborCostItemName) {
              return [materialRow];
            }

            return [
              materialRow,
              buildLaborRow({
                room,
                assemblyId,
                assemblyRow: {
                  ...assemblyRow,
                  stage: getStageName(stages, assemblyRow.stageId, assemblyRow.stage),
                  element: getElementName(elements, assemblyRow.elementId, assemblyRow.element),
                  trade: getTradeName(trades, assemblyRow.tradeId, assemblyRow.trade),
                  costCode: getCostCodeName(
                    costCodes,
                    assemblyRow.costCodeId,
                    assemblyRow.costCode
                  ),
                },
                laborCostRow,
                laborHours,
                rowOverrides,
                units,
              }),
            ];
          })
          .flat()
      );

      const customRows = getTemplateManualItems(room).map((customItem) =>
        buildTemplateLineRow({
          room,
          line: customItem,
          rowId: `${room.id}-${customItem.id}`,
          costs: costRows,
          stages,
          trades,
          elements,
          units,
          costCodes,
          rowOverrides,
          source: "manual-room",
          assemblyName: "Manual Item",
        })
      );

      const labourRows = getTemplateLabourItems(room).map((labourItem) =>
        buildTemplateLineRow({
          room,
          line: {
            ...labourItem,
            costItemId: labourItem.labourItemId || labourItem.costItemId,
          },
          rowId: `${room.id}-${labourItem.id}`,
          costs: costRows,
          stages,
          trades,
          elements,
          units,
          costCodes,
          rowOverrides,
          source: "manual-room-labour",
          assemblyName: "Manual Labour",
        })
      );

      return [...generatedRows, ...customRows, ...labourRows];
    });
}

export function generateManualEstimateBuilderRows(
  manualLines,
  rowOverrides = {},
  sections = [],
  stages = [],
  trades = [],
  elements = [],
  units = [],
  costCodes = []
) {
  return manualLines.map((line) => {
    const rowId = line.id;
    const quantity = roundValue(toNumber(line.quantity));
    const unitRate = roundValue(toNumber(line.rate));

    return buildEstimateRow(
      {
        id: rowId,
        roomId: "",
        roomName: getSectionName(sections, line.sectionId, ""),
        roomType: "",
        assemblyId: "",
        assemblyCategory: "Manual Builder",
        assemblyName:
          line.sourceAssemblyName || getSectionName(sections, line.sectionId, "Manual Builder"),
        stageId: line.stageId || "",
        stage: getStageName(stages, line.stageId, ""),
        elementId: line.elementId || "",
        element: getElementName(elements, line.elementId, ""),
        tradeId: line.tradeId || "",
        trade: getTradeName(trades, line.tradeId, ""),
        costCodeId: line.costCodeId || "",
        costCode: getCostCodeName(costCodes, line.costCodeId, ""),
        itemName: line.itemName,
        displayNameOverride: line.displayNameOverride || "",
        workType: line.workType || "",
        itemFamily: line.itemFamily || "",
        specification: line.specification || "",
        gradeOrQuality: line.gradeOrQuality || "",
        brand: line.brand || "",
        finishOrVariant: line.finishOrVariant || "",
        qtyRule: "Manual Builder",
        unitId: line.unitId || "",
        unit: getUnitAbbreviation(units, line.unitId, line.unit),
        generatedInclude: line.include !== false,
        generatedQuantity: quantity,
        generatedRate: unitRate,
        laborHours: 0,
        laborHoursPerUnit: 0,
        sortOrder: line.sortOrder ?? 0,
        source: "manual-builder",
        notes: line.notes || "",
        sourceLink: line.sourceLink || "",
        sourceAssemblyId: line.sourceAssemblyId || "",
        sourceAssemblyRowId: line.sourceAssemblyRowId || "",
        sourceCostItemId: line.sourceCostItemId || "",
      },
      rowOverrides[rowId]
    );
  });
}

export function summarizeEstimateRows(rows) {
  return rows.reduce(
    (summary, row) => {
      summary.total += row.include ? row.total : 0;
      return summary;
    },
    { total: 0 }
  );
}
