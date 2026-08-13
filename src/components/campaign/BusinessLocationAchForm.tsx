/**
 * BusinessLocationAchForm — collect encrypted ACH bank details after invite accept.
 *
 * Purpose: capture bank name, account type, routing/account (plain over HTTPS;
 * server encrypts), authorizer identity, digital signature (upload PNG/JPG or draw).
 *
 * Inputs: locationId, optional default authorizer name/email.
 * Outputs: calls saveLocationAch; shows success / error inline.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Landmark, Loader2, Lock, PenLine, Trash2, Upload } from "lucide-react";
import {
  fetchLocationAch,
  saveLocationAch,
  type LocationAchSettings,
} from "@/lib/api";
import { apiUrl } from "@/lib/api-config";

type Props = {
  locationId: number;
  defaultAuthorizedBy?: string;
  defaultAuthorizedEmail?: string | null;
};

type SignatureMode = "none" | "upload" | "draw";

function achSignatureUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return apiUrl(path);
}

function isCanvasBlank(canvas: HTMLCanvasElement): boolean {
  const blank = document.createElement("canvas");
  blank.width = canvas.width;
  blank.height = canvas.height;
  return canvas.toDataURL("image/png") === blank.toDataURL("image/png");
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read signature file"));
    reader.readAsDataURL(file);
  });
}

export function BusinessLocationAchForm({
  locationId,
  defaultAuthorizedBy = "",
  defaultAuthorizedEmail = "",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
  const [sigMode, setSigMode] = useState<SignatureMode>("none");
  const [sigFile, setSigFile] = useState<File | null>(null);
  const [sigPreview, setSigPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const existingSignatureUrl = achSignatureUrl(existing?.achSignaturePath);

  const resetSignatureInputs = useCallback((restoreExisting = true) => {
    setSigMode("none");
    setSigFile(null);
    setSigPreview(restoreExisting ? existingSignatureUrl : null);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [existingSignatureUrl]);

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
        if (data.achSignaturePath) {
          setSigPreview(achSignatureUrl(data.achSignaturePath));
        }
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
    if (sigMode !== "draw") return;
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
  }, [loading, saved, sigMode]);

  const clearDrawnSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSigFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["png", "jpg", "jpeg"].includes(ext)) {
      setError("Signature must be a PNG or JPG image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Signature image must be under 5 MB");
      return;
    }
    setError(null);
    setSigFile(file);
    setSigPreview(URL.createObjectURL(file));
  };

  const resolveSignatureBase64 = async (): Promise<string | undefined> => {
    if (sigMode === "upload" && sigFile) {
      return fileToDataUrl(sigFile);
    }
    if (sigMode === "draw" && canvasRef.current) {
      const canvas = canvasRef.current;
      if (isCanvasBlank(canvas)) {
        throw new Error("Please draw your signature before saving");
      }
      return canvas.toDataURL("image/png");
    }
    return undefined;
  };

  const hasExistingNumbers = Boolean(
    existing?.hasAchData && (existing.achAccountLast4 || existing.achRoutingNumberMasked),
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!bankName.trim() || !holderName.trim()) {
      setError("Bank name and account holder are required");
      return;
    }

    const routingTrim = routingNumber.trim();
    const accountTrim = accountNumber.trim();
    if (routingTrim && !/^\d{9}$/.test(routingTrim)) {
      setError("Routing number must be 9 digits");
      return;
    }
    if (accountTrim && !/^\d{4,17}$/.test(accountTrim)) {
      setError("Enter a valid account number");
      return;
    }
    if (!hasExistingNumbers && !routingTrim) {
      setError("Routing number is required");
      return;
    }
    if (!hasExistingNumbers && !accountTrim) {
      setError("Account number is required");
      return;
    }
    if (!authorizedBy.trim() || !authorizedEmail.includes("@")) {
      setError("Authorizer name and email are required");
      return;
    }

    let signatureBase64: string | undefined;
    try {
      signatureBase64 = await resolveSignatureBase64();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid signature");
      return;
    }

    const needsSignature = !existing?.achSignaturePath;
    if (needsSignature && !signatureBase64) {
      setError("Upload or draw your digital signature to authorize ACH");
      return;
    }

    setSubmitting(true);
    try {
      await saveLocationAch(locationId, {
        achBankName: bankName.trim(),
        achAccountHolderName: holderName.trim(),
        achAccountType: accountType,
        ...(routingTrim ? { achRoutingNumber: routingTrim } : {}),
        ...(accountTrim ? { achAccountNumber: accountTrim } : {}),
        achAuthorizationStatus: "authorized",
        achAuthorizedBy: authorizedBy.trim(),
        achAuthorizedEmail: authorizedEmail.trim(),
        achContactEmail: contactEmail.trim() || authorizedEmail.trim(),
        ...(signatureBase64 ? { achSignatureBase64: signatureBase64 } : {}),
      });
      setSaved(true);
      setRoutingNumber("");
      setAccountNumber("");
      resetSignatureInputs(false);
      const refreshed = await fetchLocationAch(locationId);
      setExisting(refreshed);
      if (refreshed.achSignaturePath) {
        setSigPreview(achSignatureUrl(refreshed.achSignaturePath));
      }
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
          {existing.achBankName ?? "Bank"} · {existing.achAccountType ?? "account"} ·····
          {existing.achAccountLast4 ?? "****"} — {existing.achAuthorizationStatus}
        </p>
        {(existing.achRoutingNumberMasked || existing.achAccountNumberMasked) && (
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {existing.achRoutingNumberMasked
              ? `Routing ${existing.achRoutingNumberMasked}`
              : null}
            {existing.achRoutingNumberMasked && existing.achAccountNumberMasked ? " · " : null}
            {existing.achAccountNumberMasked
              ? `Account ${existing.achAccountNumberMasked}`
              : null}
          </p>
        )}
        {existingSignatureUrl && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Digital signature
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={existingSignatureUrl}
              alt="ACH authorization signature on file"
              className="max-h-24 w-auto rounded-xl border border-border bg-white object-contain p-2"
            />
          </div>
        )}
        <button
          type="button"
          className="mt-4 text-sm font-semibold text-primary underline-offset-2 hover:underline"
          onClick={() => {
            setSaved(false);
            resetSignatureInputs(true);
          }}
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
        <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm">
          <p className="font-medium text-foreground">Currently on file</p>
          <p className="mt-1 text-muted-foreground">
            {existing.achBankName ?? "Bank"} · {existing.achAccountType ?? "account"} ·····
            {existing.achAccountLast4 ?? "****"}
          </p>
          {existing.achRoutingNumberMasked && (
            <p className="text-muted-foreground">
              Routing {existing.achRoutingNumberMasked}
              {existing.achAccountNumberMasked
                ? ` · Account ${existing.achAccountNumberMasked}`
                : ""}
            </p>
          )}
        </div>
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
        <span className="mb-1 block font-medium">
          Routing number
          {existing?.achRoutingNumberMasked ? (
            <span className="ml-2 font-normal text-muted-foreground">
              on file: {existing.achRoutingNumberMasked}
            </span>
          ) : null}
        </span>
        <input
          className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono"
          inputMode="numeric"
          autoComplete="off"
          value={routingNumber}
          onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
          placeholder={
            existing?.achRoutingNumberMasked
              ? "Leave blank to keep current"
              : "9-digit routing number"
          }
          required={!hasExistingNumbers}
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">
          Account number
          {existing?.achAccountNumberMasked || existing?.achAccountLast4 ? (
            <span className="ml-2 font-normal text-muted-foreground">
              on file: {existing.achAccountNumberMasked || `····${existing.achAccountLast4}`}
            </span>
          ) : null}
        </span>
        <input
          className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono"
          inputMode="numeric"
          autoComplete="off"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 17))}
          placeholder={
            existing?.achAccountLast4
              ? "Leave blank to keep current"
              : "Account number"
          }
          required={!hasExistingNumbers}
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

      <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-primary">Digital signature</p>
          <span className="text-xs text-muted-foreground">Upload or draw — one method</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setSigMode("upload");
              setSigFile(null);
              setSigPreview(null);
              clearDrawnSignature();
            }}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              sigMode === "upload"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-secondary"
            }`}
          >
            <Upload className="size-3.5" />
            Upload new
          </button>
          <button
            type="button"
            onClick={() => {
              setSigMode("draw");
              setSigFile(null);
              setSigPreview(null);
              clearDrawnSignature();
            }}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              sigMode === "draw"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-secondary"
            }`}
          >
            <PenLine className="size-3.5" />
            Draw signature
          </button>
        </div>

        {sigMode === "upload" && (
          <div>
            <label
              htmlFor={`ach-sig-upload-${locationId}`}
              className="flex min-h-[8rem] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-background px-4 py-6 text-center transition-colors hover:border-primary/40"
            >
              <Upload className="mb-2 size-6 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {sigFile ? sigFile.name : "Click to upload PNG or JPG"}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">Max 5 MB</span>
              <input
                ref={fileInputRef}
                id={`ach-sig-upload-${locationId}`}
                type="file"
                accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                className="hidden"
                onChange={handleSigFileChange}
              />
            </label>
          </div>
        )}

        {sigMode === "draw" && (
          <div>
            <canvas
              ref={canvasRef}
              width={600}
              height={150}
              className="w-full touch-none rounded-xl border border-border bg-background"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Draw with mouse or touch</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 font-semibold text-destructive"
                onClick={clearDrawnSignature}
              >
                <Trash2 className="size-3.5" />
                Clear canvas
              </button>
            </div>
          </div>
        )}

        {sigMode === "none" && sigPreview && (
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Current signature on file:</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sigPreview}
              alt="Current ACH signature"
              className="max-h-24 w-auto rounded-xl border border-border bg-white object-contain p-2"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Choose Upload new or Draw signature above to replace it.
            </p>
          </div>
        )}

        {sigMode === "none" && !sigPreview && (
          <p className="text-xs text-amber-700">
            A digital signature is required to authorize ACH debits for settlement.
          </p>
        )}

        {(sigMode === "upload" || sigMode === "draw") && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive"
            onClick={() => resetSignatureInputs(true)}
          >
            <Trash2 className="size-3.5" />
            Clear &amp; re-sign
          </button>
        )}

        {sigMode === "upload" && sigPreview && (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sigPreview}
              alt="Uploaded signature preview"
              className="max-h-28 rounded-xl border border-border bg-background p-2"
            />
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-900">
        <Lock className="mt-0.5 size-4 shrink-0 text-sky-700" />
        <span>Your bank details are encrypted and stored securely.</span>
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
