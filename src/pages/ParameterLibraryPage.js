import { useEffect, useMemo, useRef, useState } from "react";
import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";
import {
  normalizeManagedParameter,
  normalizeParameterCategory,
  normalizeParameterKey,
  parameterCategoryDefinitions,
  parameterCategoryOptions,
  parameterTypeOptions,
  sortManagedParameters,
} from "../utils/parameters";
import { convertParametersToCSV, parseParameterCsv } from "../utils/csvUtils";

const defaultForm = {
  key: "",
  label: "",
  parameterType: "Input",
  inputType: "number",
  unit: "",
  defaultValue: "",
  required: false,
  sortOrder: "",
  category: "General / Misc",
  formula: "",
  description: "",
  status: "Active",
};

const defaultFilters = {
  category: "",
  parameterType: "",
  inputType: "",
  unit: "",
  status: "",
};

const sortOptions = [
  { value: "custom", label: "Custom Order" },
  { value: "label", label: "Label" },
  { value: "key", label: "Key" },
  { value: "category", label: "Category" },
];

function cleanText(value) {
  return String(value || "").trim();
}

function getCategoryLabel(category) {
  return normalizeParameterCategory(category) || "Uncategorised";
}

function getCategoryTone(category) {
  const categoryLabel = getCategoryLabel(category);
  const matchedCategory = parameterCategoryDefinitions.find(
    (definition) => definition.name.toLowerCase() === categoryLabel.toLowerCase()
  );

  return matchedCategory?.tone || "general-misc";
}

function getSortOrderValue(parameter, fallback = 0) {
  const sortOrder = Number(parameter.sortOrder);
  return Number.isFinite(sortOrder) ? sortOrder : fallback;
}

function getInputTypeLabel(inputType) {
  return cleanText(inputType).toLowerCase() === "text" ? "Text" : "Number";
}

function matchesSearch(parameter, searchTerm) {
  if (!searchTerm) {
    return true;
  }

  const haystack = [
    parameter.key,
    parameter.label,
    parameter.category,
    parameter.unit,
  ]
    .map((value) => cleanText(value).toLowerCase())
    .join(" ");

  return haystack.includes(searchTerm);
}

function normalizeCategoryInput(value, categorySuggestions = []) {
  const normalizedValue = normalizeParameterCategory(value);
  if (!normalizedValue) {
    return "";
  }

  const matchedCategory = categorySuggestions.find(
    (category) => category.toLowerCase() === normalizedValue.toLowerCase()
  );
  return matchedCategory || normalizedValue;
}

function getNextSortOrder(parameters, category, parameterId = "") {
  const matchingParameters = parameters.filter(
    (parameter) =>
      parameter.id !== parameterId &&
      getCategoryLabel(parameter.category).toLowerCase() ===
        getCategoryLabel(category).toLowerCase()
  );
  const highestSortOrder = matchingParameters.reduce(
    (max, parameter, index) =>
      Math.max(max, getSortOrderValue(parameter, (index + 1) * 10)),
    0
  );

  return highestSortOrder + 10 || 10;
}

function buildEditorForm(parameter = {}) {
  return {
    key: cleanText(parameter.key),
    label: cleanText(parameter.label),
    parameterType: cleanText(parameter.parameterType) || "Input",
    inputType: cleanText(parameter.inputType) || "number",
    unit: cleanText(parameter.unit),
    defaultValue:
      parameter.defaultValue === "" || parameter.defaultValue == null
        ? ""
        : String(parameter.defaultValue),
    required: Boolean(parameter.required),
    sortOrder:
      parameter.sortOrder === "" || parameter.sortOrder == null
        ? ""
        : String(parameter.sortOrder),
    category: cleanText(parameter.category),
    formula: cleanText(parameter.formula),
    description: cleanText(parameter.description),
    status: cleanText(parameter.status) || "Active",
  };
}

function reorderVisibleParameters(parameters, visibleGroup, sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) {
    return parameters;
  }

  const sourceParameter = parameters.find((parameter) => parameter.id === sourceId);
  const targetParameter = parameters.find((parameter) => parameter.id === targetId);

  if (!sourceParameter || !targetParameter) {
    return parameters;
  }

  if (
    getCategoryLabel(sourceParameter.category).toLowerCase() !==
    getCategoryLabel(targetParameter.category).toLowerCase()
  ) {
    return parameters;
  }

  const visibleIds = visibleGroup.map((parameter) => parameter.id);
  const sourceIndex = visibleIds.indexOf(sourceId);
  const targetIndex = visibleIds.indexOf(targetId);

  if (sourceIndex < 0 || targetIndex < 0) {
    return parameters;
  }

  const nextVisibleIds = [...visibleIds];
  const [movedId] = nextVisibleIds.splice(sourceIndex, 1);
  nextVisibleIds.splice(targetIndex, 0, movedId);

  const categoryKey = getCategoryLabel(sourceParameter.category).toLowerCase();
  const categoryParameters = parameters
    .filter(
      (parameter) =>
        getCategoryLabel(parameter.category).toLowerCase() === categoryKey
    )
    .sort(
      (left, right) =>
        getSortOrderValue(left) - getSortOrderValue(right) ||
        left.label.localeCompare(right.label)
    );
  const hiddenIds = categoryParameters
    .map((parameter) => parameter.id)
    .filter((id) => !nextVisibleIds.includes(id));
  const orderedIds = [...nextVisibleIds, ...hiddenIds];
  const sortOrderById = Object.fromEntries(
    orderedIds.map((id, index) => [id, (index + 1) * 10])
  );

  return parameters.map((parameter) =>
    sortOrderById[parameter.id]
      ? normalizeManagedParameter({
          ...parameter,
          sortOrder: sortOrderById[parameter.id],
        })
      : parameter
  );
}

function ParameterLibraryPage({
  parameters,
  onParametersChange,
  expandedCategories,
  onExpandedCategoriesChange,
}) {
  const importFileInputRef = useRef(null);
  const normalizedParameters = useMemo(
    () => parameters.map((parameter) => normalizeManagedParameter(parameter)),
    [parameters]
  );
  const [editorState, setEditorState] = useState({ mode: "create", parameterId: "" });
  const [form, setForm] = useState(defaultForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState(defaultFilters);
  const [sortMode, setSortMode] = useState("custom");
  const [importMode, setImportMode] = useState("append");
  const [importStatus, setImportStatus] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const [dragState, setDragState] = useState({
    draggingId: "",
    overId: "",
  });
  const [localExpandedCategories, setLocalExpandedCategories] = useState({});
  const managedExpandedCategories = expandedCategories ?? localExpandedCategories;

  const categorySuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...parameterCategoryOptions,
            ...normalizedParameters
              .map((parameter) => cleanText(parameter.category))
              .filter(Boolean),
          ]
        )
      ).sort((left, right) => left.localeCompare(right)),
    [normalizedParameters]
  );
  const unitSuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          normalizedParameters.map((parameter) => cleanText(parameter.unit)).filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right)),
    [normalizedParameters]
  );
  const statusSuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          normalizedParameters.map((parameter) => cleanText(parameter.status)).filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right)),
    [normalizedParameters]
  );

  const selectedParameter =
    normalizedParameters.find((parameter) => parameter.id === editorState.parameterId) || null;

  useEffect(() => {
    if (editorState.mode === "edit" && selectedParameter) {
      setForm(buildEditorForm(selectedParameter));
      setValidationMessage("");
      return;
    }

    if (editorState.mode === "edit" && !selectedParameter && normalizedParameters.length) {
      setEditorState({ mode: "edit", parameterId: normalizedParameters[0].id });
      return;
    }

    if (
      editorState.mode === "edit" &&
      !selectedParameter &&
      !normalizedParameters.length
    ) {
      setEditorState({ mode: "create", parameterId: "" });
      setForm(defaultForm);
    }
  }, [editorState.mode, normalizedParameters, selectedParameter]);

  const updateField = (field, value) => {
    setForm((current) => {
      const nextForm = { ...current, [field]: value };

      if (field === "label" && !cleanText(current.key)) {
        nextForm.key = normalizeParameterKey(value);
      }

      if (field === "category" && (!current.sortOrder || editorState.mode === "create")) {
        nextForm.sortOrder = String(
          getNextSortOrder(normalizedParameters, value, editorState.parameterId)
        );
      }

      return nextForm;
    });
  };

  const hasDuplicateKey = (key, parameterId = "") =>
    normalizedParameters.some(
      (parameter) => parameter.key === key && parameter.id !== parameterId
    );

  const openCreateEditor = () => {
    setEditorState({ mode: "create", parameterId: "" });
    setForm({
      ...defaultForm,
      sortOrder: String(getNextSortOrder(normalizedParameters, "")),
    });
    setValidationMessage("");
  };

  const openEditEditor = (parameter) => {
    setEditorState({ mode: "edit", parameterId: parameter.id });
    setForm(buildEditorForm(parameter));
    setValidationMessage("");
  };

  const saveParameter = (event) => {
    event.preventDefault();

    const normalizedKey = normalizeParameterKey(form.key || form.label);
    const normalizedCategory = normalizeCategoryInput(form.category, categorySuggestions);
    const explicitSortOrder = Number(form.sortOrder);
    const sortOrder = Number.isFinite(explicitSortOrder)
      ? explicitSortOrder
      : getNextSortOrder(normalizedParameters, normalizedCategory, editorState.parameterId);

    if (!normalizedKey) {
      setValidationMessage("Key is required.");
      return;
    }

    if (!cleanText(form.label)) {
      setValidationMessage("Label is required.");
      return;
    }

    if (hasDuplicateKey(normalizedKey, editorState.parameterId)) {
      setValidationMessage("Key must be unique.");
      return;
    }

    const nextParameter = normalizeManagedParameter({
      ...(selectedParameter || {}),
      id:
        editorState.mode === "edit"
          ? editorState.parameterId
          : `parameter-${Date.now()}`,
      key: normalizedKey,
      label: cleanText(form.label),
      parameterType: form.parameterType,
      inputType: form.inputType,
      unit: cleanText(form.unit),
      defaultValue:
        form.defaultValue === ""
          ? ""
          : form.inputType === "number"
            ? Number(form.defaultValue)
            : form.defaultValue,
      required: Boolean(form.required),
      sortOrder,
      formula: form.parameterType === "Derived" ? cleanText(form.formula) : "",
      category: normalizedCategory,
      description: cleanText(form.description),
      status: cleanText(form.status) || "Active",
    });

    if (editorState.mode === "edit") {
      onParametersChange(
        normalizedParameters.map((parameter) =>
          parameter.id === editorState.parameterId ? nextParameter : parameter
        )
      );
      setEditorState({ mode: "edit", parameterId: nextParameter.id });
    } else {
      onParametersChange([...normalizedParameters, nextParameter]);
      setEditorState({ mode: "edit", parameterId: nextParameter.id });
    }

    setForm(buildEditorForm(nextParameter));
    setValidationMessage("");
  };

  const removeParameter = (parameterId) => {
    const nextParameters = normalizedParameters.filter(
      (parameter) => parameter.id !== parameterId
    );
    onParametersChange(nextParameters);

    if (editorState.parameterId === parameterId) {
      if (nextParameters.length) {
        const nextSelectedParameter = sortManagedParameters(nextParameters)[0];
        setEditorState({ mode: "edit", parameterId: nextSelectedParameter.id });
        setForm(buildEditorForm(nextSelectedParameter));
      } else {
        openCreateEditor();
      }
    }
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
    downloadCsv(
      "parameter-library.csv",
      convertParametersToCSV(sortManagedParameters(normalizedParameters))
    );
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
          (parameter) =>
            parameter.key === row.key ||
            parameter.label.toLowerCase() === row.label.toLowerCase()
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

    const nextParameters = [...normalizedParameters];
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
          current
            ? `${current.replace(/\.$/, "")}; ${skippedRows} invalid row(s) skipped.`
            : `${skippedRows} skipped.`
        );
      }
    } catch (error) {
      setImportStatus("Import failed. Check the CSV format and try again.");
    }
  };

  const filteredParameters = useMemo(() => {
    const normalizedSearch = cleanText(searchTerm).toLowerCase();

    return normalizedParameters.filter((parameter) => {
      if (!matchesSearch(parameter, normalizedSearch)) {
        return false;
      }

      if (
        filters.category &&
        getCategoryLabel(parameter.category) !== filters.category
      ) {
        return false;
      }

      if (filters.inputType && cleanText(parameter.inputType) !== filters.inputType) {
        return false;
      }

      if (
        filters.parameterType &&
        cleanText(parameter.parameterType) !== filters.parameterType
      ) {
        return false;
      }

      if (filters.unit && cleanText(parameter.unit) !== filters.unit) {
        return false;
      }

      if (filters.status && cleanText(parameter.status) !== filters.status) {
        return false;
      }

      return true;
    });
  }, [filters, normalizedParameters, searchTerm]);

  const groupedParameters = useMemo(() => {
    const groups = filteredParameters.reduce((map, parameter, index) => {
      const categoryLabel = getCategoryLabel(parameter.category);
      if (!map[categoryLabel]) {
        map[categoryLabel] = [];
      }
      map[categoryLabel].push({
        ...parameter,
        __fallbackIndex: index,
      });
      return map;
    }, {});

    const sortParameters = (left, right) => {
      if (sortMode === "label") {
        return (
          left.label.localeCompare(right.label) ||
          left.key.localeCompare(right.key) ||
          getSortOrderValue(left) - getSortOrderValue(right)
        );
      }

      if (sortMode === "key") {
        return (
          left.key.localeCompare(right.key) ||
          left.label.localeCompare(right.label) ||
          getSortOrderValue(left) - getSortOrderValue(right)
        );
      }

      return (
        getSortOrderValue(left, (left.__fallbackIndex + 1) * 10) -
          getSortOrderValue(right, (right.__fallbackIndex + 1) * 10) ||
        left.label.localeCompare(right.label) ||
        left.key.localeCompare(right.key)
      );
    };

    return Object.entries(groups)
      .sort(([left], [right]) => {
        if (sortMode === "category") {
          if (left === "Uncategorised") {
            return 1;
          }
          if (right === "Uncategorised") {
            return -1;
          }
        }
        if (left === "Uncategorised") {
          return 1;
        }
        if (right === "Uncategorised") {
          return -1;
        }
        return left.localeCompare(right);
      })
      .map(([categoryLabel, rows]) => ({
        categoryLabel,
        tone: getCategoryTone(categoryLabel),
        rows: rows.sort(sortParameters),
      }));
  }, [filteredParameters, sortMode]);

  const totalVisibleCount = filteredParameters.length;

  const handleDropOnParameter = (targetParameter, categoryGroup) => {
    if (!dragState.draggingId || dragState.draggingId === targetParameter.id) {
      setDragState({ draggingId: "", overId: "" });
      return;
    }

    const nextParameters = reorderVisibleParameters(
      normalizedParameters,
      categoryGroup.rows,
      dragState.draggingId,
      targetParameter.id
    );

    onParametersChange(nextParameters);
    setSortMode("custom");
    setDragState({ draggingId: "", overId: "" });
  };

  const updateExpandedCategories = (updater) => {
    const nextValue =
      typeof updater === "function" ? updater(managedExpandedCategories) : updater;

    if (onExpandedCategoriesChange) {
      onExpandedCategoriesChange(nextValue);
      return;
    }

    setLocalExpandedCategories(nextValue);
  };

  const toggleCategory = (categoryLabel) => {
    updateExpandedCategories((current = {}) => ({
      ...current,
      [categoryLabel]: !current[categoryLabel],
    }));
  };

  const setAllVisibleCategoriesExpanded = (isExpanded) => {
    updateExpandedCategories((current = {}) => ({
      ...current,
      ...Object.fromEntries(
        groupedParameters.map((group) => [group.categoryLabel, isExpanded])
      ),
    }));
  };

  return (
    <SectionCard
      title="Parameter Library"
      description="Browse reusable parameter definitions as a grouped system library, filter them quickly, and keep ordering and categories tidy as the library grows."
    >
      <div className="parameter-library-layout">
        <div className="parameter-library-browser">
          <div className="summary-section parameter-library-toolbar">
            <div className="parameter-library-toolbar-top">
              <div className="parameter-library-search">
                <FormField label="Search">
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search key, label, category, or unit"
                  />
                </FormField>
              </div>

              <div className="parameter-library-toolbar-actions">
                <button type="button" className="primary-button" onClick={openCreateEditor}>
                  New Parameter
                </button>
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
            </div>

            <div className="parameter-library-filter-grid">
              <FormField label="Category">
                <select
                  value={filters.category}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, category: event.target.value }))
                  }
                >
                  <option value="">All</option>
                  {categorySuggestions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                  {!categorySuggestions.includes("Uncategorised") ? (
                    <option value="Uncategorised">Uncategorised</option>
                  ) : null}
                </select>
              </FormField>

              <FormField label="Input Type">
                <select
                  value={filters.inputType}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, inputType: event.target.value }))
                  }
                >
                  <option value="">All</option>
                  <option value="number">Number</option>
                  <option value="text">Text</option>
                </select>
              </FormField>

              <FormField label="Parameter Type">
                <select
                  value={filters.parameterType}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, parameterType: event.target.value }))
                  }
                >
                  <option value="">All</option>
                  {parameterTypeOptions.map((parameterType) => (
                    <option key={parameterType} value={parameterType}>
                      {parameterType}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Unit">
                <select
                  value={filters.unit}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, unit: event.target.value }))
                  }
                >
                  <option value="">All</option>
                  {unitSuggestions.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Status">
                <select
                  value={filters.status}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, status: event.target.value }))
                  }
                >
                  <option value="">All</option>
                  {statusSuggestions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Sort">
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value)}
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Import mode">
                <select
                  value={importMode}
                  onChange={(event) => setImportMode(event.target.value)}
                >
                  <option value="append">Append</option>
                  <option value="override">Override All</option>
                  <option value="replace">Replace Duplicates</option>
                </select>
              </FormField>
            </div>

            <div className="parameter-library-toolbar-meta">
              <strong>
                {totalVisibleCount} parameter{totalVisibleCount === 1 ? "" : "s"}
              </strong>
              <span>
                {groupedParameters.length} categor{groupedParameters.length === 1 ? "y" : "ies"} visible
              </span>
              <span>Drag cards to update custom order within a category.</span>
            </div>

            <div className="parameter-library-group-controls">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setAllVisibleCategoriesExpanded(true)}
              >
                Expand All
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setAllVisibleCategoriesExpanded(false)}
              >
                Collapse All
              </button>
            </div>

            {importStatus ? <p className="assembly-library-status">{importStatus}</p> : null}
          </div>

          <div className="parameter-library-groups">
            {groupedParameters.length ? (
              groupedParameters.map((group) => (
                <section
                  key={group.categoryLabel}
                  className="parameter-library-group"
                  data-category-tone={group.tone}
                >
                  <button
                    type="button"
                    className="parameter-library-group-header"
                    onClick={() => toggleCategory(group.categoryLabel)}
                    aria-expanded={managedExpandedCategories[group.categoryLabel] === true}
                    aria-controls={`parameter-library-group-${group.categoryLabel}`}
                  >
                    <div className="parameter-library-group-header-copy">
                      <h3>{group.categoryLabel}</h3>
                      <p>
                        {group.rows.length} parameter{group.rows.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="parameter-library-group-toggle" aria-hidden="true">
                      {managedExpandedCategories[group.categoryLabel] === true ? "v" : ">"}
                    </span>
                  </button>

                  {managedExpandedCategories[group.categoryLabel] === true ? (
                    <div
                      id={`parameter-library-group-${group.categoryLabel}`}
                      className="parameter-library-card-list"
                    >
                      {group.rows.map((parameter) => (
                        <article
                          key={parameter.id}
                          className={`parameter-library-card${
                            editorState.parameterId === parameter.id ? " is-selected" : ""
                          }${dragState.overId === parameter.id ? " is-drag-over" : ""}`}
                          data-category-tone={group.tone}
                          draggable
                          aria-label={`Parameter ${parameter.label}`}
                          onClick={() => openEditEditor(parameter)}
                          onDragStart={() =>
                            setDragState({ draggingId: parameter.id, overId: "" })
                          }
                          onDragOver={(event) => {
                            event.preventDefault();
                            setDragState((current) => ({
                              ...current,
                              overId: parameter.id,
                            }));
                          }}
                          onDragEnd={() => setDragState({ draggingId: "", overId: "" })}
                          onDrop={(event) => {
                            event.preventDefault();
                            handleDropOnParameter(parameter, group);
                          }}
                        >
                          <div className="parameter-library-card-main">
                            <div className="parameter-library-card-title-row">
                              <strong>{parameter.label}</strong>
                              <span className="parameter-library-key-chip">{parameter.key}</span>
                              <span className="parameter-library-drag-chip" aria-hidden="true">
                                ::
                              </span>
                            </div>

                            <div className="parameter-library-card-meta">
                              <span className="parameter-library-meta-text">
                                Type: {parameter.parameterType}
                              </span>
                              <span className="parameter-library-meta-text">
                                {getInputTypeLabel(parameter.inputType)}
                              </span>
                              <span className="parameter-library-meta-text">
                                Unit: {parameter.unit}
                              </span>
                              <span className="parameter-library-meta-text">
                                Default: {parameter.defaultValue === "" ? "Blank" : parameter.defaultValue}
                              </span>
                              <span className="parameter-library-meta-text">
                                {parameter.required ? "Required" : "Optional"}
                              </span>
                              <span className="parameter-library-meta-text">
                                Order: {getSortOrderValue(parameter)}
                              </span>
                              <span className="parameter-library-meta-text">
                                Category: {group.categoryLabel}
                              </span>
                              {parameter.status ? (
                                <span className="parameter-library-meta-text">
                                  Status: {parameter.status}
                                </span>
                              ) : null}
                              {parameter.parameterType === "Derived" && parameter.formula ? (
                                <span className="parameter-library-meta-text">
                                  Formula: {parameter.formula}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </section>
              ))
            ) : (
              <p className="empty-state">
                No parameters match the current search and filters.
              </p>
            )}
          </div>
        </div>

        <aside className="parameter-library-editor">
          <form
            className="summary-section parameter-library-editor-card"
            data-category-tone={getCategoryTone(form.category)}
            onSubmit={saveParameter}
          >
            <div className="parameter-library-editor-header">
              <div>
                <p className="parameter-library-editor-kicker">
                  {editorState.mode === "edit" ? "Edit Parameter" : "Create Parameter"}
                </p>
                <h3>
                  {editorState.mode === "edit" && selectedParameter
                    ? selectedParameter.label
                    : "New Parameter"}
                </h3>
              </div>
              {editorState.mode === "edit" && selectedParameter ? (
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => removeParameter(selectedParameter.id)}
                >
                  Remove
                </button>
              ) : null}
            </div>

            <div className="parameter-library-editor-grid">
              <FormField label="Key">
                <input
                  value={form.key}
                  onChange={(event) => updateField("key", event.target.value)}
                  placeholder="wallArea"
                />
              </FormField>

              <FormField label="Label">
                <input
                  value={form.label}
                  onChange={(event) => updateField("label", event.target.value)}
                  placeholder="Wall Area"
                />
              </FormField>

              <FormField label="Parameter Type">
                <select
                  value={form.parameterType}
                  onChange={(event) => updateField("parameterType", event.target.value)}
                >
                  {parameterTypeOptions.map((parameterType) => (
                    <option key={parameterType} value={parameterType}>
                      {parameterType}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Input Type">
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
                  placeholder="m2"
                  list="parameter-library-unit-suggestions"
                />
              </FormField>

              <FormField label="Default Value">
                <input
                  type={form.inputType}
                  value={form.defaultValue}
                  onChange={(event) => updateField("defaultValue", event.target.value)}
                  placeholder="Optional"
                />
              </FormField>

              <FormField label="Category">
                <select
                  value={form.category}
                  onChange={(event) => updateField("category", event.target.value)}
                >
                  {parameterCategoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="parameter-library-editor-category-preview">
              <span
                className="parameter-library-category-badge is-preview"
                data-category-tone={getCategoryTone(form.category)}
              >
                {getCategoryLabel(form.category)}
              </span>
            </div>

            <div className="parameter-library-toggle-row">
              <label className="parameter-library-checkbox">
                <input
                  type="checkbox"
                  checked={form.required}
                  onChange={(event) => updateField("required", event.target.checked)}
                />
                <span>Required parameter</span>
              </label>
            </div>

            <details className="parameter-library-editor-secondary">
              <summary>Secondary Fields</summary>

              <div className="parameter-library-editor-grid">
                {form.parameterType === "Derived" ? (
                  <div className="parameter-library-editor-span-2">
                    <FormField label="Formula">
                      <input
                        value={form.formula}
                        onChange={(event) => updateField("formula", event.target.value)}
                        placeholder="length * width"
                      />
                    </FormField>
                  </div>
                ) : null}

                <FormField label="Sort Order">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.sortOrder}
                    onChange={(event) => updateField("sortOrder", event.target.value)}
                    placeholder="Auto"
                  />
                </FormField>

                <FormField label="Status">
                  <input
                    value={form.status}
                    onChange={(event) => updateField("status", event.target.value)}
                    placeholder="Active"
                    list="parameter-library-status-suggestions"
                  />
                </FormField>

                <div className="parameter-library-editor-span-2">
                  <FormField label="Description">
                    <textarea
                      rows={4}
                      value={form.description}
                      onChange={(event) => updateField("description", event.target.value)}
                      placeholder="Optional implementation note"
                    />
                  </FormField>
                </div>
              </div>
            </details>

            {validationMessage ? (
              <p className="parameter-library-validation">{validationMessage}</p>
            ) : null}

            <div className="parameter-library-editor-actions">
              <button type="submit" className="primary-button">
                {editorState.mode === "edit" ? "Save Parameter" : "Add Parameter"}
              </button>
              <button type="button" className="secondary-button" onClick={openCreateEditor}>
                Clear Form
              </button>
            </div>
          </form>

          <datalist id="parameter-library-unit-suggestions">
            {unitSuggestions.map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>
          <datalist id="parameter-library-status-suggestions">
            {Array.from(new Set(["Active", "Inactive", "Archived", ...statusSuggestions])).map(
              (status) => (
                <option key={status} value={status} />
              )
            )}
          </datalist>
        </aside>
      </div>
    </SectionCard>
  );
}

export default ParameterLibraryPage;
