import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDefaultStageId, getStageIntegrity } from "../utils/stageIntegrity";

const defaultWeekCount = 16;
const timelineDragThreshold = 4;

function cleanText(value) {
  return String(value || "").trim();
}

function toNumberOrNull(value) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function clampWeek(value, weekCount) {
  return Math.max(1, Math.min(weekCount, Number(value) || 1));
}

function clampDuration(value, startWeek, weekCount) {
  const maxDuration = Math.max(1, weekCount - startWeek + 1);
  return Math.max(1, Math.min(maxDuration, Number(value) || 1));
}

function getRowLabel(row) {
  return cleanText(row.displayName || row.itemName || "Untitled item");
}

function getRowAssignment(row) {
  return cleanText(row.assignedTo || row.assignment || row.roomName || "");
}

function buildWeekRange(weekCount = defaultWeekCount) {
  return Array.from({ length: weekCount }, (_, index) => index + 1);
}

function getRowSchedule(row) {
  const plannedStartWeek = toNumberOrNull(row.plannedStartWeek);
  const plannedDurationWeeks = toNumberOrNull(row.plannedDurationWeeks);

  if (
    plannedStartWeek == null ||
    plannedDurationWeeks == null ||
    plannedStartWeek < 1 ||
    plannedDurationWeeks < 1
  ) {
    return {
      plannedStartWeek: null,
      plannedDurationWeeks: null,
      plannedEndWeek: null,
      isScheduled: false,
    };
  }

  return {
    plannedStartWeek,
    plannedDurationWeeks,
    plannedEndWeek: plannedStartWeek + plannedDurationWeeks - 1,
    isScheduled: true,
  };
}

function buildTimelineGroups(rows, stages, weekCount) {
  const activeStages = [...stages]
    .filter((stage) => stage.isActive !== false)
    .sort(
      (left, right) =>
        Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) ||
        String(left.name || "").localeCompare(String(right.name || ""))
    );
  const defaultStageId = getDefaultStageId(activeStages);
  const knownStageIds = new Set(activeStages.map((stage) => stage.id));
  const groups = new Map(
    activeStages.map((stage) => [
      stage.id,
      {
        id: stage.id,
        label: stage.name,
        sortOrder: Number(stage.sortOrder ?? 0),
        rows: [],
      },
    ])
  );

  rows.forEach((row) => {
    const integrity = getStageIntegrity(row.stageId, activeStages, row.stage, { defaultStageId });
    const fallbackStageId = integrity.stageId && knownStageIds.has(integrity.stageId) ? integrity.stageId : "";
    const groupId = fallbackStageId || "__timeline-unassigned__";

    if (!groups.has(groupId)) {
      groups.set(groupId, {
        id: groupId,
        label: fallbackStageId ? integrity.stageName : "Unassigned",
        sortOrder: fallbackStageId
          ? Number(activeStages.find((stage) => stage.id === fallbackStageId)?.sortOrder ?? Number.MAX_SAFE_INTEGER)
          : Number.MAX_SAFE_INTEGER,
        rows: [],
      });
    }

    const schedule = getRowSchedule(row);
    groups.get(groupId).rows.push({
      ...row,
      resolvedStageId: fallbackStageId,
      resolvedStageName: fallbackStageId ? integrity.stageName : "Unassigned",
      assignmentLabel: getRowAssignment(row),
      timelineLabel: getRowLabel(row),
      schedule,
      visibleStartWeek: schedule.isScheduled ? Math.max(1, schedule.plannedStartWeek) : null,
      visibleEndWeek: schedule.isScheduled ? Math.min(weekCount, schedule.plannedEndWeek) : null,
    });
  });

  return [...groups.values()]
    .filter((group) => group.rows.length)
    .map((group) => ({
      ...group,
      rows: [...group.rows].sort(
        (left, right) =>
          Number(left.schedule.plannedStartWeek ?? Number.MAX_SAFE_INTEGER) -
            Number(right.schedule.plannedStartWeek ?? Number.MAX_SAFE_INTEGER) ||
          Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) ||
          getRowLabel(left).localeCompare(getRowLabel(right))
      ),
    }))
    .sort(
      (left, right) =>
        Number(left.sortOrder ?? Number.MAX_SAFE_INTEGER) - Number(right.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
        String(left.label).localeCompare(String(right.label))
    );
}

function EstimateTimelineView({ estimateName = "", rows = [], stages = [], onRowChange = () => {} }) {
  const [weekCount] = useState(defaultWeekCount);
  const [dragState, setDragState] = useState({
    rowId: "",
    mode: "",
    active: false,
  });
  const dragStateRef = useRef({
    rowId: "",
    mode: "",
    pointerId: null,
    startClientX: 0,
    startWeek: 0,
    startDuration: 0,
    active: false,
  });
  const weekRange = useMemo(() => buildWeekRange(weekCount), [weekCount]);
  const timelineGroups = useMemo(
    () => buildTimelineGroups(rows, stages, weekCount),
    [rows, stages, weekCount]
  );
  const scheduledRowCount = useMemo(
    () =>
      timelineGroups.reduce(
        (total, group) => total + group.rows.filter((row) => row.schedule.isScheduled).length,
        0
      ),
    [timelineGroups]
  );
  const unscheduledRowCount = useMemo(
    () =>
      timelineGroups.reduce(
        (total, group) => total + group.rows.filter((row) => !row.schedule.isScheduled).length,
        0
      ),
    [timelineGroups]
  );
  const rowLookup = useMemo(
    () => Object.fromEntries(rows.map((row) => [row.id, row])),
    [rows]
  );

  const updateRowSchedule = useCallback(
    (rowId, nextStartWeek, nextDurationWeeks) => {
      const row = rowLookup[rowId];

      if (!row) {
        return;
      }

      if (nextStartWeek === "" || nextDurationWeeks === "") {
        onRowChange(rowId, {
          plannedStartWeek: nextStartWeek,
          plannedDurationWeeks: nextDurationWeeks,
        });
        return;
      }

      const clampedStartWeek = clampWeek(nextStartWeek, weekCount);
      const clampedDurationWeeks = clampDuration(nextDurationWeeks, clampedStartWeek, weekCount);

      if (
        Number(row.plannedStartWeek || 0) === clampedStartWeek &&
        Number(row.plannedDurationWeeks || 0) === clampedDurationWeeks
      ) {
        return;
      }

      onRowChange(rowId, {
        plannedStartWeek: clampedStartWeek,
        plannedDurationWeeks: clampedDurationWeeks,
      });
    },
    [onRowChange, rowLookup, weekCount]
  );

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!dragStateRef.current.rowId) {
        return;
      }

      const deltaX = event.clientX - dragStateRef.current.startClientX;

      if (!dragStateRef.current.active && Math.abs(deltaX) < timelineDragThreshold) {
        return;
      }

      dragStateRef.current.active = true;
      setDragState((current) => ({ ...current, active: true }));
      const deltaWeeks = Math.round(deltaX / 56);

      if (dragStateRef.current.mode === "move") {
        const nextStartWeek = clampWeek(dragStateRef.current.startWeek + deltaWeeks, weekCount);
        updateRowSchedule(
          dragStateRef.current.rowId,
          nextStartWeek,
          dragStateRef.current.startDuration
        );
        return;
      }

      if (dragStateRef.current.mode === "resize-end") {
        const nextDuration = clampDuration(
          dragStateRef.current.startDuration + deltaWeeks,
          dragStateRef.current.startWeek,
          weekCount
        );
        updateRowSchedule(
          dragStateRef.current.rowId,
          dragStateRef.current.startWeek,
          nextDuration
        );
      }
    };

    const handlePointerUp = () => {
      dragStateRef.current = {
        rowId: "",
        mode: "",
        pointerId: null,
        startClientX: 0,
        startWeek: 0,
        startDuration: 0,
        active: false,
      };
      setDragState({
        rowId: "",
        mode: "",
        active: false,
      });
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, [updateRowSchedule, weekCount]);

  const handleScheduleFieldChange = useCallback(
    (rowId, key, value) => {
      const row = rowLookup[rowId];

      if (!row) {
        return;
      }

      const rawValue = String(value || "").trim();

      if (key === "plannedStartWeek") {
        if (!rawValue) {
          onRowChange(rowId, { plannedStartWeek: "" });
          return;
        }

        updateRowSchedule(rowId, rawValue, row.plannedDurationWeeks || 1);
        return;
      }

      if (key === "plannedDurationWeeks") {
        if (!rawValue) {
          onRowChange(rowId, { plannedDurationWeeks: "" });
          return;
        }

        updateRowSchedule(rowId, row.plannedStartWeek || 1, rawValue);
      }
    },
    [onRowChange, rowLookup, updateRowSchedule]
  );

  const beginScheduleDrag = useCallback((row, mode, event) => {
    if (!row?.schedule?.isScheduled) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    dragStateRef.current = {
      rowId: row.id,
      mode,
      pointerId: event.pointerId ?? null,
      startClientX: event.clientX,
      startWeek: row.schedule.plannedStartWeek,
      startDuration: row.schedule.plannedDurationWeeks,
      active: false,
    };
    setDragState({
      rowId: row.id,
      mode,
      active: false,
    });
  }, []);

  return (
    <div className="estimate-timeline-layout">
      <div className="estimate-timeline-shell">
        <div className="estimate-timeline-utility-row">
          <h2 className="estimate-workspace-view-label">Timeline View</h2>
          <div className="estimate-timeline-summary">
            <span>{`${rows.length} rows`}</span>
            <span>{`${scheduledRowCount} scheduled`}</span>
            <span>{`${unscheduledRowCount} unscheduled`}</span>
            <span>{`Weeks 1-${weekCount}`}</span>
          </div>
        </div>

        <div className="estimate-timeline-frame" data-testid="timeline-view">
          <div className="estimate-timeline-main">
            <div className="estimate-timeline-grid-header">
              <div className="estimate-timeline-left-header">
                <span>Item</span>
                <span>Stage</span>
                <span>Assigned To</span>
              </div>

              <div
                className="estimate-timeline-week-header"
                style={{ "--timeline-week-count": weekRange.length }}
              >
                {weekRange.map((weekNumber) => (
                  <div
                    key={`timeline-week-${weekNumber}`}
                    className="estimate-timeline-week-cell"
                    data-testid={`timeline-week-${weekNumber}`}
                  >
                    {`W${weekNumber}`}
                  </div>
                ))}
              </div>
            </div>

            {timelineGroups.length ? (
              timelineGroups.map((group) => (
                <section
                  key={group.id}
                  className="estimate-timeline-group"
                  data-testid={`timeline-group-${group.id}`}
                >
                  <div className="estimate-timeline-group-header">
                    <strong>{group.label}</strong>
                    <span>{`${group.rows.length} items`}</span>
                  </div>

                  <div className="estimate-timeline-group-body">
                    {group.rows.map((row) => (
                      <div
                        key={row.id}
                        className="estimate-timeline-row"
                        data-testid={`timeline-row-${row.id}`}
                      >
                          <div className="estimate-timeline-row-meta">
                            <div className="estimate-timeline-row-meta-primary">
                              <strong>{row.timelineLabel}</strong>
                              <div className="estimate-timeline-row-controls">
                                <label>
                                  <span>Start</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max={weekCount}
                                    value={row.schedule.plannedStartWeek ?? ""}
                                    onChange={(event) =>
                                      handleScheduleFieldChange(
                                        row.id,
                                        "plannedStartWeek",
                                        event.target.value
                                      )
                                    }
                                    aria-label={`Planned start week for ${row.timelineLabel}`}
                                  />
                                </label>
                                <label>
                                  <span>Duration</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max={weekCount}
                                    value={row.schedule.plannedDurationWeeks ?? ""}
                                    onChange={(event) =>
                                      handleScheduleFieldChange(
                                        row.id,
                                        "plannedDurationWeeks",
                                        event.target.value
                                      )
                                    }
                                    aria-label={`Planned duration weeks for ${row.timelineLabel}`}
                                  />
                                </label>
                              </div>
                            </div>
                            <span>{row.resolvedStageName || "Unassigned"}</span>
                            <span>{row.assignmentLabel || "Unassigned"}</span>
                            {!row.schedule.isScheduled ? (
                              <span className="estimate-timeline-unscheduled-pill">Unscheduled</span>
                            ) : null}
                          </div>

                          <div
                            className="estimate-timeline-row-grid"
                            style={{ "--timeline-week-count": weekRange.length }}
                          >
                            {weekRange.map((weekNumber) => (
                              <div
                                key={`${row.id}-week-${weekNumber}`}
                                className="estimate-timeline-row-cell"
                              />
                            ))}

                            {row.schedule.isScheduled &&
                            row.visibleStartWeek != null &&
                            row.visibleEndWeek != null &&
                            row.visibleEndWeek >= row.visibleStartWeek ? (
                              <div
                                className={[
                                  "estimate-timeline-bar",
                                  dragState.rowId === row.id && dragState.mode === "move" ? "is-active" : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                data-testid={`timeline-bar-${row.id}`}
                                style={{
                                  gridColumn: `${row.visibleStartWeek} / ${row.visibleEndWeek + 1}`,
                                }}
                                onPointerDown={(event) => beginScheduleDrag(row, "move", event)}
                                onMouseDown={(event) => beginScheduleDrag(row, "move", event)}
                              >
                                <span>{`${row.schedule.plannedStartWeek}-${row.schedule.plannedEndWeek}`}</span>
                                <button
                                  type="button"
                                  className={[
                                    "estimate-timeline-bar-handle",
                                    dragState.rowId === row.id && dragState.mode === "resize-end"
                                      ? "is-active"
                                      : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                  aria-label={`Resize duration for ${row.timelineLabel}`}
                                  onPointerDown={(event) => beginScheduleDrag(row, "resize-end", event)}
                                  onMouseDown={(event) => beginScheduleDrag(row, "resize-end", event)}
                                />
                              </div>
                            ) : null}
                          </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <div className="estimate-timeline-empty">
                <h3>No rows available</h3>
                <p>Builder and Canvas rows will appear here automatically once the estimate has items.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EstimateTimelineView;
