import { useMemo, useState } from "react";
import LineSheetItems from "./LineSheetItems";

const GROUP_LABELS = {
  section: "Section",
  room: "Room",
  stage: "Stage",
};

function formatCurrency(value) {
  return Number(value || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function PresentationGroup({ group, mode, showItemTotals }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <section className="estimate-presentation-group">
      <button
        type="button"
        className="estimate-presentation-group__header"
        onClick={() => setIsCollapsed((current) => !current)}
      >
        <span>
          <strong>{group.label}</strong>
          <small>{group.itemCount} items</small>
        </span>
        <span>{formatCurrency(group.subtotal)}</span>
      </button>
      {!isCollapsed && group.items.length ? (
        <div className="estimate-presentation-group__body">
          {group.items.map((item) => (
            <article key={item.id} className="estimate-presentation-item">
              <div>
                <h4>{item.title}</h4>
                {item.description ? <p>{item.description}</p> : null}
                <div className="estimate-presentation-item__meta">
                  {Number.isFinite(item.quantity) ? (
                    <span>
                      Qty {item.quantity} {item.unit}
                    </span>
                  ) : null}
                  {item.roomName ? <span>{item.roomName}</span> : null}
                  {item.stageName ? <span>{item.stageName}</span> : null}
                </div>
              </div>
              {mode === "internal" && showItemTotals ? (
                <div className="estimate-presentation-item__values">
                  {item.unitRate !== null && item.unitRate !== undefined ? (
                    <span>{formatCurrency(item.unitRate)}</span>
                  ) : null}
                  {item.total !== null && item.total !== undefined ? (
                    <strong>{formatCurrency(item.total)}</strong>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function EstimatePresentationView({ model, clientControls }) {
  const summaryCards = useMemo(
    () => [
      { label: "Subtotal", value: model?.totals?.subtotal },
      { label: "Markup", value: model?.totals?.markupAmount },
      {
        label: model?.totals?.gstEnabled ? "GST" : "GST Off",
        value: model?.totals?.gstAmount,
      },
      { label: "Final Total", value: model?.totals?.finalTotal },
    ],
    [model]
  );

  if (!model) {
    return null;
  }

  const visibility = model.visibility || {};
  const showClientToolbar = model.mode === "client" && clientControls;
  const groupingOptions = clientControls?.allowedGroupings || [];
  const layoutIsLineSheet = model.mode === "client" && model.layout === "line_sheet";
  const showSummaryTotals = visibility.showSummaryTotals !== false;
  const showGroupTotals = visibility.showGroupTotals !== false;
  const showItemTotals = visibility.showItemTotals !== false;

  return (
    <div className="estimate-presentation">
      <header className="estimate-presentation-hero">
        <div>
          <p className="estimate-presentation-hero__kicker">
            {model.mode === "client" ? "Client Presentation" : "Internal Estimate Presentation"}
          </p>
          <h2>{model.project.estimateName || model.project.projectName || "Untitled Estimate"}</h2>
          <div className="estimate-presentation-hero__meta">
            {model.project.clientName ? <span>{model.project.clientName}</span> : null}
            {model.project.projectAddress ? <span>{model.project.projectAddress}</span> : null}
            {model.project.revision ? <span>{model.project.revision}</span> : null}
          </div>
        </div>
        <div className="estimate-presentation-hero__badge">{model.groupBy}</div>
      </header>

      {showClientToolbar ? (
        <section className="estimate-presentation-toolbar">
          <div>
            <span>Group by</span>
            <select
              value={clientControls.groupBy || model.groupBy}
              onChange={(event) => clientControls.onGroupChange?.(event.target.value)}
              disabled={!clientControls.allowGroupingSwitch}
            >
              {groupingOptions.map((option) => (
                <option key={option} value={option}>
                  {GROUP_LABELS[option] || option}
                </option>
              ))}
            </select>
          </div>
        </section>
      ) : null}

        {showSummaryTotals ? (
          <section className="estimate-presentation-summary">
            {summaryCards.map((card) => (
              <article key={card.label} className="estimate-presentation-summary__card">
                <span>{card.label}</span>
                <strong>{formatCurrency(card.value)}</strong>
              </article>
            ))}
          </section>
        ) : null}

      {model.groups.length ? (
        <div
          className={
            layoutIsLineSheet
              ? "estimate-presentation-line-sheet"
              : "estimate-presentation-groups"
          }
        >
          {model.groups.map((group) => (
            <section key={group.key} className="estimate-presentation-group">
              <header className="estimate-presentation-group__header">
                <span>
                  <strong>{group.label}</strong>
                  <small>{group.itemCount} items</small>
                </span>
                {showGroupTotals ? <span>{formatCurrency(group.subtotal)}</span> : null}
              </header>
              {layoutIsLineSheet ? (
                <LineSheetItems items={group.items} />
              ) : (
                <div className="estimate-presentation-group__body">
                  {group.items.map((item) => (
                    <PresentationGroup
                      key={item.id}
                      group={{ ...group, items: [item] }}
                      mode={model.mode}
                      showItemTotals={showItemTotals}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      ) : (
        <section className="estimate-presentation-empty">
          <strong>Summary only</strong>
          <p>This presentation is configured to show totals without line items.</p>
        </section>
      )}
    </div>
  );
}

export default EstimatePresentationView;
