function toFiniteNumber(value, fallback = 0) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

export function roundCurrency(value) {
  return Math.round(toFiniteNumber(value, 0) * 100) / 100;
}

export function getEstimateRowSubtotal(row = {}) {
  if (row.include === false) {
    return 0;
  }

  const quantity = Number(row.quantity);
  const rate = Number(row.unitRate ?? row.rate);

  if (Number.isFinite(quantity) && Number.isFinite(rate)) {
    return roundCurrency(quantity * rate);
  }

  const total = Number(row.total);
  return Number.isFinite(total) ? roundCurrency(total) : 0;
}

export function getEstimateSubtotal(rows = []) {
  return roundCurrency(
    (rows || []).reduce((subtotal, row) => subtotal + getEstimateRowSubtotal(row), 0)
  );
}

export function calculateEstimateTotals({
  rows = [],
  markupPercent = 0,
  gstEnabled = true,
  gstRate = 0.1,
} = {}) {
  const subtotal = getEstimateSubtotal(rows);
  const normalizedMarkupPercent = Math.max(0, toFiniteNumber(markupPercent, 0));
  const normalizedGstRate = Math.max(0, toFiniteNumber(gstRate, 0.1));
  const markupAmount = roundCurrency(subtotal * (normalizedMarkupPercent / 100));
  const subtotalWithMarkup = roundCurrency(subtotal + markupAmount);
  const gstAmount = gstEnabled ? roundCurrency(subtotalWithMarkup * normalizedGstRate) : 0;
  const finalTotal = roundCurrency(subtotalWithMarkup + gstAmount);

  return {
    subtotal,
    markupPercent: normalizedMarkupPercent,
    markupAmount,
    subtotalWithMarkup,
    gstEnabled: Boolean(gstEnabled),
    gstRate: normalizedGstRate,
    gstAmount,
    finalTotal,
  };
}

