import { useMemo, useState } from "react";
import DataTable from "../components/DataTable";
import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";

const defaultForm = {
  name: "",
  sortOrder: "1",
  isActive: true,
};

function ItemFamilyLibraryPage({ itemFamilies, onItemFamiliesChange }) {
  const [form, setForm] = useState(defaultForm);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const addItemFamily = (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      return;
    }

    onItemFamiliesChange([
      ...itemFamilies,
      {
        id: `item-family-${Date.now()}`,
        name: form.name.trim(),
        sortOrder: Number(form.sortOrder || 0),
        isActive: Boolean(form.isActive),
      },
    ]);

    setForm((current) => ({
      ...defaultForm,
      sortOrder: current.sortOrder,
    }));
  };

  const updateItemFamily = (itemFamilyId, key, value) => {
    onItemFamiliesChange(
      itemFamilies.map((itemFamily) =>
        itemFamily.id === itemFamilyId
          ? {
              ...itemFamily,
              [key]: key === "sortOrder" ? Number(value) : value,
            }
          : itemFamily
      )
    );
  };

  const removeItemFamily = (itemFamilyId) => {
    onItemFamiliesChange(itemFamilies.filter((itemFamily) => itemFamily.id !== itemFamilyId));
  };

  const sortedItemFamilies = useMemo(
    () =>
      [...itemFamilies].sort(
        (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
      ),
    [itemFamilies]
  );

  return (
    <SectionCard
      title="Item Family Library"
      description="Maintain the controlled item-family list used by Cost Library, Assembly Library, and Estimate Builder manual items."
    >
      <div className="page-grid library-page">
        <form className="library-form-card" onSubmit={addItemFamily}>
          <div className="library-form-grid">
            <div className="library-form-span-2">
              <FormField label="Item family name">
                <input
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Timber"
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
              Add item family
            </button>
          </div>
        </form>

        <div className="library-table-panel">
          <DataTable
            columns={[
              {
                key: "name",
                header: "Item Family",
                className: "table-col-wide",
                render: (row) => (
                  <input
                    value={row.name}
                    onChange={(event) => updateItemFamily(row.id, "name", event.target.value)}
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
                    onChange={(event) => updateItemFamily(row.id, "sortOrder", event.target.value)}
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
                      updateItemFamily(row.id, "isActive", event.target.value === "true")
                    }
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ),
              },
            ]}
            rows={sortedItemFamilies}
            emptyMessage="No item families added yet."
            tableClassName="library-compact-table"
            actionsColumnClassName="table-col-actions"
            renderActions={(row) => (
              <button type="button" className="danger-button" onClick={() => removeItemFamily(row.id)}>
                Remove
              </button>
            )}
          />
        </div>
      </div>
    </SectionCard>
  );
}

export default ItemFamilyLibraryPage;
