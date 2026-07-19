import { useRef, useState } from "react";
import { ImagePlus, X, Sparkles, Building2, Image as ImageIcon, Video, Replace, AlertCircle, Megaphone } from "lucide-react";
import { useCampaign, type CampaignImage, type CampaignVideo } from "@/lib/campaign-context";
import { uploadImage } from "@/lib/api";
import { ActionBar } from "./ChooseBusinesses";

const LOGO_MIN = 500;
const COVER_MIN_WIDTH = 1200;
const PHOTO_MIN_WIDTH = 800;
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_BYTES = 250 * 1024 * 1024;
const VIDEO_MAX_SECONDS = 60;

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime"];

function makeId(name: string) {
  return `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function readImage(file: File): Promise<{ width: number; height: number; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected image"));
    reader.readAsDataURL(file);
  });
}

function readVideo(file: File): Promise<{ duration: number; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const vid = document.createElement("video");
    vid.preload = "metadata";
    vid.onloadedmetadata = () => resolve({ duration: vid.duration, url });
    vid.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read video"));
    };
    vid.src = url;
  });
}

function SectionCard({
  icon,
  label,
  required,
  helper,
  chips,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  required?: boolean;
  helper: string;
  chips: string;
  children: React.ReactNode;
}) {
  return (
    <section className="animate-rise rounded-3xl border border-border bg-card p-6 sm:p-8 [animation-delay:60ms]">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/60 text-accent-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-tight">
            {label}
            {required && <span className="ml-1 text-primary">*</span>}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{helper}</p>
          <p className="mt-1.5 text-xs font-medium text-muted-foreground/80">{chips}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mt-3 flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function GroupHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-primary">{title}</h2>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  );
}

function PromotionField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold">{label}</label>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );
}

export function CampaignMedia() {
  const { state, update, addImages, removeImage, next, back, designMode } = useCampaign();

  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const [logoError, setLogoError] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  const handleLogo = async (file: File | null) => {
    setLogoError(null);
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) return setLogoError("Logo must be a PNG, JPG, or WEBP file.");
    if (file.size > IMAGE_MAX_BYTES) return setLogoError("Logo must be 10MB or smaller.");
    try {
      const { width, height, url } = await readImage(file);
      if (width < LOGO_MIN || height < LOGO_MIN)
        return setLogoError(`Logo must be at least ${LOGO_MIN} x ${LOGO_MIN} px.`);
      update({ logo: { id: makeId(file.name), url, name: file.name } });
    } catch {
      setLogoError("We couldn't read that image. Please try another file.");
    }
  };

  const handleCover = async (file: File | null) => {
    setCoverError(null);
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) return setCoverError("Cover image must be a JPG, PNG, or WEBP file.");
    if (file.size > IMAGE_MAX_BYTES) return setCoverError("Cover image must be 10MB or smaller.");

    let coverId: string;
    let previewUrl: string;
    try {
      const { width, url } = await readImage(file);
      if (width < COVER_MIN_WIDTH)
        return setCoverError(
          "This image is too small for campaign and social media use. Please upload an image at least 1200px wide.",
        );
      coverId = makeId(file.name);
      previewUrl = url;
      // Show the local preview immediately while the upload runs.
      update({ cover: { id: coverId, url: previewUrl, name: file.name } });
    } catch {
      setCoverError("We couldn't read that image. Please try another file.");
      return;
    }

    // Persist the image to storage; keep the blob URL for preview and attach the
    // returned reference as storedUrl so it survives beyond this browser session.
    try {
      const imageBase64 = await readFileAsDataUrl(file);
      const { url: storedUrl } = await uploadImage({
        imageBase64,
        imageMimeType: file.type,
        kind: "cover",
      });
      update({ cover: { id: coverId, url: previewUrl, name: file.name, storedUrl } });
    } catch {
      setCoverError("We couldn't save that image to storage. Please check your connection and try again.");
    }
  };

  const handlePhotos = async (files: FileList | null) => {
    setPhotosError(null);
    if (!files) return;
    const remaining = 10 - state.images.length;
    if (remaining <= 0) return setPhotosError("You've reached the limit of 10 additional photos.");
    const accepted: CampaignImage[] = [];
    let rejected = false;
    for (const file of Array.from(files).slice(0, remaining)) {
      if (!IMAGE_TYPES.includes(file.type) || file.size > IMAGE_MAX_BYTES) {
        rejected = true;
        continue;
      }
      try {
        const { width, url } = await readImage(file);
        if (width < PHOTO_MIN_WIDTH) {
          rejected = true;
          continue;
        }
        accepted.push({ id: makeId(file.name), url, name: file.name });
      } catch {
        rejected = true;
      }
    }
    if (accepted.length) addImages(accepted);
    if (rejected)
      setPhotosError("Some photos were skipped — each must be a JPG/PNG/WEBP, at least 800px wide, and under 10MB.");
  };

  const handleVideo = async (file: File | null) => {
    setVideoError(null);
    if (!file) return;
    if (!VIDEO_TYPES.includes(file.type)) return setVideoError("Video must be an MP4 or MOV file.");
    if (file.size > VIDEO_MAX_BYTES) return setVideoError("Video must be 250MB or smaller.");
    try {
      const { duration, url } = await readVideo(file);
      if (duration > VIDEO_MAX_SECONDS + 0.5)
        return setVideoError("Video must be 60 seconds or shorter.");
      const video: CampaignVideo = { id: makeId(file.name), url, name: file.name };
      update({ video });
    } catch {
      setVideoError("We couldn't read that video. Please try another file.");
    }
  };

  const requiredMet = !!state.logo && !!state.cover;

  return (
    <>
      <main className="mx-auto max-w-3xl px-5 py-10 pb-32 sm:px-6 sm:py-12">
        <div className="animate-rise mb-9">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">Campaign Assets</p>
          <h1 className="font-display text-balance text-3xl font-bold leading-[1.12] tracking-tight sm:text-4xl">
            Help supporters connect with your cause.
          </h1>
          <p className="mt-3 max-w-[58ch] text-pretty text-base text-muted-foreground">
            The photos, logo, and videos you share help ForkUp create a campaign people want to
            support.
          </p>
        </div>

        <div className="animate-rise mb-8 flex items-start gap-3 rounded-2xl border border-border bg-accent/40 px-4 py-3.5 text-sm text-accent-foreground [animation-delay:60ms]">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="leading-relaxed">
            The more supporters connect with your story, the more likely they are to participate.
            We'll use these assets across your campaign page, shared links, emails, social posts,
            ambassador tools, guest bartender promotion, and your Success Toolkit.
          </p>
        </div>

        {/* REQUIRED ASSETS */}
        <div className="mb-10">
          <GroupHeading title="Start with the essentials" hint={requiredMet ? "Complete" : "Logo & featured photo"} />
          <div className="space-y-5">
            {/* Organization Logo — smaller square */}
            <SectionCard
              icon={<Building2 className="size-5" />}
              label="Organization Logo"
              required
              helper="Help supporters recognize your organization across the campaign."
              chips="PNG, JPG, WEBP · Min 500×500 · Max 10MB"
            >
              {state.logo ? (
                <div className="flex items-center gap-4">
                  <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-secondary ring-1 ring-border">
                    <img src={state.logo.url} alt="Organization logo" className="size-full object-contain" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => logoRef.current?.click()}
                      className="inline-flex w-fit items-center gap-2 rounded-full border border-border px-3.5 py-1.5 text-sm font-semibold transition-colors hover:bg-secondary"
                    >
                      <Replace className="size-4" />
                      Replace logo
                    </button>
                    <span className="truncate text-xs text-muted-foreground">{state.logo.name}</span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => logoRef.current?.click()}
                  className="flex size-28 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-secondary/40 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <ImagePlus className="size-5" />
                  <span className="text-xs font-semibold">Upload logo</span>
                </button>
              )}
              <input
                ref={logoRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => handleLogo(e.target.files?.[0] ?? null)}
              />
              <FieldError message={logoError} />
            </SectionCard>

            {/* Campaign Cover Image — wide landscape */}
            <SectionCard
              icon={<ImageIcon className="size-5" />}
              label="Featured Campaign Photo"
              required
              helper="Choose a photo that represents your mission, community, or the people you're helping."
              chips="JPG, PNG, WEBP · Min 1200px wide · Landscape · Max 10MB"
            >
              {state.cover ? (
                <div className="space-y-2">
                  <div className="relative aspect-[21/9] overflow-hidden rounded-xl bg-secondary ring-1 ring-border">
                    <img src={state.cover.url} alt="Campaign cover" className="size-full object-cover" />
                    {state.cover.id?.startsWith("library-") && (
                      <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold text-primary shadow-sm backdrop-blur">
                        <Sparkles className="size-3.5" />
                        Suggested from your library
                      </span>
                    )}
                    <button
                      onClick={() => coverRef.current?.click()}
                      className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-2 rounded-full bg-background/90 px-3.5 py-1.5 text-sm font-semibold shadow-sm backdrop-blur transition-colors hover:bg-background"
                    >
                      <Replace className="size-4" />
                      Replace
                    </button>
                  </div>
                  <span className="truncate text-xs text-muted-foreground">
                    {state.cover.id?.startsWith("library-")
                      ? "Auto-filled from an approved library image — replace it anytime."
                      : state.cover.name}
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => coverRef.current?.click()}
                  className="flex aspect-[21/9] w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-secondary/40 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <ImagePlus className="size-5" />
                  <span className="text-sm font-semibold">Upload cover image</span>
                </button>
              )}
              <input
                ref={coverRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => handleCover(e.target.files?.[0] ?? null)}
              />
              <FieldError message={coverError} />
            </SectionCard>
          </div>
        </div>

        {/* PROMOTION CHANNELS */}
        <div className="mb-10">
          <GroupHeading title="Promotion Channels" hint="Optional — feeds your Success Toolkit" />
          <SectionCard
            icon={<Megaphone className="size-5" />}
            label="Promotion Channels"
            helper="Tell us where your supporters already hear from you. ForkUp will use this to help prepare better posts, reminders, emails, and sharing tools for your campaign."
            chips="All fields optional"
          >
            <div className="space-y-4">
              <PromotionField
                label="Facebook Page URL"
                placeholder="https://facebook.com/yourorganization"
                value={state.promotion.facebookUrl}
                onChange={(v) => update({ promotion: { ...state.promotion, facebookUrl: v } })}
              />
              <PromotionField
                label="Instagram Handle"
                placeholder="@yourorganization"
                value={state.promotion.instagramHandle}
                onChange={(v) => update({ promotion: { ...state.promotion, instagramHandle: v } })}
              />
              <PromotionField
                label="Website URL"
                placeholder="https://yourorganization.org"
                value={state.promotion.websiteUrl}
                onChange={(v) => update({ promotion: { ...state.promotion, websiteUrl: v } })}
              />
              <PromotionField
                label="Newsletter / Email List Link or Notes"
                placeholder="Link to your newsletter, or notes about your email list"
                value={state.promotion.newsletter}
                onChange={(v) => update({ promotion: { ...state.promotion, newsletter: v } })}
              />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              You can skip this now and add it later from your campaign dashboard.
            </p>
          </SectionCard>
        </div>

        {/* OPTIONAL ASSETS */}
        <div>
          <GroupHeading title="Help us tell your story" hint="Recommended, not required — but highly effective." />
          <div className="space-y-5">
            {/* More Photos — compact grid */}
            <SectionCard
              icon={<ImagePlus className="size-5" />}
              label="More Photos"
              helper="Photos of volunteers, participants, families, teams, events, or community moments help make your campaign feel personal and authentic."
              chips={`Up to 10 · Min 800px wide · Max 10MB each · ${state.images.length}/10 added`}
            >
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
                {state.images.map((img) => (
                  <div
                    key={img.id}
                    className="animate-pop group relative aspect-square overflow-hidden rounded-xl bg-secondary ring-1 ring-border"
                  >
                    <img src={img.url} alt={img.name} className="size-full object-cover" />
                    <button
                      onClick={() => removeImage(img.id)}
                      className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur transition-transform hover:scale-110"
                      aria-label="Remove photo"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                {state.images.length < 10 && (
                  <button
                    onClick={() => photosRef.current?.click()}
                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-secondary/40 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    <ImagePlus className="size-4" />
                    <span className="text-[11px] font-semibold">Add</span>
                  </button>
                )}
              </div>
              <input
                ref={photosRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="hidden"
                onChange={(e) => handlePhotos(e.target.files)}
              />
              <FieldError message={photosError} />
            </SectionCard>

            {/* Personal Video — compact */}
            <SectionCard
              icon={<Video className="size-5" />}
              label="Personal Video"
              helper="Optional but powerful. A short video from someone connected to your cause can help supporters quickly understand why this campaign matters."
              chips="MP4, MOV · Max 60 seconds · Max 250MB"
            >
              <p className="mb-3 rounded-xl bg-accent/40 px-3 py-2 text-xs font-medium text-accent-foreground">
                Campaigns with a personal video often generate stronger supporter engagement.
              </p>
              {state.video ? (
                <div className="space-y-2">
                  <div className="relative aspect-video max-h-48 overflow-hidden rounded-xl bg-black ring-1 ring-border">
                    <video src={state.video.url} controls className="size-full object-contain" />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-xs text-muted-foreground">{state.video.name}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => videoRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-secondary"
                      >
                        <Replace className="size-3.5" />
                        Replace
                      </button>
                      <button
                        onClick={() => update({ video: null })}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
                      >
                        <X className="size-3.5" />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => videoRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-secondary/40 py-6 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <Video className="size-5" />
                  <span className="text-sm font-semibold">Upload video</span>
                </button>
              )}
              <input
                ref={videoRef}
                type="file"
                accept="video/mp4,video/quicktime"
                className="hidden"
                onChange={(e) => handleVideo(e.target.files?.[0] ?? null)}
              />
              <FieldError message={videoError} />
            </SectionCard>
          </div>
        </div>
      </main>

      <ActionBar
        backLabel="Back"
        onBack={back}
        meta={requiredMet ? "Ready to review campaign" : "Logo and cover image required"}
        nextLabel="Next: Review & Launch"
        nextDisabled={!requiredMet && !designMode}
        onNext={next}
      />
    </>
  );
}
