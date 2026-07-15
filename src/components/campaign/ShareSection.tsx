import { Link2, MessageCircle, Mail, Share2 } from "lucide-react";
import { ScrollReveal } from "@/components/ScrollReveal";
import { toast } from "sonner";
import { useCampaign } from "@/lib/campaign-context";
import { getNonprofitName } from "@/lib/campaign-display";

export const ShareSection = () => {
  const { state } = useCampaign();
  const campaignName = getNonprofitName(state);
  const getCampaignUrl = () =>
    typeof window !== "undefined" ? window.location.href : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(getCampaignUrl());
    toast.success("Campaign link copied!");
  };

  const handleText = () => {
    const body = encodeURIComponent(
      `I'm supporting ${campaignName} — join me and give back:\n${getCampaignUrl()}`
    );
    window.open(`sms:?&body=${body}`, "_self");
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`Join me in supporting ${campaignName}`);
    const body = encodeURIComponent(
      `Hey —\n\nI'm supporting ${campaignName} and wanted to share this with you.\n\nIt's a simple way to give back — just visit a participating local business, and a portion of your purchase goes to the team.\n\nYou can check it out here:\n${getCampaignUrl()}\n\nEvery visit helps support equipment, travel, and scholarships.\n\nHope you can join in 🙌`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_self");
  };

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Support ${campaignName}`,
          text: `I'm supporting ${campaignName} — join me and give back!`,
          url: getCampaignUrl(),
        });
      } catch {
        // user cancelled
      }
    } else {
      handleCopy();
    }
  };

  return (
    <section className="py-20 md:py-24 section-padding">
      <div className="max-w-md mx-auto text-center">
        <ScrollReveal>
          <h2 className="font-serif text-2xl sm:text-3xl text-foreground mb-3 text-balance">
            Invite others to support {campaignName}
          </h2>
          <p className="text-sm text-muted-foreground mb-1.5">
            Share with friends, family, and neighbors who want to give back
          </p>
          <p className="text-xs text-muted-foreground/70 mb-8">
            The more people who join, the more we raise for the team
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <button onClick={handleCopy} className="btn-secondary flex items-center gap-2">
              <Link2 size={16} /> Copy link
            </button>
            <button onClick={handleText} className="btn-secondary flex items-center gap-2">
              <MessageCircle size={16} /> Text a friend
            </button>
            <button onClick={handleEmail} className="btn-secondary flex items-center gap-2">
              <Mail size={16} /> Email an invite
            </button>
            <button onClick={handleShare} className="btn-secondary flex items-center gap-2">
              <Share2 size={16} /> Share on social
            </button>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};
