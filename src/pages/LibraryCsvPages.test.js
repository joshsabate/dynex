import { render, screen } from "@testing-library/react";
import TradeLibraryPage from "./TradeLibraryPage";
import CostCodeLibraryPage from "./CostCodeLibraryPage";

test("trade library renders csv actions and import modes", () => {
  render(<TradeLibraryPage trades={[]} onTradesChange={() => {}} />);

  expect(screen.getByRole("button", { name: /export csv/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /import csv/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/import mode/i)).toHaveValue("append");
});

test("cost code library renders csv actions and import modes", () => {
  render(<CostCodeLibraryPage costCodes={[]} onCostCodesChange={() => {}} />);

  expect(screen.getByRole("button", { name: /export csv/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /import csv/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/import mode/i)).toHaveValue("append");
});
