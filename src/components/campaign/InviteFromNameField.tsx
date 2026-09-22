/**
 * Editable From display name for invite / lifecycle emails.
 *
 * Purpose: Same idea as email templates — name only shown in the inbox.
 * SMTP From address stays platform. Optional; leave blank for org default.
 *
 * Inputs: controlled value + onChange.
 * Outputs: labeled text input.
 */
"use client";

const fieldClass =
  "h-12 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/30";

type Props = {
  value: string;
  onChange: (name: string) => void;
  className?: string;
  label?: string;
  disabled?: boolean;
};

export function InviteFromNameField({
  value,
  onChange,
  className,
  label = "From name",
  disabled,
}: Props) {
  return (
    <div className={className ?? "space-y-2"}>
      <label className="block text-sm font-semibold">
        {label}
        <span className="ml-1 font-normal text-muted-foreground">
          (shown on the email)
        </span>
      </label>
      <input
        type="text"
        className={fieldClass}
        value={value}
        disabled={disabled}
        maxLength={255}
        placeholder="Name shown as From on the email"
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        Name only — the sending address stays ForkUp. Leave blank to use the
        organization default name.
      </p>
    </div>
  );
}
