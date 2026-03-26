import { useState } from "react";
import ColorSwatchPicker from "../components/ColorSwatchPicker";
import DataTable from "../components/DataTable";
import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";

const defaultForm = {
  name: "",
  sortOrder: "1",
  isActive: true,
  color: "#d7aa5a",
};

function StageLibraryPage({ stages, onStagesChange }) {
  const [form, setForm] = useState(defaultForm);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const addStage = (event) => {
    event.preventDefault();
    if (!form.name) {
      return;
    }

    onStagesChange([
      ...stages,
      {
        id: `stage-${Date.now()}`,
        name: form.name,
        sortOrder: Number(form.sortOrder),
        isActive: Boolean(form.isActive),
        color: form.color,
      },
    ]);

    setForm((current) => ({
      ...defaultForm,
      sortOrder: current.sortOrder,
    }));
  };

  const updateStage = (stageId, key, value) => {
    onStagesChange(
      stages.map((stage) =>
        stage.id === stageId
          ? {
              ...stage,
              [key]: key === "sortOrder" ? Number(value) : value,
            }
          : stage
      )
    );
  };

  const removeStage = (stageId) => {
    onStagesChange(stages.filter((stage) => stage.id !== stageId));
  };

  const sortedStages = [...stages].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
  );

  return (
    <SectionCard
      title="Stage Library"
      description="Manage office estimating stages and their order. Assemblies reference this list instead of free-typed stage names."
    >
      <div className="page-grid library-page">
        <form className="library-form-card" onSubmit={addStage}>
          <div className="library-form-grid">
            <div className="library-form-span-2">
              <FormField label="Stage name">
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

            <FormField label="Color">
              <ColorSwatchPicker
                value={form.color}
                onChange={(value) => updateField("color", value)}
                ariaLabel="Select stage color"
              />
            </FormField>
          </div>

          <div className="action-row library-form-actions">
            <button type="submit" className="primary-button">
              Add stage
            </button>
          </div>
        </form>

        <div className="library-table-panel">
          <DataTable
            columns={[
              {
                key: "name",
                header: "Stage",
                className: "table-col-wide",
                render: (row) => (
                  <input
                    value={row.name}
                    onChange={(event) => updateStage(row.id, "name", event.target.value)}
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
                    onChange={(event) => updateStage(row.id, "sortOrder", event.target.value)}
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
                    onChange={(event) => updateStage(row.id, "isActive", event.target.value === "true")}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ),
              },
              {
                key: "color",
                header: "Color",
                className: "table-col-color",
                render: (row) => (
                  <ColorSwatchPicker
                    value={row.color || "#d7ddd5"}
                    onChange={(value) => updateStage(row.id, "color", value)}
                    ariaLabel={`Select color for ${row.name}`}
                  />
                ),
              },
            ]}
            rows={sortedStages}
            emptyMessage="No stages added yet."
            tableClassName="library-compact-table"
            actionsColumnClassName="table-col-actions"
            renderActions={(row) => (
              <button type="button" className="danger-button" onClick={() => removeStage(row.id)}>
                Remove
              </button>
            )}
          />
        </div>
      </div>
    </SectionCard>
  );
}

export default StageLibraryPage;
