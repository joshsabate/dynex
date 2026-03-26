import { useState } from "react";
import DataTable from "../components/DataTable";
import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";
import { getUnitAbbreviation } from "../utils/units";

const defaultForm = {
  itemName: "",
  unitId: "unit-sqm",
  rate: "",
};

function CostLibraryPage({ costs, units, onCostsChange }) {
  const [form, setForm] = useState(defaultForm);
  const activeUnits = [...units]
    .filter((unit) => unit.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const getUnitLabel = (unitId, fallback = "") =>
    getUnitAbbreviation(units, unitId, fallback, fallback);

  const addCost = (event) => {
    event.preventDefault();
    if (!form.itemName || !form.rate) {
      return;
    }

    onCostsChange([
      ...costs,
      {
        id: `cost-${Date.now()}`,
        itemName: form.itemName,
        unitId: form.unitId,
        unit: getUnitLabel(form.unitId),
        rate: Number(form.rate),
      },
    ]);

    setForm((current) => ({
      ...current,
      itemName: "",
      rate: "",
    }));
  };

  const removeCost = (costId) => {
    onCostsChange(costs.filter((cost) => cost.id !== costId));
  };

  const updateCost = (costId, key, value) => {
    onCostsChange(
      costs.map((cost) =>
        cost.id === costId
          ? {
              ...cost,
              unit:
                key === "unitId"
                  ? getUnitLabel(value, cost.unit)
                  : cost.unit,
              [key]: key === "rate" ? Number(value) : value,
            }
          : cost
      )
    );
  };

  return (
    <SectionCard
      title="Cost Library"
      description="Store flat unit rates keyed by item name and unit. Assembly rows pull rates from this in-memory list."
    >
      <div className="page-grid library-page">
        <form className="library-form-card" onSubmit={addCost}>
          <div className="library-form-grid library-form-grid-wide">
            <div className="library-form-span-2">
              <FormField label="Item name">
                <input
                  value={form.itemName}
                  onChange={(event) => updateField("itemName", event.target.value)}
                  placeholder="Floor Tile Installation"
                />
              </FormField>
            </div>

            <div className="library-form-narrow">
              <FormField label="Unit">
                <select
                  value={form.unitId}
                  onChange={(event) => updateField("unitId", event.target.value)}
                >
                  {activeUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.abbreviation} - {unit.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="library-form-narrow">
              <FormField label="Rate">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.rate}
                  onChange={(event) => updateField("rate", event.target.value)}
                  placeholder="350"
                />
              </FormField>
            </div>
          </div>

          <div className="action-row library-form-actions">
            <button type="submit" className="primary-button">
              Add cost item
            </button>
          </div>
        </form>

        <div className="library-table-panel">
          <DataTable
            columns={[
              {
                key: "itemName",
                header: "Item",
                className: "table-col-wide",
                render: (row) => (
                  <input
                    value={row.itemName}
                    onChange={(event) => updateCost(row.id, "itemName", event.target.value)}
                  />
                ),
              },
              {
                key: "unitId",
                header: "Unit",
                className: "table-col-narrow",
                render: (row) => (
                  <select
                    value={row.unitId || ""}
                    onChange={(event) => updateCost(row.id, "unitId", event.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {activeUnits.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.abbreviation} - {unit.name}
                      </option>
                    ))}
                  </select>
                ),
              },
              {
                key: "rate",
                header: "Rate",
                className: "table-col-number",
                render: (row) => (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.rate}
                    onChange={(event) => updateCost(row.id, "rate", event.target.value)}
                  />
                ),
              },
            ]}
            rows={costs}
            emptyMessage="No cost items added yet."
            tableClassName="library-compact-table"
            actionsColumnClassName="table-col-actions"
            renderActions={(row) => (
              <button
                type="button"
                className="danger-button"
                onClick={() => removeCost(row.id)}
              >
                Remove
              </button>
            )}
          />
        </div>
      </div>
    </SectionCard>
  );
}

export default CostLibraryPage;
