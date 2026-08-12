"use client";

/**
 * AI flow Step 3 — Review AI-found website / social links (guest allowed).
 *
 * Purpose: AI discovers official website + social URLs; organizer confirms
 * (Continue) or skips. Typing is not required; Edit lets them correct or add URLs.
 *
 * Inputs: pending org from ai-campaign-flow-storage (set on find-org confirm).
 * Outputs: updated pending org + promotion; navigates to ai-analyzing.
 *
 * Changelog: Additive Edit/Done toggle so AI-found links can be corrected before Continue.
 */
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Globe,
  Loader2,
  Lock,
  Facebook,
  Instagram,
  Youtube,
  Sparkles,
  Pencil,
} from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { resolveAiCampaignSources } from "@/lib/api-ai-campaign-flow";
import {
  loadAiFlowPendingOrg,
  saveAiFlowPendingOrg,
  type AiFlowPendingOrg,
} from "@/lib/ai-campaign-flow-storage";
import { AiFlowShell } from "./AiFlowShell";

function LinkRow({
  icon,
  label,
  value,
  onChange,
  editing,
  placeholder,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange?: (next: string) => void;
  editing?: boolean;
  placeholder?: string;
}) {
  const found = Boolean(value.trim());
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-4 ${
        found ? "border-emerald-300/60 bg-emerald-50/50" : "border-border bg-secondary/30"
      }`}
    >
      <span className="mt-0.5 text-primary">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        {editing && onChange ? (
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        ) : found ? (
          <p className="mt-1 break-all text-sm text-foreground/90">{value}</p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Not found yet</p>
        )}
      </div>
      {!editing ? (
        found ? (
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
        ) : (
          <Circle className="size-4 shrink-0 text-muted-foreground/40" />
        )
      ) : null}
    </div>
  );
}

export function AiConnectSocial() {
  const { update, goTo, state } = useCampaign();
  const [facebookUrl, setFacebookUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  // LinkedIn intentionally omitted from this confirm UI (not shown / not saved).
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [ready, setReady] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  /** Additive: Edit/Done for correcting AI-found website / social URLs. */
  const [editing, setEditing] = useState(false);
  const resolveStartedRef = useRef(false);

  useEffect(() => {
    if (resolveStartedRef.current) return;
    resolveStartedRef.current = true;

    let pending = loadAiFlowPendingOrg();

    if (!pending && state.nonprofitProfile?.organizationName) {
      pending = {
        organizationName: state.nonprofitProfile.organizationName,
        nonprofitId: state.nonprofitProfile.id ?? null,
        website: state.promotion.websiteUrl || null,
        facebookUrl: state.promotion.facebookUrl || null,
        instagramUrl: state.promotion.instagramHandle || null,
        linkedinUrl: null,
        mission: state.nonprofitProfile.mission || null,
        causeCategory: state.nonprofitProfile.causeCategory || null,
        contactName: state.nonprofitProfile.contactName || null,
        contactEmail: state.nonprofitProfile.contactEmail || null,
        verificationStatus: state.nonprofitProfile.verificationStatus || null,
        claimStatus: state.nonprofitProfile.claimStatus || null,
      };
      saveAiFlowPendingOrg(pending);
    }

    if (!pending) {
      goTo("ai-find-org");
      return;
    }

    setReady(true);
    setResolving(true);
    setResolveError(null);

    const seed: AiFlowPendingOrg = pending;
    void (async () => {
      try {
        // Do not seed assumed links into the request as "truth" — send org identity
        // and only known site if we already have one from the selected nonprofit.
        const sources = await resolveAiCampaignSources({
          organizationName: seed.organizationName,
          ein: seed.ein,
          nonprofitId: seed.nonprofitId,
          website: seed.website,
          mission: seed.mission,
          causeCategory: seed.causeCategory,
          city: seed.city,
          state: seed.state,
        });

        const nextWebsite = sources.website || "";
        const nextFacebook = sources.facebookUrl || "";
        const nextInstagram = sources.instagramUrl || "";
        const nextYoutube = sources.youtubeUrl || "";

        saveAiFlowPendingOrg({
          ...seed,
          website: nextWebsite || null,
          facebookUrl: nextFacebook || null,
          instagramUrl: nextInstagram || null,
          linkedinUrl: null,
          youtubeUrl: nextYoutube || null,
          mission: sources.mission || seed.mission,
          causeCategory: sources.causeCategory || seed.causeCategory,
          ein: sources.ein || seed.ein,
          city: sources.city || seed.city,
          state: sources.state || seed.state,
          nonprofitId: sources.nonprofitId ?? seed.nonprofitId,
        });

        setFacebookUrl(nextFacebook);
        setInstagramUrl(nextInstagram);
        setYoutubeUrl(nextYoutube);
        setWebsiteUrl(nextWebsite);

        update({
          promotion: {
            ...state.promotion,
            websiteUrl: nextWebsite,
            facebookUrl: nextFacebook,
            instagramHandle: nextInstagram,
          },
        });
      } catch {
        setResolveError("AI could not finish looking up public links. You can still continue.");
      } finally {
        setResolving(false);
      }
    })();
  }, [goTo, state.nonprofitProfile, state.promotion, update]);

  const continueWithLinks = (opts?: { skipSocial?: boolean }) => {
    const pending = loadAiFlowPendingOrg();
    if (!pending) {
      goTo("ai-find-org");
      return;
    }

    const nextFacebook = opts?.skipSocial ? "" : facebookUrl.trim();
    const nextInstagram = opts?.skipSocial ? "" : instagramUrl.trim();
    const nextYoutube = opts?.skipSocial ? "" : youtubeUrl.trim();
    const nextWebsite = websiteUrl.trim() || pending.website || "";

    saveAiFlowPendingOrg({
      ...pending,
      website: nextWebsite || null,
      facebookUrl: nextFacebook || null,
      instagramUrl: nextInstagram || null,
      linkedinUrl: null,
      youtubeUrl: nextYoutube || null,
    });

    update({
      promotion: {
        ...state.promotion,
        facebookUrl: nextFacebook,
        instagramHandle: nextInstagram,
        websiteUrl: nextWebsite,
        newsletter: state.promotion.newsletter,
      },
    });

    goTo("ai-analyzing");
  };

  // Nonprofit Create Campaign: Back returns to dashboard (not find-org picker).
  const backStep =
    state.accountIntent !== "fundraiser" && state.nonprofitMemberships.length > 0
      ? "nonprofit-dashboard"
      : "ai-find-org";

  if (!ready) {
    return (
      <AiFlowShell title="Finding your links" backStep={backStep}>
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Loading…
        </p>
      </AiFlowShell>
    );
  }

  const anyFound = Boolean(
    websiteUrl.trim() ||
      facebookUrl.trim() ||
      instagramUrl.trim() ||
      youtubeUrl.trim(),
  );

  return (
    <AiFlowShell
      title={resolving ? "Finding your links" : "Review what AI found"}
      subtitle="ForkUp looks up your official website and public social profiles. Edit any link if something looks wrong."
      backStep={backStep}
    >
      {resolving ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-8 text-center">
          <Sparkles className="mx-auto size-6 text-primary" />
          <p className="mt-3 text-sm font-semibold text-primary">
            AI is finding your official website and social links…
          </p>
          <Loader2 className="mx-auto mt-4 size-5 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {resolveError ? (
            <p className="mb-4 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {resolveError}
            </p>
          ) : null}

          <div className="mb-4 flex items-start justify-between gap-3">
            {!anyFound ? (
              <p className="rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
                No public website or social profiles were confirmed. You can edit links below, skip, or
                continue — campaign ideas can still use your organization name and mission.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Confirm these official links, then continue. Images prefer social when available.
              </p>
            )}
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Pencil className="size-3" />
              {editing ? "Done" : "Edit"}
            </button>
          </div>

          <div className="space-y-3">
            <LinkRow
              icon={<Globe className="size-4" />}
              label="Website"
              value={websiteUrl}
              editing={editing}
              onChange={setWebsiteUrl}
              placeholder="https://yourorganization.org"
            />
            <LinkRow
              icon={<Facebook className="size-4" />}
              label="Facebook"
              value={facebookUrl}
              editing={editing}
              onChange={setFacebookUrl}
              placeholder="https://facebook.com/yourorganization"
            />
            <LinkRow
              icon={<Instagram className="size-4" />}
              label="Instagram"
              value={instagramUrl}
              editing={editing}
              onChange={setInstagramUrl}
              placeholder="https://instagram.com/yourorganization"
            />
            <LinkRow
              icon={<Youtube className="size-4" />}
              label="YouTube"
              value={youtubeUrl}
              editing={editing}
              onChange={setYoutubeUrl}
              placeholder="https://youtube.com/@yourorganization"
            />
          </div>

          <button
            type="button"
            onClick={() => continueWithLinks()}
            className="mt-6 w-full rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark"
          >
            Continue
          </button>

          <button
            type="button"
            onClick={() => continueWithLinks({ skipSocial: true })}
            className="mt-3 w-full rounded-full border border-transparent py-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip social links
          </button>

          <p className="mt-6 inline-flex w-full items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <Lock className="size-3.5 shrink-0" />
            We only use public pages. We never post without permission.
          </p>
        </>
      )}
    </AiFlowShell>
  );
}
