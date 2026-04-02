export const builderDebugStorageKey = "estimator-app-builder-debug";
export const builderDebugRowUpdatesKey = "estimator-app-builder-row-updates";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function isBuilderDebugEnabled() {
  if (process.env.NODE_ENV === "production" || !canUseStorage()) {
    return false;
  }

  return window.localStorage.getItem(builderDebugStorageKey) === "true";
}

export function setBuilderDebugEnabled(value) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(builderDebugStorageKey, String(Boolean(value)));
}

export function getBuilderDebugRowUpdates() {
  if (!canUseStorage()) {
    return {};
  }

  return safeParse(window.localStorage.getItem(builderDebugRowUpdatesKey) || "{}", {});
}

export function recordBuilderDebugRowUpdate(row, updatedFrom) {
  if (process.env.NODE_ENV === "production" || !canUseStorage() || !row?.id) {
    return null;
  }

  const nextEntry = {
    rowId: row.id,
    stageId: row.stageId || "",
    canvasColumn: row.canvasColumn ?? "",
    canvasTrack: row.canvasTrack ?? "",
    updatedFrom,
    updatedAt: Date.now(),
  };
  const nextUpdates = {
    ...getBuilderDebugRowUpdates(),
    [row.id]: nextEntry,
  };

  window.localStorage.setItem(builderDebugRowUpdatesKey, JSON.stringify(nextUpdates));
  return nextEntry;
}

export function logBuilderDebugRowUpdate(row, updatedFrom) {
  if (!isBuilderDebugEnabled() || !row?.id) {
    return;
  }

  console.group("ROW UPDATE");
  console.log("rowId:", row.id);
  console.log("stageId:", row.stageId || "");
  console.log("canvasColumn:", row.canvasColumn ?? "");
  console.log("canvasTrack:", row.canvasTrack ?? "");
  console.log("updatedFrom:", updatedFrom);
  console.groupEnd();
}
