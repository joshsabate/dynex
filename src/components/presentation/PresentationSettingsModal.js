const DETAIL_FIELDS = [
  { key: "specification", label: "Specification" },
  { key: "gradeOrQuality", label: "Grade / Quality" },
  { key: "brand", label: "Brand" },
  { key: "finishOrVariant", label: "Finish / Variant" },
];

const GROUP_BY_OPTIONS = [
  { value: "room", label: "Room" },
  { value: "stage", label: "Stage" },
];

const LAYOUT_OPTIONS = [
  { value: "line_sheet", label: "Line sheet" },
  { value: "cards", label: "Cards" },
];

const PRIMARY_LABEL_OPTIONS = [
  { value: "coreName", label: "Core Name (default)" },
  { value: "itemName", label: "Item Name" },
];

const VISIBILITY_TOGGLES = [
  { key: "totalsOnly", label: "Totals only" },
  { key: "groupedBreakdown", label: "Grouped breakdown" },
  { key: "hideUnitRates", label: "Hide unit rates" },
  { key: "hideQuantities", label: "Hide quantities" },
  { key: "hideLineItems", label: "Hide line items" },
];

const TOTAL_VISIBILITY_TOGGLES = [
  { key: "showSummaryTotals", label: "Show summary totals" },
  { key: "showGroupTotals", label: "Show group totals" },
  { key: "showItemTotals", label: "Show item totals" },
];

const VISIBILITY_DEFAULTS = {
  totalsOnly: false,
  groupedBreakdown: true,
  hideUnitRates: false,
  hideQuantities: false,
  hideLineItems: false,
  showSummaryTotals: true,
  showGroupTotals: true,
  showItemTotals: true,
};

function PresentationSettingsModal({ isOpen, settings = {}, onClose, onChange }) {
  if (!isOpen) {
    return null;
  }

  const detailFields = settings.clientLineItemDetailFields || [];
  const visibility = settings.visibility || {};
  const getVisibilityValue = (key) =>
    typeof visibility[key] === "boolean" ? visibility[key] : VISIBILITY_DEFAULTS[key];

  const toggleDetailField = (field) => {
    const next = new Set(detailFields);
    if (next.has(field)) {
      next.delete(field);
    } else {
      next.add(field);
    }

    const ordered = DETAIL_FIELDS.map((option) => option.key).filter((key) => next.has(key));
    onChange({ clientLineItemDetailFields: ordered });
  };

  const handleVisibilityToggle = (key) => {
    onChange({
      visibility: {
        [key]: !getVisibilityValue(key),
      },
    });
  };

  return (
    <div className="estimate-builder-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="estimate-builder-modal presentation-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Presentation settings"
        onClick={(event) => event.stopPropagation()}
      >
        <form className="estimate-builder-modal-form">
          <div className="estimate-builder-modal-header">
            <div>
              <p className="estimate-builder-modal-kicker">Presentation Settings</p>
              <h2>Configure client output</h2>
            </div>
            <button type="button" className="secondary-button" onClick={onClose}>
              Close
            </button>
          </div>

          <div className="presentation-settings-modal__grid">
            <label className="field">
              <span>Layout</span>
              <select
                value={settings.presentationLayout || "line_sheet"}
                onChange={(event) => onChange({ presentationLayout: event.target.value })}
              >
                {LAYOUT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Group by</span>
              <select
                value={settings.clientGroupBy || "room"}
                onChange={(event) => onChange({ clientGroupBy: event.target.value })}
              >
                {GROUP_BY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Primary label</span>
              <select
                value={settings.clientPrimaryLabelField || "coreName"}
                onChange={(event) => onChange({ clientPrimaryLabelField: event.target.value })}
              >
                {PRIMARY_LABEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="presentation-settings-modal__section">
            <p className="presentation-settings-modal__section-title">Supporting detail fields</p>
            <div className="presentation-settings-modal__field-grid">
              {DETAIL_FIELDS.map((field) => (
                <label key={field.key} className="presentation-settings-modal__checkbox">
                  <input
                    type="checkbox"
                    checked={detailFields.includes(field.key)}
                    onChange={() => toggleDetailField(field.key)}
                  />
                  <span>{field.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="presentation-settings-modal__section">
            <p className="presentation-settings-modal__section-title">Quantity & unit</p>
            <div className="presentation-settings-modal__field-grid">
              <label className="presentation-settings-modal__checkbox">
                <input
                  type="checkbox"
                  checked={!settings.clientHideQuantities}
                  onChange={(event) =>
                    onChange({
                      clientHideQuantities: !event.target.checked,
                    })
                  }
                />
                <span>Show quantities</span>
              </label>
              <label className="presentation-settings-modal__checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(settings.clientShowUnits)}
                  onChange={(event) =>
                    onChange({
                      clientShowUnits: event.target.checked,
                    })
                  }
                />
                <span>Show units</span>
              </label>
            </div>
          </div>

          <div className="presentation-settings-modal__section">
            <p className="presentation-settings-modal__section-title">Visibility controls</p>
            <div className="presentation-settings-modal__field-grid">
              {VISIBILITY_TOGGLES.map((option) => (
                <label key={option.key} className="presentation-settings-modal__checkbox">
                  <input
                    type="checkbox"
                    checked={getVisibilityValue(option.key)}
                    onChange={() => handleVisibilityToggle(option.key)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="presentation-settings-modal__section">
            <p className="presentation-settings-modal__section-title">Totals display</p>
            <div className="presentation-settings-modal__field-grid">
              {TOTAL_VISIBILITY_TOGGLES.map((option) => (
                <label key={option.key} className="presentation-settings-modal__checkbox">
                  <input
                    type="checkbox"
                    checked={getVisibilityValue(option.key)}
                    onChange={() => handleVisibilityToggle(option.key)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="estimate-builder-modal-actions">
            <button type="button" className="primary-button" onClick={onClose}>
              Done
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PresentationSettingsModal;
