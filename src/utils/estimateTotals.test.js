import {
  calculateEstimateTotals,
  getEstimateRowSubtotal,
  getEstimateSubtotal,
} from "./estimateTotals";

test("getEstimateRowSubtotal prefers quantity times rate for included rows", () => {
  expect(
    getEstimateRowSubtotal({
      quantity: 2,
      unitRate: 125,
      total: 999,
      include: true,
    })
  ).toBe(250);
});

test("getEstimateSubtotal ignores excluded rows", () => {
  expect(
    getEstimateSubtotal([
      { quantity: 2, unitRate: 125, include: true },
      { quantity: 3, unitRate: 50, include: false },
      { total: 40, include: true },
    ])
  ).toBe(290);
});

test("calculateEstimateTotals applies markup and gst", () => {
  expect(
    calculateEstimateTotals({
      rows: [
        { quantity: 2, unitRate: 125, include: true },
        { quantity: 1, rate: 50, include: true },
      ],
      markupPercent: 10,
    })
  ).toMatchObject({
    subtotal: 300,
    markupAmount: 30,
    subtotalWithMarkup: 330,
    gstAmount: 33,
    finalTotal: 363,
  });
});

test("calculateEstimateTotals supports gst disabled and custom rate", () => {
  expect(
    calculateEstimateTotals({
      rows: [{ quantity: 4, unitRate: 50, include: true }],
      markupPercent: "12.5",
      gstEnabled: false,
      gstRate: 0.15,
    })
  ).toMatchObject({
    subtotal: 200,
    markupAmount: 25,
    subtotalWithMarkup: 225,
    gstAmount: 0,
    finalTotal: 225,
  });
});

