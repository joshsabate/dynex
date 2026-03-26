import { useState } from "react";
import DataTable from "../components/DataTable";
import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";

const defaultForm = {
  name: "",
  sortOrder: "1",
  isActive: true,
};

function TradeLibraryPage({ trades, onTradesChange }) {
  const [form, setForm] = useState(defaultForm);

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

  const sortedTrades = [...trades].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
  );

  return (
    <SectionCard
      title="Trade Library"
      description="Manage office estimating trades and their order. Assemblies reference this list instead of free-typed trade names."
    >
      <div className="page-grid library-page">
        <form className="library-form-card" onSubmit={addTrade}>
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

            <FormField label="Sort order">
              <input
                type="number"
                min="0"
                step="1"
                value={form.sortOrder}
                onChange={(event) => updateField("sortOrder", event.target.value)}
              />
            </FormField>

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
