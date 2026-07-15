import { useRef, useState } from "react";
import { useCampaign } from "@/lib/campaign-context";
import { HeroSection } from "@/components/campaign/HeroSection";
import { CampaignStory } from "@/components/campaign/CampaignStory";
import { HowItWorks } from "@/components/campaign/HowItWorks";
import { LocationsSection } from "@/components/campaign/LocationsSection";
import { AboutNonprofit } from "@/components/campaign/AboutNonprofit";
import { ImpactSection } from "@/components/campaign/ImpactSection";
import { LeaderboardSection } from "@/components/campaign/LeaderboardSection";
import { ShareSection } from "@/components/campaign/ShareSection";
import { DonateSection } from "@/components/campaign/DonateSection";
import { DonationModal } from "@/components/campaign/DonationModal";

/**
 * Canonical Public Campaign Page — the single source of truth for what
 * supporters see. Ported from the refined "Campaign Creator" experience and
 * made the one official campaign page across the platform.
 *
 * Modular sections:
 *   1. Hero / Campaign Header
 *   2. About the Cause (Why this matters)
 *   3. Choose Where to Participate (participating businesses)
 *   4. Community Impact / Leaderboards
 *   5. Invite Others (campaign sharing)
 *   6. Donate Directly (optional virtual donation)
 */
export function CampaignPage() {
  const locationsRef = useRef<HTMLDivElement>(null);
  const [donateOpen, setDonateOpen] = useState(false);
  const { state } = useCampaign();
  const { methods } = state;

  // Which fundraising methods the organizer selected drive which sections show.
  const showGiveback = methods.giveback;
  const showDonations = methods.donations;
  const showAmbassador = methods.ambassador;

  const scrollToLocations = () => {
    document.getElementById("locations")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div ref={locationsRef} className="min-h-screen bg-background">
      <HeroSection
        onViewLocations={scrollToLocations}
        onDonate={() => setDonateOpen(true)}
        showLocationsCta={showGiveback}
        showDonateCta={showDonations}
      />
      <CampaignStory showLocationsCta={showGiveback} />
      {showGiveback && <HowItWorks />}
      {showGiveback && <LocationsSection id="locations" />}
      <AboutNonprofit />
      <ImpactSection />
      {showAmbassador && <LeaderboardSection />}
      <ShareSection />
      {showDonations && <DonateSection onDonate={() => setDonateOpen(true)} />}

      <DonationModal
        open={donateOpen}
        onOpenChange={setDonateOpen}
        onExploreBiz={scrollToLocations}
      />

      {/* Footer */}
      <footer className="py-8 section-padding text-center border-t border-border">
        <p className="text-xs text-muted-foreground">
          Powered by <span className="font-semibold text-foreground">ForkUp</span> · Local fundraising, one meal at a time
        </p>
      </footer>
    </div>
  );
}
