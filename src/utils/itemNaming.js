export const workTypeOptions = [
  "Supply",
  "Install",
  "Supply & Install",
  "Labour",
  "Equipment",
];

function cleanText(value) {
  return String(value || "").trim();
}

export function normalizeStructuredItem(source = {}) {
  return {
    workType: cleanText(source.workType),
    itemFamily: cleanText(source.itemFamily),
    itemName: cleanText(source.itemName),
    specification: cleanText(source.specification),
    gradeOrQuality: cleanText(source.gradeOrQuality),
    brand: cleanText(source.brand),
    finishOrVariant: cleanText(source.finishOrVariant),
  };
}

export function getStructuredItemPresentation(source = {}) {
  const normalized = normalizeStructuredItem(source);
  const displayNameOverride = cleanText(source.displayNameOverride);
  const primaryParts = [normalized.itemFamily, normalized.itemName].filter(Boolean);
  const metaParts = [
    normalized.specification,
    normalized.gradeOrQuality,
    normalized.brand,
    normalized.finishOrVariant,
  ].filter(Boolean);
  const fallbackName = normalized.itemName || cleanText(source.displayName) || "Unassigned";
  const primaryLabel = primaryParts.join(" ").trim() || fallbackName;
  const metaLabel = metaParts.join(" ");
  const displayParts = [
    normalized.itemFamily,
    normalized.itemName,
    normalized.specification,
    normalized.gradeOrQuality,
    normalized.brand,
    normalized.finishOrVariant,
  ].filter(Boolean);

  const structuredDisplayName = displayParts.join(" ").trim() || fallbackName;
  const effectiveDisplayName = displayNameOverride || structuredDisplayName;

  return {
    ...normalized,
    primaryLabel: displayNameOverride || primaryLabel,
    metaLabel,
    displayName: effectiveDisplayName,
    structuredDisplayName,
    displayNameOverride,
    hasStructuredNaming: Boolean(normalized.workType || normalized.itemFamily || metaParts.length),
    sortKey: [
      normalized.itemFamily,
      normalized.itemName,
      normalized.specification,
      normalized.gradeOrQuality,
      normalized.brand,
      normalized.finishOrVariant,
      normalized.workType,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
}

export function getWorkTypeTone(workType) {
  switch (cleanText(workType).toLowerCase()) {
    case "supply":
      return "supply";
    case "install":
      return "install";
    case "supply & install":
      return "supply-install";
    case "labour":
      return "labour";
    case "equipment":
      return "equipment";
    default:
      return "";
  }
}
