import { calculateEstimateTotals, getEstimateSubtotal } from "./estimateTotals";

function cleanText(value) {
  return String(value || "").trim();
}

function buildDescription(row = {}) {
  return [
    row.displayNameOverride && row.displayNameOverride !== row.itemName
      ? row.displayNameOverride
      : "",
    row.specification,
    row.gradeOrQuality,
    row.brand,
    row.finishOrVariant,
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(" · ");
}

function getSectionNameById(sections = []) {
  return new Map((sections || []).map((section) => [section.id, cleanText(section.name)]));
}

function getRoomSectionById(projectRooms = []) {
  return new Map((projectRooms || []).map((room) => [room.id, cleanText(room.sectionId)]));
}

function resolveSectionContext(row, options) {
  const { generatedRowSectionAssignments = {}, sectionNameById, roomSectionById } = options;
  const sectionId =
    cleanText(row.sectionId) ||
    cleanText(generatedRowSectionAssignments[row.id]) ||
    cleanText(roomSectionById.get(row.roomId)) ||
    "";

  return {
    sectionId,
    sectionName: sectionNameById.get(sectionId) || cleanText(row.sectionName) || "Unassigned",
  };
}

const DETAIL_FIELD_PROVIDERS = {
  specification: (row) => cleanText(row.specification),
  gradeOrQuality: (row) => cleanText(row.gradeOrQuality),
  brand: (row) => cleanText(row.brand),
  finishOrVariant: (row) => cleanText(row.finishOrVariant),
  quantity: (row, options) =>
    options.hideQuantities ? null : `Qty ${Number(row.quantity ?? 0)}`,
  unit: (row, options) => (options.showUnits ? cleanText(row.unit) : null),
};

function buildSupportingDetailParts(row, fields = [], options = {}) {
  return (fields || [])
    .map((field) => {
      const provider = DETAIL_FIELD_PROVIDERS[field];
      if (!provider) {
        return null;
      }

      const value = provider(row, options);
      return value ? value : null;
    })
    .filter(Boolean);
}

function getPrimaryLabel(row, primaryField) {
  if (primaryField === "coreName") {
    return cleanText(row.coreName) || cleanText(row.itemName);
  }

  return cleanText(row.itemName);
}

function createPresentationItem(
  row,
  { mode, hideUnitRates, hideQuantities, showUnits, primaryLabelField, detailFields }
) {
  const baseItem = {
    id: row.id,
    title: cleanText(row.displayNameOverride) || cleanText(row.itemName) || "Untitled item",
    description: buildDescription(row),
    quantity: Number(row.quantity ?? 0),
    unit: cleanText(row.unit),
    roomName: cleanText(row.roomName),
    sectionName: cleanText(row.sectionName),
    stageName: cleanText(row.stage),
    primaryLabel: getPrimaryLabel(row, primaryLabelField),
    supportingDetailParts:
      mode === "client"
        ? buildSupportingDetailParts(row, detailFields, { hideQuantities, showUnits })
        : [],
    quantityDisplay: mode === "client" && hideQuantities ? null : Number(row.quantity ?? 0),
    unitDisplay: mode === "client" && showUnits ? cleanText(row.unit) : null,
  };

  if (mode === "client") {
    return {
      ...baseItem,
      unitRate: hideUnitRates ? null : undefined,
      total: null,
    };
  }

  return {
    ...baseItem,
    unitRate: hideUnitRates ? null : Number(row.unitRate ?? row.rate ?? 0),
    total: Number(row.total ?? 0),
    costCode: cleanText(row.costCode),
    notes: cleanText(row.notes),
    source: cleanText(row.source),
  };
}

function getGroupLabel(row, groupBy) {
  switch (groupBy) {
    case "room":
      return cleanText(row.roomName) || "Unassigned";
    case "stage":
      return cleanText(row.stage) || "Unassigned";
    case "section":
    default:
      return cleanText(row.sectionName) || "Unassigned";
  }
}

export const defaultPresentationOptions = {
  groupBy: "section",
  mode: "internal",
  visibility: {
    totalsOnly: false,
    groupedBreakdown: true,
    hideUnitRates: false,
    hideQuantities: false,
    hideLineItems: false,
    showItemTotals: true,
    showGroupTotals: true,
    showSummaryTotals: true,
  },
  markupPercent: 0,
  gstEnabled: true,
  gstRate: 0.1,
};

export function buildEstimatePresentationModel({
  rows = [],
  sections = [],
  projectRooms = [],
  generatedRowSectionAssignments = {},
  project = {},
  groupBy = defaultPresentationOptions.groupBy,
  mode = defaultPresentationOptions.mode,
  visibility = {},
  clientGroupBy,
  allowedClientGroupings = [],
  allowClientGroupingSwitch = true,
  presentationLayout = "line_sheet",
  clientPrimaryLabelField = "coreName",
  clientLineItemDetailFields = ["specification", "gradeOrQuality", "brand", "finishOrVariant"],
  clientHideQuantities = true,
  clientShowUnits = false,
  markupPercent = defaultPresentationOptions.markupPercent,
  gstEnabled = defaultPresentationOptions.gstEnabled,
  gstRate = defaultPresentationOptions.gstRate,
} = {}) {
  const resolvedVisibility = {
    ...defaultPresentationOptions.visibility,
    ...(visibility || {}),
  };
  const normalizedMode = mode === "client" ? "client" : "internal";
  const normalizedGroupBy = ["section", "room", "stage"].includes(groupBy) ? groupBy : "section";
  const validClientGroupings = ["section", "room", "stage"];
  const normalizedAllowedClientGroupings =
    Array.isArray(allowedClientGroupings) && allowedClientGroupings.length
      ? allowedClientGroupings.filter((value) => validClientGroupings.includes(value))
      : validClientGroupings;
  const normalizedClientGroupBy = validClientGroupings.includes(clientGroupBy)
    ? clientGroupBy
    : normalizedGroupBy;
  const resolvedClientGroupBy =
    normalizedAllowedClientGroupings.includes(normalizedClientGroupBy)
      ? normalizedClientGroupBy
      : normalizedAllowedClientGroupings[0] || normalizedGroupBy;
  const sectionNameById = getSectionNameById(sections);
  const roomSectionById = getRoomSectionById(projectRooms);

  const visibleRows = (rows || [])
    .filter((row) => row && row.include !== false)
    .map((row) => {
      const sectionContext = resolveSectionContext(row, {
        generatedRowSectionAssignments,
        sectionNameById,
        roomSectionById,
      });

      return {
        ...row,
        sectionId: sectionContext.sectionId,
        sectionName: sectionContext.sectionName,
        roomName: cleanText(row.roomName) || "Unassigned",
        stage: cleanText(row.stage) || "Unassigned",
      };
    });

  const totals = calculateEstimateTotals({
    rows: visibleRows,
    markupPercent,
    gstEnabled,
    gstRate,
  });

  const groupsMap = new Map();

  const groupingKey = normalizedMode === "client" ? resolvedClientGroupBy : normalizedGroupBy;

  visibleRows.forEach((row) => {
    const label = getGroupLabel(row, groupingKey);
    const key = `${groupingKey}:${label}`;

    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        key,
        label,
        rows: [],
      });
    }

    groupsMap.get(key).rows.push(row);
  });

  const groups = Array.from(groupsMap.values())
    .map((group) => ({
      key: group.key,
      label: group.label,
      subtotal: getEstimateSubtotal(group.rows),
      itemCount: group.rows.length,
      items:
        resolvedVisibility.totalsOnly || !resolvedVisibility.groupedBreakdown || resolvedVisibility.hideLineItems
          ? []
          : group.rows.map((row) =>
            createPresentationItem(row, {
              mode: normalizedMode,
              hideUnitRates: resolvedVisibility.hideUnitRates || normalizedMode === "client",
              hideQuantities:
                normalizedMode === "client"
                  ? resolvedVisibility.hideQuantities || clientHideQuantities
                  : false,
              showUnits: normalizedMode === "client" && clientShowUnits,
              primaryLabelField: clientPrimaryLabelField,
              detailFields: clientLineItemDetailFields,
            })
          ),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));

  return {
    project: {
      projectName: cleanText(project.projectName),
      estimateName: cleanText(project.estimateName),
      clientName: cleanText(project.clientName),
      projectAddress: cleanText(project.projectAddress),
      projectManager: cleanText(project.projectManager),
      estimator: cleanText(project.estimator),
      revision: cleanText(project.revision),
      contactDetails: cleanText(project.contactDetails),
    },
    mode: normalizedMode,
    groupBy: groupingKey,
    clientGroupBy: resolvedClientGroupBy,
    visibility: {
      ...resolvedVisibility,
      allowClientGroupingSwitch,
      allowedClientGroupings: normalizedAllowedClientGroupings,
    },
    layout: presentationLayout,
    clientPrimaryLabelField,
    clientLineItemDetailFields,
    clientHideQuantities,
    clientShowUnits,
    totals,
    groups:
      resolvedVisibility.totalsOnly || !resolvedVisibility.groupedBreakdown
        ? []
        : groups,
  };
}
