import { evaluateFormulaTokens, tokenizeFormula } from "./quantitySources";

function toNumberOrBlank(value) {
  if (value === "" || value == null) {
    return "";
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : "";
}

function roundValue(value) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? Math.round(parsedValue * 100) / 100 : "";
}

export function extractFormulaReferences(formula) {
  const expression = String(formula || "").trim();

  if (!expression) {
    return [];
  }

  const identifiers = tokenizeFormula(expression)
    .filter((token) => token.type === "identifier")
    .map((token) => token.value);

  return [...new Set(identifiers)];
}

export function resolveDerivedParameterOrder(parameters = []) {
  const derivedParameters = parameters.filter(
    (parameter) => parameter.parameterType === "Derived"
  );
  const knownKeys = new Set(parameters.map((parameter) => parameter.key).filter(Boolean));
  const pendingByKey = Object.fromEntries(
    derivedParameters.map((parameter) => [parameter.key, parameter])
  );
  const visiting = new Set();
  const visited = new Set();
  const orderedKeys = [];
  const errors = [];

  const visit = (parameter) => {
    if (!parameter?.key || visited.has(parameter.key)) {
      return;
    }

    if (visiting.has(parameter.key)) {
      errors.push({
        key: parameter.key,
        reason: "Circular dependency",
      });
      return;
    }

    visiting.add(parameter.key);

    extractFormulaReferences(parameter.formula).forEach((referenceKey) => {
      if (!knownKeys.has(referenceKey)) {
        errors.push({
          key: parameter.key,
          reason: `Unknown parameter reference: ${referenceKey}`,
        });
        return;
      }

      if (pendingByKey[referenceKey]) {
        visit(pendingByKey[referenceKey]);
      }
    });

    visiting.delete(parameter.key);
    visited.add(parameter.key);
    orderedKeys.push(parameter.key);
  };

  derivedParameters.forEach(visit);

  return {
    orderedKeys,
    errors,
  };
}

export function evaluateDerivedParameters(parameters = [], values = {}) {
  const parameterMap = Object.fromEntries(parameters.map((parameter) => [parameter.key, parameter]));
  const knownValues = { ...values };
  const results = {};
  const errors = [];
  const { orderedKeys, errors: orderingErrors } = resolveDerivedParameterOrder(parameters);

  errors.push(...orderingErrors);

  orderedKeys.forEach((parameterKey) => {
    const parameter = parameterMap[parameterKey];

    if (!parameter || parameter.parameterType !== "Derived") {
      return;
    }

    if (!String(parameter.formula || "").trim()) {
      results[parameterKey] = "";
      knownValues[parameterKey] = "";
      return;
    }

    try {
      const tokens = tokenizeFormula(parameter.formula);
      const references = extractFormulaReferences(parameter.formula);
      const hasMissingReference = references.some(
        (referenceKey) => knownValues[referenceKey] === "" || knownValues[referenceKey] == null
      );

      if (hasMissingReference) {
        results[parameterKey] = "";
        knownValues[parameterKey] = "";
        return;
      }

      const rawValue = evaluateFormulaTokens(tokens, knownValues);
      const nextValue = roundValue(rawValue);
      results[parameterKey] = toNumberOrBlank(nextValue);
      knownValues[parameterKey] = results[parameterKey];
    } catch (error) {
      errors.push({
        key: parameterKey,
        reason: "Invalid formula",
      });
      results[parameterKey] = "";
      knownValues[parameterKey] = "";
    }
  });

  return {
    values: results,
    errors,
  };
}
