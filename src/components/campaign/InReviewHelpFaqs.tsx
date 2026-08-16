/**
 * Contact Support dialog with FAQs for Pending ForkUp Review.
 *
 * Purpose: Let organizers open FAQs, then email the Success Team via SMTP
 * (POST /api/support/contact). No mailto / clipboard.
 */
"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, Headphones, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCampaign } from "@/lib/campaign-context";
import { postSupportContact } from "@/lib/api";

const IN_REVIEW_FAQS: { id: string; question: string; answer: string }[] = [
  {
    id: "review-time",
    question: "How long does review take?",
    answer:
      "Most campaigns are reviewed within 24 hours. You’ll get an email when there’s an update.",
  },
  {
    id: "can-edit",
    question: "Can I still edit my campaign?",
    answer:
      "Yes. Use Edit Campaign in Next Steps to update photos, story, and details. Your campaign stays in review until ForkUp approves it.",
  },
  {
    id: "public-yet",
    question: "Can supporters see this yet?",
    answer:
      "Not yet. This preview is not public. Donate, invite businesses, and share stay locked until your campaign is approved.",
  },
  {
    id: "methods-pending",
    question: "Why is a method pending review?",
    answer:
      "Online donations and ambassador fundraising can stay active. Methods like Dine & Donate may show Pending Review until ForkUp confirms them.",
  },
  {
    id: "contact",
    question: "How do I reach the Success Team?",
    answer:
      "Write your question below and send. ForkUp emails the Success Team for you.",
  },
];

export function InReviewHelpFaqs() {
  const { state } = useCampaign();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const campaignLabel = state.title?.trim() || state.campaignSlug || "my campaign";

  const handleDialogChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setMessage("");
      setSent(false);
      setSending(false);
    }
  };

  const handleSend = async () => {
    const body = message.trim();
    if (!body) {
      toast.error("Write a short message for the Success Team.");
      return;
    }

    setSending(true);
    try {
      await postSupportContact({
        message: body,
        campaignSlug: state.campaignSlug || undefined,
        campaignName: state.title?.trim() || undefined,
      });
      setSent(true);
      toast.success("Message sent to the Success Team.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send your message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
      >
        <Headphones className="size-4" /> Contact Support
      </button>

      <Dialog open={open} onOpenChange={handleDialogChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Contact Support</DialogTitle>
            <DialogDescription>
              Common questions while your campaign is in ForkUp review.
            </DialogDescription>
          </DialogHeader>

          <div className="divide-y divide-border rounded-xl border border-border">
            {IN_REVIEW_FAQS.map((faq) => (
              <details key={faq.id} className="group px-3 py-1">
                <summary className="cursor-pointer list-none py-2 text-sm font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start justify-between gap-2">
                    {faq.question}
                    <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </span>
                </summary>
                <p className="pb-2.5 text-sm leading-relaxed text-muted-foreground">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>

          {sent ? (
            <div className="rounded-xl border border-border bg-secondary/40 px-4 py-4 text-center">
              <CheckCircle2 className="mx-auto size-6 text-primary" />
              <p className="mt-2 text-sm font-semibold">Message sent to the Success Team</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                We emailed your note. The Success Team typically replies within 24 hours.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor="success-team-message" className="text-sm font-semibold">
                Message to the Success Team
              </label>
              <textarea
                id="success-team-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                disabled={sending}
                placeholder="Tell us what you need help with…"
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              />
              <p className="text-xs text-muted-foreground">Campaign: {campaignLabel}</p>
              <button
                type="button"
                disabled={sending}
                onClick={() => void handleSend()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Headphones className="size-4" />
                )}
                {sending ? "Sending…" : "Send to Success Team"}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
