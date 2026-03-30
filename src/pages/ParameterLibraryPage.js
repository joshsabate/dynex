import { useRef, useState } from "react";
import DataTable from "../components/DataTable";
import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";
import { normalizeManagedParameter, normalizeParameterKey, sortManagedParameters } from "../utils/parameters";
import { convertParametersToCSV, parseParameterCsv } from "../utils/csvUtils";

const defaultForm = {
  key: "",
  label: "",
  inputType: "number",
  unit: "",
  defaultValue: "",
  description: "",
  category: "",
  status: "Active",
};

function ParameterLibraryPage({ parameters, onParametersChange }) {
  const importFileInputRef = useRef(null);
  const [form, setForm] = useState(defaultForm);
  const [importMode, setImportMode] = useState("append");
  const [importStatus, setImportStatus] = useState("");

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
        description: form.description.trim(),
        category: form.category.trim(),
        status: form.status.trim() || "Active",
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

  const downloadCsv = (filename, text) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const exportParameters = () => {
    downloadCsv("parameter-library.csv", convertParametersToCSV(sortManagedParameters(parameters)));
  };

  const findDuplicateParameter = (collection, row) =>
    collection.find(
      (parameter) =>
        parameter.key === row.key ||
        (!row.key && parameter.label.toLowerCase() === row.label.toLowerCase()) ||
        parameter.label.toLowerCase() === row.label.toLowerCase()
    );

  const applyImportedParameters = (importedRows) => {
    if (importMode === "override") {
      if (
        typeof window !== "undefined" &&
        !window.confirm("Override all existing Parameter Library items with the imported CSV?")
      ) {
        return;
      }

      const dedupedRows = [];
      let replaced = 0;
      importedRows.forEach((row) => {
        const existingIndex = dedupedRows.findIndex(
          (parameter) => parameter.key === row.key || parameter.label.toLowerCase() === row.label.toLowerCase()
        );

        if (existingIndex >= 0) {
          dedupedRows[existingIndex] = {
            ...row,
            id: dedupedRows[existingIndex].id || row.id,
          };
          replaced += 1;
          return;
        }

        dedupedRows.push(row);
      });

      onParametersChange(dedupedRows);
      setImportStatus(`${dedupedRows.length} added, ${replaced} replaced, 0 skipped.`);
      return;
    }

    const nextParameters = [...parameters];
    let added = 0;
    let replaced = 0;
    let skipped = 0;

    importedRows.forEach((row) => {
      const existing = findDuplicateParameter(nextParameters, row);

      if (!existing) {
        nextParameters.push(row);
        added += 1;
        return;
      }

      if (importMode === "replace") {
        const index = nextParameters.findIndex((parameter) => parameter.id === existing.id);
        nextParameters[index] = {
          ...row,
          id: existing.id,
        };
        replaced += 1;
        return;
      }

      skipped += 1;
    });

    onParametersChange(nextParameters);
    setImportStatus(`${added} added, ${replaced} replaced, ${skipped} skipped.`);
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const { rows, skippedRows } = parseParameterCsv(text);

      if (!rows.length) {
        setImportStatus(`0 added, 0 replaced, ${skippedRows} skipped.`);
        return;
      }

      applyImportedParameters(rows);
      if (skippedRows) {
        setImportStatus((current) =>
          current ? `${current.replace(/\.$/, "")}; ${skippedRows} invalid row(s) skipped.` : `${skippedRows} skipped.`
        );
      }
    } catch (error) {
      setImportStatus("Import failed. Check the CSV format and try again.");
    }
  };

  const sortedParameters = sortManagedParameters(parameters);

  return (
    <SectionCard
      title="Parameter Library"
      description="Manage reusable parameter definitions so room type inputs use one consistent parameter set."
    >
      <div className="page-grid library-page">
        <form className="library-form-card" onSubmit={addParameter}>
          <div className="library-form-actions library-form-actions-top">
            <button type="button" className="secondary-button" onClick={exportParameters}>
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
              aria-label="Import Parameter CSV"
              onChange={handleImportFile}
            />
          </div>
          <div className="library-form-grid library-form-grid-wide">
            <FormField label="Import mode">
              <select value={importMode} onChange={(event) => setImportMode(event.target.value)}>
                <option value="append">Append</option>
                <option value="override">Override All</option>
                <option value="replace">Replace Duplicates</option>
              </select>
            </FormField>
          </div>
          {importStatus ? <p className="assembly-library-status">{importStatus}</p> : null}
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

            <FormField label="Category">
              <input
                value={form.category}
                onChange={(event) => updateField("category", event.target.value)}
                placeholder="Optional"
              />
            </FormField>

            <FormField label="Status">
              <input
                value={form.status}
                onChange={(event) => updateField("status", event.target.value)}
                placeholder="Active"
              />
            </FormField>

            <div className="library-form-span-2">
              <FormField label="Description">
                <input
                  value={form.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  placeholder="Optional"
                />
              </FormField>
            </div>
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
                key: "category",
                header: "Category",
                className: "table-col-medium",
                render: (row) => (
                  <input
                    value={row.category || ""}
                    onChange={(event) => updateParameter(row.id, "category", event.target.value)}
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
                    onChange={(event) => updateParameter(row.id, "status", event.target.value)}
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
              {
                key: "description",
                header: "Description",
                className: "table-col-wide",
                render: (row) => (
                  <input
                    value={row.description || ""}
                    onChange={(event) => updateParameter(row.id, "description", event.target.value)}
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
