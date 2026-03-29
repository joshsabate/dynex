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

function tokenizeFormula(expression) {
  const tokens = [];
  let index = 0;

  while (index < expression.length) {
    const character = expression[index];

    if (/\s/.test(character)) {
      index += 1;
      continue;
    }

    if (/[0-9.]/.test(character)) {
      const startIndex = index;
      let hasDecimalPoint = character === ".";
      index += 1;

      while (index < expression.length) {
        const nextCharacter = expression[index];

        if (/[0-9]/.test(nextCharacter)) {
          index += 1;
          continue;
        }

        if (nextCharacter === "." && !hasDecimalPoint) {
          hasDecimalPoint = true;
          index += 1;
          continue;
        }

        break;
      }

      const value = Number(expression.slice(startIndex, index));

      if (!Number.isFinite(value)) {
        throw new Error("Invalid number");
      }

      tokens.push({ type: "number", value });
      continue;
    }

    if (/[A-Za-z_]/.test(character)) {
      const startIndex = index;
      index += 1;

      while (index < expression.length && /[A-Za-z0-9_]/.test(expression[index])) {
        index += 1;
      }

      tokens.push({
        type: "identifier",
        value: expression.slice(startIndex, index),
      });
      continue;
    }

    if ("+-*/()".includes(character)) {
      tokens.push({ type: "operator", value: character });
      index += 1;
      continue;
    }

    throw new Error("Unsupported token");
  }

  return tokens;
}

function evaluateBinaryOperation(operator, left, right) {
  switch (operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      return right === 0 ? 0 : left / right;
    default:
      throw new Error("Unsupported operator");
  }
}

function evaluateFormulaTokens(tokens, context = {}) {
  let index = 0;

  const parseExpression = () => {
    let value = parseTerm();

    while (index < tokens.length) {
      const token = tokens[index];

      if (token.type !== "operator" || !["+", "-"].includes(token.value)) {
        break;
      }

      index += 1;
      value = evaluateBinaryOperation(token.value, value, parseTerm());
    }

    return value;
  };

  const parseTerm = () => {
    let value = parseFactor();

    while (index < tokens.length) {
      const token = tokens[index];

      if (token.type !== "operator" || !["*", "/"].includes(token.value)) {
        break;
      }

      index += 1;
      value = evaluateBinaryOperation(token.value, value, parseFactor());
    }

    return value;
  };

  const parseFactor = () => {
    const token = tokens[index];

    if (!token) {
      throw new Error("Unexpected end of formula");
    }

    if (token.type === "operator" && token.value === "(") {
      index += 1;
      const value = parseExpression();

      if (tokens[index]?.type !== "operator" || tokens[index]?.value !== ")") {
        throw new Error("Missing closing parenthesis");
      }

      index += 1;
      return value;
    }

    if (token.type === "operator" && ["+", "-"].includes(token.value)) {
      index += 1;
      const factor = parseFactor();
      return token.value === "-" ? -factor : factor;
    }

    if (token.type === "number") {
      index += 1;
      return token.value;
    }

    if (token.type === "identifier") {
      index += 1;
      return toNumber(context[token.value], 0);
    }

    throw new Error("Unexpected token");
  };

  const result = parseExpression();

  if (index !== tokens.length) {
    throw new Error("Unexpected trailing tokens");
  }

  return result;
}

export function evaluateFormula(formula, parameters = {}, derivedMetrics = {}) {
  const expression = String(formula || "").trim();

  if (!expression) {
    return 0;
  }

  try {
    const context = buildFormulaContext(parameters, derivedMetrics);
    const tokens = tokenizeFormula(expression);
    return toNumber(evaluateFormulaTokens(tokens, context), 0);
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
