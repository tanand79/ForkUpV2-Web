"use client";

/**
 * UsDateInput — date field that always shows US MM/DD/YYYY.
 *
 * Inputs: value as YYYY-MM-DD (campaign state), optional min/max, className, placeholder.
 * Outputs: onChange(YYYY-MM-DD) when a valid US date is typed or picked.
 *
 * Calendar uses the ForkUp-themed shadcn Calendar + Popover (not the native browser picker).
 */

import { forwardRef, useEffect, useId, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

/** Parse YYYY-MM-DD to a local Date (avoids UTC day-shift). */
function isoToLocalDate(iso: string | undefined): Date | undefined {
  const s = toDateOnlyString(iso);
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

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
    const inputId = id ?? autoId;
    const [open, setOpen] = useState(false);
    const [text, setText] = useState(() => formatMmDdYyyy(value));

    useEffect(() => {
      setText(formatMmDdYyyy(value));
    }, [value]);

    const minIso = toDateOnlyString(min) || "";
    const maxIso = toDateOnlyString(max) || "";
    const selected = isoToLocalDate(value);
    const defaultMonth = selected ?? isoToLocalDate(min) ?? new Date();

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

    const isDayDisabled = (date: Date) => {
      const iso = toDateOnlyString(date);
      if (!iso) return true;
      if (minIso && iso < minIso) return true;
      if (maxIso && iso > maxIso) return true;
      return false;
    };

    return (
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
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
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label="Open calendar"
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              <CalendarIcon className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-auto border-border bg-popover p-0 text-popover-foreground shadow-md"
          >
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={defaultMonth}
              disabled={isDayDisabled}
              onSelect={(date) => {
                if (!date) {
                  onChange("");
                  setText("");
                  return;
                }
                const iso = toDateOnlyString(date);
                onChange(iso);
                setText(formatMmDdYyyy(iso));
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  },
);
