"use client";

/**
 * Open-cover Resize control (additive).
 *
 * Purpose: Show a Resize button on the currently open cover image (not inside
 * the Change photo sheet). Opens CampaignImageResizeDialog for crop/zoom,
 * then calls onApply with the cropped File for the parent to upload/save.
 *
 * Inputs:
 *   imageSrc — current cover preview URL (null hides the control)
 *   imageName — optional export filename stem
 *   disabled — block while parent is saving
 *   onApply — async handler that receives the cropped File
 *
 * Outputs: Resize button + dialog UI; invokes onApply(File)
 *
 * Changelog: Added so organizers resize on the open cover, not only in Change photo.
 */

import { useState } from "react";
import { Crop } from "lucide-react";
import { CampaignImageResizeDialog } from "@/components/campaign/CampaignImageResizeDialog";

export interface OpenCoverResizeControlProps {
  imageSrc: string | null | undefined;
  imageName?: string;
  disabled?: boolean;
  className?: string;
  /** Inputs: cropped File. Outputs: parent uploads / saves. */
  onApply: (file: File) => Promise<void> | void;
}

/**
 * Renders the open-cover Resize affordance + dialog.
 *
 * Inputs: OpenCoverResizeControlProps
 * Outputs: JSX control
 */
export function OpenCoverResizeControl({
  imageSrc,
  imageName,
  disabled,
  className,
  onApply,
}: OpenCoverResizeControlProps) {
  const [open, setOpen] = useState(false);
  const src = (imageSrc || "").trim();
  if (!src) return null;

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={
          className ||
          "absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur transition-colors hover:bg-background disabled:opacity-40"
        }
      >
        <Crop className="size-3.5" />
        Resize
      </button>

      <CampaignImageResizeDialog
        open={open}
        imageSrc={src}
        imageName={imageName || "cover"}
        onClose={() => setOpen(false)}
        onApply={onApply}
      />
    </>
  );
}
