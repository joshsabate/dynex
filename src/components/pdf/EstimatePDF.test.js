import { act, render, screen } from "@testing-library/react";
import { EstimatePDFPrintLayer } from "./EstimatePDF";

const model = {
  mode: "client",
  groupBy: "section",
  project: {
    estimateName: "Sample Estimate",
    projectName: "Sample Project",
    clientName: "Sample Client",
    revision: "Rev 1",
  },
  totals: {
    subtotal: 1000,
    markupAmount: 100,
    gstAmount: 110,
    finalTotal: 1210,
  },
  groups: [
    {
      key: "section:main",
      label: "Main Works",
      subtotal: 1000,
      items: [
        {
          id: "item-1",
          title: "Joinery package",
          description: "Full joinery scope",
          quantity: 1,
          unit: "EA",
        },
      ],
    },
  ],
};

beforeEach(() => {
  jest.useFakeTimers();
  window.print = jest.fn();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  document.body.classList.remove("estimate-pdf-print-active");
});

test("EstimatePDFPrintLayer renders estimate content and starts in-page printing", () => {
  const onComplete = jest.fn();

  render(
    <EstimatePDFPrintLayer
      job={{ id: "print-1", model, title: "Sample Estimate" }}
      onComplete={onComplete}
    />
  );

  expect(screen.getByText("Sample Estimate")).toBeInTheDocument();
  expect(document.body).toHaveClass("estimate-pdf-print-active");

  act(() => {
    jest.advanceTimersByTime(100);
  });

  expect(window.print).toHaveBeenCalledTimes(1);

  act(() => {
    window.dispatchEvent(new Event("afterprint"));
    jest.runOnlyPendingTimers();
  });

  expect(onComplete).toHaveBeenCalled();
  expect(document.body).not.toHaveClass("estimate-pdf-print-active");
});

