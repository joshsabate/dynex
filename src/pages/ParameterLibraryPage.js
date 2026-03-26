import { useState } from "react";
import DataTable from "../components/DataTable";
import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";
import { normalizeManagedParameter, normalizeParameterKey, sortManagedParameters } from "../utils/parameters";

const defaultForm = {
  key: "",
  label: "",
  inputType: "number",
  unit: "",
  defaultValue: "",
};

function ParameterLibraryPage({ parameters, onParametersChange }) {
  const [form, setForm] = useState(defaultForm);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const hasDuplicateKey = (key, parameterId = "") =>
    parameters.some((parameter) => parameter.key === key && parameter.id !== parameterId);

  const addParameter = (event) => {
    event.preventDefault();

    const normalizedKey = normalizeParameterKey(form.key);

    if (!normalizedKey || !form.label.trim() || hasDuplicateKey(normalizedKey)) {
      return;
    }

    onParametersChange([
      ...parameters,
      normalizeManagedParameter({
        id: `parameter-${Date.now()}`,
        key: normalizedKey,
        label: form.label.trim(),
        inputType: form.inputType,
        unit: form.unit.trim(),
        defaultValue:
          form.defaultValue === ""
            ? ""
            : form.inputType === "number"
              ? Number(form.defaultValue)
              : form.defaultValue,
      }),
    ]);

    setForm(defaultForm);
  };

  const updateParameter = (parameterId, field, value) => {
    onParametersChange(
      parameters.map((parameter) => {
        if (parameter.id !== parameterId) {
          return parameter;
        }

        const nextValue =
          field === "key"
            ? normalizeParameterKey(value)
            : field === "defaultValue"
              ? value === ""
                ? ""
                : parameter.inputType === "number"
                  ? Number(value)
                  : value
              : value;

        if (field === "key" && hasDuplicateKey(nextValue, parameterId)) {
          return parameter;
        }

        return normalizeManagedParameter({
          ...parameter,
          [field]: nextValue,
        });
      })
    );
  };

  const removeParameter = (parameterId) => {
    onParametersChange(parameters.filter((parameter) => parameter.id !== parameterId));
  };

  const sortedParameters = sortManagedParameters(parameters);

  return (
    <SectionCard
      title="Parameter Library"
      description="Manage reusable parameter definitions so room type inputs use one consistent parameter set."
    >
      <div className="page-grid library-page">
        <form className="library-form-card" onSubmit={addParameter}>
          <div className="library-form-grid library-form-grid-wide">
            <FormField label="Key">
              <input
                value={form.key}
                onChange={(event) => updateField("key", event.target.value)}
                placeholder="length"
              />
            </FormField>

            <div className="library-form-span-2">
              <FormField label="Label">
                <input
                  value={form.label}
                  onChange={(event) => updateField("label", event.target.value)}
                  placeholder="Length"
                />
              </FormField>
            </div>

            <FormField label="Input type">
              <select
                value={form.inputType}
                onChange={(event) => updateField("inputType", event.target.value)}
              >
                <option value="number">Number</option>
                <option value="text">Text</option>
              </select>
            </FormField>

            <FormField label="Unit">
              <input
                value={form.unit}
                onChange={(event) => updateField("unit", event.target.value)}
                placeholder="m"
              />
            </FormField>

            <FormField label="Default value">
              <input
                type={form.inputType}
                value={form.defaultValue}
                onChange={(event) => updateField("defaultValue", event.target.value)}
                placeholder="Optional"
              />
            </FormField>
          </div>

          <div className="action-row library-form-actions">
            <button type="submit" className="primary-button">
              Add parameter
            </button>
          </div>
        </form>

        <div className="library-table-panel">
          <DataTable
            columns={[
              {
                key: "key",
                header: "Key",
                className: "table-col-code",
                render: (row) => (
                  <input
                    value={row.key}
                    onChange={(event) => updateParameter(row.id, "key", event.target.value)}
                  />
                ),
              },
              {
                key: "label",
                header: "Label",
                className: "table-col-wide",
                render: (row) => (
                  <input
                    value={row.label}
                    onChange={(event) => updateParameter(row.id, "label", event.target.value)}
                  />
                ),
              },
              {
                key: "inputType",
                header: "Input",
                className: "table-col-medium",
                render: (row) => (
                  <select
                    value={row.inputType}
                    onChange={(event) => updateParameter(row.id, "inputType", event.target.value)}
                  >
                    <option value="number">Number</option>
                    <option value="text">Text</option>
                  </select>
                ),
              },
              {
                key: "unit",
                header: "Unit",
                className: "table-col-narrow",
                render: (row) => (
                  <input
                    value={row.unit || ""}
                    onChange={(event) => updateParameter(row.id, "unit", event.target.value)}
                  />
                ),
              },
              {
                key: "defaultValue",
                header: "Default",
                className: "table-col-medium",
                render: (row) => (
                  <input
                    type={row.inputType}
                    value={String(row.defaultValue ?? "")}
                    onChange={(event) => updateParameter(row.id, "defaultValue", event.target.value)}
                  />
                ),
              },
            ]}
            rows={sortedParameters}
            emptyMessage="No parameters added yet."
            tableClassName="library-compact-table"
            actionsColumnClassName="table-col-actions"
            renderActions={(row) => (
              <button type="button" className="danger-button" onClick={() => removeParameter(row.id)}>
                Remove
              </button>
            )}
          />
        </div>
      </div>
    </SectionCard>
  );
}

export default ParameterLibraryPage;
