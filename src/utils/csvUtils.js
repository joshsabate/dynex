import { normalizeAssemblies } from "./assemblies";
import {
  normalizeManagedParameter,
  normalizeParameterKey,
  normalizeParameterType,
} from "./parameters";

const assemblyCsvHeaders = [
  "Assembly Name",
  "Room Type",
  "Assembly Group",
  "Item Name",
  "Cost Type",
  "Delivery Type",
  "Trade",
  "Cost Code",
  "Quantity Formula",
  "Unit",
  "Unit Cost",
  "Notes",
];

const costCsvHeaders = [
  "Internal ID",
  "Core Name",
  "Item Name",
  "Cost Type",
  "Delivery Type",
  "Family",
  "Trade",
  "Cost Code",
  "Spec",
  "Grade",
  "Finish",
  "Brand",
  "Unit",
  "Rate",
  "Status",
  "Notes",
  "Source Link",
];

const parameterCsvHeaders = [
  "Parameter Name",
  "Parameter Key",
  "Parameter Type",
  "Input Type",
  "Unit",
  "Default Value",
  "Required",
  "Sort Order",
  "Formula",
  "Description",
  "Category",
  "Status",
];

const tradeCsvHeaders = ["Trade Name", "Description", "Status", "Sort Order"];

const costCodeCsvHeaders = [
  "Cost Code",
  "Cost Code Name",
  "Stage",
  "Trade",
  "Description",
  "Order",
  "Status",
];

const roomTemplateCsvHeaders = [
  "Template ID",
  "Template Name",
  "Room Type",
  "Assembly Name",
  "Default Include",
  "Order",
  "Notes",
];

function escapeCsvValue(value) {
  const normalizedValue = String(value ?? "");

  if (/[",\n]/.test(normalizedValue)) {
    return `"${normalizedValue.replace(/"/g, '""')}"`;
  }

  return normalizedValue;
}

export function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentValue = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (insideQuotes) {
      if (character === '"' && nextCharacter === '"') {
        currentValue += '"';
        index += 1;
        continue;
      }

      if (character === '"') {
        insideQuotes = false;
        continue;
      }

      currentValue += character;
      continue;
    }

    if (character === '"') {
      insideQuotes = true;
      continue;
    }

    if (character === ",") {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if (character === "\n") {
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    if (character !== "\r") {
      currentValue += character;
    }
  }

  if (currentValue || currentRow.length) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  const [headerRow = [], ...dataRows] = rows.filter((row) =>
    row.some((value) => String(value || "").trim())
  );
  const headers = headerRow.map((header) => String(header || "").trim());

  return dataRows.map((row) =>
    headers.reduce((record, header, columnIndex) => {
      record[header] = String(row[columnIndex] || "").trim();
      return record;
    }, {})
  );
}

export function convertAssembliesToCSV(assemblies = []) {
  const normalizedAssemblies = normalizeAssemblies(assemblies);
  const rows = [
    assemblyCsvHeaders.join(","),
    ...normalizedAssemblies.flatMap((assembly) =>
      assembly.items.map((item) =>
        [
          assembly.assemblyName,
          assembly.roomType,
          assembly.assemblyGroup,
          item.itemNameSnapshot || item.itemName,
          item.costType || item.itemType,
          item.deliveryType || item.workType,
          item.trade,
          item.costCode,
            item.quantityFormula,
            item.unit,
            item.rateOverride === "" || item.rateOverride == null ? item.baseRate : item.rateOverride,
            item.notes || assembly.notes || "",
          ]
          .map(escapeCsvValue)
          .join(",")
      )
    ),
  ];

  return rows.join("\n");
}

export function convertCostsToCSV(costs = []) {
  const rows = [
    costCsvHeaders.join(","),
    ...costs.map((cost) =>
      [
        cost.internalId || "",
        cost.coreName || cost.itemName,
        cost.displayName || cost.itemName,
        cost.costType,
        cost.deliveryType,
        cost.family || cost.itemFamily,
        cost.trade,
        cost.costCode,
        cost.spec || cost.specification,
        cost.grade || cost.gradeOrQuality,
        cost.finish || cost.finishOrVariant,
        cost.brand,
        cost.unit,
        cost.rate,
        cost.status,
        cost.notes || "",
        cost.sourceLink || "",
      ]
        .map(escapeCsvValue)
        .join(",")
    ),
  ];

  return rows.join("\n");
}

export function convertParametersToCSV(parameters = []) {
  const rows = [
    parameterCsvHeaders.join(","),
    ...parameters.map((parameter) =>
      [
        parameter.label,
        parameter.key,
        parameter.parameterType || "Input",
        parameter.inputType || "number",
        parameter.unit || "",
        parameter.defaultValue ?? "",
        parameter.required ? "Yes" : "No",
        parameter.sortOrder ?? 0,
        parameter.formula || "",
        parameter.description || "",
        parameter.category || "",
        parameter.status || "Active",
      ]
        .map(escapeCsvValue)
        .join(",")
    ),
  ];

  return rows.join("\n");
}

function getImportedValue(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (String(value || "").trim()) {
      return String(value).trim();
    }
  }
  return "";
}

export function parseParameterCsv(text) {
  const rows = parseCSV(text);
  const validRows = [];
  let skippedRows = 0;

  rows.forEach((row) => {
    const label = getImportedValue(row, ["Parameter Name", "Label", "Name"]);
    const fallbackKeyFromLabel = normalizeParameterKey(label);
    const key = normalizeParameterKey(
      getImportedValue(row, ["Parameter Key", "Key"]) || fallbackKeyFromLabel
    );

    if (!label || !key) {
      skippedRows += 1;
      return;
    }

    const inputType = getImportedValue(row, ["Input Type", "Type"]).toLowerCase() === "text"
      ? "text"
      : "number";
    const parameterType = normalizeParameterType(
      getImportedValue(row, ["Parameter Type", "Type Class"]),
      key
    );
    const defaultValueRaw = getImportedValue(row, ["Default Value", "Default"]);
    const defaultValue =
      defaultValueRaw === ""
        ? ""
        : inputType === "number"
          ? Number(defaultValueRaw)
          : defaultValueRaw;

    validRows.push(
      normalizeManagedParameter({
        id: `parameter-import-${Date.now()}-${validRows.length}`,
        key,
        label,
        parameterType,
        inputType,
        unit: getImportedValue(row, ["Unit"]),
        defaultValue: Number.isFinite(defaultValue) || defaultValue === "" ? defaultValue : "",
        required: ["yes", "true", "1"].includes(
          getImportedValue(row, ["Required"]).toLowerCase()
        ),
        sortOrder: Number(getImportedValue(row, ["Sort Order", "Order"]) || validRows.length + 1),
        formula: getImportedValue(row, ["Formula"]),
        description: getImportedValue(row, ["Description"]),
        category: getImportedValue(row, ["Category"]),
        status: getImportedValue(row, ["Status"]) || "Active",
      })
    );
  });

  return {
    rows: validRows,
    skippedRows,
  };
}

export function convertTradesToCSV(trades = []) {
  return [
    tradeCsvHeaders.join(","),
    ...trades.map((trade) =>
      [
        trade.name,
        trade.description || "",
        trade.status || (trade.isActive === false ? "Inactive" : "Active"),
        trade.sortOrder ?? 0,
      ]
        .map(escapeCsvValue)
        .join(",")
    ),
  ].join("\n");
}

export function parseTradeCsv(text) {
  const rows = parseCSV(text);
  const validRows = [];
  let skippedRows = 0;

  rows.forEach((row, index) => {
    const name = getImportedValue(row, ["Trade Name", "Trade", "Name"]);
    if (!name) {
      skippedRows += 1;
      return;
    }

    validRows.push({
      id: `trade-import-${Date.now()}-${index}`,
      name,
      description: getImportedValue(row, ["Description"]),
      status: getImportedValue(row, ["Status"]) || "Active",
      isActive: (getImportedValue(row, ["Status"]) || "Active").toLowerCase() !== "inactive",
      sortOrder: Number(getImportedValue(row, ["Sort Order", "Order"]) || validRows.length + 1),
    });
  });

  return { rows: validRows, skippedRows };
}

export function convertCostCodesToCSV(costCodes = []) {
  return [
    costCodeCsvHeaders.join(","),
    ...costCodes.map((costCode) =>
      [
        costCode.code || "",
        costCode.name,
        costCode.stage || "",
        costCode.trade || "",
        costCode.description || "",
        costCode.sortOrder ?? 0,
        costCode.status || (costCode.isActive === false ? "Inactive" : "Active"),
      ]
        .map(escapeCsvValue)
        .join(",")
    ),
  ].join("\n");
}

export function parseCostCodeCsv(text) {
  const rows = parseCSV(text);
  const validRows = [];
  let skippedRows = 0;

  rows.forEach((row, index) => {
    const code = getImportedValue(row, ["Cost Code"]);
    const name = getImportedValue(row, ["Cost Code Name", "Cost Code", "Name"]);

    if (!name && !code) {
      skippedRows += 1;
      return;
    }

    validRows.push({
      id: `cost-code-import-${Date.now()}-${index}`,
      code,
      name: name || code,
      stage: getImportedValue(row, ["Stage"]),
      trade: getImportedValue(row, ["Trade"]),
      description: getImportedValue(row, ["Description"]),
      sortOrder: Number(getImportedValue(row, ["Order", "Sort Order"]) || validRows.length + 1),
      status: getImportedValue(row, ["Status"]) || "Active",
      isActive: (getImportedValue(row, ["Status"]) || "Active").toLowerCase() !== "inactive",
    });
  });

  return { rows: validRows, skippedRows };
}

export function convertRoomTemplatesToCSV(templates = [], assemblies = [], roomTypes = []) {
  const roomTypeMap = Object.fromEntries(roomTypes.map((roomType) => [roomType.id, roomType.name]));
  const assemblyMap = Object.fromEntries(assemblies.map((assembly) => [assembly.id, assembly.assemblyName]));

  return [
    roomTemplateCsvHeaders.join(","),
    ...templates.map((template, index) =>
      [
        template.id || "",
        template.name || `Room Template ${index + 1}`,
        template.roomType || roomTypeMap[template.roomTypeId] || "",
        (template.assemblyIds || []).map((assemblyId) => assemblyMap[assemblyId] || assemblyId).join(" | "),
        template.include === false ? "No" : "Yes",
        index + 1,
        template.notes || "",
      ]
        .map(escapeCsvValue)
        .join(",")
    ),
  ].join("\n");
}

export function parseRoomTemplatesCsv(text) {
  const rows = parseCSV(text);
  const validRows = [];
  let skippedRows = 0;

  rows.forEach((row, index) => {
    const name = getImportedValue(row, ["Template Name", "Name"]);
    const roomType = getImportedValue(row, ["Room Type"]);

    if (!name || !roomType) {
      skippedRows += 1;
      return;
    }

    validRows.push({
      id: getImportedValue(row, ["Template ID"]) || `room-template-import-${Date.now()}-${index}`,
      name,
      roomType,
      assemblyNames: getImportedValue(row, ["Assembly Name"])
        .split("|")
        .map((value) => value.trim())
        .filter(Boolean),
      include: getImportedValue(row, ["Default Include"]).toLowerCase() !== "no",
      sortOrder: Number(getImportedValue(row, ["Order"]) || index + 1),
      notes: getImportedValue(row, ["Notes"]),
    });
  });

  return { rows: validRows, skippedRows };
}

export function applyImportMode({
  existingItems = [],
  importedItems = [],
  mode = "append",
  getMatchKey,
  shouldConfirmOverride = () => true,
}) {
  if (mode === "override") {
    if (!shouldConfirmOverride()) {
      return null;
    }

    const nextItems = [];
    let replaced = 0;

    importedItems.forEach((item) => {
      const matchIndex =
        typeof getMatchKey === "function"
          ? nextItems.findIndex((candidate) => getMatchKey(candidate, item))
          : -1;

      if (matchIndex >= 0) {
        nextItems[matchIndex] = item;
        replaced += 1;
        return;
      }

      nextItems.push(item);
    });

    return {
      items: nextItems,
      summary: {
        added: nextItems.length,
        replaced,
        skipped: 0,
      },
    };
  }

  const nextItems = [...existingItems];
  let added = 0;
  let replaced = 0;
  let skipped = 0;

  importedItems.forEach((item) => {
    const matchIndex =
      typeof getMatchKey === "function"
        ? nextItems.findIndex((candidate) => getMatchKey(candidate, item))
        : -1;

    if (matchIndex < 0) {
      nextItems.push(item);
      added += 1;
      return;
    }

    if (mode === "replace") {
      nextItems[matchIndex] = {
        ...item,
        id: nextItems[matchIndex].id || item.id,
      };
      replaced += 1;
      return;
    }

    skipped += 1;
  });

  return {
    items: nextItems,
    summary: {
      added,
      replaced,
      skipped,
    },
  };
}
