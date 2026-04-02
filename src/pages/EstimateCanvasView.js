import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getAssemblyGroupId } from "../utils/assemblyGroups";
import { logBuilderDebugRowUpdate, recordBuilderDebugRowUpdate, isBuilderDebugEnabled } from "../utils/builderDebug";
import { getDefaultStageId, getStageIntegrity, logInvalidStageWarning } from "../utils/stageIntegrity";
import { getStagePresentation } from "../utils/stages";

const unassignedStageId = "__canvas-unassigned__";
const pointerDragThreshold = 6;
const canvasDebugStorageKey = "estimator-app-canvas-debug";
const canvasTestModeStorageKey = "estimator-app-canvas-test-mode";
const defaultTrackCount = 3;
const uploadedImageMaxEdge = 1400;
const uploadedImageQuality = 0.78;
const uploadedImageSmallFileThreshold = 350 * 1024;
const hoverPreviewOpenDelayMs = 80;
const hoverPreviewCloseDelayMs = 140;
const takeoffToolOptions = [
  { id: "line", label: "Line", unit: "LM" },
  { id: "rectangle", label: "Rectangle Area", unit: "SQM" },
  { id: "polygon", label: "Polygon Area", unit: "SQM" },
  { id: "count", label: "Count", unit: "EA" },
];
const takeoffScaleUnitOptions = [
  { id: "m", label: "m", factor: 1 },
  { id: "cm", label: "cm", factor: 0.01 },
  { id: "mm", label: "mm", factor: 0.001 },
];

const cleanText = (value) => String(value || "").trim();
const toTestIdSegment = (value) =>
  String(value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-");
const toNumberOrBlank = (value) => {
  if (value === "" || value == null) {
    return "";
  }
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : "";
};
const formatCurrency = (value) =>
  Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const formatMeasureValue = (value) =>
  Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
const getCardTypeLabel = (row) =>
  cleanText(row.workType) || (row.source === "manual-builder" ? "Manual" : "Estimate");
const getCardIconLabel = (row) =>
  cleanText(row.roomName || row.assemblyName || row.itemName || "Item")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
const getCardMeta = (row) =>
  [cleanText(row.trade), cleanText(row.costCode), cleanText(row.roomName)].filter(Boolean).join(" â€¢ ");
const getRowImageUrls = (row, assemblyLookup = {}) => {
  if (Array.isArray(row?.imageUrls)) {
    return row.imageUrls.map((value) => cleanText(value)).filter(Boolean);
  }

  const assemblyImageUrl = cleanText(
    row?.assemblyImageUrl || assemblyLookup[row?.assemblyId]?.imageUrl
  );
  const itemImageUrl = cleanText(row?.itemImageUrl);

  return [cleanText(row?.imageUrl), assemblyImageUrl, itemImageUrl].filter(Boolean);
};
const getRowImageUrl = (row, assemblyLookup = {}) => {
  const imageUrls = getRowImageUrls(row, assemblyLookup);
  const primaryImageIndex = Number(row?.primaryImageIndex);

  if (!imageUrls.length) {
    return "";
  }

  if (Number.isInteger(primaryImageIndex) && primaryImageIndex >= 0 && primaryImageIndex < imageUrls.length) {
    return imageUrls[primaryImageIndex];
  }

  return imageUrls[0] || "";
};
const getCanvasCardMeta = (row) =>
  [cleanText(row.assemblyName || row.roomName), cleanText(row.trade)].filter(Boolean).join(" / ");
const getCanvasCardQuantity = (row) => {
  const quantityText = formatMeasureValue(row.quantity);
  const unitText = cleanText(row.unit);
  return [quantityText, unitText].filter(Boolean).join(" ");
};
const getHoverPreviewMetrics = (row) => {
  const metrics = [
    {
      key: "takeoff",
      label: "Takeoff",
      value: getCanvasCardQuantity(row) || formatMeasureValue(row.quantity),
    },
  ];

  const rateValue = row.rate ?? row.unitRate;

  if (rateValue !== "" && rateValue != null) {
    metrics.push({
      key: "rate",
      label: "Rate",
      value: `$${formatCurrency(rateValue)}`,
    });
  }

  metrics.push({
    key: "total",
    label: "Total",
    value: `$${formatCurrency(row.total)}`,
  });

  return metrics;
};
const roundTakeoffValue = (value) => Math.round(Number(value || 0) * 100) / 100;
const createTakeoffId = () =>
  `takeoff-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const getTakeoffToolDefinition = (toolId) =>
  takeoffToolOptions.find((tool) => tool.id === toolId) || takeoffToolOptions[0];
const getTakeoffDefaultUnit = (toolId) => getTakeoffToolDefinition(toolId).unit;
const toClampedPoint = (point = {}) => ({
  x: Math.max(0, Math.min(1, Number(point.x) || 0)),
  y: Math.max(0, Math.min(1, Number(point.y) || 0)),
});
const getDistancePixels = (pointA, pointB, dimensions) => {
  if (!pointA || !pointB || !dimensions?.width || !dimensions?.height) {
    return 0;
  }

  const deltaX = (pointB.x - pointA.x) * dimensions.width;
  const deltaY = (pointB.y - pointA.y) * dimensions.height;

  return Math.sqrt(deltaX ** 2 + deltaY ** 2);
};
const getRectangleAreaPixels = (pointA, pointB, dimensions) => {
  if (!pointA || !pointB || !dimensions?.width || !dimensions?.height) {
    return 0;
  }

  return (
    Math.abs((pointB.x - pointA.x) * dimensions.width) *
    Math.abs((pointB.y - pointA.y) * dimensions.height)
  );
};
const getPolygonAreaPixels = (points = [], dimensions) => {
  if (!Array.isArray(points) || points.length < 3 || !dimensions?.width || !dimensions?.height) {
    return 0;
  }

  let doubleArea = 0;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const nextPoint = points[(index + 1) % points.length];
    const currentX = point.x * dimensions.width;
    const currentY = point.y * dimensions.height;
    const nextX = nextPoint.x * dimensions.width;
    const nextY = nextPoint.y * dimensions.height;

    doubleArea += currentX * nextY - nextX * currentY;
  }

  return Math.abs(doubleArea / 2);
};
const getMetersPerPixelFromCalibration = (calibration) =>
  Number(calibration?.metersPerPixel) > 0 ? Number(calibration.metersPerPixel) : 0;
const getMetersFromScaleLength = (realLength, realUnit) => {
  const parsedLength = Number(realLength);
  const factor =
    takeoffScaleUnitOptions.find((option) => option.id === String(realUnit || "").toLowerCase())?.factor || 1;

  if (!Number.isFinite(parsedLength) || parsedLength <= 0) {
    return 0;
  }

  return parsedLength * factor;
};
const getTakeoffMeasurementValue = (toolId, points = [], dimensions, calibration) => {
  const normalizedPoints = Array.isArray(points) ? points : [];
  const metersPerPixel = getMetersPerPixelFromCalibration(calibration);

  if (toolId === "count") {
    return roundTakeoffValue(normalizedPoints.length);
  }

  if (!metersPerPixel) {
    return 0;
  }

  if (toolId === "line" && normalizedPoints.length >= 2) {
    return roundTakeoffValue(getDistancePixels(normalizedPoints[0], normalizedPoints[1], dimensions) * metersPerPixel);
  }

  if (toolId === "rectangle" && normalizedPoints.length >= 2) {
    return roundTakeoffValue(
      getRectangleAreaPixels(normalizedPoints[0], normalizedPoints[1], dimensions) * metersPerPixel * metersPerPixel
    );
  }

  if (toolId === "polygon" && normalizedPoints.length >= 3) {
    return roundTakeoffValue(getPolygonAreaPixels(normalizedPoints, dimensions) * metersPerPixel * metersPerPixel);
  }

  return 0;
};
const formatTakeoffValue = (value) =>
  Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
const getTakeoffLabel = (takeoff) =>
  cleanText(takeoff?.label) || `${getTakeoffToolDefinition(takeoff?.tool).label} Takeoff`;
const toSvgPointList = (points = []) =>
  points.map((point) => `${point.x * 1000},${point.y * 1000}`).join(" ");
const getTakeoffIndicatorLabel = (row) => {
  const savedCount = Array.isArray(row?.takeoffs) ? row.takeoffs.length : 0;

  if (row?.takeoffApplied?.takeoffId) {
    return "Measured quantity";
  }

  if (savedCount > 0) {
    return savedCount === 1 ? "1 takeoff saved" : `${savedCount} takeoffs saved`;
  }

  return "";
};
const getTakeoffIndicatorIcon = (row) => (row?.takeoffApplied?.takeoffId ? "✓" : "T");
const getCanvasTypeBadgeLabel = (row) => cleanText(row.workType) || (row.assemblyId ? "Assembly" : "Item");
const getCardStatus = (row) =>
  cleanText(row.status || row.workflowStatus || row.scheduleStatus || row.itemStatus);
const getWorkTypeToneClass = (row) => {
  const normalizedWorkType = cleanText(getCardTypeLabel(row)).toLowerCase();

  if (normalizedWorkType.includes("labour")) {
    return "is-work-labour";
  }
  if (normalizedWorkType.includes("install")) {
    return "is-work-install";
  }
  if (normalizedWorkType.includes("supply")) {
    return "is-work-supply";
  }
  return "is-work-generic";
};
const getCardSurfaceClass = (row) => {
  if (cleanText(row.source) === "generated" || cleanText(row.assemblyId)) {
    return "is-assembly-card";
  }

  return "is-item-card";
};
const tradeToneClasses = ["is-trade-tone-1", "is-trade-tone-2", "is-trade-tone-3", "is-trade-tone-4"];
const getTradeToneClass = (row) => {
  const tradeKey = cleanText(row.tradeId || row.trade).toLowerCase();

  if (!tradeKey) {
    return tradeToneClasses[0];
  }

  let hash = 0;

  for (let index = 0; index < tradeKey.length; index += 1) {
    hash = (hash * 31 + tradeKey.charCodeAt(index)) >>> 0;
  }

  return tradeToneClasses[hash % tradeToneClasses.length];
};
const getStatusToneClass = (status) => {
  const normalizedStatus = cleanText(status).toLowerCase();

  if (normalizedStatus === "complete") {
    return "is-status-complete";
  }
  if (normalizedStatus === "blocked") {
    return "is-status-blocked";
  }
  if (normalizedStatus === "in progress") {
    return "is-status-in-progress";
  }
  if (normalizedStatus === "not started") {
    return "is-status-not-started";
  }
  return "is-status-generic";
};
const getCardSearchText = (row) =>
  [
    row.displayName,
    row.itemName,
    row.trade,
    row.costCode,
    row.roomName,
    row.assemblyName,
    row.notes,
    row.workType,
  ]
    .map((value) => cleanText(value).toLowerCase())
    .join(" ");

function readFilesAsDataUrls(files = []) {
  return Promise.all(Array.from(files).map((file) => compressImageFile(file)));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`Unable to read ${file?.name || "image"}`));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Unable to load ${file?.name || "image"}`));
    };
    image.src = objectUrl;
  });
}

function getSupportedLossyImageOutputType() {
  if (typeof document === "undefined") {
    return "image/jpeg";
  }

  const probeCanvas = document.createElement("canvas");
  const webpDataUrl = probeCanvas.toDataURL("image/webp", 0.8);
  return webpDataUrl.startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
}

function imageHasTransparency(image, width, height) {
  const alphaCanvas = document.createElement("canvas");

  alphaCanvas.width = width;
  alphaCanvas.height = height;

  const alphaContext = alphaCanvas.getContext("2d");

  if (!alphaContext) {
    return false;
  }

  alphaContext.clearRect(0, 0, width, height);
  alphaContext.drawImage(image, 0, 0, width, height);

  try {
    const { data } = alphaContext.getImageData(0, 0, width, height);

    for (let index = 3; index < data.length; index += 16) {
      if (data[index] < 255) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

async function compressImageFile(file) {
  const mimeType = String(file?.type || "").toLowerCase();

  if (!file || !mimeType.startsWith("image/")) {
    return readFileAsDataUrl(file);
  }

  if (mimeType === "image/svg+xml" || mimeType === "image/gif") {
    return readFileAsDataUrl(file);
  }

  const image = await loadImageElement(file);
  const longestEdge = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height, 1);

  if (longestEdge <= uploadedImageMaxEdge && Number(file.size || 0) <= uploadedImageSmallFileThreshold) {
    return readFileAsDataUrl(file);
  }

  const scale = Math.min(1, uploadedImageMaxEdge / longestEdge);
  const targetWidth = Math.max(1, Math.round((image.naturalWidth || image.width || 1) * scale));
  const targetHeight = Math.max(1, Math.round((image.naturalHeight || image.height || 1) * scale));
  const hasTransparency =
    mimeType === "image/png" || mimeType === "image/webp"
      ? imageHasTransparency(image, targetWidth, targetHeight)
      : false;
  const canvas = document.createElement("canvas");

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const outputType = hasTransparency ? "image/png" : getSupportedLossyImageOutputType();
  const context = canvas.getContext("2d", { alpha: hasTransparency });

  if (!context) {
    return readFileAsDataUrl(file);
  }

  if (!hasTransparency) {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, targetWidth, targetHeight);
  } else {
    context.clearRect(0, 0, targetWidth, targetHeight);
  }
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const compressedDataUrl =
    outputType === "image/png"
      ? canvas.toDataURL(outputType)
      : canvas.toDataURL(outputType, uploadedImageQuality);

  if (longestEdge <= uploadedImageMaxEdge) {
    const originalDataUrl = await readFileAsDataUrl(file);
    return compressedDataUrl.length < originalDataUrl.length ? compressedDataUrl : originalDataUrl;
  }

  return compressedDataUrl;
}

function shouldEnableFlag(paramName, storageKey) {
  if (typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  const queryValue = cleanText(params.get(paramName)).toLowerCase();

  if (queryValue === "1" || queryValue === "true" || queryValue === "on") {
    return true;
  }

  try {
    return window.localStorage.getItem(storageKey) === "true";
  } catch {
    return false;
  }
}

function shouldLogCanvasDebug() {
  return process.env.NODE_ENV === "development" && shouldEnableFlag("canvasDebug", canvasDebugStorageKey);
}

function getRowStageId(row) {
  return cleanText(row.stageId);
}

function emitCanvasRowDebugUpdate(row) {
  if (!isBuilderDebugEnabled() || !row?.id) {
    return;
  }

  recordBuilderDebugRowUpdate(row, "canvas");
  logBuilderDebugRowUpdate(row, "canvas");
}

function getStageName(stages, stageId, fallback = "") {
  if (stageId === unassignedStageId) {
    return "Unassigned";
  }

  return getStageIntegrity(stageId, stages, fallback, {
    defaultStageId: getDefaultStageId(stages),
  }).stageName || fallback || "Unassigned";
}

function getTradeName(trades, tradeId, fallback = "") {
  return trades.find((trade) => trade.id === tradeId)?.name || fallback || "Unassigned";
}

function getCostCodeName(costCodes, costCodeId, fallback = "") {
  return costCodes.find((costCode) => costCode.id === costCodeId)?.name || fallback || "Unassigned";
}

function buildStageLanes(stages, rows) {
  const activeStages = [...stages]
    .filter((stage) => stage.isActive !== false)
    .sort(
      (left, right) =>
        Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) ||
        left.name.localeCompare(right.name)
    );

  if (activeStages.length) {
    return activeStages;
  }

  return rows.length
    ? [{ id: unassignedStageId, name: "Unassigned", sortOrder: Number.MAX_SAFE_INTEGER, color: "#cbd5e1" }]
    : [];
}

function getResolvedStageId(row, stages, stageIds) {
  const integrity = getStageIntegrity(row.stageId, stages, row.stage, {
    defaultStageId: getDefaultStageId(stages),
  });

  if (!integrity.isValid) {
    logInvalidStageWarning({
      context: "canvas-row",
      rowId: row.id || "",
      stageId: integrity.originalStageId,
      fallbackStageName: row.stage || "",
      normalizedStageId: integrity.stageId,
      reason: integrity.reason,
    });
  }

  return integrity.stageId && stageIds.has(integrity.stageId) ? integrity.stageId : unassignedStageId;
}

function buildVisibleRows(rows, filters, searchTerm) {
  const normalizedSearch = cleanText(searchTerm).toLowerCase();

  return rows.filter((row) => {
    if (filters.stageId && getRowStageId(row) !== cleanText(filters.stageId)) {
      return false;
    }
    if (filters.tradeId && cleanText(row.tradeId) !== cleanText(filters.tradeId)) {
      return false;
    }
    if (filters.type && cleanText(getCardTypeLabel(row)) !== cleanText(filters.type)) {
      return false;
    }
    return !normalizedSearch || getCardSearchText(row).includes(normalizedSearch);
  });
}

function buildBoard(rows, stages) {
  const stageLanes = buildStageLanes(stages, rows);
  const stageIds = new Set(stageLanes.map((stage) => stage.id));
  const stageBoardMap = Object.fromEntries(
    stageLanes.map((stage) => [stage.id, { columns: [], maxTrack: 0, cardCount: 0 }])
  );
  const rowPlacementMap = {};

  const getNextAvailableColumn = (stageId) => {
    const stageBoard = stageBoardMap[stageId];
    let columnIndex = 0;

    while (stageBoard.columns[columnIndex] && Object.keys(stageBoard.columns[columnIndex]).length) {
      columnIndex += 1;
    }

    return columnIndex;
  };

  const claimPlacement = (row, stageId, requestedColumn, requestedTrack) => {
    const stageBoard = stageBoardMap[stageId];
    const targetColumn = Math.max(0, Number(requestedColumn) || 0);

    while (stageBoard.columns.length <= targetColumn) {
      stageBoard.columns.push({});
    }

    const nextColumn = { ...stageBoard.columns[targetColumn] };
    let track = Math.max(0, Number(requestedTrack) || 0);

    while (nextColumn[track]) {
      track += 1;
    }

    nextColumn[track] = row;
    stageBoard.columns[targetColumn] = nextColumn;
    stageBoard.maxTrack = Math.max(stageBoard.maxTrack, track);
    stageBoard.cardCount += 1;
    rowPlacementMap[row.id] = { stageId, columnIndex: targetColumn, track };
  };

  const sortedRows = [...rows].sort(
    (left, right) =>
      Number(toNumberOrBlank(left.canvasColumn) === "" ? Number.MAX_SAFE_INTEGER : left.canvasColumn) -
        Number(toNumberOrBlank(right.canvasColumn) === "" ? Number.MAX_SAFE_INTEGER : right.canvasColumn) ||
      Number(left.canvasOrder ?? left.sortOrder ?? 0) - Number(right.canvasOrder ?? right.sortOrder ?? 0) ||
      cleanText(left.displayName || left.itemName).localeCompare(cleanText(right.displayName || right.itemName))
  );

  sortedRows.forEach((row) => {
    const stageId = getResolvedStageId(row, stages, stageIds);
    const explicitColumn = toNumberOrBlank(row.canvasColumn);
    const explicitTrack = toNumberOrBlank(row.canvasTrack);
    const legacyParentId = cleanText(row.canvasStackParentId);

    if (legacyParentId && explicitColumn === "" && explicitTrack === "") {
      const parentPlacement = rowPlacementMap[legacyParentId];

      claimPlacement(
        row,
        parentPlacement?.stageId || stageId,
        parentPlacement?.columnIndex ?? getNextAvailableColumn(stageId),
        (parentPlacement?.track ?? 0) + 1
      );
      return;
    }

    claimPlacement(
      row,
      stageId,
      explicitColumn === "" ? getNextAvailableColumn(stageId) : explicitColumn,
      explicitTrack === "" ? 0 : explicitTrack
    );
  });

  stageLanes.forEach((stage) => {
    stageBoardMap[stage.id].trackCount = Math.max(defaultTrackCount, stageBoardMap[stage.id].maxTrack + 1);
  });

  return { stageLanes, stageBoardMap, rowPlacementMap };
}

function cloneColumns(columns = []) {
  return columns.map((column) => ({ ...column }));
}

function removeRowFromColumns(columns, rowId) {
  return columns.map((column) => {
    if (!column) {
      return column;
    }

    const nextColumn = {};
    Object.entries(column).forEach(([track, row]) => {
      if (row.id !== rowId) {
        nextColumn[track] = row;
      }
    });
    return Object.keys(nextColumn).length ? nextColumn : undefined;
  });
}

function insertColumn(columns, columnIndex, track, row) {
  const nextColumns = cloneColumns(columns);
  const safeIndex = Math.max(0, Math.min(columnIndex, nextColumns.length));
  nextColumns.splice(safeIndex, 0, { [Math.max(0, Number(track) || 0)]: row });
  return nextColumns;
}

function placeRowInColumn(columns, columnIndex, requestedTrack, row) {
  const nextColumns = cloneColumns(columns);
  const safeIndex = Math.max(0, columnIndex);

  while (nextColumns.length <= safeIndex) {
    nextColumns.push({});
  }

  const nextColumn = { ...nextColumns[safeIndex] };
  const track = Math.max(0, Number(requestedTrack) || 0);

  nextColumn[track] = row;
  nextColumns[safeIndex] = nextColumn;
  return nextColumns;
}

function insertRowInTrack(columns, columnIndex, insertTrack, row) {
  const nextColumns = cloneColumns(columns);
  const safeIndex = Math.max(0, columnIndex);

  while (nextColumns.length <= safeIndex) {
    nextColumns.push(undefined);
  }

  const existingColumn = { ...(nextColumns[safeIndex] || {}) };
  const shiftedColumn = {};

  Object.entries(existingColumn)
    .sort((left, right) => Number(left[0]) - Number(right[0]))
    .forEach(([trackKey, existingRow]) => {
      const track = Number(trackKey);
      shiftedColumn[track >= insertTrack ? track + 1 : track] = existingRow;
    });

  shiftedColumn[insertTrack] = row;
  nextColumns[safeIndex] = shiftedColumn;
  return nextColumns;
}

function buildCanvasOrder(columnIndex, track) {
  return columnIndex * 100 + track;
}

function getRenderedTrackCount(column, minimumTrackCount = defaultTrackCount) {
  const occupiedTracks = Object.keys(column || {})
    .map((trackKey) => Number(trackKey))
    .filter((track) => Number.isFinite(track))
    .sort((left, right) => left - right);

  const highestTrack = occupiedTracks.length ? occupiedTracks[occupiedTracks.length - 1] : -1;
  return Math.max(minimumTrackCount, highestTrack + 1);
}

function getTargetLabel(target) {
  if (!target) {
    return "idle";
  }

  if (target.type === "insert-column") {
    return `insert column / ${target.stageId} / column ${target.columnIndex} / track ${target.track}`;
  }

  if (target.type === "insert-track") {
    return `insert track / ${target.stageId} / column ${target.columnIndex} / track ${target.track}`;
  }

  if (target.type === "cell") {
    return `track cell / ${target.stageId} / column ${target.columnIndex} / track ${target.track}`;
  }

  return "idle";
}

function resolveDropTarget(clientX, clientY) {
  if (typeof document === "undefined") {
    return null;
  }

  const dropTargets = Array.from(document.querySelectorAll("[data-canvas-drop-type]"));
  const matchedTarget = dropTargets
    .map((element) => ({
      element,
      rect: element.getBoundingClientRect(),
    }))
    .filter(
      ({ rect }) =>
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
    )
    .sort((left, right) => {
      const leftArea = left.rect.width * left.rect.height;
      const rightArea = right.rect.width * right.rect.height;
      return leftArea - rightArea;
    })[0];

  const droppableElement =
    matchedTarget?.element ||
    (typeof document.elementFromPoint === "function"
      ? document.elementFromPoint(clientX, clientY)?.closest("[data-canvas-drop-type]")
      : null);

  if (!droppableElement) {
    return null;
  }

  return {
    type: droppableElement.dataset.canvasDropType || "",
    stageId: droppableElement.dataset.canvasStageId || "",
    columnIndex: Number(droppableElement.dataset.canvasColumnIndex || 0),
    track: Number(droppableElement.dataset.canvasTrack || 0),
  };
}

function EstimateCanvasView({
  estimateName = "",
  rows = [],
  stages = [],
  trades = [],
  costCodes = [],
  assemblies = [],
  searchTerm = "",
  filters = {},
  onRowOverrideChange = () => {},
  onRowsChange = null,
  onOpenBuilderView = () => {},
  topBarPortalTarget = null,
}) {
  const devModeEnabled = process.env.NODE_ENV !== "production";
  const [debugEnabled, setDebugEnabled] = useState(() =>
    devModeEnabled ? shouldEnableFlag("canvasDebug", canvasDebugStorageKey) : false
  );
  const [selectedRowId, setSelectedRowId] = useState("");
  const [selectedDrawerTab, setSelectedDrawerTab] = useState("details");
  const [galleryPreviewUrl, setGalleryPreviewUrl] = useState("");
  const [hoverPreview, setHoverPreview] = useState(null);
  const [selectedTakeoffImageIndex, setSelectedTakeoffImageIndex] = useState(0);
  const [takeoffTool, setTakeoffTool] = useState("line");
  const [takeoffMode, setTakeoffMode] = useState("idle");
  const [takeoffDraftPoints, setTakeoffDraftPoints] = useState([]);
  const [takeoffPointerPoint, setTakeoffPointerPoint] = useState(null);
  const [takeoffScaleLength, setTakeoffScaleLength] = useState("");
  const [takeoffScaleUnit, setTakeoffScaleUnit] = useState("m");
  const [takeoffImageMetrics, setTakeoffImageMetrics] = useState({});
  const [selectedTakeoffId, setSelectedTakeoffId] = useState("");
  const [editingTakeoffId, setEditingTakeoffId] = useState("");
  const [takeoffLabelDraft, setTakeoffLabelDraft] = useState("");
  const [takeoffFeedback, setTakeoffFeedback] = useState("");
  const [confirmingDeleteTakeoffId, setConfirmingDeleteTakeoffId] = useState("");
  const [dragState, setDragState] = useState({
    rowId: "",
    pointerX: 0,
    pointerY: 0,
    activeTarget: null,
  });
  const galleryFileInputRef = useRef(null);
  const takeoffSurfaceRef = useRef(null);
  const takeoffPointerStateRef = useRef({
    pointerId: null,
    originPoint: null,
    dragging: false,
  });
  const hoverPreviewOpenTimerRef = useRef(null);
  const hoverPreviewCloseTimerRef = useRef(null);
  const takeoffFeedbackTimerRef = useRef(null);
  const suppressOpenRef = useRef(false);
  const dragStateRef = useRef({
    pointerId: null,
    row: null,
    originX: 0,
    originY: 0,
    pointerX: 0,
    pointerY: 0,
    dragging: false,
    activeTarget: null,
  });
  const filteredMode = Boolean(cleanText(searchTerm) || filters.stageId || filters.tradeId || filters.type);

  const effectiveRows = rows;
  const visibleRows = useMemo(
    () => buildVisibleRows(effectiveRows, filters, searchTerm),
    [effectiveRows, filters, searchTerm]
  );
  const board = useMemo(() => buildBoard(visibleRows, stages), [visibleRows, stages]);
  const fullBoard = useMemo(() => buildBoard(effectiveRows, stages), [effectiveRows, stages]);
  const selectedRow = effectiveRows.find((row) => row.id === selectedRowId) || null;
  const activeDragRow = effectiveRows.find((row) => row.id === dragState.rowId) || null;
  const hoverPreviewRow =
    hoverPreview && hoverPreview.rowId
      ? effectiveRows.find((row) => row.id === hoverPreview.rowId) || null
      : null;
  const assemblyLookup = useMemo(
    () =>
      Object.fromEntries(
        assemblies.flatMap((assembly) => {
          const lookupKeys = [
            getAssemblyGroupId(assembly),
            cleanText(assembly.assemblyId),
            cleanText(assembly.id),
          ].filter(Boolean);

          return lookupKeys.map((lookupKey) => [lookupKey, assembly]);
        })
      ),
    [assemblies]
  );
  useEffect(() => {
    if (!devModeEnabled) {
      return undefined;
    }

    try {
      window.localStorage.setItem(canvasDebugStorageKey, String(debugEnabled));
    } catch {
      return undefined;
    }

    return undefined;
  }, [debugEnabled, devModeEnabled]);

  useEffect(
    () => () => {
      if (hoverPreviewOpenTimerRef.current) {
        window.clearTimeout(hoverPreviewOpenTimerRef.current);
      }
      if (hoverPreviewCloseTimerRef.current) {
        window.clearTimeout(hoverPreviewCloseTimerRef.current);
      }
      if (takeoffFeedbackTimerRef.current) {
        window.clearTimeout(takeoffFeedbackTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const enabled = shouldEnableFlag("canvasTest", canvasTestModeStorageKey);
    document.body.dataset.canvasTestMode = enabled ? "true" : "false";

    return () => {
      delete document.body.dataset.canvasTestMode;
    };
  }, []);

  const persistStageColumns = useCallback(
    (stageId, columns) => {
      const nextChanges = [];

      columns.forEach((column, columnIndex) => {
        if (!column) {
          return;
        }

        Object.entries(column)
          .sort((left, right) => Number(left[0]) - Number(right[0]))
          .forEach(([trackKey, row]) => {
            const nextRow = {
              ...row,
              stageId: stageId === unassignedStageId ? "" : stageId,
              canvasColumn: columnIndex,
              canvasTrack: Number(trackKey),
            };
            const nextUpdates = {
              stageId: stageId === unassignedStageId ? "" : stageId,
              canvasColumn: columnIndex,
              canvasTrack: Number(trackKey),
              canvasOrder: buildCanvasOrder(columnIndex, Number(trackKey)),
              canvasStackParentId: "",
              canvasStackOrder: "",
            };

            emitCanvasRowDebugUpdate(nextRow);
            if (row.stageId !== nextRow.stageId) {
              console.log("Canvas move", row.id, nextRow.stageId);
            }

            nextChanges.push({
              rowId: row.id,
              updates: nextUpdates,
            });
          });
      });

      if (typeof onRowsChange === "function") {
        onRowsChange(nextChanges);
        return;
      }

      nextChanges.forEach(({ rowId, updates }) => {
        onRowOverrideChange(rowId, updates);
      });
    },
    [onRowOverrideChange, onRowsChange]
  );

  const persistRowEdits = useCallback(
    (row, updates = {}) => {
      if (!row?.id || !updates || !Object.keys(updates).length) {
        return;
      }

      if (row.source === "manual-builder") {
        onRowOverrideChange(
          row.id,
          Object.prototype.hasOwnProperty.call(updates, "unit")
            ? {
                ...updates,
                unitId: "",
              }
            : updates
        );
        return;
      }

      const nextUpdates = {};

      if (Object.prototype.hasOwnProperty.call(updates, "quantity")) {
        nextUpdates.quantityOverride = updates.quantity;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "rate")) {
        nextUpdates.rateOverride = updates.rate;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "unit")) {
        nextUpdates.unit = updates.unit;
        nextUpdates.unitId = "";
      }
      if (Object.prototype.hasOwnProperty.call(updates, "imageUrls")) {
        nextUpdates.imageUrls = updates.imageUrls;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "primaryImageIndex")) {
        nextUpdates.primaryImageIndex = updates.primaryImageIndex;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "imageUrl")) {
        nextUpdates.imageUrl = updates.imageUrl;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "notes")) {
        nextUpdates.notes = updates.notes;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "takeoffApplied")) {
        nextUpdates.takeoffApplied = updates.takeoffApplied;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "takeoffs")) {
        nextUpdates.takeoffs = updates.takeoffs;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "takeoffCalibrations")) {
        nextUpdates.takeoffCalibrations = updates.takeoffCalibrations;
      }

      onRowOverrideChange(row.id, nextUpdates);
    },
    [onRowOverrideChange]
  );

  const updateSelectedRowField = useCallback(
    (field, value) => {
      if (!selectedRow) {
        return;
      }

      if (field === "quantity" || field === "rate") {
        persistRowEdits(selectedRow, {
          [field]: value === "" ? "" : toNumberOrBlank(value),
          ...(field === "quantity" ? { takeoffApplied: null } : {}),
        });
        return;
      }

      persistRowEdits(selectedRow, { [field]: value });
    },
    [persistRowEdits, selectedRow]
  );

  const updateSelectedRowImages = useCallback(
    (nextImageUrls = [], nextPrimaryImageIndex = 0) => {
      if (!selectedRow) {
        return;
      }

      const normalizedImageUrls = nextImageUrls
        .map((value) => cleanText(value))
        .filter(Boolean);
      const resolvedPrimaryImageIndex =
        normalizedImageUrls.length &&
        Number.isInteger(nextPrimaryImageIndex) &&
        nextPrimaryImageIndex >= 0 &&
        nextPrimaryImageIndex < normalizedImageUrls.length
          ? nextPrimaryImageIndex
          : 0;

      persistRowEdits(selectedRow, {
        imageUrls: normalizedImageUrls,
        primaryImageIndex: resolvedPrimaryImageIndex,
        imageUrl: normalizedImageUrls[resolvedPrimaryImageIndex] || "",
      });
    },
    [persistRowEdits, selectedRow]
  );

  const handleGalleryInputChange = useCallback(
    async (event) => {
      if (!selectedRow) {
        return;
      }

      const files = Array.from(event.target.files || []);

      if (!files.length) {
        return;
      }

      try {
        const uploadedImageUrls = await readFilesAsDataUrls(files);
        const nextImageUrls = [...getRowImageUrls(selectedRow, assemblyLookup), ...uploadedImageUrls].filter(Boolean);
        const nextPrimaryImageIndex =
          getRowImageUrls(selectedRow, assemblyLookup).length || 0;

        updateSelectedRowImages(nextImageUrls, nextPrimaryImageIndex);
      } finally {
        event.target.value = "";
      }
    },
    [assemblyLookup, selectedRow, updateSelectedRowImages]
  );

  const selectedRowImageUrls = selectedRow ? getRowImageUrls(selectedRow, assemblyLookup) : [];
  const selectedRowPrimaryImageUrl = selectedRow ? getRowImageUrl(selectedRow, assemblyLookup) : "";
  const selectedRowTakeoffs = Array.isArray(selectedRow?.takeoffs) ? selectedRow.takeoffs : [];
  const selectedRowTakeoffCalibrations =
    selectedRow?.takeoffCalibrations && typeof selectedRow.takeoffCalibrations === "object"
      ? selectedRow.takeoffCalibrations
      : {};
  const selectedTakeoffCalibration = selectedRowTakeoffCalibrations[String(selectedTakeoffImageIndex)] || null;
  const selectedTakeoffImageDimensions = takeoffImageMetrics[selectedTakeoffImageIndex] || null;
  const selectedTakeoffImageUrl = selectedRowImageUrls[selectedTakeoffImageIndex] || "";

  useEffect(() => {
    setSelectedDrawerTab("details");
    setSelectedTakeoffImageIndex(selectedRow?.primaryImageIndex || 0);
    setTakeoffTool("line");
    setTakeoffMode("idle");
    setTakeoffDraftPoints([]);
    setTakeoffPointerPoint(null);
    setTakeoffScaleLength("");
    setTakeoffScaleUnit("m");
    setSelectedTakeoffId("");
    setEditingTakeoffId("");
    setTakeoffLabelDraft("");
    setTakeoffFeedback("");
    setConfirmingDeleteTakeoffId("");
  }, [selectedRowId, selectedRow?.primaryImageIndex]);

  useEffect(() => {
    if (!selectedRowImageUrls.length) {
      setSelectedTakeoffImageIndex(0);
      return;
    }

    setSelectedTakeoffImageIndex((currentIndex) =>
      currentIndex >= 0 && currentIndex < selectedRowImageUrls.length
        ? currentIndex
        : Math.min(selectedRow?.primaryImageIndex || 0, selectedRowImageUrls.length - 1)
    );
  }, [selectedRow?.primaryImageIndex, selectedRowImageUrls.length]);

  useEffect(() => {
    if (selectedTakeoffCalibration) {
      setTakeoffScaleLength(
        selectedTakeoffCalibration.realLength === "" || selectedTakeoffCalibration.realLength == null
          ? ""
          : String(selectedTakeoffCalibration.realLength)
      );
      setTakeoffScaleUnit(cleanText(selectedTakeoffCalibration.realUnit).toLowerCase() || "m");
    } else {
      setTakeoffScaleLength("");
      setTakeoffScaleUnit("m");
    }
    setTakeoffMode("idle");
    setTakeoffDraftPoints([]);
    setTakeoffPointerPoint(null);
  }, [selectedTakeoffCalibration, selectedTakeoffImageIndex]);

  const getTakeoffPointFromEvent = useCallback((event) => {
    const bounds = takeoffSurfaceRef.current?.getBoundingClientRect();

    if (!bounds || !bounds.width || !bounds.height) {
      return null;
    }

    return toClampedPoint({
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    });
  }, []);

  const resetTakeoffDraft = useCallback(() => {
    takeoffPointerStateRef.current = {
      pointerId: null,
      originPoint: null,
      dragging: false,
    };
    setTakeoffMode("idle");
    setTakeoffDraftPoints([]);
    setTakeoffPointerPoint(null);
  }, []);

  const showTakeoffFeedback = useCallback((message) => {
    setTakeoffFeedback(message);

    if (takeoffFeedbackTimerRef.current) {
      window.clearTimeout(takeoffFeedbackTimerRef.current);
    }

    takeoffFeedbackTimerRef.current = window.setTimeout(() => {
      setTakeoffFeedback("");
    }, 2200);
  }, []);

  const persistSelectedRowTakeoffs = useCallback(
    (updater) => {
      if (!selectedRow) {
        return;
      }

      const currentTakeoffs = Array.isArray(selectedRow.takeoffs) ? selectedRow.takeoffs : [];
      const nextTakeoffs = typeof updater === "function" ? updater(currentTakeoffs) : updater;
      persistRowEdits(selectedRow, { takeoffs: nextTakeoffs });
    },
    [persistRowEdits, selectedRow]
  );

  const persistSelectedRowCalibrations = useCallback(
    (nextCalibrations) => {
      if (!selectedRow) {
        return;
      }

      persistRowEdits(selectedRow, { takeoffCalibrations: nextCalibrations });
    },
    [persistRowEdits, selectedRow]
  );

  const startCalibrationMode = useCallback(() => {
    setTakeoffMode("calibrating");
    setTakeoffDraftPoints([]);
    setTakeoffPointerPoint(null);
  }, []);

  const selectedImageTakeoffs = useMemo(
    () => selectedRowTakeoffs.filter((takeoff) => Number(takeoff.imageIndex) === selectedTakeoffImageIndex),
    [selectedRowTakeoffs, selectedTakeoffImageIndex]
  );
  const sortedTakeoffs = useMemo(() => {
    const currentImageIndex = selectedTakeoffImageIndex;

    return [...selectedRowTakeoffs].sort((left, right) => {
      const leftIsCurrent = Number(left.imageIndex) === currentImageIndex ? 0 : 1;
      const rightIsCurrent = Number(right.imageIndex) === currentImageIndex ? 0 : 1;

      if (leftIsCurrent !== rightIsCurrent) {
        return leftIsCurrent - rightIsCurrent;
      }

      return String(getTakeoffLabel(left)).localeCompare(String(getTakeoffLabel(right)));
    });
  }, [selectedRowTakeoffs, selectedTakeoffImageIndex]);
  const selectedTakeoffEntry =
    sortedTakeoffs.find((takeoff) => takeoff.id === selectedTakeoffId) ||
    sortedTakeoffs[0] ||
    null;
  const groupedTakeoffs = useMemo(
    () =>
      sortedTakeoffs.reduce((groups, takeoff) => {
        const imageIndex = Number(takeoff.imageIndex) || 0;
        const existingGroup = groups.find((group) => group.imageIndex === imageIndex);

        if (existingGroup) {
          existingGroup.takeoffs.push(takeoff);
          return groups;
        }

        groups.push({
          imageIndex,
          takeoffs: [takeoff],
        });

        return groups;
      }, []),
    [sortedTakeoffs]
  );

  useEffect(() => {
    if (!sortedTakeoffs.length) {
      if (selectedTakeoffId) {
        setSelectedTakeoffId("");
      }
      return;
    }

    if (!selectedTakeoffId || !sortedTakeoffs.some((takeoff) => takeoff.id === selectedTakeoffId)) {
      setSelectedTakeoffId(sortedTakeoffs[0].id);
    }
  }, [selectedTakeoffId, sortedTakeoffs]);

  const getTakeoffPointsForPreview = useCallback(() => {
    if (takeoffMode === "calibrating") {
      if (takeoffDraftPoints.length === 1 && takeoffPointerPoint) {
        return [takeoffDraftPoints[0], takeoffPointerPoint];
      }

      return takeoffDraftPoints;
    }

    if (takeoffTool === "rectangle") {
      if (takeoffDraftPoints.length === 1 && takeoffPointerPoint) {
        return [takeoffDraftPoints[0], takeoffPointerPoint];
      }

      return takeoffDraftPoints;
    }

    if (takeoffTool === "line") {
      if (takeoffDraftPoints.length === 1 && takeoffPointerPoint) {
        return [takeoffDraftPoints[0], takeoffPointerPoint];
      }

      return takeoffDraftPoints;
    }

    if (takeoffTool === "polygon") {
      if (takeoffDraftPoints.length && takeoffPointerPoint) {
        return [...takeoffDraftPoints, takeoffPointerPoint];
      }

      return takeoffDraftPoints;
    }

    return takeoffDraftPoints;
  }, [takeoffDraftPoints, takeoffMode, takeoffPointerPoint, takeoffTool]);

  const takeoffPreviewPoints = getTakeoffPointsForPreview();
  const liveTakeoffValue = useMemo(() => {
    if (takeoffMode === "calibrating") {
      if (
        takeoffPreviewPoints.length < 2 ||
        !selectedTakeoffImageDimensions ||
        !Number(takeoffScaleLength) ||
        Number(takeoffScaleLength) <= 0
      ) {
        return 0;
      }

      const distancePixels = getDistancePixels(
        takeoffPreviewPoints[0],
        takeoffPreviewPoints[1],
        selectedTakeoffImageDimensions
      );
      const meters = getMetersFromScaleLength(takeoffScaleLength, takeoffScaleUnit);

      if (!distancePixels || !meters) {
        return 0;
      }

      return roundTakeoffValue(meters / distancePixels);
    }

    return getTakeoffMeasurementValue(
      takeoffTool,
      takeoffPreviewPoints,
      selectedTakeoffImageDimensions,
      selectedTakeoffCalibration
    );
  }, [
    selectedTakeoffCalibration,
    selectedTakeoffImageDimensions,
    takeoffMode,
    takeoffPreviewPoints,
    takeoffScaleLength,
    takeoffScaleUnit,
    takeoffTool,
  ]);

  const completeCalibration = useCallback(() => {
    if (
      !selectedRow ||
      takeoffDraftPoints.length !== 2 ||
      !selectedTakeoffImageDimensions
    ) {
      return;
    }

    const distancePixels = getDistancePixels(
      takeoffDraftPoints[0],
      takeoffDraftPoints[1],
      selectedTakeoffImageDimensions
    );
    const meters = getMetersFromScaleLength(takeoffScaleLength, takeoffScaleUnit);

    if (!distancePixels || !meters) {
      return;
    }

    persistSelectedRowCalibrations({
      ...selectedRowTakeoffCalibrations,
      [selectedTakeoffImageIndex]: {
        points: takeoffDraftPoints,
        realLength: roundTakeoffValue(Number(takeoffScaleLength)),
        realUnit: takeoffScaleUnit,
        metersPerPixel: meters / distancePixels,
      },
    });
    resetTakeoffDraft();
  }, [
    persistSelectedRowCalibrations,
    resetTakeoffDraft,
    selectedRow,
    selectedRowTakeoffCalibrations,
    selectedTakeoffImageDimensions,
    selectedTakeoffImageIndex,
    takeoffDraftPoints,
    takeoffScaleLength,
    takeoffScaleUnit,
  ]);

  const finalizeTakeoff = useCallback(() => {
    if (!selectedRow || !selectedTakeoffImageDimensions) {
      return;
    }

    const requiredPointCount = takeoffTool === "count" ? 1 : takeoffTool === "polygon" ? 3 : 2;

    if (takeoffDraftPoints.length < requiredPointCount) {
      return;
    }

    const computedValue = getTakeoffMeasurementValue(
      takeoffTool,
      takeoffDraftPoints,
      selectedTakeoffImageDimensions,
      selectedTakeoffCalibration
    );

    if (takeoffTool !== "count" && !selectedTakeoffCalibration) {
      return;
    }

    const nextTakeoff = {
      id: createTakeoffId(),
      imageIndex: selectedTakeoffImageIndex,
      tool: takeoffTool,
      points: takeoffDraftPoints,
      computedValue,
      unit: getTakeoffDefaultUnit(takeoffTool),
      label: "",
    };

    persistSelectedRowTakeoffs((currentTakeoffs) => [...currentTakeoffs, nextTakeoff]);
    setSelectedTakeoffId(nextTakeoff.id);
    showTakeoffFeedback(`${getTakeoffToolDefinition(takeoffTool).label} saved`);
    resetTakeoffDraft();
  }, [
    persistSelectedRowTakeoffs,
    resetTakeoffDraft,
    selectedRow,
    selectedTakeoffCalibration,
    selectedTakeoffImageDimensions,
    selectedTakeoffImageIndex,
    takeoffDraftPoints,
    takeoffTool,
    showTakeoffFeedback,
  ]);

  const undoTakeoffPoint = useCallback(() => {
    setTakeoffDraftPoints((currentPoints) => currentPoints.slice(0, -1));
  }, []);

  const applyTakeoffToQuantity = useCallback(
    (takeoff, mode = "replace") => {
      if (!selectedRow || !takeoff) {
        return;
      }

      const nextValue =
        mode === "add"
          ? roundTakeoffValue(Number(selectedRow.quantity || 0) + Number(takeoff.computedValue || 0))
          : roundTakeoffValue(Number(takeoff.computedValue || 0));

      persistRowEdits(selectedRow, {
        quantity: nextValue,
        takeoffApplied: {
          takeoffId: takeoff.id,
          imageIndex: Number(takeoff.imageIndex) || 0,
          tool: takeoff.tool,
          computedValue: Number(takeoff.computedValue || 0),
          unit: takeoff.unit,
          mode,
          appliedQuantity: nextValue,
          appliedAt: new Date().toISOString(),
        },
      });
      setSelectedTakeoffId(takeoff.id);
      showTakeoffFeedback(mode === "add" ? "Takeoff added to quantity" : "Quantity replaced from takeoff");
    },
    [persistRowEdits, selectedRow, showTakeoffFeedback]
  );

  const startTakeoffRename = useCallback((takeoff) => {
    if (!takeoff) {
      return;
    }

    setSelectedTakeoffId(takeoff.id);
    setEditingTakeoffId(takeoff.id);
    setTakeoffLabelDraft(takeoff.label || getTakeoffLabel(takeoff));
    setConfirmingDeleteTakeoffId("");
  }, []);

  const saveTakeoffRename = useCallback(() => {
    if (!editingTakeoffId) {
      return;
    }

    persistSelectedRowTakeoffs((currentTakeoffs) =>
      currentTakeoffs.map((entry) =>
        entry.id === editingTakeoffId
          ? {
              ...entry,
              label: cleanText(takeoffLabelDraft),
            }
          : entry
      )
    );
    setEditingTakeoffId("");
    setTakeoffLabelDraft("");
    showTakeoffFeedback("Takeoff renamed");
  }, [editingTakeoffId, persistSelectedRowTakeoffs, showTakeoffFeedback, takeoffLabelDraft]);

  const deleteTakeoff = useCallback(
    (takeoffId) => {
      if (confirmingDeleteTakeoffId !== takeoffId) {
        setConfirmingDeleteTakeoffId(takeoffId);
        return;
      }

      persistSelectedRowTakeoffs((currentTakeoffs) =>
        currentTakeoffs.filter((takeoff) => takeoff.id !== takeoffId)
      );
      if (selectedTakeoffId === takeoffId) {
        setSelectedTakeoffId("");
      }
      if (editingTakeoffId === takeoffId) {
        setEditingTakeoffId("");
        setTakeoffLabelDraft("");
      }
      setConfirmingDeleteTakeoffId("");
      showTakeoffFeedback("Takeoff deleted");
    },
    [
      confirmingDeleteTakeoffId,
      editingTakeoffId,
      persistSelectedRowTakeoffs,
      selectedTakeoffId,
      showTakeoffFeedback,
    ]
  );

  const handleTakeoffImageLoad = useCallback((event) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;

    if (!naturalWidth || !naturalHeight) {
      return;
    }

    setTakeoffImageMetrics((currentMetrics) => ({
      ...currentMetrics,
      [selectedTakeoffImageIndex]: {
        width: naturalWidth,
        height: naturalHeight,
      },
    }));
  }, [selectedTakeoffImageIndex]);

  const handleTakeoffStagePointerDown = useCallback(
    (event) => {
      if (!selectedTakeoffImageUrl) {
        return;
      }

      const point = getTakeoffPointFromEvent(event);

      if (!point) {
        return;
      }

      if (takeoffMode === "calibrating") {
        setTakeoffDraftPoints((currentPoints) =>
          currentPoints.length >= 2 ? [point] : [...currentPoints, point]
        );
        return;
      }

      if (takeoffTool === "rectangle") {
        takeoffPointerStateRef.current = {
          pointerId: event.pointerId,
          originPoint: point,
          dragging: true,
        };
        setTakeoffDraftPoints([point]);
        setTakeoffPointerPoint(point);
        setTakeoffMode("drawing");
        event.currentTarget.setPointerCapture?.(event.pointerId);
        return;
      }

      if (takeoffTool === "line") {
        setTakeoffDraftPoints((currentPoints) =>
          currentPoints.length >= 2 ? [point] : [...currentPoints, point]
        );
        if (takeoffDraftPoints.length === 1) {
          setTakeoffMode("drawing");
        }
        return;
      }

      if (takeoffTool === "polygon" || takeoffTool === "count") {
        setTakeoffDraftPoints((currentPoints) => [...currentPoints, point]);
        setTakeoffMode("drawing");
      }
    },
    [getTakeoffPointFromEvent, selectedTakeoffImageUrl, takeoffDraftPoints.length, takeoffMode, takeoffTool]
  );

  const handleTakeoffStagePointerMove = useCallback(
    (event) => {
      const point = getTakeoffPointFromEvent(event);

      if (!point) {
        return;
      }

      if (takeoffMode === "calibrating" && takeoffDraftPoints.length === 1) {
        setTakeoffPointerPoint(point);
        return;
      }

      if (takeoffTool === "line" && takeoffDraftPoints.length === 1) {
        setTakeoffPointerPoint(point);
        return;
      }

      if (takeoffTool === "polygon" && takeoffDraftPoints.length >= 1) {
        setTakeoffPointerPoint(point);
        return;
      }

      if (takeoffTool === "rectangle" && takeoffPointerStateRef.current.dragging) {
        setTakeoffPointerPoint(point);
      }
    },
    [getTakeoffPointFromEvent, takeoffDraftPoints.length, takeoffMode, takeoffTool]
  );

  const handleTakeoffStagePointerUp = useCallback(
    (event) => {
      if (takeoffTool !== "rectangle" || !takeoffPointerStateRef.current.dragging) {
        return;
      }

      const point = getTakeoffPointFromEvent(event);

      if (!point || !takeoffPointerStateRef.current.originPoint) {
        resetTakeoffDraft();
        return;
      }

      setTakeoffDraftPoints([takeoffPointerStateRef.current.originPoint, point]);
      setTakeoffPointerPoint(null);
      setTakeoffMode("drawing");
      takeoffPointerStateRef.current = {
        pointerId: null,
        originPoint: null,
        dragging: false,
      };
    },
    [getTakeoffPointFromEvent, resetTakeoffDraft, takeoffTool]
  );

  const applyDrop = useCallback(
    (row, target) => {
      if (!row || !target) {
        return;
      }

      const targetStageId = target.stageId === unassignedStageId ? "" : target.stageId;
      const effectiveStageId = getRowStageId(row);

      if (shouldLogCanvasDebug() || isBuilderDebugEnabled()) {
        console.info("[Canvas Grid] Stage update requested", {
          rowId: row.id,
          triggeredFrom: "canvas",
          stageIdBefore: effectiveStageId || "",
          targetStageId,
        });
      }

      const nextStageColumns = Object.fromEntries(
        fullBoard.stageLanes.map((stage) => [stage.id, cloneColumns(fullBoard.stageBoardMap[stage.id].columns)])
      );
      const sourcePlacement = fullBoard.rowPlacementMap[row.id];

      if (sourcePlacement) {
        nextStageColumns[sourcePlacement.stageId] = removeRowFromColumns(
          nextStageColumns[sourcePlacement.stageId],
          row.id
        );
      }

      if (target.type === "insert-column") {
        nextStageColumns[target.stageId] = insertColumn(
          nextStageColumns[target.stageId],
          target.columnIndex,
          target.track,
          row
        );
      } else if (target.type === "insert-track") {
        nextStageColumns[target.stageId] = insertRowInTrack(
          nextStageColumns[target.stageId],
          target.columnIndex,
          target.track,
          row
        );
      } else if (target.type === "cell") {
        nextStageColumns[target.stageId] = placeRowInColumn(
          nextStageColumns[target.stageId],
          target.columnIndex,
          target.track,
          row
        );
      }

      new Set([sourcePlacement?.stageId, target.stageId]).forEach((stageId) => {
        if (stageId) {
          if (shouldLogCanvasDebug()) {
            const snapshot = (nextStageColumns[stageId] || []).flatMap((column, columnIndex) =>
              Object.entries(column || {})
                .sort((left, right) => Number(left[0]) - Number(right[0]))
                .map(([trackKey, stageRow]) => ({
                  id: stageRow.id,
                  stageId,
                  canvasColumn: columnIndex,
                  canvasTrack: Number(trackKey),
                }))
            );

            console.info("[Canvas Grid] Drop resolved", {
              rowId: row.id,
              target,
              computedColumnIndex: target.columnIndex,
              layout: snapshot,
            });
          }

          persistStageColumns(stageId, nextStageColumns[stageId] || []);
        }
      });
    },
    [fullBoard, persistStageColumns]
  );

  useEffect(() => {
    const handleDragMove = (event) => {
      if (!dragStateRef.current.row) {
        return;
      }

      const nextPointerX = event.clientX;
      const nextPointerY = event.clientY;
      const deltaX = nextPointerX - dragStateRef.current.originX;
      const deltaY = nextPointerY - dragStateRef.current.originY;
      const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2);

      if (!dragStateRef.current.dragging && distance < pointerDragThreshold) {
        return;
      }

      dragStateRef.current.dragging = true;
      suppressOpenRef.current = true;
      dragStateRef.current.pointerX = nextPointerX;
      dragStateRef.current.pointerY = nextPointerY;
      dragStateRef.current.activeTarget = resolveDropTarget(nextPointerX, nextPointerY);

      setDragState({
        rowId: dragStateRef.current.row.id,
        pointerX: nextPointerX,
        pointerY: nextPointerY,
        activeTarget: dragStateRef.current.activeTarget,
      });
    };

    const handleDragEnd = (event) => {
      const wasDragging = Boolean(
        dragStateRef.current.row && dragStateRef.current.dragging
      );

      if (wasDragging) {
        const releaseTarget = resolveDropTarget(event.clientX, event.clientY);
        applyDrop(
          dragStateRef.current.row,
          releaseTarget || dragStateRef.current.activeTarget
        );
      }

      dragStateRef.current = {
        pointerId: null,
        row: null,
        originX: 0,
        originY: 0,
        pointerX: 0,
        pointerY: 0,
        dragging: false,
        activeTarget: null,
      };
      setDragState({
        rowId: "",
        pointerX: 0,
        pointerY: 0,
        activeTarget: null,
      });
      if (wasDragging) {
        window.setTimeout(() => {
          suppressOpenRef.current = false;
        }, 0);
      }
    };

    window.addEventListener("pointermove", handleDragMove);
    window.addEventListener("pointerup", handleDragEnd);
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);

    return () => {
      window.removeEventListener("pointermove", handleDragMove);
      window.removeEventListener("pointerup", handleDragEnd);
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
    };
  }, [applyDrop]);

  const beginCardDrag = useCallback(
    (row, event, { preventDefault = false } = {}) => {
      if (filteredMode || (event.button != null && event.button !== 0)) {
        return;
      }

      if (preventDefault) {
        event.preventDefault();
      }

      dragStateRef.current = {
        pointerId: event.pointerId,
        row,
        originX: event.clientX,
        originY: event.clientY,
        pointerX: event.clientX,
        pointerY: event.clientY,
        dragging: false,
        activeTarget: null,
      };
    },
    [filteredMode]
  );

  const handleCardPressStart = useCallback(
    (row, event) => {
      beginCardDrag(row, event, { preventDefault: true });
    },
    [beginCardDrag]
  );

  const handleCardDetailsOpen = useCallback((row, event) => {
    event.stopPropagation();
    if (suppressOpenRef.current) {
      event.preventDefault();
      return;
    }

    if (hoverPreviewOpenTimerRef.current) {
      window.clearTimeout(hoverPreviewOpenTimerRef.current);
    }
    if (hoverPreviewCloseTimerRef.current) {
      window.clearTimeout(hoverPreviewCloseTimerRef.current);
    }
    setHoverPreview(null);
    setSelectedRowId(row.id);
  }, []);

  const scheduleHoverPreviewClose = useCallback(() => {
    if (hoverPreviewOpenTimerRef.current) {
      window.clearTimeout(hoverPreviewOpenTimerRef.current);
    }
    if (hoverPreviewCloseTimerRef.current) {
      window.clearTimeout(hoverPreviewCloseTimerRef.current);
    }

    hoverPreviewCloseTimerRef.current = window.setTimeout(() => {
      setHoverPreview(null);
    }, hoverPreviewCloseDelayMs);
  }, []);

  const openHoverPreview = useCallback((row, event) => {
    if (!row?.id) {
      return;
    }

    if (hoverPreviewOpenTimerRef.current) {
      window.clearTimeout(hoverPreviewOpenTimerRef.current);
    }
    if (hoverPreviewCloseTimerRef.current) {
      window.clearTimeout(hoverPreviewCloseTimerRef.current);
    }

    const rect = event.currentTarget.getBoundingClientRect();
    hoverPreviewOpenTimerRef.current = window.setTimeout(() => {
      setHoverPreview({
        rowId: row.id,
        rect: {
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        },
      });
    }, hoverPreviewOpenDelayMs);
  }, []);

  const keepHoverPreviewOpen = useCallback(() => {
    if (hoverPreviewOpenTimerRef.current) {
      window.clearTimeout(hoverPreviewOpenTimerRef.current);
    }
    if (hoverPreviewCloseTimerRef.current) {
      window.clearTimeout(hoverPreviewCloseTimerRef.current);
    }
  }, []);

  const setExplicitActiveTarget = useCallback((target) => {
    if (!dragStateRef.current.row || !dragStateRef.current.dragging) {
      return;
    }

    dragStateRef.current.activeTarget = target;
    setDragState((current) => ({
      ...current,
      rowId: dragStateRef.current.row?.id || "",
      activeTarget: target,
    }));
  }, []);

  const canSaveCalibration =
    takeoffMode === "calibrating" &&
    takeoffDraftPoints.length === 2 &&
    Number(takeoffScaleLength) > 0 &&
    Boolean(selectedTakeoffImageDimensions);
  const canCompleteTakeoff =
    takeoffTool === "count"
      ? takeoffDraftPoints.length >= 1
      : takeoffTool === "polygon"
        ? takeoffDraftPoints.length >= 3 && Boolean(selectedTakeoffCalibration)
        : takeoffDraftPoints.length >= 2 && Boolean(selectedTakeoffCalibration);

  const renderInsertCell = (stageId, columnIndex, track) => {
    const isActive =
      dragState.activeTarget?.type === "insert-column" &&
      dragState.activeTarget.stageId === stageId &&
      dragState.activeTarget.columnIndex === columnIndex &&
      dragState.activeTarget.track === track;

    return (
      <button
        key={`insert-${stageId}-${columnIndex}-${track}`}
        type="button"
        className={[
          "estimate-canvas-grid-track-drop",
          isActive ? "is-active" : "",
          debugEnabled ? "is-debug-visible" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-testid={`canvas-column-slot-${toTestIdSegment(stageId)}-${columnIndex}-${track}`}
        data-canvas-drop-type="insert-column"
        data-canvas-stage-id={stageId}
        data-canvas-column-index={columnIndex}
        data-canvas-track={track}
        onPointerEnter={() =>
          setExplicitActiveTarget({
            type: "insert-column",
            stageId,
            columnIndex,
            track,
          })
        }
        onMouseEnter={() =>
          setExplicitActiveTarget({
            type: "insert-column",
            stageId,
            columnIndex,
            track,
          })
        }
        onPointerMove={() =>
          setExplicitActiveTarget({
            type: "insert-column",
            stageId,
            columnIndex,
            track,
          })
        }
        onMouseMove={() =>
          setExplicitActiveTarget({
            type: "insert-column",
            stageId,
            columnIndex,
            track,
          })
        }
        aria-label={`Insert column ${columnIndex + 1} track ${track + 1} in ${getStageName(stages, stageId)}`}
      >
        <span className="estimate-canvas-grid-track-drop-line" />
        {debugEnabled ? (
          <span className="estimate-canvas-debug-drop-label">{`slot ${columnIndex}:${track}`}</span>
        ) : null}
      </button>
    );
  };

  const renderTrackInsertSlot = (stageId, columnIndex, slotIndex, insertTrack) => {
    const isActive =
      dragState.activeTarget?.type === "insert-track" &&
      dragState.activeTarget.stageId === stageId &&
      dragState.activeTarget.columnIndex === columnIndex &&
      dragState.activeTarget.track === insertTrack;

    return (
      <button
        key={`track-slot-${stageId}-${columnIndex}-${slotIndex}`}
        type="button"
        className={[
          "estimate-canvas-track-slot",
          isActive ? "is-active" : "",
          debugEnabled ? "is-debug-visible" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-testid={`canvas-track-slot-${toTestIdSegment(stageId)}-${columnIndex}-${slotIndex}`}
        data-canvas-drop-type="insert-track"
        data-canvas-stage-id={stageId}
        data-canvas-column-index={columnIndex}
        data-canvas-track={insertTrack}
        onPointerEnter={() =>
          setExplicitActiveTarget({
            type: "insert-track",
            stageId,
            columnIndex,
            track: insertTrack,
          })
        }
        onMouseEnter={() =>
          setExplicitActiveTarget({
            type: "insert-track",
            stageId,
            columnIndex,
            track: insertTrack,
          })
        }
        onPointerMove={() =>
          setExplicitActiveTarget({
            type: "insert-track",
            stageId,
            columnIndex,
            track: insertTrack,
          })
        }
        onMouseMove={() =>
          setExplicitActiveTarget({
            type: "insert-track",
            stageId,
            columnIndex,
            track: insertTrack,
          })
        }
      >
        <span className="estimate-canvas-track-slot-line" />
        {debugEnabled ? (
          <span className="estimate-canvas-debug-drop-label">{`track slot ${slotIndex}`}</span>
        ) : null}
      </button>
    );
  };

  const renderTrackCard = (stageId, columnIndex, track, row) => {
    const cardImageUrl = getRowImageUrl(row, assemblyLookup);
    const cardStatus = getCardStatus(row);

    return (
    <div
      key={`cell-${stageId}-${columnIndex}-${track}`}
      className={[
        "estimate-canvas-grid-cell",
        "has-card",
        debugEnabled ? "is-debug-visible" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid={`canvas-track-cell-${toTestIdSegment(stageId)}-${columnIndex}-${track}`}
    >
      <div
        data-testid={`canvas-card-${toTestIdSegment(row.id)}`}
        className={[
          "estimate-canvas-card",
          "canvas-card",
          getWorkTypeToneClass(row),
          getCardSurfaceClass(row),
          selectedRowId === row.id ? "is-selected" : "",
          dragState.rowId === row.id ? "is-dragging" : "",
          row.include === false ? "is-excluded" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onPointerDown={(event) => handleCardPressStart(row, event)}
        onMouseDown={(event) => handleCardPressStart(row, event)}
      >
        <div className="canvas-card__layout">
          <div className="canvas-card__image-shell">
            <span className="canvas-card__edge-indicator" aria-hidden="true" />
            {cardImageUrl ? (
              <img
                className="estimate-canvas-card-thumbnail estimate-canvas-card-image canvas-card__image"
                src={cardImageUrl}
                alt=""
                loading="lazy"
              />
            ) : (
              <span
                className="estimate-canvas-card-thumbnail canvas-card__image canvas-card__image--fallback"
                aria-hidden="true"
              >
                {getCardIconLabel(row)}
              </span>
            )}
          </div>

          <div className="canvas-card__body">
            <div className="canvas-card__header">
              {cardStatus ? (
                <div className="canvas-card__header-topline">
                  <span
                    className={[
                      "canvas-card__status",
                      getStatusToneClass(cardStatus),
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="canvas-card__status-dot" aria-hidden="true" />
                    {cardStatus}
                  </span>
                </div>
              ) : null}
              <strong className="canvas-card__title">{row.displayName || row.itemName}</strong>
              <span className="canvas-card__meta">{getCanvasCardMeta(row) || "Estimate item"}</span>
            </div>

          </div>

          <div className="canvas-card__footer">
            <span className="canvas-card__footer-left">
              {getTakeoffIndicatorLabel(row) ? (
                <span
                  className={[
                    "canvas-card__takeoff-indicator",
                    row.takeoffApplied?.takeoffId ? "is-applied" : "is-saved",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  title={getTakeoffIndicatorLabel(row)}
                  aria-label={getTakeoffIndicatorLabel(row)}
                >
                  <span aria-hidden="true">{getTakeoffIndicatorIcon(row)}</span>
                </span>
              ) : null}
              <span className="canvas-card__quantity">{getCanvasCardQuantity(row)}</span>
            </span>
            <strong className="canvas-card__value">{`$${formatCurrency(row.total)}`}</strong>
          </div>
        </div>

        <button
          type="button"
          className="canvas-card__details-button"
          aria-label={`Open details for ${row.displayName || row.itemName}`}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
          onMouseEnter={(event) => openHoverPreview(row, event)}
          onMouseLeave={scheduleHoverPreviewClose}
          onFocus={(event) => openHoverPreview(row, event)}
          onBlur={scheduleHoverPreviewClose}
          onClick={(event) => handleCardDetailsOpen(row, event)}
        >
          <span className="canvas-card__details-icon" aria-hidden="true">
            i
          </span>
        </button>

        {debugEnabled ? (
          <dl
            className="estimate-canvas-debug-card-meta"
            data-testid={`canvas-debug-card-meta-${toTestIdSegment(row.id)}`}
          >
            <div>
              <dt>ID</dt>
              <dd>{row.id}</dd>
            </div>
            <div>
              <dt>Stage</dt>
              <dd>{getRowStageId(row) || "-"}</dd>
            </div>
            <div>
              <dt>Integrity</dt>
              <dd>
                {getStageIntegrity(row.stageId, stages, row.stage, {
                  defaultStageId: getDefaultStageId(stages),
                }).isValid
                  ? "VALID"
                  : "INVALID"}
              </dd>
            </div>
            <div>
              <dt>Column</dt>
              <dd>{columnIndex}</dd>
            </div>
            <div>
              <dt>Track</dt>
              <dd>{track}</dd>
            </div>
          </dl>
        ) : null}
      </div>
    </div>
    );
  };

  const renderTrackGapCell = (stageId, columnIndex, track) => (
    <div
      key={`gap-${stageId}-${columnIndex}-${track}`}
      className={[
        "estimate-canvas-grid-cell",
        "is-empty",
        "is-gap",
        debugEnabled ? "is-debug-visible" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid={`canvas-track-cell-${toTestIdSegment(stageId)}-${columnIndex}-${track}`}
    >
      {debugEnabled ? (
        <span className="estimate-canvas-grid-cell-empty">{`Gap ${track + 1}`}</span>
      ) : null}
    </div>
  );

  useEffect(() => {
    if (!shouldLogCanvasDebug()) {
      return;
    }

    const restoredLayout = effectiveRows
      .map((row) => ({
        id: row.id,
        stageId: getRowStageId(row) || "",
        canvasColumn: row.canvasColumn ?? "",
        canvasTrack: row.canvasTrack ?? "",
      }))
      .sort((left, right) => String(left.id).localeCompare(String(right.id)));

    console.info("[Canvas Grid] Restored layout", restoredLayout);
  }, [effectiveRows]);

  const canvasTopBarContent =
    topBarPortalTarget && typeof document !== "undefined" && devModeEnabled
      ? createPortal(
          <div className="estimate-workspace-topbar__controls">
            <button
              type="button"
              className={[
                "secondary-button",
                "estimate-canvas-debug-toggle",
                "estimate-workspace-topbar-button",
                debugEnabled ? "is-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-testid="canvas-debug-toggle"
              onClick={() => setDebugEnabled((current) => !current)}
            >
              {`Debug ${debugEnabled ? "On" : "Off"}`}
            </button>
          </div>,
          topBarPortalTarget
        )
      : null;

  return (
    <div className="estimate-canvas-layout">
      {canvasTopBarContent}
      <div className="estimate-canvas-shell">
        <div className="estimate-canvas-utility-row">
          {!topBarPortalTarget ? (
            <h2 className="estimate-workspace-view-label">Canvas View</h2>
          ) : null}
          <div className="estimate-canvas-summary">
            <span>{`${visibleRows.length} visible cards`}</span>
            <span>{`${board.stageLanes.length} stages`}</span>
          </div>
          {!topBarPortalTarget && devModeEnabled ? (
            <button
              type="button"
              className={[
                "secondary-button",
                "estimate-canvas-debug-toggle",
                debugEnabled ? "is-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-testid="canvas-debug-toggle"
              onClick={() => setDebugEnabled((current) => !current)}
            >
              {`Debug ${debugEnabled ? "On" : "Off"}`}
            </button>
          ) : null}
        </div>

        {filteredMode ? (
          <div className="estimate-canvas-filter-notice">
            Dragging is disabled while search or filters are active so the saved board layout stays stable.
          </div>
        ) : null}

        {debugEnabled ? (
          <div className="estimate-canvas-debug-status" data-testid="canvas-debug-active-target">
            <strong>Active target</strong>
            <span>{getTargetLabel(dragState.activeTarget)}</span>
          </div>
        ) : null}

        <div className="estimate-canvas-board">
            <div className="estimate-canvas-stage-board">
              {board.stageLanes.map((stage, stageIndex) => {
                const stageBoard = board.stageBoardMap[stage.id];
                const presentation = getStagePresentation(stages, stage.id, stage.name);
                const trackCount = stageBoard.trackCount || defaultTrackCount;
                const columnCount = Math.max(stageBoard.columns.length, 1);
                const columns = Array.from({ length: columnCount }, (_, columnIndex) => stageBoard.columns[columnIndex] || {});

                return (
                  <div
                    key={stage.id}
                    className="estimate-canvas-stage-row"
                    data-testid={`canvas-stage-${toTestIdSegment(stage.id)}`}
                  >
                    <div
                      className="estimate-canvas-lane"
                      style={{
                        "--canvas-stage-bg": presentation.backgroundColor,
                        "--canvas-stage-border": presentation.borderColor,
                        "--canvas-stage-color": presentation.color,
                      }}
                    >
                      <div className="estimate-canvas-lane-header-inline">
                        <div className="estimate-canvas-stage-kicker">
                          <span className="estimate-canvas-rail-code">{`S${stageIndex + 1}`}</span>
                          <strong>{stage.name}</strong>
                        </div>
                        {debugEnabled ? (
                          <div
                            className="estimate-canvas-debug-lane-meta"
                            data-testid={`canvas-debug-lane-${toTestIdSegment(stage.id)}`}
                          >
                            <span>{`stage: ${stage.id}`}</span>
                            <span>{`columns: ${columns.length}`}</span>
                            <span>{`tracks: ${trackCount}`}</span>
                            <span>{`cards: ${stageBoard.cardCount}`}</span>
                          </div>
                        ) : null}
                      </div>

                      <div className="estimate-canvas-lane-scroll">
                        <div className="estimate-canvas-grid">
                          <div
                            className="estimate-canvas-grid-insert-column"
                            data-testid={`canvas-column-slot-${toTestIdSegment(stage.id)}-0`}
                          >
                            {Array.from({ length: trackCount }, (_, track) =>
                              renderInsertCell(stage.id, 0, track)
                            )}
                          </div>

                          {columns.length ? (
                            columns.map((column, columnIndex) => {
                              const renderedTrackCount = getRenderedTrackCount(column, trackCount);

                              return (
                                <Fragment key={`${stage.id}-column-${columnIndex}`}>
                                  <div
                                    className="estimate-canvas-grid-column"
                                    data-testid={`canvas-column-${toTestIdSegment(stage.id)}-${columnIndex}`}
                                  >
                                    {Object.keys(column).length ? (
                                      <>
                                        {Array.from({ length: renderedTrackCount }, (_, trackIndex) => (
                                          <Fragment key={`${stage.id}-${columnIndex}-${trackIndex}`}>
                                            {renderTrackInsertSlot(
                                              stage.id,
                                              columnIndex,
                                              trackIndex,
                                              trackIndex
                                            )}
                                            {column[trackIndex]
                                              ? renderTrackCard(
                                                  stage.id,
                                                  columnIndex,
                                                  trackIndex,
                                                  column[trackIndex]
                                                )
                                              : renderTrackGapCell(stage.id, columnIndex, trackIndex)}
                                          </Fragment>
                                        ))}
                                        {renderTrackInsertSlot(
                                          stage.id,
                                          columnIndex,
                                          renderedTrackCount,
                                          renderedTrackCount
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        {renderTrackInsertSlot(stage.id, columnIndex, 0, 0)}
                                        <div
                                          className="estimate-canvas-grid-cell is-empty"
                                          data-testid={`canvas-track-cell-${toTestIdSegment(stage.id)}-${columnIndex}-0`}
                                        >
                                          <span className="estimate-canvas-grid-cell-empty">Empty column</span>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  <div
                                    className="estimate-canvas-grid-insert-column"
                                    data-testid={`canvas-column-slot-${toTestIdSegment(stage.id)}-${columnIndex + 1}`}
                                  >
                                    {Array.from({ length: trackCount }, (_, track) =>
                                      renderInsertCell(stage.id, columnIndex + 1, track)
                                    )}
                                  </div>
                                </Fragment>
                              );
                            })
                          ) : (
                            <>
                              <div className="estimate-canvas-grid-empty">
                                <span>Drag cards here to start this stage sequence.</span>
                              </div>
                              <div
                                className="estimate-canvas-grid-insert-column"
                                data-testid={`canvas-column-slot-${toTestIdSegment(stage.id)}-1`}
                              >
                                {Array.from({ length: trackCount }, (_, track) =>
                                  renderInsertCell(stage.id, 1, track)
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>


        </div>

        {selectedRow ? (
          <>
            <button
              type="button"
              className="estimate-canvas-detail-backdrop"
              aria-label="Close card details"
              onClick={() => setSelectedRowId("")}
            />
            <aside className="estimate-canvas-detail-drawer" data-testid="canvas-detail-drawer">
              <div className="estimate-canvas-detail-drawer-header">
                <span className="estimate-canvas-detail-kicker">Card details</span>
                <button
                  type="button"
                  className="toolbar-icon-button estimate-canvas-detail-close"
                  aria-label="Close card details"
                  onClick={() => setSelectedRowId("")}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>

              <div className="estimate-canvas-detail-panel">
                <div className="estimate-canvas-detail-media">
                  {selectedRowPrimaryImageUrl ? (
                    <img
                      className="estimate-canvas-detail-image estimate-canvas-detail-image-photo"
                      src={selectedRowPrimaryImageUrl}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <div className="estimate-canvas-detail-image">{getCardIconLabel(selectedRow)}</div>
                  )}
                  <div className="estimate-canvas-detail-media-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => galleryFileInputRef.current?.click()}
                    >
                      Add Image
                    </button>
                    {selectedRowPrimaryImageUrl ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setGalleryPreviewUrl(selectedRowPrimaryImageUrl)}
                      >
                        Preview
                      </button>
                    ) : null}
                    <input
                      ref={galleryFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      onChange={handleGalleryInputChange}
                    />
                  </div>
                </div>

                <div className="estimate-canvas-detail-title">
                  <div className="estimate-canvas-detail-title-topline">
                    <span className={["canvas-card__type-badge", getWorkTypeToneClass(selectedRow)].filter(Boolean).join(" ")}>
                      {getCanvasTypeBadgeLabel(selectedRow)}
                    </span>
                    {getCardStatus(selectedRow) ? (
                      <span
                        className={[
                          "canvas-card__status",
                          getStatusToneClass(getCardStatus(selectedRow)),
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <span className="canvas-card__status-dot" aria-hidden="true" />
                        {getCardStatus(selectedRow)}
                      </span>
                    ) : null}
                  </div>
                  <h3>{selectedRow.displayName || selectedRow.itemName}</h3>
                  <span>{getCanvasCardMeta(selectedRow) || "Estimate item"}</span>
                </div>

                <div className="estimate-canvas-detail-metrics">
                  <div>
                    <span>Quantity</span>
                    <strong>{formatMeasureValue(selectedRow.quantity)}</strong>
                  </div>
                  <div>
                    <span>Unit</span>
                    <strong>{cleanText(selectedRow.unit) || "-"}</strong>
                  </div>
                  <div>
                    <span>Rate</span>
                    <strong>{`$${formatCurrency(selectedRow.rate ?? selectedRow.unitRate)}`}</strong>
                  </div>
                  <div>
                    <span>Total</span>
                    <strong>{`$${formatCurrency(selectedRow.total)}`}</strong>
                  </div>
                </div>

                <div className="estimate-canvas-detail-tabs" role="tablist" aria-label="Card drawer sections">
                  <button
                    type="button"
                    className={["estimate-canvas-detail-tab", selectedDrawerTab === "details" ? "is-active" : ""]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setSelectedDrawerTab("details")}
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    className={["estimate-canvas-detail-tab", selectedDrawerTab === "takeoff" ? "is-active" : ""]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setSelectedDrawerTab("takeoff")}
                  >
                    Takeoff
                  </button>
                </div>

                {selectedDrawerTab === "details" ? (
                  <>
                <div className="estimate-canvas-detail-actions">
                  <button
                    type="button"
                    className="secondary-button estimate-canvas-open-builder"
                    onClick={onOpenBuilderView}
                  >
                    Open In Builder
                  </button>
                </div>

                <div className="estimate-canvas-detail-section">
                  <div className="estimate-canvas-detail-section-header">
                    <h4>Images</h4>
                  </div>

                  {selectedRowImageUrls.length ? (
                    <div className="estimate-canvas-gallery-grid">
                      {selectedRowImageUrls.map((imageUrl, imageIndex) => (
                        <div
                          key={`${selectedRow.id}-image-${imageIndex}`}
                          className={[
                            "estimate-canvas-gallery-card",
                            imageIndex === (selectedRow.primaryImageIndex || 0) ? "is-primary" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <button
                            type="button"
                            className="estimate-canvas-gallery-thumb"
                            onClick={() => setGalleryPreviewUrl(imageUrl)}
                          >
                            <img src={imageUrl} alt="" loading="lazy" />
                          </button>
                          <div className="estimate-canvas-gallery-card-meta">
                            <span>{imageIndex === (selectedRow.primaryImageIndex || 0) ? "Primary" : `Image ${imageIndex + 1}`}</span>
                            <div className="estimate-canvas-gallery-actions">
                              {imageIndex === (selectedRow.primaryImageIndex || 0) ? null : (
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => updateSelectedRowImages(selectedRowImageUrls, imageIndex)}
                                >
                                  Make primary
                                </button>
                              )}
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => {
                                  const nextImageUrls = selectedRowImageUrls.filter((_, index) => index !== imageIndex);
                                  const nextPrimaryImageIndex =
                                    imageIndex < (selectedRow.primaryImageIndex || 0)
                                      ? (selectedRow.primaryImageIndex || 0) - 1
                                      : selectedRow.primaryImageIndex || 0;
                                  updateSelectedRowImages(nextImageUrls, nextPrimaryImageIndex);
                                  if (galleryPreviewUrl === imageUrl) {
                                    setGalleryPreviewUrl("");
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="estimate-canvas-gallery-empty">
                      <span>No images added yet. Upload one or more images to show them on this card.</span>
                    </div>
                  )}
                </div>

                <div className="estimate-canvas-detail-section">
                  <div className="estimate-canvas-detail-section-header">
                    <h4>Estimate Inputs</h4>
                  </div>
                  <div className="estimate-canvas-detail-form">
                    <label className="field">
                      <span>Quantity</span>
                      <input
                        type="number"
                        step="0.01"
                        value={selectedRow.quantity ?? ""}
                        onChange={(event) => updateSelectedRowField("quantity", event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>Unit</span>
                      <input
                        type="text"
                        value={selectedRow.unit || ""}
                        onChange={(event) => updateSelectedRowField("unit", event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>Rate</span>
                      <input
                        type="number"
                        step="0.01"
                        value={selectedRow.rate ?? selectedRow.unitRate ?? ""}
                        onChange={(event) => updateSelectedRowField("rate", event.target.value)}
                      />
                    </label>
                  </div>
                </div>

                <div className="estimate-canvas-detail-section">
                  <div className="estimate-canvas-detail-section-header">
                    <h4>Details</h4>
                  </div>
                  <dl className="estimate-canvas-detail-grid">
                    <div>
                      <dt>Stage</dt>
                      <dd>{getStageName(stages, getRowStageId(selectedRow), selectedRow.stage)}</dd>
                    </div>
                    <div>
                      <dt>Trade</dt>
                      <dd>{getTradeName(trades, selectedRow.tradeId, selectedRow.trade)}</dd>
                    </div>
                    <div>
                      <dt>Cost Code</dt>
                      <dd>{getCostCodeName(costCodes, selectedRow.costCodeId, selectedRow.costCode)}</dd>
                    </div>
                    <div>
                      <dt>Column</dt>
                      <dd>{board.rowPlacementMap[selectedRow.id]?.columnIndex ?? "-"}</dd>
                    </div>
                    <div>
                      <dt>Track</dt>
                      <dd>{board.rowPlacementMap[selectedRow.id]?.track ?? "-"}</dd>
                    </div>
                    {debugEnabled ? (
                      <div>
                        <dt>Integrity</dt>
                        <dd>
                          {getStageIntegrity(selectedRow.stageId, stages, selectedRow.stage, {
                            defaultStageId: getDefaultStageId(stages),
                          }).isValid
                            ? "VALID"
                            : "INVALID"}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>

                <div className="estimate-canvas-detail-section">
                  <h4>Included Items</h4>
                  {selectedRow.assemblyId && assemblyLookup[selectedRow.assemblyId]?.items?.length ? (
                    <ul>
                      {assemblyLookup[selectedRow.assemblyId].items.slice(0, 6).map((item) => (
                        <li key={item.id}>{item.itemName}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No assembly breakdown attached to this card.</p>
                  )}
                </div>

                <div className="estimate-canvas-detail-section">
                  <h4>Notes</h4>
                  <p>{cleanText(selectedRow.notes) || "No notes added."}</p>
                </div>
                  </>
                ) : (
                  <div className="estimate-canvas-detail-section estimate-canvas-takeoff-section">
                    <div className="estimate-canvas-detail-section-header">
                      <h4>Takeoff Mode</h4>
                      <span className="estimate-canvas-takeoff-helper">
                        Calibrate one image, measure, then apply the result to quantity.
                      </span>
                    </div>

                    {selectedRowImageUrls.length ? (
                      <>
                        <div className="estimate-canvas-takeoff-image-selector" role="tablist" aria-label="Takeoff images">
                          {selectedRowImageUrls.map((imageUrl, imageIndex) => (
                            <button
                              key={`${selectedRow.id}-takeoff-image-${imageIndex}`}
                              type="button"
                              className={[
                                "estimate-canvas-takeoff-image-chip",
                                imageIndex === selectedTakeoffImageIndex ? "is-active" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              onClick={() => setSelectedTakeoffImageIndex(imageIndex)}
                            >
                              <img src={imageUrl} alt="" loading="lazy" />
                              <span>{imageIndex === (selectedRow.primaryImageIndex || 0) ? "Primary" : `Image ${imageIndex + 1}`}</span>
                            </button>
                          ))}
                        </div>

                        <div className="estimate-canvas-takeoff-toolbar">
                          <div className="estimate-canvas-takeoff-tools">
                            {takeoffToolOptions.map((tool) => (
                              <button
                                key={tool.id}
                                type="button"
                                className={[
                                  "estimate-canvas-takeoff-tool",
                                  takeoffTool === tool.id ? "is-active" : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                onClick={() => {
                                  setTakeoffTool(tool.id);
                                  resetTakeoffDraft();
                                }}
                              >
                                <strong>{tool.label}</strong>
                                <span>{tool.unit}</span>
                              </button>
                            ))}
                          </div>

                          <div className="estimate-canvas-takeoff-scale-card">
                            <div className="estimate-canvas-takeoff-scale-header">
                              <strong>Calibration</strong>
                              <span className={selectedTakeoffCalibration ? "is-calibrated" : "is-uncalibrated"}>
                                {selectedTakeoffCalibration
                                  ? `Calibrated: ${formatTakeoffValue(selectedTakeoffCalibration.realLength)} ${selectedTakeoffCalibration.realUnit} reference`
                                  : "Not calibrated"}
                              </span>
                            </div>
                            <div className="estimate-canvas-takeoff-scale-controls">
                              <label className="field">
                                <span>Length</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={takeoffScaleLength}
                                  onChange={(event) => setTakeoffScaleLength(event.target.value)}
                                />
                              </label>
                              <label className="field">
                                <span>Unit</span>
                                <select
                                  value={takeoffScaleUnit}
                                  onChange={(event) => setTakeoffScaleUnit(event.target.value)}
                                >
                                  {takeoffScaleUnitOptions.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                            <div className="estimate-canvas-takeoff-scale-actions">
                              <button type="button" className="secondary-button" onClick={startCalibrationMode}>
                                {selectedTakeoffCalibration ? "Recalibrate" : "Set Scale"}
                              </button>
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={completeCalibration}
                                disabled={!canSaveCalibration}
                              >
                                Save Scale
                              </button>
                              {selectedTakeoffCalibration ? (
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => {
                                    const nextCalibrations = { ...selectedRowTakeoffCalibrations };
                                    delete nextCalibrations[String(selectedTakeoffImageIndex)];
                                    persistSelectedRowCalibrations(nextCalibrations);
                                    resetTakeoffDraft();
                                  }}
                                >
                                  Clear
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="estimate-canvas-takeoff-stage-wrap">
                          <div
                            ref={takeoffSurfaceRef}
                            className={[
                              "estimate-canvas-takeoff-stage",
                              takeoffMode === "calibrating" ? "is-calibrating" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            onPointerDown={handleTakeoffStagePointerDown}
                            onPointerMove={handleTakeoffStagePointerMove}
                            onPointerUp={handleTakeoffStagePointerUp}
                            onDoubleClick={() => {
                              if (takeoffTool === "polygon" && canCompleteTakeoff) {
                                finalizeTakeoff();
                              }
                            }}
                          >
                            <img
                              src={selectedTakeoffImageUrl}
                              alt=""
                              loading="lazy"
                              onLoad={handleTakeoffImageLoad}
                            />
                            <svg
                              className="estimate-canvas-takeoff-overlay"
                              viewBox="0 0 1000 1000"
                              preserveAspectRatio="none"
                              aria-hidden="true"
                            >
                              {selectedImageTakeoffs.map((takeoff) => {
                                if (takeoff.tool === "count") {
                                  return (
                                    <g key={takeoff.id} className="is-saved">
                                      {takeoff.points.map((point, index) => (
                                        <circle key={`${takeoff.id}-point-${index}`} cx={point.x * 1000} cy={point.y * 1000} r="10" />
                                      ))}
                                    </g>
                                  );
                                }

                                if (takeoff.tool === "line") {
                                  return (
                                    <g key={takeoff.id} className="is-saved">
                                      <line
                                        x1={takeoff.points[0]?.x * 1000}
                                        y1={takeoff.points[0]?.y * 1000}
                                        x2={takeoff.points[1]?.x * 1000}
                                        y2={takeoff.points[1]?.y * 1000}
                                      />
                                    </g>
                                  );
                                }

                                if (takeoff.tool === "rectangle") {
                                  const firstPoint = takeoff.points[0] || { x: 0, y: 0 };
                                  const secondPoint = takeoff.points[1] || firstPoint;
                                  return (
                                    <g key={takeoff.id} className="is-saved">
                                      <rect
                                        x={Math.min(firstPoint.x, secondPoint.x) * 1000}
                                        y={Math.min(firstPoint.y, secondPoint.y) * 1000}
                                        width={Math.abs(secondPoint.x - firstPoint.x) * 1000}
                                        height={Math.abs(secondPoint.y - firstPoint.y) * 1000}
                                      />
                                    </g>
                                  );
                                }

                                return (
                                  <g key={takeoff.id} className="is-saved">
                                    <polygon points={toSvgPointList(takeoff.points)} />
                                  </g>
                                );
                              })}

                              {takeoffMode === "calibrating" && takeoffPreviewPoints.length ? (
                                <g className="is-calibration">
                                  {takeoffPreviewPoints.length >= 2 ? (
                                    <line
                                      x1={takeoffPreviewPoints[0].x * 1000}
                                      y1={takeoffPreviewPoints[0].y * 1000}
                                      x2={takeoffPreviewPoints[1].x * 1000}
                                      y2={takeoffPreviewPoints[1].y * 1000}
                                    />
                                  ) : null}
                                  {takeoffPreviewPoints.map((point, index) => (
                                    <circle key={`calibration-point-${index}`} cx={point.x * 1000} cy={point.y * 1000} r="9" />
                                  ))}
                                </g>
                              ) : null}

                              {takeoffMode !== "calibrating" && takeoffPreviewPoints.length ? (
                                <g className="is-draft">
                                  {takeoffTool === "count"
                                    ? takeoffPreviewPoints.map((point, index) => (
                                        <circle key={`draft-point-${index}`} cx={point.x * 1000} cy={point.y * 1000} r="10" />
                                      ))
                                    : null}
                                  {takeoffTool === "line" && takeoffPreviewPoints.length >= 2 ? (
                                    <line
                                      x1={takeoffPreviewPoints[0].x * 1000}
                                      y1={takeoffPreviewPoints[0].y * 1000}
                                      x2={takeoffPreviewPoints[1].x * 1000}
                                      y2={takeoffPreviewPoints[1].y * 1000}
                                    />
                                  ) : null}
                                  {takeoffTool === "rectangle" && takeoffPreviewPoints.length >= 2 ? (
                                    <rect
                                      x={Math.min(takeoffPreviewPoints[0].x, takeoffPreviewPoints[1].x) * 1000}
                                      y={Math.min(takeoffPreviewPoints[0].y, takeoffPreviewPoints[1].y) * 1000}
                                      width={Math.abs(takeoffPreviewPoints[1].x - takeoffPreviewPoints[0].x) * 1000}
                                      height={Math.abs(takeoffPreviewPoints[1].y - takeoffPreviewPoints[0].y) * 1000}
                                    />
                                  ) : null}
                                  {takeoffTool === "polygon" && takeoffPreviewPoints.length >= 2 ? (
                                    <polyline points={toSvgPointList(takeoffPreviewPoints)} />
                                  ) : null}
                                </g>
                              ) : null}
                            </svg>
                          </div>

                          <div className="estimate-canvas-takeoff-stage-caption">
                            {takeoffMode === "calibrating"
                              ? "Click two points on the image, then save the scale."
                              : takeoffTool === "rectangle"
                                ? "Drag on the image to define the rectangle area."
                                : takeoffTool === "polygon"
                                  ? "Click around the shape, then finish the polygon."
                                  : takeoffTool === "count"
                                    ? "Click each item to count, then save the takeoff."
                                    : "Click two points to create a line measurement."}
                          </div>
                        </div>

                        <div className="estimate-canvas-takeoff-results">
                          <div>
                            <span>Current tool</span>
                            <strong>{getTakeoffToolDefinition(takeoffTool).label}</strong>
                          </div>
                          <div className="is-live-result">
                            <span>{takeoffMode === "calibrating" ? "Scale result" : "Live result"}</span>
                            <strong>
                              {takeoffMode === "calibrating"
                                ? liveTakeoffValue > 0
                                  ? `${liveTakeoffValue} m/px`
                                  : "Set two points"
                                : `${formatTakeoffValue(liveTakeoffValue)} ${getTakeoffDefaultUnit(takeoffTool)}`}
                            </strong>
                            <em>
                              {takeoffMode === "calibrating"
                                ? canSaveCalibration
                                  ? "Ready to save calibration"
                                  : "Click two reference points"
                                : canCompleteTakeoff
                                  ? "Ready to save"
                                  : selectedTakeoffCalibration || takeoffTool === "count"
                                    ? "Add more points to complete"
                                    : "Calibrate this image first"}
                            </em>
                          </div>
                          <div>
                            <span>Qty source</span>
                            <strong>
                              {selectedTakeoffEntry?.id === selectedRow?.takeoffApplied?.takeoffId
                                ? "Applied from takeoff"
                                : selectedRow?.takeoffApplied?.takeoffId
                                  ? "Measured quantity set"
                                  : "Manual / estimate qty"}
                            </strong>
                          </div>
                        </div>

                        {takeoffFeedback ? (
                          <div className="estimate-canvas-takeoff-feedback" role="status">
                            {takeoffFeedback}
                          </div>
                        ) : null}

                        <div className="estimate-canvas-takeoff-actions">
                          <button type="button" className="secondary-button" onClick={undoTakeoffPoint} disabled={!takeoffDraftPoints.length}>
                            Undo Last Point
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={resetTakeoffDraft}
                            disabled={!takeoffDraftPoints.length && takeoffMode !== "calibrating"}
                          >
                            Clear Draft
                          </button>
                          <button
                            type="button"
                            className="primary-button"
                            onClick={finalizeTakeoff}
                            disabled={!canCompleteTakeoff}
                          >
                            Save Takeoff
                          </button>
                        </div>

                        <div className="estimate-canvas-detail-section estimate-canvas-takeoff-list-section">
                          <div className="estimate-canvas-detail-section-header">
                            <h4>Saved Takeoffs</h4>
                          </div>
                          {selectedRowTakeoffs.length ? (
                            <div className="estimate-canvas-takeoff-list">
                              {groupedTakeoffs.map((group) => (
                                <section
                                  key={`takeoff-group-${group.imageIndex}`}
                                  className={[
                                    "estimate-canvas-takeoff-group",
                                    group.imageIndex === selectedTakeoffImageIndex ? "is-current-image" : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                >
                                  <div className="estimate-canvas-takeoff-group-header">
                                    <strong>
                                      {`Image ${group.imageIndex + 1}`}
                                      {group.imageIndex === (selectedRow.primaryImageIndex || 0) ? " · Primary" : ""}
                                    </strong>
                                    <span>{`${group.takeoffs.length} saved`}</span>
                                  </div>

                                  <div className="estimate-canvas-takeoff-group-list">
                                    {group.takeoffs.map((takeoff) => (
                                      <div
                                        key={takeoff.id}
                                        className={[
                                          "estimate-canvas-takeoff-entry",
                                          Number(takeoff.imageIndex) === selectedTakeoffImageIndex ? "is-current-image" : "",
                                          selectedTakeoffEntry?.id === takeoff.id ? "is-selected" : "",
                                          selectedRow?.takeoffApplied?.takeoffId === takeoff.id ? "is-applied" : "",
                                        ]
                                          .filter(Boolean)
                                          .join(" ")}
                                        onClick={() => {
                                          setSelectedTakeoffId(takeoff.id);
                                          setConfirmingDeleteTakeoffId("");
                                        }}
                                      >
                                        <div className="estimate-canvas-takeoff-entry-topline">
                                          <span className="estimate-canvas-takeoff-entry-tool">
                                            {getTakeoffToolDefinition(takeoff.tool).label}
                                          </span>
                                          {selectedRow?.takeoffApplied?.takeoffId === takeoff.id ? (
                                            <span className="estimate-canvas-takeoff-entry-state">Applied</span>
                                          ) : null}
                                        </div>

                                        <div className="estimate-canvas-takeoff-entry-copy">
                                          {editingTakeoffId === takeoff.id ? (
                                            <div className="estimate-canvas-takeoff-entry-edit">
                                              <input
                                                type="text"
                                                value={takeoffLabelDraft}
                                                onChange={(event) => setTakeoffLabelDraft(event.target.value)}
                                                onClick={(event) => event.stopPropagation()}
                                              />
                                              <div className="estimate-canvas-takeoff-entry-edit-actions">
                                                <button type="button" className="secondary-button" onClick={(event) => { event.stopPropagation(); saveTakeoffRename(); }}>
                                                  Save
                                                </button>
                                                <button type="button" className="secondary-button" onClick={(event) => { event.stopPropagation(); setEditingTakeoffId(''); setTakeoffLabelDraft(''); }}>
                                                  Cancel
                                                </button>
                                              </div>
                                            </div>
                                          ) : (
                                            <>
                                              <strong>{getTakeoffLabel(takeoff)}</strong>
                                              <span>{`Measured on image ${Number(takeoff.imageIndex) + 1}`}</span>
                                            </>
                                          )}
                                        </div>

                                        <div className="estimate-canvas-takeoff-entry-result-row">
                                          <div className="estimate-canvas-takeoff-entry-value">
                                            {formatTakeoffValue(takeoff.computedValue)} {takeoff.unit}
                                          </div>
                                          <div className="estimate-canvas-takeoff-entry-actions estimate-canvas-takeoff-entry-actions--primary">
                                            <button
                                              type="button"
                                              className={selectedRow?.takeoffApplied?.takeoffId === takeoff.id ? "primary-button" : "secondary-button"}
                                              onClick={(event) => { event.stopPropagation(); applyTakeoffToQuantity(takeoff, "replace"); }}
                                            >
                                              Replace quantity
                                            </button>
                                            <button
                                              type="button"
                                              className="secondary-button"
                                              onClick={(event) => { event.stopPropagation(); applyTakeoffToQuantity(takeoff, "add"); }}
                                            >
                                              Add to quantity
                                            </button>
                                          </div>
                                        </div>

                                        <div className="estimate-canvas-takeoff-entry-actions estimate-canvas-takeoff-entry-actions--secondary">
                                          <button type="button" className="secondary-button" onClick={(event) => { event.stopPropagation(); startTakeoffRename(takeoff); }}>
                                            Edit name
                                          </button>
                                          {confirmingDeleteTakeoffId === takeoff.id ? (
                                            <div className="estimate-canvas-takeoff-confirm">
                                              <span>Delete this takeoff?</span>
                                              <button type="button" className="secondary-button" onClick={(event) => { event.stopPropagation(); deleteTakeoff(takeoff.id); }}>
                                                Confirm
                                              </button>
                                              <button type="button" className="secondary-button" onClick={(event) => { event.stopPropagation(); setConfirmingDeleteTakeoffId(''); }}>
                                                Cancel
                                              </button>
                                            </div>
                                          ) : (
                                            <button type="button" className="secondary-button is-danger" onClick={(event) => { event.stopPropagation(); deleteTakeoff(takeoff.id); }}>
                                              Delete
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </section>
                              ))}
                            </div>
                          ) : (
                            <div className="estimate-canvas-gallery-empty">
                              <span>No saved takeoffs yet. Calibrate the image and save your first measurement.</span>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="estimate-canvas-gallery-empty">
                        <span>Add an image to this card before using Takeoff Mode.</span>
                      </div>
                    )}
                  </div>
                )}

                {debugEnabled ? (
                  <div className="estimate-canvas-debug-inspector" data-testid="canvas-debug-inspector">
                    <h4>Selected Card Debug</h4>
                    <dl className="estimate-canvas-debug-inspector-grid">
                      <div>
                        <dt>ID</dt>
                        <dd>{selectedRow.id}</dd>
                      </div>
                      <div>
                        <dt>Stage</dt>
                        <dd>{getRowStageId(selectedRow) || "-"}</dd>
                      </div>
                      <div>
                        <dt>Column</dt>
                        <dd>{board.rowPlacementMap[selectedRow.id]?.columnIndex ?? "-"}</dd>
                      </div>
                      <div>
                        <dt>Track</dt>
                        <dd>{board.rowPlacementMap[selectedRow.id]?.track ?? "-"}</dd>
                      </div>
                      <div>
                        <dt>Legacy Stack Parent</dt>
                        <dd>{selectedRow.canvasStackParentId || "-"}</dd>
                      </div>
                      <div>
                        <dt>Legacy Stack Order</dt>
                        <dd>{selectedRow.canvasStackOrder || "-"}</dd>
                      </div>
                    </dl>
                  </div>
                ) : null}
              </div>
            </aside>
          </>
        ) : null}

        {activeDragRow ? (
          <div
            className="estimate-canvas-drag-preview"
            style={{
              transform: `translate(${dragState.pointerX + 16}px, ${dragState.pointerY + 16}px)`,
            }}
          >
            <div className="estimate-canvas-drag-preview-card">
              <strong>{activeDragRow.displayName || activeDragRow.itemName}</strong>
              <p>{getTargetLabel(dragState.activeTarget)}</p>
            </div>
          </div>
        ) : null}
        {galleryPreviewUrl ? (
          <div className="estimate-canvas-image-preview" role="dialog" aria-modal="true">
            <button
              type="button"
              className="estimate-canvas-image-preview-backdrop"
              aria-label="Close image preview"
              onClick={() => setGalleryPreviewUrl("")}
            />
            <div className="estimate-canvas-image-preview-card">
              <button
                type="button"
                className="toolbar-icon-button estimate-canvas-image-preview-close"
                aria-label="Close image preview"
                onClick={() => setGalleryPreviewUrl("")}
              >
                <span aria-hidden="true">×</span>
              </button>
              <img src={galleryPreviewUrl} alt="" />
            </div>
          </div>
        ) : null}
        {hoverPreviewRow && hoverPreview?.rect && typeof document !== "undefined"
          ? createPortal(
              <div
                className="canvas-card__hover-preview"
                style={{
                  top: Math.max(12, hoverPreview.rect.top - 12),
                  left: Math.min(
                    Math.max(12, hoverPreview.rect.right + 12),
                    Math.max(12, window.innerWidth - 292)
                  ),
                }}
                onMouseEnter={keepHoverPreviewOpen}
                onMouseLeave={scheduleHoverPreviewClose}
              >
                <div className="canvas-card__hover-preview-media">
                  {getRowImageUrl(hoverPreviewRow, assemblyLookup) ? (
                    <img
                      src={getRowImageUrl(hoverPreviewRow, assemblyLookup)}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <div className="canvas-card__hover-preview-fallback">
                      {getCardIconLabel(hoverPreviewRow)}
                    </div>
                  )}
                </div>
                <div className="canvas-card__hover-preview-copy">
                  <strong>{hoverPreviewRow.displayName || hoverPreviewRow.itemName}</strong>
                  <span>{getCanvasCardMeta(hoverPreviewRow) || "Estimate item"}</span>
                  {getTakeoffIndicatorLabel(hoverPreviewRow) ? (
                    <span className="canvas-card__hover-preview-source">{getTakeoffIndicatorLabel(hoverPreviewRow)}</span>
                  ) : null}
                </div>
                <dl
                  className={[
                    "canvas-card__hover-preview-metrics",
                    getHoverPreviewMetrics(hoverPreviewRow).length >= 3 ? "is-wide" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {getHoverPreviewMetrics(hoverPreviewRow).map((metric) => (
                    <div
                      key={`${hoverPreviewRow.id}-${metric.key}`}
                      className={metric.key === "total" ? "is-total" : ""}
                    >
                      <dt>{metric.label}</dt>
                      <dd>{metric.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>,
              document.body
            )
          : null}
      </div>
    </div>
  );
}

export default EstimateCanvasView;






