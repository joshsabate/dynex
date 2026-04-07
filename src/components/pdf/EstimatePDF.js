import { useEffect } from "react";
import LineSheetItems from "../presentation/LineSheetItems";

function formatCurrency(value) {
  return Number(value || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function EstimatePDF({ model }) {
  if (!model) {
    return null;
  }

  const layoutIsLineSheet = model.layout === "line_sheet";
  const visibility = model.visibility || {};
  const showSummaryTotals = visibility.showSummaryTotals !== false;
  const showGroupTotals = visibility.showGroupTotals !== false;
  const showItemTotals = visibility.showItemTotals !== false;

  return (
    <div className="estimate-pdf">
      <section className="estimate-pdf-page estimate-pdf-page--cover">
        <p className="estimate-pdf-kicker">
          {model.mode === "client" ? "Client Estimate" : "Internal Estimate"}
        </p>
        <h1>{model.project.estimateName || model.project.projectName || "Untitled Estimate"}</h1>
        <dl className="estimate-pdf-meta">
          <div>
            <dt>Project</dt>
            <dd>{model.project.projectName || "Untitled Project"}</dd>
          </div>
          <div>
            <dt>Client</dt>
            <dd>{model.project.clientName || "Not provided"}</dd>
          </div>
          <div>
            <dt>Revision</dt>
            <dd>{model.project.revision || "Rev 0"}</dd>
          </div>
          <div>
            <dt>Group By</dt>
            <dd>{model.groupBy}</dd>
          </div>
        </dl>
      </section>

      {showSummaryTotals ? (
        <section className="estimate-pdf-page">
          <h2>Summary</h2>
          <div className="estimate-pdf-summary">
            <article>
              <span>Subtotal</span>
              <strong>{formatCurrency(model.totals.subtotal)}</strong>
            </article>
            <article>
              <span>Markup</span>
              <strong>{formatCurrency(model.totals.markupAmount)}</strong>
            </article>
            <article>
              <span>GST</span>
              <strong>{formatCurrency(model.totals.gstAmount)}</strong>
            </article>
            <article>
              <span>Total</span>
              <strong>{formatCurrency(model.totals.finalTotal)}</strong>
            </article>
          </div>
        </section>
      ) : null}

      {model.groups.map((group) => (
        <section key={group.key} className="estimate-pdf-page">
          <header className="estimate-pdf-group-header">
            <h2>{group.label}</h2>
            {showGroupTotals ? <strong>{formatCurrency(group.subtotal)}</strong> : null}
          </header>
          {group.items.length ? (
            layoutIsLineSheet ? (
              <div className="estimate-pdf-items">
                <LineSheetItems items={group.items} className="estimate-pdf-line-sheet" />
              </div>
            ) : (
              <div className="estimate-pdf-items">
                {group.items.map((item) => (
                  <article key={item.id} className="estimate-pdf-item">
                    <div>
                      <h3>{item.title}</h3>
                      {item.description ? <p>{item.description}</p> : null}
                      {Number.isFinite(item.quantity) ? (
                        <span>
                          Qty {item.quantity} {item.unit}
                        </span>
                      ) : null}
                    </div>
                    {model.mode === "internal" && showItemTotals ? (
                      <div className="estimate-pdf-item-values">
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
            )
          ) : (
            <p className="estimate-pdf-group-note">Summary only for this group.</p>
          )}
        </section>
      ))}
    </div>
  );
}

export function EstimatePDFPrintLayer({ job, onComplete = () => {}, onError = () => {} }) {
  useEffect(() => {
    if (!job || typeof document === "undefined" || typeof window === "undefined") {
      return undefined;
    }

    if (typeof window.print !== "function") {
      onError("Print is not available in this browser.");
      return undefined;
    }

    const originalTitle = document.title;
    let isFinished = false;
    let printTimeoutId = null;
    let focusTimeoutId = null;

    const finish = () => {
      if (isFinished) {
        return;
      }

      isFinished = true;
      document.body.classList.remove("estimate-pdf-print-active");
      document.title = originalTitle;
      if (printTimeoutId) {
        window.clearTimeout(printTimeoutId);
      }
      if (focusTimeoutId) {
        window.clearTimeout(focusTimeoutId);
      }
      window.removeEventListener("afterprint", handleAfterPrint);
      window.removeEventListener("focus", handleFocus);
      onComplete();
    };

    const handleAfterPrint = () => {
      focusTimeoutId = window.setTimeout(finish, 0);
    };

    const handleFocus = () => {
      focusTimeoutId = window.setTimeout(finish, 300);
    };

    document.title = job.title || originalTitle;
    document.body.classList.add("estimate-pdf-print-active");
    window.addEventListener("afterprint", handleAfterPrint);
    window.addEventListener("focus", handleFocus);

    printTimeoutId = window.setTimeout(() => {
      try {
        window.print();
      } catch (error) {
        document.body.classList.remove("estimate-pdf-print-active");
        document.title = originalTitle;
        onError(error?.message || "Unable to start printing.");
        finish();
      }
    }, 80);

    return () => {
      finish();
    };
  }, [job, onComplete, onError]);

  if (!job?.model) {
    return null;
  }

  return (
    <div className="estimate-pdf-print-root" aria-hidden="true">
      <EstimatePDF model={job.model} />
    </div>
  );
}
