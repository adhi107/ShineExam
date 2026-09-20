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
        <>
          <div
            className="value-help-backdrop"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="value-help-popover" role="dialog" aria-modal="true">
            <div className="value-help-header">
              <div className="value-help-header-text">
                <span className="value-help-title">{label}</span>
                <span className="value-help-hint">Select or type to filter options</span>
              </div>
              <button
                type="button"
                className="value-help-mobile-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="value-help-search-bar">
              <span className="value-help-search-icon" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
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
                <div className="value-help-empty">No matching reports found</div>
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
                    {isSelected && (
                      <span className="value-help-check" aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ValueHelpField;
