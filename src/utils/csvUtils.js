const assemblyCsvHeaders = [
  "Assembly Name",
  "Item Name",
  "Description",
  "Quantity Formula",
  "Unit",
  "Unit Cost",
  "Item Type",
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
  const rows = [
    assemblyCsvHeaders.join(","),
    ...assemblies.map((assembly) =>
      [
        assembly.assemblyName,
        assembly.itemName,
        assembly.description,
        assembly.qtyRule,
        assembly.unit,
        assembly.unitCost,
        assembly.itemType,
      ]
        .map(escapeCsvValue)
        .join(",")
    ),
  ];

  return rows.join("\n");
}
