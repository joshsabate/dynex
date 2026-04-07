import { useEffect, useId, useRef, useState } from "react";

const DEFAULT_STAGE_COLORS = [
  "#3f4a44",
  "#718096",
  "#2563eb",
  "#2f855a",
  "#d7aa5a",
  "#dd6b20",
  "#c53030",
  "#7c3aed",
  "#0f766e",
  "#a16207",
];

function ColorSwatchPicker({
  value,
  onChange,
  presetColors = DEFAULT_STAGE_COLORS,
  ariaLabel = "Select color",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);
  const colorInputRef = useRef(null);
  const customInputId = useId();

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, []);

  return (
    <div className={`color-swatch-picker ${isOpen ? "color-swatch-picker-open" : ""}`} ref={wrapperRef}>
      <button
        type="button"
        className="color-swatch-trigger"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="color-swatch-trigger-chip" style={{ backgroundColor: value }} />
        <span className="color-swatch-trigger-value">{value}</span>
      </button>

      {isOpen ? (
        <div className="color-swatch-popover">
          <div className="color-swatch-grid">
          {presetColors.map((presetColor) => {
            const isSelected = presetColor.toLowerCase() === String(value).toLowerCase();

            return (
              <button
                  key={presetColor}
                  type="button"
                  className={`color-swatch-option ${isSelected ? "color-swatch-option-selected" : ""}`}
                  style={{ backgroundColor: presetColor }}
                  aria-label={`Use color ${presetColor}`}
                  onClick={() => {
                    onChange(presetColor);
                  }}
                />
              );
            })}
          </div>

          <div className="color-swatch-footer">
            <button
              type="button"
              className="secondary-button"
              onClick={() => colorInputRef.current?.click()}
            >
              Custom
            </button>
            <span className="color-swatch-footer-value">{value}</span>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setIsOpen(false)}
            >
              Done
            </button>
          </div>

          <input
            id={customInputId}
            ref={colorInputRef}
            className="color-swatch-native"
            type="color"
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
            }}
            aria-label={`${ariaLabel} custom`}
          />
        </div>
      ) : null}
    </div>
  );
}

export default ColorSwatchPicker;
