import { useRef, useState } from "react";
import DataTable from "../components/DataTable";
import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";
import { applyImportMode, convertCostCodesToCSV, parseCostCodeCsv } from "../utils/csvUtils";

const defaultForm = {
  code: "",
  name: "",
  stage: "",
  trade: "",
  description: "",
  status: "Active",
  sortOrder: "1",
  isActive: true,
};

function CostCodeLibraryPage({ costCodes, onCostCodesChange }) {
  const importFileInputRef = useRef(null);
  const [form, setForm] = useState(defaultForm);
  const [csvStatus, setCsvStatus] = useState("");
  const [importMode, setImportMode] = useState("append");

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const addCostCode = (event) => {
    event.preventDefault();
    if (!form.name && !form.code) {
      return;
    }

    onCostCodesChange([
      ...costCodes,
      {
        id: `cost-code-${Date.now()}`,
        code: form.code,
        name: form.name || form.code,
        stage: form.stage,
        trade: form.trade,
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

  const exportCostCodesAsCsv = () => {
    if (typeof window === "undefined") {
      return;
    }
    const csvText = convertCostCodesToCSV(costCodes);
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cost-code-library.csv";
    link.click();
    window.URL.revokeObjectURL(url);
    setCsvStatus(`Exported ${costCodes.length} cost codes.`);
  };

  const importCostCodesFromCsv = async (file) => {
    if (!file) {
      return;
    }
    try {
      const { rows, skippedRows } = parseCostCodeCsv(await file.text());
      const mergeResult = applyImportMode({
        existingItems: costCodes,
        importedItems: rows,
        mode: importMode,
        getMatchKey: (existing, incoming) =>
          (String(existing.code || "").trim() &&
            String(existing.code || "").trim().toLowerCase() ===
              String(incoming.code || "").trim().toLowerCase()) ||
          String(existing.name || "").trim().toLowerCase() ===
            String(incoming.name || "").trim().toLowerCase(),
        shouldConfirmOverride: () =>
          typeof window === "undefined" ||
          window.confirm("Override all existing Cost Code Library items with the imported CSV?"),
      });

      if (!mergeResult) {
        return;
      }

      onCostCodesChange(mergeResult.items);
      setCsvStatus(
        `${mergeResult.summary.added} added, ${mergeResult.summary.replaced} replaced, ${
          skippedRows + mergeResult.summary.skipped
        } skipped.`
      );
    } catch (error) {
      setCsvStatus("Import failed. Check the CSV format and try again.");
    }
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
          <div className="library-form-actions library-form-actions-top">
            <button type="button" className="secondary-button" onClick={exportCostCodesAsCsv}>
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
              aria-label="Import Cost Code CSV"
              onChange={(event) => {
                const [file] = event.target.files || [];
                importCostCodesFromCsv(file);
                event.target.value = "";
              }}
            />
          </div>
          <div className="library-form-grid">
            <FormField label="Import mode">
              <select value={importMode} onChange={(event) => setImportMode(event.target.value)}>
                <option value="append">Append</option>
                <option value="override">Override All</option>
                <option value="replace">Replace Duplicates</option>
              </select>
            </FormField>
          </div>
          {csvStatus ? <p className="assembly-library-status">{csvStatus}</p> : null}

          <div className="library-form-grid">
            <FormField label="Cost code">
              <input
                value={form.code}
                onChange={(event) => updateField("code", event.target.value)}
                placeholder="S10"
              />
            </FormField>

            <div className="library-form-span-2">
              <FormField label="Cost code name">
                <input
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Finishes"
                />
              </FormField>
            </div>

            <FormField label="Stage">
              <input
                value={form.stage}
                onChange={(event) => updateField("stage", event.target.value)}
                placeholder="Optional"
              />
            </FormField>

            <FormField label="Trade">
              <input
                value={form.trade}
                onChange={(event) => updateField("trade", event.target.value)}
                placeholder="Optional"
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

            <FormField label="Status">
              <input
                value={form.status}
                onChange={(event) => updateField("status", event.target.value)}
                placeholder="Active"
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
              Add cost code
            </button>
          </div>
        </form>

        <div className="library-table-panel">
          <DataTable
            columns={[
              {
                key: "code",
                header: "Code",
                className: "table-col-medium",
                render: (row) => (
                  <input
                    value={row.code || ""}
                    onChange={(event) => updateCostCode(row.id, "code", event.target.value)}
                  />
                ),
              },
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
                key: "stage",
                header: "Stage",
                className: "table-col-medium",
                render: (row) => (
                  <input
                    value={row.stage || ""}
                    onChange={(event) => updateCostCode(row.id, "stage", event.target.value)}
                  />
                ),
              },
              {
                key: "trade",
                header: "Trade",
                className: "table-col-medium",
                render: (row) => (
                  <input
                    value={row.trade || ""}
                    onChange={(event) => updateCostCode(row.id, "trade", event.target.value)}
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
                    onChange={(event) => updateCostCode(row.id, "description", event.target.value)}
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
                    onChange={(event) => updateCostCode(row.id, "status", event.target.value)}
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
