"use client";

/**
 * UsDateInput — date field that always shows US MM/DD/YYYY.
 *
 * Inputs: value as YYYY-MM-DD (campaign state), optional min, className, placeholder.
 * Outputs: onChange(YYYY-MM-DD) when a valid US date is entered or picked.
 *
 * Native type="date" follows OS locale (e.g. DD-MM-YYYY); this control forces US display.
 */

import { forwardRef, useEffect, useId, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { formatMmDdYyyy, parseFlexibleDateInput, toDateOnlyString } from "@/lib/date-only";

type UsDateInputProps = {
  value: string;
  onChange: (isoDate: string) => void;
  min?: string;
  max?: string;
  className?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  "aria-label"?: string;
};

export const UsDateInput = forwardRef<HTMLInputElement, UsDateInputProps>(
  function UsDateInput(
    {
      value,
      onChange,
      min,
      max,
      className = "",
      placeholder = "MM/DD/YYYY",
      id,
      disabled,
      required,
      "aria-label": ariaLabel,
    },
    ref,
  ) {
    const autoId = useId();
    const pickerId = id ?? autoId;
    const pickerRef = useRef<HTMLInputElement>(null);
    const [text, setText] = useState(() => formatMmDdYyyy(value));

    useEffect(() => {
      setText(formatMmDdYyyy(value));
    }, [value]);

    const commitText = (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        onChange("");
        setText("");
        return;
      }
      const iso = parseFlexibleDateInput(trimmed);
      if (!iso) {
        setText(formatMmDdYyyy(value));
        return;
      }
      const minIso = toDateOnlyString(min);
      const maxIso = toDateOnlyString(max);
      if (minIso && iso < minIso) {
        setText(formatMmDdYyyy(value));
        return;
      }
      if (maxIso && iso > maxIso) {
        setText(formatMmDdYyyy(value));
        return;
      }
      onChange(iso);
      setText(formatMmDdYyyy(iso));
    };

    return (
      <div className="relative">
        <input
          ref={ref}
          id={pickerId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-label={ariaLabel}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => commitText(text)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitText(text);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className={`pr-10 ${className}`.trim()}
        />
        <input
          ref={pickerRef}
          type="date"
          lang="en-US"
          value={value || ""}
          min={min || undefined}
          max={max || undefined}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            onChange(e.target.value);
            setText(formatMmDdYyyy(e.target.value));
          }}
          className="pointer-events-none absolute inset-0 opacity-0"
        />
        <button
          type="button"
          disabled={disabled}
          aria-label="Open calendar"
          onClick={() => {
            const el = pickerRef.current;
            if (!el) return;
            try {
              el.showPicker?.();
            } catch {
              el.click();
            }
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          <Calendar className="size-4" />
        </button>
      </div>
    );
  },
);
