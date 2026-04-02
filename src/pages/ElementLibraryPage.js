import { useState } from "react";
import DataTable from "../components/DataTable";
import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";

const defaultForm = {
  name: "",
  sortOrder: "1",
  isActive: true,
};

function ElementLibraryPage({ elements, onElementsChange }) {
  const [form, setForm] = useState(defaultForm);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const addElement = (event) => {
    event.preventDefault();
    if (!form.name) {
      return;
    }

    onElementsChange([
      ...elements,
      {
        id: `element-${Date.now()}`,
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

  const updateElement = (elementId, key, value) => {
    onElementsChange(
      elements.map((element) =>
        element.id === elementId
          ? {
              ...element,
              [key]: key === "sortOrder" ? Number(value) : value,
            }
          : element
      )
    );
  };

  const removeElement = (elementId) => {
    onElementsChange(elements.filter((element) => element.id !== elementId));
  };

  const sortedElements = [...elements].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
  );

  return (
    <SectionCard
      title="Element Library"
      description="Manage office estimating elements and their order. Assemblies reference this list instead of free-typed element names."
    >
      <div className="page-grid library-page library-page-elements">
        <form className="library-form-card" onSubmit={addElement}>
          <div className="library-form-grid">
            <div className="library-form-span-2">
              <FormField label="Element name">
                <input
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Floor"
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
              Add element
            </button>
          </div>
        </form>

        <div className="library-table-panel">
          <DataTable
            columns={[
              {
                key: "name",
                header: "Element",
                className: "table-col-wide",
                render: (row) => (
                  <input
                    value={row.name}
                    onChange={(event) => updateElement(row.id, "name", event.target.value)}
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
                    onChange={(event) => updateElement(row.id, "sortOrder", event.target.value)}
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
                      updateElement(row.id, "isActive", event.target.value === "true")
                    }
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ),
              },
            ]}
            rows={sortedElements}
            emptyMessage="No elements added yet."
            tableClassName="library-compact-table"
            actionsColumnClassName="table-col-actions"
            renderActions={(row) => (
              <button type="button" className="danger-button" onClick={() => removeElement(row.id)}>
                Remove
              </button>
            )}
          />
        </div>
      </div>
    </SectionCard>
  );
}

export default ElementLibraryPage;
