import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Heart, CheckCircle2, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCampaign } from "@/lib/campaign-context";
import { getNonprofitName } from "@/lib/campaign-display";
import { startStripeDonationCheckout } from "@/lib/api";

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
        const checkout = await startStripeDonationCheckout(campaignSlug, {
          amount: displayAmount,
          donorName: name.trim() || undefined,
          email: email.trim(),
          anonymous,
        });
        if (!checkout.url) {
          throw new Error("Checkout URL missing from server");
        }
        // Redirect to Stripe-hosted Checkout (card / Apple Pay / Google Pay).
        window.location.assign(checkout.url);
        return;
      } catch (err) {
        setDonateError(err instanceof Error ? err.message : "Donation failed");
        setSubmitting(false);
      }
      return;
    }

    // Preview / no slug: keep local success step (no charge).
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
                giveback sales. You&apos;ll complete payment securely with Stripe.
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
                    Redirecting to Stripe…
                  </span>
                ) : (
                  `Pay $${displayAmount} securely`
                )}
              </button>

              <p className="text-xs text-muted-foreground text-center pt-1">
                Card, Apple Pay, and Google Pay are available on the Stripe checkout page.
              </p>
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
