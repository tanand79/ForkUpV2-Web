"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Receipt,
  Loader2,
  UploadCloud,
  CheckCircle2,
  MapPin,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { fetchCampaign, uploadReceipt, type ReceiptUploadResult } from "@/lib/api";
import type { ParticipatingLocation } from "@/lib/campaign-types";
import {
  readReceiptUploadPrefillFromSearch,
  readStoredParticipant,
} from "@/lib/receipt-upload-href";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

function locationKey(loc: ParticipatingLocation): string {
  return `${loc.businessId}-${loc.locationId}-${loc.methodId}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected image"));
    reader.readAsDataURL(file);
  });
}

export function ReceiptUpload() {
  const { state, goTo } = useCampaign();

  const [urlSlug, setUrlSlug] = useState<string | null>(null);
  const prefillApplied = useRef(false);
  const [visitLocked, setVisitLocked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setUrlSlug(new URLSearchParams(window.location.search).get("campaign"));
  }, []);
  const slug = state.campaignSlug ?? urlSlug;

  const [locations, setLocations] = useState<ParticipatingLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedKey, setSelectedKey] = useState<string>("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [claimedSubtotal, setClaimedSubtotal] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<ReceiptUploadResult | null>(null);

  const load = useCallback(async () => {
    if (!slug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const campaign = await fetchCampaign(slug);
      setLocations(campaign.participatingLocations ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load campaign");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (prefillApplied.current || locations.length === 0) return;
    if (typeof window === "undefined") return;

    const fromUrl = readReceiptUploadPrefillFromSearch(window.location.search);
    const fromStore = readStoredParticipant();
    const first = fromUrl.firstName || fromStore.firstName || "";
    const mail = fromUrl.email || fromStore.email || "";
    if (first) setFirstName(first);
    if (mail) setEmail(mail);

    let matchedKey = "";
    if (fromUrl.businessId != null && fromUrl.locationId != null && fromUrl.methodId != null) {
      const key = `${fromUrl.businessId}-${fromUrl.locationId}-${fromUrl.methodId}`;
      if (locations.some((loc) => locationKey(loc) === key)) {
        matchedKey = key;
      }
    }
    if (!matchedKey && locations.length === 1) {
      matchedKey = locationKey(locations[0]);
    }

    if (matchedKey) {
      setSelectedKey(matchedKey);
      setVisitLocked(Boolean(first && mail && fromUrl.businessId != null));
    }

    prefillApplied.current = true;
  }, [locations]);

  const selected = locations.find((loc) => locationKey(loc) === selectedKey) ?? null;
  const showFullPicker = !visitLocked || !selected;

  const handleFile = async (file: File | null) => {
    setSubmitError(null);
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setSubmitError("Image is too large — please choose a file under 8 MB.");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setImageDataUrl(dataUrl);
      setImageMimeType(file.type || "image/jpeg");
      setImageName(file.name);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not read the image");
    }
  };

  const claimed = Number(claimedSubtotal);
  const hasClaimedTotal = Number.isFinite(claimed) && claimed > 0;

  const canSubmit =
    !!slug &&
    !!selected &&
    firstName.trim().length > 0 &&
    email.includes("@") &&
    !!imageDataUrl &&
    hasClaimedTotal &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !selected || !imageDataUrl || !hasClaimedTotal) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await uploadReceipt(slug, {
        firstName: firstName.trim(),
        email: email.trim(),
        businessId: selected.businessId,
        locationId: selected.locationId,
        methodId: selected.methodId,
        imageBase64: imageDataUrl,
        imageMimeType: imageMimeType ?? "image/jpeg",
        claimedSubtotal: claimed,
      });
      setResult(res);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setResult(null);
    setClaimedSubtotal("");
    setImageDataUrl(null);
    setImageMimeType(null);
    setImageName(null);
    setSubmitError(null);
  };

  if (!slug) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-12 text-center">
        <Receipt className="mx-auto size-10 text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">
          Open or launch a campaign first to upload a receipt.
        </p>
        <button type="button" onClick={() => goTo("dashboard")} className="btn-primary mt-4">
          Go to dashboard
        </button>
      </main>
    );
  }

  if (result) {
    const donation = result.calculatedDonation;
    const eligible = result.eligibleSubtotal;
    return (
      <main className="mx-auto max-w-2xl px-5 py-12 text-center">
        <div className="inline-flex size-16 items-center justify-center rounded-full bg-accent/10">
          <CheckCircle2 className="size-8 text-accent" />
        </div>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Receipt submitted</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Thanks! Your receipt is now in review. We&rsquo;ll email you once it&rsquo;s approved.
        </p>

        <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-border bg-card p-5 text-left text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className="font-semibold capitalize">{result.reviewStatus}</span>
          </div>
          {result.ocrProvider && (
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">OCR</span>
              <span className="text-right font-semibold capitalize">
                {result.ocrProvider}
                {result.ocrExtractStatus ? ` · ${result.ocrExtractStatus.replace(/_/g, " ")}` : ""}
              </span>
            </div>
          )}
          {result.merchantName && (
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Merchant</span>
              <span className="truncate text-right font-semibold">{result.merchantName}</span>
            </div>
          )}
          {eligible != null && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Eligible amount</span>
              <span className="font-semibold">${eligible.toFixed(2)}</span>
            </div>
          )}
          {donation != null && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Estimated donation</span>
              <span className="font-semibold text-primary">${donation.toFixed(2)}</span>
            </div>
          )}
          {result.isManualSubtotal && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
              Amount may need manual confirmation during review.
            </p>
          )}
          {result.message && (
            <p className="mt-3 text-xs text-muted-foreground">{result.message}</p>
          )}
          {!result.message && (
            <p className="mt-3 text-xs text-muted-foreground">
              Final amounts are confirmed by the organizer when they review your receipt.
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-col items-center gap-2.5">
          <button type="button" onClick={resetForm} className="btn-primary">
            Upload another receipt
          </button>
          <button
            type="button"
            onClick={() => goTo("dashboard")}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Back to dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
        <Receipt className="size-6 text-primary" />
        Upload your receipt
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {visitLocked && selected
          ? `Add a photo and the total for your visit at ${selected.businessName}.`
          : "Dined or shopped at a participating business? Upload your receipt so your visit turns into a donation for the campaign."}
      </p>

      {loading && (
        <div className="mt-10 flex justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      )}

      {loadError && <p className="mt-4 text-sm text-destructive">{loadError}</p>}

      {!loading && !loadError && locations.length === 0 && (
        <p className="mt-8 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No participating businesses are accepting receipts for this campaign yet.
        </p>
      )}

      {!loading && !loadError && locations.length > 0 && (
        <form onSubmit={handleSubmit} className="mt-8 space-y-7">
          {showFullPicker ? (
            <div>
              <label className="text-sm font-semibold">Where did you visit?</label>
              <div className="mt-3 grid gap-2.5">
                {locations.map((loc) => {
                  const key = locationKey(loc);
                  const active = key === selectedKey;
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setSelectedKey(key)}
                      className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors ${
                        active
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-primary/40"
                      }`}
                    >
                      <MapPin
                        className={`mt-0.5 size-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{loc.businessName}</span>
                        <span className="block text-sm text-muted-foreground">
                          {loc.locationName}
                          {loc.city ? ` · ${loc.city}` : ""}
                          {loc.state ? `, ${loc.state}` : ""}
                        </span>
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {loc.participationMethod} · {loc.givebackPercentage}% giveback
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            selected && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="font-semibold">{selected.businessName}</p>
                      <p className="text-sm text-muted-foreground">
                        {selected.locationName}
                        {selected.city ? ` · ${selected.city}` : ""}
                        {selected.state ? `, ${selected.state}` : ""}
                      </p>
                      <p className="mt-1 text-sm text-foreground">
                        {firstName}
                        {email ? ` · ${email}` : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVisitLocked(false)}
                    className="shrink-0 text-xs font-semibold text-primary hover:underline"
                  >
                    Change
                  </button>
                </div>
              </div>
            )
          )}

          {showFullPicker && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">First name</span>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Your first name"
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
            </div>
          )}

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Receipt total</span>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={claimedSubtotal}
                onChange={(e) => setClaimedSubtotal(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-border bg-card py-3 pl-8 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              Enter the amount on your receipt. If the photo cannot be read automatically, this
              total is used for review.
            </span>
          </label>

          <div className="space-y-1.5">
            <span className="text-sm font-semibold">Receipt photo</span>
            <label
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
                imageDataUrl ? "border-primary/50 bg-primary/5" : "border-border bg-card hover:border-primary/40"
              }`}
            >
              {imageDataUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageDataUrl}
                    alt="Receipt preview"
                    className="max-h-56 w-auto rounded-lg object-contain"
                  />
                  <span className="text-xs text-muted-foreground">
                    {imageName ?? "Selected image"} — tap to change
                  </span>
                </>
              ) : (
                <>
                  <UploadCloud className="size-8 text-muted-foreground" />
                  <span className="text-sm font-medium">Tap to add a photo of your receipt</span>
                  <span className="text-xs text-muted-foreground">JPG, PNG, or WEBP · up to 8 MB</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {submitError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <p>{submitError}</p>
              {(submitError.toLowerCase().includes("duplicate") ||
                /\(.*matched\)/i.test(submitError)) && (
                <p className="mt-1 text-xs">
                  If this is a different visit, check the date and amount or ask the organizer to
                  reject the earlier receipt first.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => goTo("dashboard")}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  Submit receipt
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
