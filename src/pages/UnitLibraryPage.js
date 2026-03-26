import { useState } from "react";
import DataTable from "../components/DataTable";
import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";

const defaultForm = {
  name: "",
  abbreviation: "",
  sortOrder: "1",
  isActive: true,
};

function UnitLibraryPage({ units, onUnitsChange }) {
  const [form, setForm] = useState(defaultForm);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const addUnit = (event) => {
    event.preventDefault();
    if (!form.name || !form.abbreviation) {
      return;
    }

    onUnitsChange([
      ...units,
      {
        id: `unit-${Date.now()}`,
        name: form.name,
        abbreviation: form.abbreviation.toUpperCase(),
        sortOrder: Number(form.sortOrder),
        isActive: Boolean(form.isActive),
      },
    ]);

    setForm((current) => ({
      ...defaultForm,
      sortOrder: current.sortOrder,
    }));
  };

  const updateUnit = (unitId, key, value) => {
    onUnitsChange(
      units.map((unit) =>
        unit.id === unitId
          ? {
              ...unit,
              [key]:
                key === "sortOrder"
                  ? Number(value)
                  : key === "abbreviation"
                    ? value.toUpperCase()
                    : value,
            }
          : unit
      )
    );
  };

  const removeUnit = (unitId) => {
    onUnitsChange(units.filter((unit) => unit.id !== unitId));
  };

  const sortedUnits = [...units].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
  );

  return (
    <SectionCard
      title="Unit Library"
      description="Manage estimating units and abbreviations so assemblies, costs, labour, and estimate output use the same unit set."
    >
      <div className="page-grid library-page">
        <form className="library-form-card" onSubmit={addUnit}>
          <div className="library-form-grid">
            <div className="library-form-span-2">
              <FormField label="Unit name">
                <input
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Square Metre"
                />
              </FormField>
            </div>

            <FormField label="Abbreviation">
              <input
                value={form.abbreviation}
                onChange={(event) => updateField("abbreviation", event.target.value)}
                placeholder="SQM"
              />
            </FormField>

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
              Add unit
            </button>
          </div>
        </form>

        <div className="library-table-panel">
          <DataTable
            columns={[
              {
                key: "name",
                header: "Unit",
                className: "table-col-wide",
                render: (row) => (
                  <input
                    value={row.name}
                    onChange={(event) => updateUnit(row.id, "name", event.target.value)}
                  />
                ),
              },
              {
                key: "abbreviation",
                header: "Abbrev",
                className: "table-col-code",
                render: (row) => (
                  <input
                    value={row.abbreviation}
                    onChange={(event) => updateUnit(row.id, "abbreviation", event.target.value)}
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
                    onChange={(event) => updateUnit(row.id, "sortOrder", event.target.value)}
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
                    onChange={(event) => updateUnit(row.id, "isActive", event.target.value === "true")}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ),
              },
            ]}
            rows={sortedUnits}
            emptyMessage="No units added yet."
            tableClassName="library-compact-table"
            actionsColumnClassName="table-col-actions"
            renderActions={(row) => (
              <button type="button" className="danger-button" onClick={() => removeUnit(row.id)}>
                Remove
              </button>
            )}
          />
        </div>
      </div>
    </SectionCard>
  );
}

export default UnitLibraryPage;
