import { useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { inferCapabilities } from "@/data/businesses";

export function InviteBusiness() {
  const { addInvited, goTo } = useCampaign();
  const [form, setForm] = useState({
    name: "",
    contactName: "",
    email: "",
    type: "",
    location: "",
    note: "",
  });

  const [touched, setTouched] = useState(false);

  const valid =
    form.name.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email);

  const submit = () => {
    if (!valid) {
      setTouched(true);
      return;
    }
    const capabilities = inferCapabilities({ category: form.type, type: form.type });
    addInvited({ ...form, capabilities });
    goTo("businesses");
  };

  const field = "h-12 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/30";

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 sm:px-6 sm:py-12">
      <button
        onClick={() => goTo("businesses")}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to businesses
      </button>

      <div className="animate-rise">
        <h1 className="text-3xl font-extrabold tracking-tight">Invite a business</h1>
        <p className="mt-3 text-pretty text-muted-foreground">
          Bring a local partner into the ForkUp network. We'll invite them to participate in your campaign.
        </p>
      </div>

      <div className="animate-rise mt-8 space-y-5 rounded-3xl border border-border bg-card p-6 sm:p-8 [animation-delay:60ms]">
        <div className="space-y-2">
          <label className="text-sm font-semibold">Business Name *</label>
          <input
            className={field}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Sovana Bistro"
          />
          {touched && !form.name.trim() && (
            <p className="text-xs text-destructive">Add the business name so we know who to invite.</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold">Business Email *</label>
          <input
            className={field}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="owner@business.com"
          />
          {touched && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email) && (
            <p className="text-xs text-destructive">Add a valid business email so we can send the invitation.</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold">
            Personal Note <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            className="min-h-24 w-full rounded-xl border border-border bg-card p-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/30"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Add a quick note to the business about why you'd like them to join this campaign."
          />
          <p className="text-xs text-muted-foreground">
            We'll use this email to send the invitation and help get the conversation started.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 pt-2">
          <button
            onClick={submit}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary-dark active:scale-95"
          >
            <Send className="size-4" />
            Invite This Business
          </button>
          <p className="text-center text-xs text-muted-foreground">
            They'll be added to your Invite List as Pending Invitation — not a confirmed participant yet.
          </p>
        </div>
      </div>
    </main>
  );
}
