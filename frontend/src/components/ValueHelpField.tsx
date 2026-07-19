import React, { useEffect, useMemo, useRef, useState } from "react";
import { normalizeSearchText } from "../utils/filterUtils";
import "./ValueHelpField.css";

export interface ValueHelpOption {
  value: string;
  label: string;
  keywords?: string[];
}

interface ValueHelpFieldProps {
  label: string;
  placeholder: string;
  value: string;
  options: ValueHelpOption[];
  onChange: (value: string) => void;
  allowFreeText?: boolean;
  compact?: boolean;
  disabled?: boolean;
}

const ValueHelpField: React.FC<ValueHelpFieldProps> = ({
  label,
  placeholder,
  value,
  options,
  onChange,
  allowFreeText = false,
  compact = false,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const normalized = normalizeSearchText(query);
    if (!normalized) return options;

    return options.filter((option) => {
      const haystack = normalizeSearchText([option.label, option.value, ...(option.keywords || [])].join(" "));
      return haystack.includes(normalized);
    });
  }, [options, query]);

  const displayLabel = useMemo(() => {
    const match = options.find((option) => option.value === value);
    return match?.label || value;
  }, [options, value]);

  return (
    <div ref={wrapperRef} className={`value-help-field ${compact ? "compact" : ""} ${disabled ? "disabled" : ""}`}>
      <label className="value-help-label">{label}</label>
      <div
        className={`value-help-trigger-row ${open ? "open" : ""} ${disabled ? "disabled" : ""}`}
        onClick={() => !disabled && setOpen(true)}
      >
        <input
          className="value-help-input"
          type="text"
          value={allowFreeText ? value : displayLabel}
          placeholder={placeholder}
          readOnly={!allowFreeText}
          disabled={disabled}
          onChange={(e) => allowFreeText && onChange(e.target.value)}
          onFocus={() => !disabled && setOpen(true)}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen(true);
            }
            if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        <span className="value-help-chevron" aria-hidden="true">▾</span>
      </div>

      {open && !disabled && (
        <div className="value-help-popover">
          <div className="value-help-header">
            <span className="value-help-title">{label}</span>
            <span className="value-help-hint">Search and select a value</span>
          </div>
          <input
            className="value-help-search"
            type="text"
            value={query}
            placeholder={`Search ${label.toLowerCase()} values...`}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div className="value-help-list">
            {filteredOptions.length === 0 && <div className="value-help-empty">No matching values</div>}
            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`value-help-option ${option.value === value ? "selected" : ""}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span className="value-help-option-label">{option.label}</span>
                {option.keywords && option.keywords.length > 0 && (
                  <span className="value-help-option-meta">{option.keywords.join(" • ")}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ValueHelpField;
