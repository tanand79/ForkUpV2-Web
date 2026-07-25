"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Building2, Heart, User } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { stashAccountIntent } from "@/lib/campaign-auth";
import { assetSrc } from "@/lib/utils";
import forkupLogo from "@/assets/forkup-logo-transparent.png";

/**
 * GoFundMe-style create entry (Nick V2 speed layer).
 * Asks who / region / purpose first, then continues to Find Organization.
 * Inputs: none (reads/writes campaign context).
 * Output: navigates to nonprofit-claim with purpose + region saved on state.
 */

type FundraisingFor = "nonprofit" | "someone_else" | "myself";
type Phase = "who" | "region" | "purpose";

const WHO_OPTIONS: {
  id: FundraisingFor;
  title: string;
  hint: string;
  icon: typeof Building2;
}[] = [
  {
    id: "nonprofit",
    title: "A nonprofit or charity",
    hint: "Raise money for an organization you represent or support.",
    icon: Building2,
  },
  {
    id: "someone_else",
    title: "Someone else",
    hint: "Help a person or family in your community.",
    icon: Heart,
  },
  {
    id: "myself",
    title: "Myself",
    hint: "Start a personal fundraiser tied to a cause.",
    icon: User,
  },
];

const REGIONS = [
  "United States",
  "Canada",
  "United Kingdom",
  "Australia",
  "Other",
];

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
  "Wisconsin", "Wyoming", "District of Columbia",
];

export function CreateFundraiser() {
  const { state, update, goTo } = useCampaign();

  const [phase, setPhase] = useState<Phase>("who");
  const [fundraisingFor, setFundraisingFor] = useState<FundraisingFor>(
    (state.fundraisingFor as FundraisingFor) || "nonprofit",
  );
  const [country, setCountry] = useState(
    state.createRegion?.includes("|")
      ? state.createRegion.split("|")[0]!
      : state.createRegion || "United States",
  );
  const [usState, setUsState] = useState(
    state.createRegion?.includes("|") ? state.createRegion.split("|")[1] ?? "" : "",
  );
  const [purpose, setPurpose] = useState(state.description ?? "");

  const canContinueWho = !!fundraisingFor;
  const canContinueRegion =
    !!country && (country !== "United States" || !!usState.trim());
  const canContinuePurpose = purpose.trim().length >= 8;

  const persistAndFindOrg = () => {
    const regionLabel =
      country === "United States" && usState.trim()
        ? `${country}|${usState.trim()}`
        : country;
    stashAccountIntent("nonprofit");
    update({
      fundraisingFor,
      createRegion: regionLabel,
      description: purpose.trim(),
      accountIntent: "nonprofit",
      // Nick defaults until Quick Start confirms methods.
      methods: {
        giveback: false,
        donations: true,
        guestBartending: false,
        ambassador: true,
      },
    });
    goTo("nonprofit-claim");
  };

  return (
    <main className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col px-5 py-8 sm:px-6">
      <button
        type="button"
        onClick={() => {
          if (phase === "who") goTo("website-landing");
          else if (phase === "region") setPhase("who");
          else setPhase("region");
        }}
        className="mb-6 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back
      </button>

      <button
        type="button"
        onClick={() => goTo("website-landing")}
        className="mb-8 self-start"
        aria-label="ForkUp home"
      >
        <img
          src={assetSrc(forkupLogo)}
          alt="ForkUp"
          width={120}
          height={40}
          className="h-9 w-auto object-contain"
        />
      </button>

      {phase === "who" && (
        <>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Create a fundraiser
          </p>
          <h1 className="font-display mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Let&apos;s get started — who are you fundraising for?
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            ForkUp helps nonprofits and communities raise money with local businesses and
            supporters. Pick who this campaign supports.
          </p>
          <div className="mt-8 space-y-3">
            {WHO_OPTIONS.map((opt) => {
              const selected = fundraisingFor === opt.id;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFundraisingFor(opt.id)}
                  className={`flex w-full items-start gap-4 rounded-2xl border-2 p-4 text-left transition-all ${
                    selected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <span
                    className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
                      selected ? "bg-primary text-primary-foreground" : "bg-secondary"
                    }`}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span>
                    <span className="block font-semibold">{opt.title}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{opt.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!canContinueWho}
            onClick={() => setPhase("region")}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark disabled:opacity-40"
          >
            Continue
            <ArrowRight className="size-4" />
          </button>
        </>
      )}

      {phase === "region" && (
        <>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Where
          </p>
          <h1 className="font-display mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Where will this fundraiser take place?
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            We use this to suggest local businesses and show your campaign in the right
            community.
          </p>
          <div className="mt-8 space-y-5">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Country / region</span>
              <select
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  if (e.target.value !== "United States") setUsState("");
                }}
                className="h-12 w-full rounded-xl border border-border bg-card px-4 text-sm"
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            {country === "United States" && (
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">State</span>
                <select
                  value={usState}
                  onChange={(e) => setUsState(e.target.value)}
                  className="h-12 w-full rounded-xl border border-border bg-card px-4 text-sm"
                >
                  <option value="">Select a state</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <button
            type="button"
            disabled={!canContinueRegion}
            onClick={() => setPhase("purpose")}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark disabled:opacity-40"
          >
            Continue
            <ArrowRight className="size-4" />
          </button>
        </>
      )}

      {phase === "purpose" && (
        <>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Your cause
          </p>
          <h1 className="font-display mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            What are you raising money for?
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            A short sentence is enough — ForkUp will help turn this into your campaign story.
          </p>
          <label className="mt-8 block space-y-1.5">
            <span className="text-sm font-semibold">Campaign purpose</span>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={5}
              placeholder="e.g. New instruments for our school music program so every child can learn to play."
              className="w-full rounded-xl border border-border bg-card p-4 text-sm outline-none transition-colors focus:border-primary"
            />
          </label>
          <button
            type="button"
            disabled={!canContinuePurpose}
            onClick={persistAndFindOrg}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark disabled:opacity-40"
          >
            Continue
            <ArrowRight className="size-4" />
          </button>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Next you&apos;ll find or create your nonprofit profile.
          </p>
        </>
      )}
    </main>
  );
}
