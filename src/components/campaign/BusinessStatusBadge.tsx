import {
  BUSINESS_STATUS_LABEL,
  businessStatusTone,
  type CampaignBusinessStatus,
  fromApiAcceptanceStatus,
  fromLegacyInviteStatus,
  type LegacyBusinessInviteStatus,
} from "@/lib/business-status";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<
  ReturnType<typeof businessStatusTone>,
  string
> = {
  default: "bg-secondary text-secondary-foreground",
  success: "bg-primary/10 text-primary",
  warn: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  muted: "bg-muted text-muted-foreground",
  destructive: "bg-destructive/10 text-destructive",
};

interface BusinessStatusBadgeProps {
  status: CampaignBusinessStatus;
  className?: string;
}

export function BusinessStatusBadge({ status, className }: BusinessStatusBadgeProps) {
  const tone = businessStatusTone(status);
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TONE_CLASS[tone],
        className,
      )}
    >
      {BUSINESS_STATUS_LABEL[status]}
    </span>
  );
}

/** Convenience for legacy builder invite statuses. */
export function LegacyInviteStatusBadge({
  status,
  className,
}: {
  status: LegacyBusinessInviteStatus;
  className?: string;
}) {
  return (
    <BusinessStatusBadge
      status={fromLegacyInviteStatus(status)}
      className={className}
    />
  );
}

/** Convenience for API acceptance_status strings. */
export function ApiAcceptanceStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <BusinessStatusBadge
      status={fromApiAcceptanceStatus(status)}
      className={className}
    />
  );
}
