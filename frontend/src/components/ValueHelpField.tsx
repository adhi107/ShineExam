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

  // Clean search placeholder without awkward repetitions
  const searchPlaceholder = useMemo(() => {
    const cleanLabel = label.replace(/^search\s+/i, "").trim();
    return cleanLabel ? `Filter ${cleanLabel.toLowerCase()}...` : "Filter options...";
  }, [label]);

  return (
    <div ref={wrapperRef} className={`value-help-field ${compact ? "compact" : ""} ${disabled ? "disabled" : ""}`}>
      {!compact && <label className="value-help-label">{label}</label>}
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
            <span className="value-help-hint">Select or type to filter options</span>
          </div>

          <div className="value-help-search-bar">
            <span className="value-help-search-icon">🔍</span>
            <input
              className="value-help-search"
              type="text"
              value={query}
              placeholder={searchPlaceholder}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {query && (
              <button
                type="button"
                className="value-help-clear-btn"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="value-help-list">
            {filteredOptions.length === 0 && (
              <div className="value-help-empty">No matching items found</div>
            )}
            {filteredOptions.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`value-help-option ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <div className="value-help-option-content">
                    <span className="value-help-option-label">{option.label}</span>
                    {option.keywords && option.keywords.length > 0 && (
                      <div className="value-help-option-badges">
                        {option.keywords.map((kw, i) => {
                          const lower = kw.toLowerCase();
                          const isPass = lower.includes("pass");
                          const isFail = lower.includes("improvement") || lower.includes("fail");
                          return (
                            <span
                              key={i}
                              className={`value-help-badge ${isPass ? "badge-pass" : isFail ? "badge-fail" : ""}`}
                            >
                              {kw}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {isSelected && <span className="value-help-check">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ValueHelpField;
