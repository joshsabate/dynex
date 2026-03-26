import { useState } from "react";
import DataTable from "../components/DataTable";
import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";

const defaultForm = {
  name: "",
  sortOrder: "1",
  isActive: true,
};

function CostCodeLibraryPage({ costCodes, onCostCodesChange }) {
  const [form, setForm] = useState(defaultForm);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const addCostCode = (event) => {
    event.preventDefault();
    if (!form.name) {
      return;
    }

    onCostCodesChange([
      ...costCodes,
      {
        id: `cost-code-${Date.now()}`,
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

  const updateCostCode = (costCodeId, key, value) => {
    onCostCodesChange(
      costCodes.map((costCode) =>
        costCode.id === costCodeId
          ? {
              ...costCode,
              [key]: key === "sortOrder" ? Number(value) : value,
            }
          : costCode
      )
    );
  };

  const removeCostCode = (costCodeId) => {
    onCostCodesChange(costCodes.filter((costCode) => costCode.id !== costCodeId));
  };

  const sortedCostCodes = [...costCodes].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
  );

  return (
    <SectionCard
      title="Cost Code Library"
      description="Manage cost codes and their order. Assemblies reference this list for structured estimating and reporting."
    >
      <div className="page-grid library-page">
        <form className="library-form-card" onSubmit={addCostCode}>
          <div className="library-form-grid">
            <div className="library-form-span-2">
              <FormField label="Cost code name">
                <input
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Finishes"
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
              Add cost code
            </button>
          </div>
        </form>

        <div className="library-table-panel">
          <DataTable
            columns={[
              {
                key: "name",
                header: "Cost Code",
                className: "table-col-wide",
                render: (row) => (
                  <input
                    value={row.name}
                    onChange={(event) => updateCostCode(row.id, "name", event.target.value)}
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
                    onChange={(event) => updateCostCode(row.id, "sortOrder", event.target.value)}
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
                    onChange={(event) =>
                      updateCostCode(row.id, "isActive", event.target.value === "true")
                    }
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ),
              },
            ]}
            rows={sortedCostCodes}
            emptyMessage="No cost codes added yet."
            tableClassName="library-compact-table"
            actionsColumnClassName="table-col-actions"
            renderActions={(row) => (
              <button
                type="button"
                className="danger-button"
                onClick={() => removeCostCode(row.id)}
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

export default CostCodeLibraryPage;
