/**
 * BusinessLocationAchForm — collect encrypted ACH bank details after invite accept.
 *
 * Purpose: capture bank name, account type, routing/account (plain over HTTPS;
 * server encrypts), authorizer identity, optional canvas-style signature as base64 PNG.
 *
 * Inputs: locationId, optional default authorizer name/email.
 * Outputs: calls saveLocationAch; shows success / error inline.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Landmark } from "lucide-react";
import {
  fetchLocationAch,
  saveLocationAch,
  type LocationAchSettings,
} from "@/lib/api";

type Props = {
  locationId: number;
  defaultAuthorizedBy?: string;
  defaultAuthorizedEmail?: string | null;
};

export function BusinessLocationAchForm({
  locationId,
  defaultAuthorizedBy = "",
  defaultAuthorizedEmail = "",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<LocationAchSettings | null>(null);
  const [bankName, setBankName] = useState("");
  const [holderName, setHolderName] = useState("");
  const [accountType, setAccountType] = useState<"checking" | "savings">("checking");
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [authorizedBy, setAuthorizedBy] = useState(defaultAuthorizedBy);
  const [authorizedEmail, setAuthorizedEmail] = useState(defaultAuthorizedEmail ?? "");
  const [contactEmail, setContactEmail] = useState(defaultAuthorizedEmail ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchLocationAch(locationId);
        if (cancelled) return;
        setExisting(data);
        setBankName(data.achBankName ?? "");
        setHolderName(data.achAccountHolderName ?? "");
        if (data.achAccountType === "savings" || data.achAccountType === "checking") {
          setAccountType(data.achAccountType);
        }
        setAuthorizedBy(data.achAuthorizedBy || defaultAuthorizedBy);
        setAuthorizedEmail(data.achAuthorizedEmail || defaultAuthorizedEmail || "");
        setContactEmail(data.achContactEmail || defaultAuthorizedEmail || "");
        if (data.hasAchData && data.achAuthorizationStatus === "authorized") {
          setSaved(true);
        }
      } catch {
        if (!cancelled) setExisting(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locationId, defaultAuthorizedBy, defaultAuthorizedEmail]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    const pos = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * canvas.width,
        y: ((e.clientY - rect.top) / rect.height) * canvas.height,
      };
    };

    const onDown = (e: PointerEvent) => {
      drawing.current = true;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!drawing.current) return;
      const p = pos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };
    const onUp = () => {
      drawing.current = false;
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, [loading, saved]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!bankName.trim() || !holderName.trim()) {
      setError("Bank name and account holder are required");
      return;
    }
    if (!/^\d{9}$/.test(routingNumber.trim())) {
      setError("Routing number must be 9 digits");
      return;
    }
    if (!/^\d{4,17}$/.test(accountNumber.trim())) {
      setError("Enter a valid account number");
      return;
    }
    if (!authorizedBy.trim() || !authorizedEmail.includes("@")) {
      setError("Authorizer name and email are required");
      return;
    }

    const canvas = canvasRef.current;
    const signatureBase64 = canvas ? canvas.toDataURL("image/png") : undefined;

    setSubmitting(true);
    try {
      await saveLocationAch(locationId, {
        achBankName: bankName.trim(),
        achAccountHolderName: holderName.trim(),
        achAccountType: accountType,
        achRoutingNumber: routingNumber.trim(),
        achAccountNumber: accountNumber.trim(),
        achAuthorizationStatus: "authorized",
        achAuthorizedBy: authorizedBy.trim(),
        achAuthorizedEmail: authorizedEmail.trim(),
        achContactEmail: contactEmail.trim() || authorizedEmail.trim(),
        achSignatureBase64: signatureBase64,
      });
      setSaved(true);
      setRoutingNumber("");
      setAccountNumber("");
      clearSignature();
      setExisting(await fetchLocationAch(locationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save ACH details");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (saved && existing?.hasAchData) {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-left">
        <div className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-primary">
          <Landmark className="size-4" />
          ACH on file
        </div>
        <p className="text-sm text-muted-foreground">
          {existing.achBankName ?? "Bank"} ····{existing.achAccountLast4 ?? "****"} (
          {existing.achAccountType ?? "account"}) — {existing.achAuthorizationStatus}
        </p>
        <button
          type="button"
          className="mt-4 text-sm font-semibold text-primary underline-offset-2 hover:underline"
          onClick={() => setSaved(false)}
        >
          Update bank details
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6 text-left">
      <div className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
        <Landmark className="size-4" />
        Set up ACH for settlement
      </div>
      <p className="text-sm text-muted-foreground">
        Routing and account numbers are encrypted before storage. ForkUp does not debit your
        account from this screen.
      </p>

      {existing?.hasAchData && (
        <p className="text-xs text-muted-foreground">
          Current on file: ····{existing.achAccountLast4 ?? "****"}
          {existing.achRoutingNumberMasked ? ` · routing ${existing.achRoutingNumberMasked}` : ""}
        </p>
      )}

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Bank name</span>
        <input
          className="w-full rounded-xl border border-border bg-background px-3 py-2"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          required
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Account holder name</span>
        <input
          className="w-full rounded-xl border border-border bg-background px-3 py-2"
          value={holderName}
          onChange={(e) => setHolderName(e.target.value)}
          required
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Account type</span>
        <select
          className="w-full rounded-xl border border-border bg-background px-3 py-2"
          value={accountType}
          onChange={(e) => setAccountType(e.target.value as "checking" | "savings")}
        >
          <option value="checking">Checking</option>
          <option value="savings">Savings</option>
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Routing number</span>
        <input
          className="w-full rounded-xl border border-border bg-background px-3 py-2"
          inputMode="numeric"
          autoComplete="off"
          value={routingNumber}
          onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
          required
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Account number</span>
        <input
          className="w-full rounded-xl border border-border bg-background px-3 py-2"
          inputMode="numeric"
          autoComplete="off"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 17))}
          required
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Authorized by</span>
        <input
          className="w-full rounded-xl border border-border bg-background px-3 py-2"
          value={authorizedBy}
          onChange={(e) => setAuthorizedBy(e.target.value)}
          required
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Authorizer email</span>
        <input
          type="email"
          className="w-full rounded-xl border border-border bg-background px-3 py-2"
          value={authorizedEmail}
          onChange={(e) => setAuthorizedEmail(e.target.value)}
          required
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">ACH contact email</span>
        <input
          type="email"
          className="w-full rounded-xl border border-border bg-background px-3 py-2"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
        />
      </label>

      <div>
        <div className="mb-1 flex items-center justify-between text-sm font-medium">
          <span>Signature</span>
          <button type="button" className="text-xs text-primary" onClick={clearSignature}>
            Clear
          </button>
        </div>
        <canvas
          ref={canvasRef}
          width={480}
          height={140}
          className="w-full touch-none rounded-xl border border-border bg-background"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="btn-primary inline-flex w-full items-center justify-center rounded-2xl py-3 text-sm disabled:opacity-60"
      >
        {submitting ? <Loader2 className="size-4 animate-spin" /> : "Save ACH authorization"}
      </button>
    </form>
  );
}
