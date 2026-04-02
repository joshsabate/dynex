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
const getCardTypeLabel = (row) =>
  cleanText(row.workType) || (row.source === "manual-builder" ? "Manual" : "Estimate");
const getCardIconLabel = (row) =>
  cleanText(row.roomName || row.assemblyName || row.itemName || "Item")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
const getCardMeta = (row) =>
  [cleanText(row.trade), cleanText(row.costCode), cleanText(row.roomName)].filter(Boolean).join(" • ");
const getRowImageUrl = (row, assemblyLookup = {}) => {
  const assemblyImageUrl = cleanText(
    row.assemblyImageUrl || assemblyLookup[row.assemblyId]?.imageUrl
  );
  const itemImageUrl = cleanText(row.itemImageUrl);

  return cleanText(row.imageUrl) || assemblyImageUrl || itemImageUrl || "";
};
const getCanvasCardMeta = (row) =>
  [cleanText(row.costCode), cleanText(row.assemblyName || row.roomName)].filter(Boolean).join(" / ");
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
  let track = Math.max(0, Number(requestedTrack) || 0);

  while (nextColumn[track] && nextColumn[track].id !== row.id) {
    track += 1;
  }

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
  onOpenBuilderView = () => {},
  topBarPortalTarget = null,
}) {
  const devModeEnabled = process.env.NODE_ENV !== "production";
  const [debugEnabled, setDebugEnabled] = useState(() =>
    devModeEnabled ? shouldEnableFlag("canvasDebug", canvasDebugStorageKey) : false
  );
  const [selectedRowId, setSelectedRowId] = useState("");
  const [dragState, setDragState] = useState({
    rowId: "",
    pointerX: 0,
    pointerY: 0,
    activeTarget: null,
  });
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
            emitCanvasRowDebugUpdate(nextRow);
            if (row.stageId !== nextRow.stageId) {
              console.log("Canvas move", row.id, nextRow.stageId);
            }
            onRowOverrideChange(row.id, {
              stageId: stageId === unassignedStageId ? "" : stageId,
              canvasColumn: columnIndex,
              canvasTrack: Number(trackKey),
              canvasOrder: buildCanvasOrder(columnIndex, Number(trackKey)),
              canvasStackParentId: "",
              canvasStackOrder: "",
            });
          });
      });
    },
    [onRowOverrideChange]
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
      if (dragStateRef.current.row && dragStateRef.current.dragging) {
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

  const handleCardPressStart = useCallback(
    (row, event) => {
      if (filteredMode || (event.button != null && event.button !== 0)) {
        return;
      }

      event.preventDefault();
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
      setSelectedRowId(row.id);
    },
    [filteredMode]
  );

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
      <button
        type="button"
        data-testid={`canvas-card-${toTestIdSegment(row.id)}`}
        className={[
          "estimate-canvas-card",
          "canvas-card",
          selectedRowId === row.id ? "is-selected" : "",
          dragState.rowId === row.id ? "is-dragging" : "",
          row.include === false ? "is-excluded" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onPointerDown={(event) => handleCardPressStart(row, event)}
        onMouseDown={(event) => handleCardPressStart(row, event)}
        onClick={() => setSelectedRowId(row.id)}
        draggable={false}
        onDragStart={(event) => event.preventDefault()}
      >
        <div className="canvas-card__image-shell">
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
          {cardStatus ? (
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
          ) : null}
        </div>

        <div className="canvas-card__body">
          <div className="canvas-card__header">
            <strong className="canvas-card__title">{row.displayName || row.itemName}</strong>
            <span className="canvas-card__meta">{getCanvasCardMeta(row) || "Estimate item"}</span>
          </div>

          <div className="canvas-card__footer">
            <div className="estimate-canvas-card-badges canvas-card__tags">
              {cleanText(row.trade) ? (
                <span
                  className={[
                    "estimate-canvas-card-badge",
                    "canvas-card__tag",
                    "is-trade",
                    getTradeToneClass(row),
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {row.trade}
                </span>
              ) : null}
              <span
                className={[
                  "estimate-canvas-card-badge",
                  "canvas-card__tag",
                  "is-work-type",
                  getWorkTypeToneClass(row),
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {getCardTypeLabel(row)}
              </span>
              {!cardStatus && cleanText(row.stage) ? (
                <span className="estimate-canvas-card-badge canvas-card__tag is-stage-tag">
                  {row.stage}
                </span>
              ) : null}
            </div>
            <strong className="canvas-card__value">{`$${formatCurrency(row.total)}`}</strong>
          </div>
        </div>

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
      </button>
    </div>
    );
  };

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
                    <div className="estimate-canvas-stage-label">
                      <span className="estimate-canvas-rail-code">{`S${stageIndex + 1}`}</span>
                      <strong>{stage.name}</strong>
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

                    <div
                      className="estimate-canvas-lane"
                      style={{
                        "--canvas-stage-bg": presentation.backgroundColor,
                        "--canvas-stage-border": presentation.borderColor,
                        "--canvas-stage-color": presentation.color,
                      }}
                    >
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
                              const trackEntries = Object.entries(column)
                                .map(([trackKey, row]) => ({
                                  track: Number(trackKey),
                                  row,
                                }))
                                .sort((left, right) => left.track - right.track);

                              return (
                                <Fragment key={`${stage.id}-column-${columnIndex}`}>
                                  <div
                                    className="estimate-canvas-grid-column"
                                    data-testid={`canvas-column-${toTestIdSegment(stage.id)}-${columnIndex}`}
                                  >
                                    {trackEntries.length ? (
                                      <>
                                        {renderTrackInsertSlot(
                                          stage.id,
                                          columnIndex,
                                          0,
                                          trackEntries[0].track
                                        )}
                                        {trackEntries.map((entry, entryIndex) => (
                                          <Fragment key={`${stage.id}-${columnIndex}-${entry.track}`}>
                                            {renderTrackCard(stage.id, columnIndex, entry.track, entry.row)}
                                            {renderTrackInsertSlot(
                                              stage.id,
                                              columnIndex,
                                              entryIndex + 1,
                                              entry.track + 1
                                            )}
                                          </Fragment>
                                        ))}
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

            <aside className="estimate-canvas-detail-panel">
              {selectedRow ? (
                <>
                  <div className="estimate-canvas-detail-hero">
                    {getRowImageUrl(selectedRow, assemblyLookup) ? (
                      <img
                        className="estimate-canvas-detail-image estimate-canvas-detail-image-photo"
                        src={getRowImageUrl(selectedRow, assemblyLookup)}
                        alt=""
                        loading="lazy"
                      />
                    ) : (
                      <div className="estimate-canvas-detail-image">{getCardIconLabel(selectedRow)}</div>
                    )}
                    <div className="estimate-canvas-detail-title">
                      <h3>{selectedRow.displayName || selectedRow.itemName}</h3>
                      <span>{getCanvasCardMeta(selectedRow) || "Estimate item"}</span>
                    </div>
                  </div>

                  <dl className="estimate-canvas-detail-grid">
                    <div>
                      <dt>Stage</dt>
                      <dd>{getStageName(stages, getRowStageId(selectedRow), selectedRow.stage)}</dd>
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
                    <div>
                      <dt>Trade</dt>
                      <dd>{getTradeName(trades, selectedRow.tradeId, selectedRow.trade)}</dd>
                    </div>
                    <div>
                      <dt>Cost Code</dt>
                      <dd>{getCostCodeName(costCodes, selectedRow.costCodeId, selectedRow.costCode)}</dd>
                    </div>
                    <div>
                      <dt>Cost Summary</dt>
                      <dd>{`$${formatCurrency(selectedRow.total)}`}</dd>
                    </div>
                    <div>
                      <dt>Column</dt>
                      <dd>{board.rowPlacementMap[selectedRow.id]?.columnIndex ?? "-"}</dd>
                    </div>
                    <div>
                      <dt>Track</dt>
                      <dd>{board.rowPlacementMap[selectedRow.id]?.track ?? "-"}</dd>
                    </div>
                  </dl>

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
                </>
              ) : (
                <div className="estimate-canvas-detail-empty">
                  <h3>Select a card</h3>
                  <p>Choose a card to inspect stage, trade, cost, and notes without leaving the board.</p>
                </div>
              )}
            </aside>
        </div>

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
      </div>
    </div>
  );
}

export default EstimateCanvasView;
