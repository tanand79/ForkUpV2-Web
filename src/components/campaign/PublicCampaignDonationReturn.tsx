"use client";

/**
 * Handles return from Stripe Checkout on the public campaign page.
 *
 * Purpose: When URL has ?donation=success&session_id=…, confirm payment
 * with the API (idempotent with webhook), show thank-you, refresh feed.
 *
 * Inputs: campaignSlug, nonprofitName, onConfirmed (refresh donations)
 * Outputs: optional success dialog UI
 *
 * Changelog: Pass 3 — Stripe online donation integration.
 */
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { confirmStripeDonationCheckout } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type Props = {
  campaignSlug: string;
  nonprofitName: string;
  /** Called after a successful confirm so the parent can refresh donation feed. */
  onConfirmed?: () => void;
};

/**
 * Mount on PublicCampaignView. No-op unless donation query params are present.
 */
export function PublicCampaignDonationReturn({
  campaignSlug,
  nonprofitName,
  onConfirmed,
}: Props) {
  const [status, setStatus] = useState<"idle" | "confirming" | "success" | "error">("idle");
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onConfirmedRef = useRef(onConfirmed);
  onConfirmedRef.current = onConfirmed;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const donation = params.get("donation");
    const sessionId = params.get("session_id");

    if (donation === "cancelled") {
      params.delete("donation");
      params.delete("session_id");
      const next = params.toString();
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`,
      );
      return;
    }

    if (donation !== "success" || !sessionId?.startsWith("cs_")) return;

    let cancelled = false;
    setStatus("confirming");

    void (async () => {
      try {
        const result = await confirmStripeDonationCheckout(campaignSlug, sessionId);
        if (cancelled) return;
        setAmount(result.amount ?? null);
        setStatus("success");
        onConfirmedRef.current?.();
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not confirm donation");
        setStatus("error");
      } finally {
        params.delete("donation");
        params.delete("session_id");
        const next = params.toString();
        window.history.replaceState(
          {},
          "",
          `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [campaignSlug]);

  if (status === "idle") return null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) setStatus("idle");
      }}
    >
      <DialogContent className="sm:max-w-[400px] rounded-2xl">
        {status === "confirming" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Loader2 className="size-8 animate-spin text-primary" />
            <DialogTitle>Confirming your donation…</DialogTitle>
            <DialogDescription>Please wait a moment.</DialogDescription>
          </div>
        )}
        {status === "success" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="size-10 text-accent" />
            <DialogTitle className="font-serif text-2xl">Thank you</DialogTitle>
            <DialogDescription className="text-pretty">
              {amount != null
                ? `Your $${Number(amount).toFixed(0)} donation to ${nonprofitName} was received.`
                : `Your donation to ${nonprofitName} was received.`}
            </DialogDescription>
            <button type="button" className="btn-primary mt-2 w-full" onClick={() => setStatus("idle")}>
              Close
            </button>
          </div>
        )}
        {status === "error" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <DialogTitle>Donation status</DialogTitle>
            <DialogDescription className="text-destructive text-pretty">
              {error ?? "Something went wrong confirming payment."}
            </DialogDescription>
            <p className="text-xs text-muted-foreground text-pretty">
              If you were charged, your gift should still appear shortly. Refresh this page in a minute.
            </p>
            <button type="button" className="btn-secondary mt-2 w-full" onClick={() => setStatus("idle")}>
              Close
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
