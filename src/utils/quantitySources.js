function toNumber(value, fallback = 0) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function roundValue(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

function buildFormulaContext(parameters = {}, derivedMetrics = {}) {
  return {
    ...derivedMetrics,
    ...parameters,
  };
}

function evaluateFormula(formula, parameters = {}, derivedMetrics = {}) {
  const expression = String(formula || "").trim();

  if (!expression) {
    return 0;
  }

  try {
    const context = buildFormulaContext(parameters, derivedMetrics);
    const evaluator = new Function(
      "context",
      `with (context) { return (${expression}); }`
    );

    return toNumber(evaluator(context), 0);
  } catch (error) {
    return 0;
  }
}

export function resolveQuantitySource(line = {}, parameters = {}, derivedMetrics = {}) {
  switch (line.quantitySourceType) {
    case "parameter":
      return roundValue(parameters[line.parameterKey] ?? 0);
    case "derivedMetric":
      return roundValue(derivedMetrics[line.derivedMetricKey] ?? 0);
    case "formula":
      return roundValue(evaluateFormula(line.formula, parameters, derivedMetrics));
    case "fixed":
    default:
      return roundValue(line.fixedQty ?? line.quantity ?? 0);
  }
}
