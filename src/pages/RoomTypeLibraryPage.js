import { useState } from "react";
import FormField from "../components/FormField";
import SectionCard from "../components/SectionCard";
import { sortManagedParameters } from "../utils/parameters";
import {
  getRoomTypeParameterDefinitions,
  serializeRoomTypeParameterDefinitions,
} from "../utils/roomTypeParameters";

const defaultForm = {
  name: "",
  sortOrder: "1",
  isActive: true,
};

const defaultParameterForm = {
  parameterId: "",
  defaultValue: "",
  isRequired: false,
  sortOrder: "1",
};

function RoomTypeLibraryPage({ roomTypes, parameters, onRoomTypesChange }) {
  const [form, setForm] = useState(defaultForm);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState("");
  const [parameterForm, setParameterForm] = useState(defaultParameterForm);

  const renderCompactIconButton = ({ label, icon, className = "secondary-button", onClick }) => (
    <button
      type="button"
      className={`estimate-builder-icon-button ${className}`}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateParameterFormField = (key, value) => {
    setParameterForm((current) => ({ ...current, [key]: value }));
  };

  const updateRoomTypeParameterDefinitions = (roomTypeId, updater) => {
    onRoomTypesChange(
      roomTypes.map((roomType) => {
        if (roomType.id !== roomTypeId) {
          return roomType;
        }

        const currentParameterDefinitions = getRoomTypeParameterDefinitions(roomType, parameters);
        const nextParameterDefinitions = serializeRoomTypeParameterDefinitions(
          updater(currentParameterDefinitions)
          .map((parameterDefinition, index) => ({
            ...parameterDefinition,
            sortOrder:
              parameterDefinition.sortOrder === "" ||
              parameterDefinition.sortOrder == null ||
              Number.isNaN(Number(parameterDefinition.sortOrder))
                ? index + 1
                : Number(parameterDefinition.sortOrder),
          }))
          .sort(
            (left, right) =>
              left.sortOrder - right.sortOrder || left.label.localeCompare(right.label)
          ),
          parameters
        );

        return {
          ...roomType,
          parameterDefinitions: nextParameterDefinitions,
        };
      })
    );
  };

  const addRoomType = (event) => {
    event.preventDefault();
    if (!form.name) {
      return;
    }

    const nextRoomTypeId = `room-type-${Date.now()}`;

    onRoomTypesChange([
      ...roomTypes,
      {
        id: nextRoomTypeId,
        name: form.name,
        sortOrder: Number(form.sortOrder),
        isActive: Boolean(form.isActive),
        parameterDefinitions: [],
      },
    ]);

    setForm((current) => ({
      ...defaultForm,
      sortOrder: current.sortOrder,
    }));
    setSelectedRoomTypeId(nextRoomTypeId);
  };

  const updateRoomType = (roomTypeId, key, value) => {
    onRoomTypesChange(
      roomTypes.map((roomType) =>
        roomType.id === roomTypeId
          ? {
              ...roomType,
              [key]: key === "sortOrder" ? Number(value) : value,
            }
          : roomType
      )
    );
  };

  const removeRoomType = (roomTypeId) => {
    onRoomTypesChange(roomTypes.filter((roomType) => roomType.id !== roomTypeId));
    setSelectedRoomTypeId((current) => (current === roomTypeId ? "" : current));
  };

  const sortedRoomTypes = [...roomTypes].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
  );
  const selectedRoomType =
    sortedRoomTypes.find((roomType) => roomType.id === selectedRoomTypeId) || null;
  const selectedParameterDefinitions = selectedRoomType
    ? getRoomTypeParameterDefinitions(selectedRoomType, parameters)
    : [];
  const sortedParameters = sortManagedParameters(parameters);
  const selectedManagedParameter =
    sortedParameters.find((parameter) => parameter.id === parameterForm.parameterId) || null;

  const addParameterDefinition = (event) => {
    event.preventDefault();

    if (!selectedRoomType || !parameterForm.parameterId) {
      return;
    }

    const hasDuplicateKey = selectedParameterDefinitions.some(
      (parameterDefinition) => parameterDefinition.parameterId === parameterForm.parameterId
    );

    if (hasDuplicateKey) {
      return;
    }

    updateRoomTypeParameterDefinitions(selectedRoomType.id, (parameterDefinitions) => [
      ...parameterDefinitions,
      {
        parameterId: parameterForm.parameterId,
        defaultValue:
          parameterForm.defaultValue === ""
            ? ""
            : selectedManagedParameter?.inputType === "number"
              ? Number(parameterForm.defaultValue)
              : parameterForm.defaultValue,
        isRequired: Boolean(parameterForm.isRequired),
        sortOrder: Number(parameterForm.sortOrder || parameterDefinitions.length + 1),
      },
    ]);

    setParameterForm((current) => ({
      ...defaultParameterForm,
      sortOrder: String(Number(current.sortOrder || selectedParameterDefinitions.length + 1) + 1),
    }));
  };

  const updateParameterDefinition = (roomTypeId, parameterKey, field, value) => {
    updateRoomTypeParameterDefinitions(roomTypeId, (parameterDefinitions) =>
      parameterDefinitions.map((parameterDefinition) => {
        if (parameterDefinition.key !== parameterKey) {
          return parameterDefinition;
        }

        if (
          field === "parameterId" &&
          value &&
          parameterDefinitions.some(
            (definition) =>
              definition.key !== parameterKey && definition.parameterId === value
          )
        ) {
          return parameterDefinition;
        }

        return {
          ...parameterDefinition,
          [field]:
            field === "sortOrder"
              ? Number(value)
              : field === "isRequired"
                ? value
                : field === "defaultValue" && parameterDefinition.inputType === "number"
                  ? value === ""
                    ? ""
                    : Number(value)
                  : value,
        };
      })
    );
  };

  const removeParameterDefinition = (roomTypeId, parameterKey) => {
    updateRoomTypeParameterDefinitions(roomTypeId, (parameterDefinitions) =>
      parameterDefinitions.filter((parameterDefinition) => parameterDefinition.key !== parameterKey)
    );
  };

  const moveParameterDefinition = (roomTypeId, parameterKey, direction) => {
    updateRoomTypeParameterDefinitions(roomTypeId, (parameterDefinitions) => {
      const currentIndex = parameterDefinitions.findIndex(
        (parameterDefinition) => parameterDefinition.key === parameterKey
      );
      const nextIndex = currentIndex + direction;

      if (
        currentIndex < 0 ||
        nextIndex < 0 ||
        nextIndex >= parameterDefinitions.length
      ) {
        return parameterDefinitions;
      }

      const nextDefinitions = [...parameterDefinitions];
      const [movedDefinition] = nextDefinitions.splice(currentIndex, 1);
      nextDefinitions.splice(nextIndex, 0, movedDefinition);

      return nextDefinitions.map((parameterDefinition, index) => ({
        ...parameterDefinition,
        sortOrder: index + 1,
      }));
    });
  };

  return (
    <SectionCard
      title="Room Type Library"
      description="Manage room types, their order, and the parameter definitions each type exposes in the Room Library."
    >
      <div className="room-type-master-detail">
        <div className="room-type-master-column">
          <div className="room-type-parameters-panel library-form-card">
          <form className="room-type-library-form" onSubmit={addRoomType}>
            <div className="room-type-library-form-grid">
              <div className="room-type-form-name">
                <FormField label="Room type name">
                  <input
                    value={form.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    placeholder="Bathroom"
                  />
                </FormField>
              </div>

              <div className="room-type-form-small">
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

              <div className="room-type-form-active">
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
                Add room type
              </button>
            </div>
          </form>
          </div>

          <div className="room-type-parameters-panel library-table-panel">
          <div className="room-type-library-list-header">
            <h3>Room Types</h3>
            <p>Select a room type to manage its parameters.</p>
          </div>

          {sortedRoomTypes.length ? (
            <div className="room-type-library-list">
              {sortedRoomTypes.map((row) => {
                const isSelected = row.id === selectedRoomType?.id;
                const parameterCount = getRoomTypeParameterDefinitions(row, parameters).length;

                return (
                  <div
                    key={row.id}
                    className={`room-type-library-row ${
                      isSelected ? "room-type-library-row-selected" : ""
                    }`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${isSelected ? "Collapse" : "Manage"} ${row.name}`}
                    onClick={() => setSelectedRoomTypeId(isSelected ? "" : row.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedRoomTypeId(isSelected ? "" : row.id);
                      }
                    }}
                  >
                    <div className="room-type-library-row-main">
                      <div className="room-type-library-row-name room-type-library-row-summary-name">
                        <label>Room type</label>
                        <input
                          value={row.name}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => updateRoomType(row.id, "name", event.target.value)}
                        />
                      </div>

                      <div className="room-type-library-row-small">
                        <label>Sort</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={row.sortOrder}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => updateRoomType(row.id, "sortOrder", event.target.value)}
                        />
                      </div>

                      <div className="room-type-library-row-small">
                        <label>Active</label>
                        <select
                          value={String(row.isActive)}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) =>
                            updateRoomType(row.id, "isActive", event.target.value === "true")
                          }
                        >
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      </div>

                      <div className="room-type-library-row-small">
                        <label>Params</label>
                        <div className="room-type-library-row-pill">
                          {parameterCount}
                        </div>
                      </div>

                      <div className="room-type-library-row-actions">
                        {renderCompactIconButton({
                          label: "Remove room type",
                          icon: "×",
                          className: "danger-button",
                          onClick: () => removeRoomType(row.id),
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="empty-state">No room types added yet.</p>
          )}
          </div>
        </div>

        <div className="room-type-detail-column">
      {selectedRoomType ? (
        <div className="room-type-parameters-panel room-type-parameters-editor">
          <div className="room-type-parameters-header">
            <div>
              <h3>{selectedRoomType.name} Parameters</h3>
              <p>Changes here immediately affect which inputs appear when creating room templates.</p>
            </div>
          </div>

          <form className="room-type-parameter-form" onSubmit={addParameterDefinition}>
            <div className="room-type-parameter-grid">
              <div className="room-type-parameter-field room-type-parameter-field-wide">
                <FormField label="Parameter">
                  <select
                    value={parameterForm.parameterId}
                    onChange={(event) => updateParameterFormField("parameterId", event.target.value)}
                  >
                    <option value="">Select parameter</option>
                    {sortedParameters.map((parameter) => (
                      <option key={parameter.id} value={parameter.id}>
                        {parameter.label} ({parameter.key})
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div className="room-type-parameter-field room-type-parameter-field-narrow">
                <FormField label="Key">
                  <input
                    value={selectedManagedParameter?.key || ""}
                    readOnly
                    placeholder="Auto-filled"
                  />
                </FormField>
              </div>

              <div className="room-type-parameter-field room-type-parameter-field-medium">
                <FormField label="Label">
                  <input
                    value={selectedManagedParameter?.label || ""}
                    readOnly
                    placeholder="Auto-filled"
                  />
                </FormField>
              </div>

              <div className="room-type-parameter-field room-type-parameter-field-narrow">
                <FormField label="Input type">
                  <input
                    value={selectedManagedParameter?.inputType || ""}
                    readOnly
                    placeholder="Auto-filled"
                  />
                </FormField>
              </div>

              <div className="room-type-parameter-field room-type-parameter-field-narrow">
                <FormField label="Unit">
                  <input value={selectedManagedParameter?.unit || ""} readOnly placeholder="Auto-filled" />
                </FormField>
              </div>

              <div className="room-type-parameter-field room-type-parameter-field-medium">
                <FormField label="Default value override">
                  <input
                    type={selectedManagedParameter?.inputType || "text"}
                    value={parameterForm.defaultValue}
                    onChange={(event) => updateParameterFormField("defaultValue", event.target.value)}
                    placeholder={String(selectedManagedParameter?.defaultValue ?? "") || "Use library default"}
                  />
                </FormField>
              </div>

              <div className="room-type-parameter-field room-type-parameter-field-narrow">
                <FormField label="Required">
                  <select
                    value={String(parameterForm.isRequired)}
                    onChange={(event) =>
                      updateParameterFormField("isRequired", event.target.value === "true")
                    }
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </FormField>
              </div>

              <div className="room-type-parameter-field room-type-parameter-field-narrow">
                <FormField label="Sort order">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={parameterForm.sortOrder}
                    onChange={(event) => updateParameterFormField("sortOrder", event.target.value)}
                  />
                </FormField>
              </div>

              <div className="room-type-parameter-field room-type-parameter-field-action">
                <div className="action-row room-type-parameter-actions">
                  <button type="submit" className="primary-button">
                    Add parameter
                  </button>
                </div>
              </div>
            </div>
          </form>

          {selectedParameterDefinitions.length ? (
            <div className="room-type-parameter-list">
              {selectedParameterDefinitions.map((row) => (
                <div key={row.key} className="room-type-parameter-row">
                  <div className="room-type-parameter-row-main">
                    <div className="room-type-parameter-row-field room-type-parameter-row-parameter">
                      <label>Parameter</label>
                      <select
                        value={row.parameterId || ""}
                        onChange={(event) =>
                          updateParameterDefinition(
                            selectedRoomType.id,
                            row.key,
                            "parameterId",
                            event.target.value
                          )
                        }
                      >
                        <option value="">Legacy parameter</option>
                        {sortedParameters.map((parameter) => (
                          <option key={parameter.id} value={parameter.id}>
                            {parameter.label} ({parameter.key})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="room-type-parameter-row-field room-type-parameter-row-code">
                      <label>Key</label>
                      <div className="room-type-parameter-readonly">{row.key}</div>
                    </div>

                    <div className="room-type-parameter-row-field room-type-parameter-row-label">
                      <label>Label</label>
                      <div className="room-type-parameter-readonly">{row.label}</div>
                    </div>

                    <div className="room-type-parameter-row-field room-type-parameter-row-tiny">
                      <label>Input</label>
                      <div className="room-type-parameter-readonly">{row.inputType}</div>
                    </div>

                    <div className="room-type-parameter-row-field room-type-parameter-row-tiny">
                      <label>Unit</label>
                      <div className="room-type-parameter-readonly">{row.unit || "-"}</div>
                    </div>

                    <div className="room-type-parameter-row-field room-type-parameter-row-default">
                      <label>Default override</label>
                      <input
                        type={row.inputType}
                        value={String(row.defaultValue ?? "")}
                        onChange={(event) =>
                          updateParameterDefinition(
                            selectedRoomType.id,
                            row.key,
                            "defaultValue",
                            event.target.value
                          )
                        }
                      />
                    </div>

                    <div className="room-type-parameter-row-field room-type-parameter-row-tiny">
                      <label>Required</label>
                      <select
                        value={String(row.isRequired)}
                        onChange={(event) =>
                          updateParameterDefinition(
                            selectedRoomType.id,
                            row.key,
                            "isRequired",
                            event.target.value === "true"
                          )
                        }
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </div>

                    <div className="room-type-parameter-row-field room-type-parameter-row-tiny">
                      <label>Sort</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={row.sortOrder}
                        onChange={(event) =>
                          updateParameterDefinition(
                            selectedRoomType.id,
                            row.key,
                            "sortOrder",
                            event.target.value
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="action-row room-type-parameter-row-actions">
                    {renderCompactIconButton({
                      label: "Move parameter up",
                      icon: "↑",
                      onClick: () => moveParameterDefinition(selectedRoomType.id, row.key, -1),
                    })}
                    {renderCompactIconButton({
                      label: "Move parameter down",
                      icon: "↓",
                      onClick: () => moveParameterDefinition(selectedRoomType.id, row.key, 1),
                    })}
                    {renderCompactIconButton({
                      label: "Delete parameter",
                      icon: "×",
                      className: "danger-button",
                      onClick: () => removeParameterDefinition(selectedRoomType.id, row.key),
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No parameters defined for this room type.</p>
          )}
        </div>
      ) : (
        <div className="room-type-parameters-panel room-type-parameters-editor">
          <p className="empty-state">Select a room type to manage its parameters.</p>
        </div>
      )}
        </div>
      </div>
    </SectionCard>
  );
}

export default RoomTypeLibraryPage;
