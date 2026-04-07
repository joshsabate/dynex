import React from "react";

function LineSheetItems({ items, className = "" }) {
  if (!items || !items.length) {
    return null;
  }

  const containerClassName = ["estimate-line-sheet", className].filter(Boolean).join(" ");

  return (
    <div className={containerClassName}>
      {items.map((item) => {
        const detailText = (item.supportingDetailParts || []).join(" · ");
        const quantityText =
          typeof item.quantityDisplay === "number" && !Number.isNaN(item.quantityDisplay)
            ? `Qty ${item.quantityDisplay}`
            : null;

        return (
          <article key={item.id} className="estimate-line-sheet-item">
            <div className="estimate-line-sheet-main">
              <strong>{item.primaryLabel || item.title}</strong>
              {(quantityText || item.unitDisplay) ? (
                <span className="estimate-line-sheet-meta">
                  {quantityText}
                  {quantityText && item.unitDisplay ? " · " : ""}
                  {item.unitDisplay}
                </span>
              ) : null}
            </div>
            {detailText ? (
              <p className="estimate-line-sheet-details">{detailText}</p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

export default LineSheetItems;
