import { useRef, useState } from "react";
import DataTable from "../components/DataTable";
import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";
import { applyImportMode, convertTradesToCSV, parseTradeCsv } from "../utils/csvUtils";

const defaultForm = {
  name: "",
  description: "",
  status: "Active",
  sortOrder: "1",
  isActive: true,
};

function TradeLibraryPage({ trades, onTradesChange }) {
  const importFileInputRef = useRef(null);
  const [form, setForm] = useState(defaultForm);
  const [csvStatus, setCsvStatus] = useState("");
  const [importMode, setImportMode] = useState("append");

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const addTrade = (event) => {
    event.preventDefault();
    if (!form.name) {
      return;
    }

    onTradesChange([
      ...trades,
      {
        id: `trade-${Date.now()}`,
        name: form.name,
        description: form.description,
        status: form.status,
        sortOrder: Number(form.sortOrder),
        isActive: Boolean(form.isActive),
      },
    ]);

    setForm((current) => ({
      ...defaultForm,
      sortOrder: current.sortOrder,
    }));
  };

  const updateTrade = (tradeId, key, value) => {
    onTradesChange(
      trades.map((trade) =>
        trade.id === tradeId
          ? {
              ...trade,
              [key]: key === "sortOrder" ? Number(value) : value,
            }
          : trade
      )
    );
  };

  const removeTrade = (tradeId) => {
    onTradesChange(trades.filter((trade) => trade.id !== tradeId));
  };

  const exportTradesAsCsv = () => {
    if (typeof window === "undefined") {
      return;
    }
    const csvText = convertTradesToCSV(trades);
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "trade-library.csv";
    link.click();
    window.URL.revokeObjectURL(url);
    setCsvStatus(`Exported ${trades.length} trades.`);
  };

  const importTradesFromCsv = async (file) => {
    if (!file) {
      return;
    }
    try {
      const { rows, skippedRows } = parseTradeCsv(await file.text());
      const mergeResult = applyImportMode({
        existingItems: trades,
        importedItems: rows,
        mode: importMode,
        getMatchKey: (existing, incoming) =>
          String(existing.name || "").trim().toLowerCase() ===
          String(incoming.name || "").trim().toLowerCase(),
        shouldConfirmOverride: () =>
          typeof window === "undefined" ||
          window.confirm("Override all existing Trade Library items with the imported CSV?"),
      });
      if (!mergeResult) {
        return;
      }
      onTradesChange(mergeResult.items);
      setCsvStatus(
        `${mergeResult.summary.added} added, ${mergeResult.summary.replaced} replaced, ${
          skippedRows + mergeResult.summary.skipped
        } skipped.`
      );
    } catch (error) {
      setCsvStatus("Import failed. Check the CSV format and try again.");
    }
  };

  const sortedTrades = [...trades].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
  );

  return (
    <SectionCard
      title="Trade Library"
      description="Manage office estimating trades and their order. Assemblies reference this list instead of free-typed trade names."
    >
      <div className="page-grid library-page library-page-trades">
        <form className="library-form-card" onSubmit={addTrade}>
          <div className="library-form-actions library-form-actions-top">
            <button type="button" className="secondary-button" onClick={exportTradesAsCsv}>
              Export CSV
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => importFileInputRef.current?.click()}
            >
              Import CSV
            </button>
            <input
              ref={importFileInputRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              aria-label="Import Trade CSV"
              onChange={(event) => {
                const [file] = event.target.files || [];
                importTradesFromCsv(file);
                event.target.value = "";
              }}
            />
          </div>
          <div className="library-form-grid">
            <div className="library-form-medium">
              <FormField label="Import mode">
                <select value={importMode} onChange={(event) => setImportMode(event.target.value)}>
                  <option value="append">Append</option>
                  <option value="override">Override All</option>
                  <option value="replace">Replace Duplicates</option>
                </select>
              </FormField>
            </div>
          </div>
          {csvStatus ? <p className="assembly-library-status">{csvStatus}</p> : null}
          <div className="library-form-grid">
            <div className="library-form-span-2">
              <FormField label="Trade name">
                <input
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Tile"
                />
              </FormField>
            </div>

            <div className="library-form-span-2">
              <FormField label="Description">
                <input
                  value={form.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  placeholder="Optional"
                />
              </FormField>
            </div>

            <div className="library-form-medium">
              <FormField label="Status">
                <input
                  value={form.status}
                  onChange={(event) => updateField("status", event.target.value)}
                  placeholder="Active"
                />
              </FormField>
            </div>

            <div className="library-form-narrow">
              <FormField label="Sort order">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.sortOrder}
                  onChange={(event) => updateField("sortOrder", event.target.value)}
                />
              </FormField>
            </div>

            <div className="library-form-narrow">
              <FormField label="Active">
                <select
                  value={String(form.isActive)}
                  onChange={(event) => updateField("isActive", event.target.value === "true")}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </FormField>
            </div>
          </div>

          <div className="action-row library-form-actions">
            <button type="submit" className="primary-button">
              Add trade
            </button>
          </div>
        </form>

        <div className="library-table-panel">
          <DataTable
            columns={[
              {
                key: "name",
                header: "Trade",
                className: "table-col-wide",
                render: (row) => (
                  <input
                    value={row.name}
                    onChange={(event) => updateTrade(row.id, "name", event.target.value)}
                  />
                ),
              },
              {
                key: "description",
                header: "Description",
                className: "table-col-wide",
                render: (row) => (
                  <input
                    value={row.description || ""}
                    onChange={(event) => updateTrade(row.id, "description", event.target.value)}
                  />
                ),
              },
              {
                key: "status",
                header: "Status",
                className: "table-col-medium",
                render: (row) => (
                  <input
                    value={row.status || ""}
                    onChange={(event) => updateTrade(row.id, "status", event.target.value)}
                  />
                ),
              },
              {
                key: "sortOrder",
                header: "Sort",
                className: "table-col-number",
                render: (row) => (
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={row.sortOrder}
                    onChange={(event) => updateTrade(row.id, "sortOrder", event.target.value)}
                  />
                ),
              },
              {
                key: "isActive",
                header: "Active",
                className: "table-col-narrow",
                render: (row) => (
                  <select
                    value={String(row.isActive)}
                    onChange={(event) => updateTrade(row.id, "isActive", event.target.value === "true")}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ),
              },
            ]}
            rows={sortedTrades}
            emptyMessage="No trades added yet."
            tableClassName="library-compact-table"
            actionsColumnClassName="table-col-actions"
            renderActions={(row) => (
              <button type="button" className="danger-button" onClick={() => removeTrade(row.id)}>
                Remove
              </button>
            )}
          />
        </div>
      </div>
    </SectionCard>
  );
}

export default TradeLibraryPage;
