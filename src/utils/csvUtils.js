import { normalizeAssemblies } from "./assemblies";

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
];

const costCsvHeaders = [
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
      ]
        .map(escapeCsvValue)
        .join(",")
    ),
  ];

  return rows.join("\n");
}
