// ─────────────────────────────────────────────────────────────────────────
// Method-level campaign timing
//
// A campaign is a PARENT container with a single campaign window. Each
// fundraising method within it can run on its own independent timeline.
// If a method has no explicit dates, it inherits the campaign window.
//
// This module is the single source of truth for:
//   • resolving a method's effective dates (override → inherit)
//   • computing a method's live status (Draft / Scheduled / Active /
//     Completed / Pending Acceptance)
//
// Future methods can plug into this model without touching campaign structure.
// ─────────────────────────────────────────────────────────────────────────
import type { CampaignState, SupportMethod } from "./campaign-context";
import type { Business, BusinessCapabilities } from "@/data/businesses";

export type MethodStatus =
  | "Draft"
  | "Scheduled"
  | "Active"
  | "Completed"
  | "Pending Acceptance";

export interface MethodTiming {
  startDate: string;
  endDate: string;
}

export const METHOD_TYPE_LABELS: Record<SupportMethod, string> = {
  giveback: "Dine & Donate / Local Giveback",
  donations: "Virtual Donations",
  ambassador: "Ambassador Fundraising",
  guestBartending: "Guest Bartending Event",
};

export const METHOD_STATUS_META: Record<
  MethodStatus,
  { label: string; tone: string }
> = {
  Draft: {
    label: "Draft",
    tone: "bg-secondary text-secondary-foreground",
  },
  Scheduled: {
    label: "Scheduled",
    tone: "bg-primary/15 text-primary",
  },
  Active: {
    label: "Active",
    tone: "bg-[oklch(0.94_0.05_150)] text-[oklch(0.4_0.13_150)] dark:bg-[oklch(0.3_0.06_150)] dark:text-[oklch(0.85_0.1_150)]",
  },
  Completed: {
    label: "Completed",
    tone: "bg-secondary text-muted-foreground",
  },
  "Pending Acceptance": {
    label: "Pending Acceptance",
    tone: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
};

/**
 * Resolve the effective dates for a method.
 * Override dates take precedence; otherwise the method inherits the
 * campaign window.
 */
export function resolveMethodDates(
  state: CampaignState,
  method: SupportMethod,
): { startDate: string; endDate: string; inherited: boolean } {
  const override = state.methodTiming?.[method];
  if (override && (override.startDate || override.endDate)) {
    return {
      startDate: override.startDate || state.startDate,
      endDate: override.endDate || state.endDate,
      inherited: false,
    };
  }
  return { startDate: state.startDate, endDate: state.endDate, inherited: true };
}

/**
 * Compute a method's live status.
 *
 * Activation rules:
 *   • Virtual Donations & Ambassador Fundraising launch immediately.
 *   • Guest Bartending launches immediately once event details are complete.
 *   • Dine & Donate / Local Giveback cannot become Active until at least one
 *     business accepts participation (acceptedCount > 0).
 *
 * Once active, the window dates determine Scheduled / Active / Completed.
 */
export function computeMethodStatus(
  state: CampaignState,
  method: SupportMethod,
  opts: { acceptedCount?: number; launched?: boolean } = {},
): MethodStatus {
  const { acceptedCount = 0, launched = true } = opts;

  if (!launched) return "Draft";

  // Giveback is blocked until a business accepts.
  if (method === "giveback" && acceptedCount === 0) {
    return "Pending Acceptance";
  }

  const { startDate, endDate } = resolveMethodDates(state, method);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (startDate) {
    const start = new Date(startDate + "T00:00:00");
    if (today < start) return "Scheduled";
  }
  if (endDate) {
    const end = new Date(endDate + "T00:00:00");
    if (today > end) return "Completed";
  }
  return "Active";
}

// ─────────────────────────────────────────────────────────────────────────
// Fundraising Method model
//
// A Campaign is a CONTAINER. It holds one or more independent Fundraising
// Methods. Each method is its own object with a type, an optional associated
// business, a timeline, a status, donation rules, and (future) performance
// metrics. The overall campaign status is DERIVED from the combined state of
// all its methods — it is never stored independently.
//
// The legacy `state.methods` toggles + selected businesses are the source the
// builder writes to; `deriveMethods()` projects them into the method objects
// the dashboard, success states, and (future) reporting/settlements read from.
// ─────────────────────────────────────────────────────────────────────────

export type MethodType =
  | "dineDonate"
  | "shopDonate"
  | "serviceGiveback"
  | "guestBartending"
  | "virtualDonations"
  | "ambassador";

interface MethodTypeMeta {
  label: string;
  /** Business must accept before the method can become Active. */
  businessDependent: boolean;
  /** Capability flag a business must have to be invited to this method. */
  capability: keyof BusinessCapabilities | null;
}

export const METHOD_TYPE_META: Record<MethodType, MethodTypeMeta> = {
  dineDonate: {
    label: "Dine & Donate",
    businessDependent: true,
    capability: "supportsDineDonate",
  },
  shopDonate: {
    label: "Shop & Donate",
    businessDependent: true,
    capability: "supportsShopDonate",
  },
  serviceGiveback: {
    label: "Service Giveback",
    businessDependent: true,
    capability: "supportsServiceGiveback",
  },
  guestBartending: {
    label: "Guest Bartending Event",
    businessDependent: true,
    capability: "supportsGuestBartending",
  },
  virtualDonations: {
    label: "Virtual Donations",
    businessDependent: false,
    capability: null,
  },
  ambassador: {
    label: "Ambassador Fundraising",
    businessDependent: false,
    capability: "supportsAmbassadorTracking",
  },
};

/** Whether a business supports (can be invited to) a given method type. */
export function businessSupportsMethod(
  business: BusinessCapabilities,
  type: MethodType,
): boolean {
  const cap = METHOD_TYPE_META[type].capability;
  if (!cap) return true;
  return business[cap];
}

/** Method types a business is eligible for, in display order. */
export function businessSupportedMethods(business: BusinessCapabilities): MethodType[] {
  return (Object.keys(METHOD_TYPE_META) as MethodType[]).filter((t) =>
    businessSupportsMethod(business, t),
  );
}

/** The giveback method type a business participates in (its primary one). */
export function givebackMethodForBusiness(business: BusinessCapabilities): MethodType {
  if (business.supportsDineDonate) return "dineDonate";
  if (business.supportsShopDonate) return "shopDonate";
  if (business.supportsServiceGiveback) return "serviceGiveback";
  return "dineDonate";
}

export interface MethodMetrics {
  raised: number;
  supporters: number;
  donations: number;
}

export interface FundraisingMethod {
  id: string;
  type: MethodType;
  label: string;
  businessId?: string;
  businessName?: string;
  startDate: string;
  endDate: string;
  inheritedDates: boolean;
  status: MethodStatus;
  donationRules: { givebackPercent?: number };
  metrics: MethodMetrics;
}

const EMPTY_METRICS: MethodMetrics = { raised: 0, supporters: 0, donations: 0 };

/** Map a legacy SupportMethod timing override onto a method type. */
function timingFor(state: CampaignState, legacy: SupportMethod) {
  return resolveMethodDates(state, legacy);
}

/**
 * Project the campaign state into the list of independent Fundraising Methods.
 * Business-dependent giveback methods become one method PER participating
 * business (each can be accepted/activated independently). Non-business
 * methods (Virtual Donations, Ambassador Fundraising) become a single method
 * that launches immediately.
 */
export function deriveMethods(
  state: CampaignState,
  opts: { businesses?: Business[]; acceptedBusinessIds?: string[] } = {},
): FundraisingMethod[] {
  const { businesses = [], acceptedBusinessIds = [] } = opts;
  const methods: FundraisingMethod[] = [];

  // Virtual Donations — launches immediately, no business needed.
  if (state.methods.donations) {
    const dates = timingFor(state, "donations");
    methods.push({
      id: "method-virtual-donations",
      type: "virtualDonations",
      label: METHOD_TYPE_META.virtualDonations.label,
      startDate: dates.startDate,
      endDate: dates.endDate,
      inheritedDates: dates.inherited,
      status: computeMethodStatus(state, "donations"),
      donationRules: {},
      metrics: { ...EMPTY_METRICS },
    });
  }

  // Ambassador Fundraising — launches immediately, no business needed.
  if (state.methods.ambassador) {
    const dates = timingFor(state, "ambassador");
    methods.push({
      id: "method-ambassador",
      type: "ambassador",
      label: METHOD_TYPE_META.ambassador.label,
      startDate: dates.startDate,
      endDate: dates.endDate,
      inheritedDates: dates.inherited,
      status: computeMethodStatus(state, "ambassador"),
      donationRules: {},
      metrics: { ...EMPTY_METRICS },
    });
  }

  // Dine & Donate / Shop & Donate / Service Giveback — one method per
  // participating business, each business-dependent and pending acceptance.
  if (state.methods.giveback) {
    const dates = timingFor(state, "giveback");
    if (businesses.length === 0) {
      methods.push({
        id: "method-giveback",
        type: "dineDonate",
        label: METHOD_TYPE_META.dineDonate.label,
        startDate: dates.startDate,
        endDate: dates.endDate,
        inheritedDates: dates.inherited,
        status: "Pending Acceptance",
        donationRules: { givebackPercent: state.giveback },
        metrics: { ...EMPTY_METRICS },
      });
    } else {
      for (const b of businesses) {
        const type = givebackMethodForBusiness(b);
        const accepted = acceptedBusinessIds.includes(b.id);
        methods.push({
          id: `method-giveback-${b.id}`,
          type,
          label: `${b.name} ${METHOD_TYPE_META[type].label}`,
          businessId: b.id,
          businessName: b.name,
          startDate: dates.startDate,
          endDate: dates.endDate,
          inheritedDates: dates.inherited,
          status: computeMethodStatus(state, "giveback", {
            acceptedCount: accepted ? 1 : 0,
          }),
          donationRules: { givebackPercent: state.giveback },
          metrics: { ...EMPTY_METRICS },
        });
      }
    }
  }

  // Guest Bartending — business-dependent event, pending until confirmed.
  if (state.methods.guestBartending) {
    const dates = timingFor(state, "guestBartending");
    const accepted = state.guestBartenders.length > 0;
    methods.push({
      id: "method-guest-bartending",
      type: "guestBartending",
      label: METHOD_TYPE_META.guestBartending.label,
      businessName: state.guestBartenders[0]?.business || undefined,
      startDate: dates.startDate,
      endDate: dates.endDate,
      inheritedDates: dates.inherited,
      status: computeMethodStatus(state, "guestBartending", {
        acceptedCount: accepted ? 1 : 0,
      }),
      donationRules: {},
      metrics: { ...EMPTY_METRICS },
    });
  }

  return methods;
}

export type CampaignStatus =
  | "Draft"
  | "Scheduled"
  | "Pending Acceptance"
  | "Live"
  | "Completed";

export const CAMPAIGN_STATUS_META: Record<
  CampaignStatus,
  { label: string; tone: string }
> = {
  Draft: { label: "Draft", tone: "bg-secondary text-secondary-foreground" },
  Scheduled: { label: "Scheduled", tone: "bg-primary/15 text-primary" },
  "Pending Acceptance": {
    label: "Pending Acceptance",
    tone: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  Live: { label: "Live", tone: "bg-primary/15 text-primary" },
  Completed: { label: "Completed", tone: "bg-secondary text-muted-foreground" },
};

/**
 * Derive the overall campaign status from the combined state of its methods.
 *   • Live              — at least one method is Active.
 *   • Scheduled         — methods exist but all are scheduled for the future.
 *   • Pending Acceptance — only waiting on business acceptances.
 *   • Completed         — every method has completed.
 *   • Draft             — no methods yet.
 */
export function computeCampaignStatus(methods: FundraisingMethod[]): CampaignStatus {
  if (methods.length === 0) return "Draft";
  if (methods.some((m) => m.status === "Active")) return "Live";
  if (methods.every((m) => m.status === "Completed")) return "Completed";
  if (methods.some((m) => m.status === "Pending Acceptance")) return "Pending Acceptance";
  if (methods.some((m) => m.status === "Scheduled")) return "Scheduled";
  return "Draft";
}

