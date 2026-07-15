import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Heart, CheckCircle2, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCampaign } from "@/lib/campaign-context";
import { getNonprofitName } from "@/lib/campaign-display";
import { submitVirtualDonation } from "@/lib/api";

interface DonationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShareCampaign?: () => void;
  onExploreBiz?: () => void;
  /** Override campaign context (public campaign page). */
  campaignSlug?: string;
  nonprofitName?: string;
}

const AMOUNTS = [10, 25, 50, 100] as const;

type DonationModalContentProps = Omit<DonationModalProps, "campaignSlug" | "nonprofitName"> & {
  campaignSlug?: string;
  nonprofitName: string;
};

function DonationModalContent({
  open,
  onOpenChange,
  onShareCampaign,
  onExploreBiz,
  campaignSlug,
  nonprofitName,
}: DonationModalContentProps) {
  const [step, setStep] = useState<"amount" | "info" | "success">("amount");
  const [selectedAmount, setSelectedAmount] = useState<number>(50);
  const [customAmount, setCustomAmount] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [donateError, setDonateError] = useState<string | null>(null);

  const displayAmount = isCustom ? parseInt(customAmount, 10) || 0 : selectedAmount;

  const handleDonate = async () => {
    if (!email.includes("@") || displayAmount < 1) return;
    setDonateError(null);

    if (campaignSlug) {
      setSubmitting(true);
      try {
        await submitVirtualDonation(campaignSlug, {
          amount: displayAmount,
          donorName: name.trim() || undefined,
          email: email.trim(),
          anonymous,
        });
        setStep("success");
      } catch (err) {
        setDonateError(err instanceof Error ? err.message : "Donation failed");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setStep("success");
  };

  const reset = () => {
    setStep("amount");
    setSelectedAmount(50);
    setCustomAmount("");
    setIsCustom(false);
    setName("");
    setEmail("");
    setAnonymous(false);
  };

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden border-border bg-background rounded-2xl">
        {step === "amount" && (
          <div className="p-6 sm:p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-4">
                <Heart className="w-5 h-5 text-accent" />
              </div>
              <DialogTitle className="font-serif text-2xl text-foreground mb-2 leading-tight text-center">
                Support {nonprofitName}
              </DialogTitle>
              <DialogDescription className="text-sm text-center">
                Online donations go directly to {nonprofitName} and are separate from business
                giveback sales. {/* TODO: Payment processor integration */}
              </DialogDescription>
            </div>

            <div className="grid grid-cols-3 gap-2.5 mb-3">
              {AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => { setSelectedAmount(amt); setIsCustom(false); }}
                  className={cn(
                    "relative py-4 rounded-xl text-center font-semibold text-lg transition-all duration-150 ease-out",
                    "border-2 active:scale-[0.96]",
                    !isCustom && selectedAmount === amt
                      ? "border-primary bg-primary/8 text-primary shadow-sm"
                      : "border-border bg-card text-foreground hover:border-primary/40"
                  )}
                >
                  ${amt}
                </button>
              ))}
              <button
                onClick={() => setIsCustom(true)}
                className={cn(
                  "relative py-4 rounded-xl text-center font-semibold text-base transition-all duration-150 ease-out",
                  "border-2 active:scale-[0.96]",
                  isCustom
                    ? "border-primary bg-primary/8 text-primary shadow-sm"
                    : "border-border bg-card text-foreground hover:border-primary/40"
                )}
              >
                Custom
              </button>
            </div>

            {isCustom && (
              <div className="mb-3 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">$</span>
                <input
                  type="number"
                  min="1"
                  autoFocus
                  placeholder="Enter amount"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-3.5 rounded-xl border-2 border-primary/30 bg-card text-foreground text-lg font-semibold focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center mb-6 text-pretty">
              100% goes to {nonprofitName} — funding equipment, travel, and scholarships
            </p>

            <button
              onClick={() => displayAmount > 0 && setStep("info")}
              disabled={displayAmount <= 0}
              className={cn(
                "btn-primary w-full flex items-center justify-center gap-2",
                displayAmount <= 0 && "opacity-50 pointer-events-none"
              )}
            >
              Continue
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {step === "info" && (
          <div className="p-6 sm:p-8">
            <div className="text-center mb-6">
              <p className="text-sm font-semibold text-primary mb-1">Donating ${displayAmount}</p>
              <DialogTitle className="font-serif text-xl text-foreground">A little about you</DialogTitle>
            </div>

            <div className="space-y-3 mb-4">
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
              />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
              />
            </div>

            <button
              onClick={() => setAnonymous(!anonymous)}
              className="flex items-center gap-2.5 w-full px-4 py-3 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-colors mb-6"
            >
              {anonymous ? (
                <EyeOff size={16} className="text-primary shrink-0" />
              ) : (
                <Eye size={16} className="text-muted-foreground shrink-0" />
              )}
              <span className="text-sm text-foreground">Make this donation anonymous</span>
              <div
                className={cn(
                  "ml-auto w-9 h-5 rounded-full transition-colors duration-200 relative shrink-0",
                  anonymous ? "bg-primary" : "bg-border"
                )}
              >
                <div
                  className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                    anonymous ? "translate-x-[18px]" : "translate-x-0.5"
                  )}
                />
              </div>
            </button>

            <div className="space-y-2.5">
              {donateError && <p className="text-sm text-destructive text-center">{donateError}</p>}
              <button
                onClick={handleDonate}
                disabled={submitting || !email.includes("@")}
                className="btn-primary w-full text-base disabled:opacity-60"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Processing…
                  </span>
                ) : (
                  `Donate $${displayAmount}`
                )}
              </button>

              <div className="flex items-center justify-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or pay with</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button className="flex items-center justify-center gap-2 py-3 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-colors active:scale-[0.97] text-sm font-medium text-foreground">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                  Apple Pay
                </button>
                <button className="flex items-center justify-center gap-2 py-3 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-colors active:scale-[0.97] text-sm font-medium text-foreground">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3.22 7.4l8.56 6.94 8.56-6.94A1.98 1.98 0 0 0 18.36 6H5.64a1.98 1.98 0 0 0-1.98 1.02l-.44.38zm17.56 1.53L12.78 15.7a1.25 1.25 0 0 1-1.56 0L3.22 8.93V17a2 2 0 0 0 2 2h13.56a2 2 0 0 0 2-2V8.93z"/></svg>
                  Google Pay
                </button>
              </div>
            </div>

            <button
              onClick={() => setStep("amount")}
              className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
            >
              ← Change amount
            </button>
          </div>
        )}

        {step === "success" && (
          <div className="p-6 sm:p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-5">
              <CheckCircle2 className="w-8 h-8 text-accent" />
            </div>

            <DialogTitle className="font-serif text-2xl text-foreground mb-2">
              Thank you — you supported the team
            </DialogTitle>
            <DialogDescription className="text-sm mb-8 text-pretty">
              Your ${displayAmount} donation goes directly to {nonprofitName}
            </DialogDescription>

            <div className="space-y-2.5">
              <button
                onClick={() => {
                  handleClose(false);
                  onShareCampaign?.();
                }}
                className="btn-primary w-full"
              >
                Invite others to support the team
              </button>
              <button
                onClick={() => {
                  handleClose(false);
                  onExploreBiz?.();
                }}
                className="btn-secondary w-full"
              >
                Explore participating businesses
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DonationModalFromContext(props: DonationModalProps) {
  const { state } = useCampaign();
  return (
    <DonationModalContent
      {...props}
      campaignSlug={props.campaignSlug ?? state.campaignSlug ?? undefined}
      nonprofitName={props.nonprofitName ?? getNonprofitName(state)}
    />
  );
}

export const DonationModal = (props: DonationModalProps) => {
  if (props.campaignSlug && props.nonprofitName) {
    return (
      <DonationModalContent
        {...props}
        campaignSlug={props.campaignSlug}
        nonprofitName={props.nonprofitName}
      />
    );
  }
  return <DonationModalFromContext {...props} />;
};
