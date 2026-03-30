import { sortManagedParameters } from "./parameters";

export function getQuantityFormulaOptions(parameters = []) {
  return sortManagedParameters(parameters)
    .filter((parameter) => parameter.key)
    .map((parameter) => ({
      value: parameter.key,
      label: parameter.label || parameter.key,
      unit: parameter.unit || "",
      description: parameter.description || "",
      source: "Parameter Library",
    }));
}

export function buildQuantityFormula(baseParameter, operator = "*", factor = "") {
  const base = String(baseParameter || "").trim();
  const nextFactor = String(factor || "").trim();

  if (!base) {
    return "";
  }

  if (!nextFactor) {
    return base;
  }

  return `${base} ${operator || "*"} ${nextFactor}`;
}

export function parseQuantityFormula(formula, availableParameterKeys = []) {
  const expression = String(formula || "").trim();
  const availableKeys = new Set(availableParameterKeys);

  if (!expression) {
    return {
      baseParameter: "",
      operator: "*",
      factor: "",
      isGuided: true,
    };
  }

  const match = expression.match(
    /^([A-Za-z_][A-Za-z0-9_]*)\s*(?:(\*|\/|\+|-)\s*(-?\d+(?:\.\d+)?))?$/
  );

  if (!match) {
    return {
      baseParameter: "",
      operator: "*",
      factor: "",
      isGuided: false,
    };
  }

  const [, baseParameter, operator = "*", factor = ""] = match;

  if (availableKeys.size && !availableKeys.has(baseParameter)) {
    return {
      baseParameter: "",
      operator: "*",
      factor: "",
      isGuided: false,
    };
  }

  return {
    baseParameter,
    operator,
    factor,
    isGuided: true,
  };
}
