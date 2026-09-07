/**
 * NonprofitAchSettings — bank details for nonprofit settlement payouts (Task 19).
 *
 * Purpose: let a signed-in nonprofit add encrypted ACH details for receiving
 * online donation settlements and other ForkUp → NPO transfers.
 *
 * Inputs: nonprofitProfile from campaign context.
 * Outputs: calls GET/POST /api/profiles/nonprofits/:id/ach.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Landmark, Loader2, Lock } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { getAuthToken } from "@/lib/auth-storage";
import { fetchNonprofitAch, saveNonprofitAch } from "@/lib/api-nonprofit-ach";
import { AuthLogin } from "@/components/campaign/AuthLogin";

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

export function NonprofitAchSettings() {
  const { goTo, state } = useCampaign();
  const np = state.nonprofitProfile;
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [bankName, setBankName] = useState("");
  const [holderName, setHolderName] = useState("");
  const [accountType, setAccountType] = useState<"checking" | "savings">("checking");
  const [routing, setRouting] = useState("");
  const [account, setAccount] = useState("");
  const [authorizedBy, setAuthorizedBy] = useState("");
  const [authorizedEmail, setAuthorizedEmail] = useState("");
  const [last4, setLast4] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState("pending");

  useEffect(() => {
    setMounted(true);
  }, []);

  const isSignedIn = mounted && Boolean(getAuthToken());
  const nonprofitId = np?.id;

  const load = useCallback(async () => {
    if (!nonprofitId || !getAuthToken()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNonprofitAch(nonprofitId);
      setBankName(data.achBankName ?? "");
      setHolderName(data.achAccountHolderName ?? "");
      setAccountType((data.achAccountType as "checking" | "savings") || "checking");
      setAuthorizedBy(data.achAuthorizedBy ?? "");
      setAuthorizedEmail(data.achAuthorizedEmail ?? "");
      setLast4(data.achAccountLast4);
      setAuthStatus(data.achAuthorizationStatus ?? "pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ACH settings");
    } finally {
      setLoading(false);
    }
  }, [nonprofitId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nonprofitId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await saveNonprofitAch(nonprofitId, {
        achBankName: bankName.trim(),
        achAccountHolderName: holderName.trim(),
        achAccountType: accountType,
        achRoutingNumber: routing.trim() || undefined,
        achAccountNumber: account.trim() || undefined,
        achAuthorizedBy: authorizedBy.trim() || undefined,
        achAuthorizedEmail: authorizedEmail.trim() || undefined,
        achAuthorizationStatus: "authorized",
      });
      setSuccess("Bank details saved. You can now receive settlement payouts via ACH.");
      setRouting("");
      setAccount("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  if (!isSignedIn) {
    return (
      <main className="mx-auto max-w-xl px-5 py-10 sm:px-6">
        <button
          type="button"
          onClick={() => goTo("nonprofit-dashboard")}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        <h1 className="text-xl font-bold">Sign in to manage payout bank details</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nonprofit ACH settings require a signed-in organization account.
        </p>
        <div className="mt-8">
          <AuthLogin intent="nonprofit" />
        </div>
      </main>
    );
  }

  if (!np?.id) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10 text-center text-sm text-muted-foreground">
        Select or claim a nonprofit profile first.
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <button
        type="button"
        onClick={() => goTo("nonprofit-dashboard")}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to dashboard
      </button>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Landmark className="size-5 text-primary" />
          Nonprofit payout bank details
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add the account where ForkUp should send online donation settlements and other
          disbursements for <strong>{np.organizationName}</strong>.
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" />
          Routing and account numbers are encrypted at rest.
        </p>

        {loading ? (
          <div className="mt-8 flex justify-center">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="mt-6 space-y-3">
            {last4 && (
              <p className="rounded-xl bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
                Account on file ending in <strong>{last4}</strong> · status:{" "}
                <span className="capitalize">{authStatus}</span>
              </p>
            )}
            <label className="block text-xs font-semibold text-muted-foreground">
              Bank name
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="block text-xs font-semibold text-muted-foreground">
              Account holder name
              <input
                type="text"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="block text-xs font-semibold text-muted-foreground">
              Account type
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as "checking" | "savings")}
                className={`mt-1 ${inputClass}`}
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
              </select>
            </label>
            <label className="block text-xs font-semibold text-muted-foreground">
              Routing number
              <input
                type="text"
                inputMode="numeric"
                value={routing}
                onChange={(e) => setRouting(e.target.value)}
                placeholder={last4 ? "Leave blank to keep existing" : ""}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="block text-xs font-semibold text-muted-foreground">
              Account number
              <input
                type="text"
                inputMode="numeric"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder={last4 ? "Leave blank to keep existing" : ""}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="block text-xs font-semibold text-muted-foreground">
              Authorized by (name)
              <input
                type="text"
                value={authorizedBy}
                onChange={(e) => setAuthorizedBy(e.target.value)}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="block text-xs font-semibold text-muted-foreground">
              Authorized by (email)
              <input
                type="email"
                value={authorizedEmail}
                onChange={(e) => setAuthorizedEmail(e.target.value)}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-emerald-600">{success}</p>}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save bank details
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
