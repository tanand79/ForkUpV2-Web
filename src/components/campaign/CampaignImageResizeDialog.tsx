"use client";

/**
 * Campaign image Resize dialog (additive).
 *
 * Purpose: Free all-sides crop — drag edges/corners independently, or drag
 * the box to move — then export a JPEG for re-upload.
 *
 * Inputs:
 *   open — whether the dialog is visible
 *   imageSrc — preview URL of the image being resized
 *   imageName — optional label for the exported file
 *   onClose — dismiss without saving
 *   onApply — receives the cropped File; caller uploads + updates state
 *
 * Outputs: calls onApply(File) after Apply; no API calls inside this component
 *
 * Changelog: Added visible Resize option for Review gallery + AI cover picker.
 * Changelog: Free crop with handles on all sides (not zoom/pan-only).
 */

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from "react";
import { Loader2, Minimize2 } from "lucide-react";
import { exportNaturalRectCrop } from "@/lib/resize-campaign-image";

const MIN_CROP_PX = 48;

type CropRect = { x: number; y: number; w: number; h: number };
type HandleId = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | "move";

export interface CampaignImageResizeDialogProps {
  open: boolean;
  imageSrc: string | null;
  imageName?: string;
  onClose: () => void;
  /** Inputs: cropped File. Outputs: none (parent uploads). */
  onApply: (file: File) => Promise<void> | void;
}

/**
 * Modal free-crop UI for one campaign image.
 *
 * Inputs: CampaignImageResizeDialogProps
 * Outputs: JSX dialog; onApply with the cropped File
 */
export function CampaignImageResizeDialog({
  open,
  imageSrc,
  imageName,
  onClose,
  onApply,
}: CampaignImageResizeDialogProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [stageSize, setStageSize] = useState({ w: 360, h: 280 });
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, w: 100, h: 100 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dragRef = useRef<{
    handle: HandleId;
    startX: number;
    startY: number;
    origin: CropRect;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setNatural(null);
    setError(null);
    setSaving(false);
    setCrop({ x: 0, y: 0, w: 100, h: 100 });
  }, [open, imageSrc]);

  useEffect(() => {
    if (!open || !stageRef.current) return;
    const el = stageRef.current;
    const measure = () => {
      setStageSize({
        w: el.clientWidth || 360,
        h: el.clientHeight || 280,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const layout = (() => {
    if (!natural) {
      return {
        scale: 1,
        displayW: stageSize.w,
        displayH: stageSize.h,
        offsetX: 0,
        offsetY: 0,
      };
    }
    const scale = Math.min(stageSize.w / natural.w, stageSize.h / natural.h);
    const displayW = natural.w * scale;
    const displayH = natural.h * scale;
    return {
      scale,
      displayW,
      displayH,
      offsetX: (stageSize.w - displayW) / 2,
      offsetY: (stageSize.h - displayH) / 2,
    };
  })();

  /**
   * Initializes a centered ~90% crop once natural size is known.
   * Inputs: natural image size + current display layout
   * Outputs: updates crop state in display pixels relative to the image box
   */
  const initCrop = (nw: number, nh: number, scale: number) => {
    const dw = nw * scale;
    const dh = nh * scale;
    const insetX = dw * 0.05;
    const insetY = dh * 0.05;
    setCrop({
      x: insetX,
      y: insetY,
      w: Math.max(MIN_CROP_PX, dw - insetX * 2),
      h: Math.max(MIN_CROP_PX, dh - insetY * 2),
    });
  };

  const onImgLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    const nw = el.naturalWidth;
    const nh = el.naturalHeight;
    if (!nw || !nh) return;
    setNatural({ w: nw, h: nh });
    const scale = Math.min(stageSize.w / nw, stageSize.h / nh);
    initCrop(nw, nh, scale);
  };

  /**
   * Clamps a proposed crop rect inside the displayed image bounds.
   * Inputs: proposed rect, display image size
   * Outputs: clamped CropRect
   */
  const clampCrop = (next: CropRect, maxW: number, maxH: number): CropRect => {
    let { x, y, w, h } = next;
    w = Math.max(MIN_CROP_PX, Math.min(maxW, w));
    h = Math.max(MIN_CROP_PX, Math.min(maxH, h));
    x = Math.max(0, Math.min(maxW - w, x));
    y = Math.max(0, Math.min(maxH - h, y));
    return { x, y, w, h };
  };

  /**
   * Applies edge/corner/move drag delta to the crop rectangle.
   * Inputs: handle id, pointer deltas, origin rect
   * Outputs: next CropRect in display image coordinates
   */
  const applyHandleDelta = (
    handle: HandleId,
    dx: number,
    dy: number,
    origin: CropRect,
    maxW: number,
    maxH: number,
  ): CropRect => {
    let { x, y, w, h } = origin;

    if (handle === "move") {
      return clampCrop({ x: x + dx, y: y + dy, w, h }, maxW, maxH);
    }

    if (handle.includes("w")) {
      const nextX = Math.min(x + w - MIN_CROP_PX, Math.max(0, x + dx));
      w = w + (x - nextX);
      x = nextX;
    }
    if (handle.includes("e")) {
      w = Math.max(MIN_CROP_PX, Math.min(maxW - x, w + dx));
    }
    if (handle.includes("n")) {
      const nextY = Math.min(y + h - MIN_CROP_PX, Math.max(0, y + dy));
      h = h + (y - nextY);
      y = nextY;
    }
    if (handle.includes("s")) {
      h = Math.max(MIN_CROP_PX, Math.min(maxH - y, h + dy));
    }

    return clampCrop({ x, y, w, h }, maxW, maxH);
  };

  const onHandleDown =
    (handle: HandleId) => (e: ReactPointerEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      stageRef.current?.setPointerCapture(e.pointerId);
      dragRef.current = {
        handle,
        startX: e.clientX,
        startY: e.clientY,
        origin: { ...crop },
      };
    };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !natural) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setCrop(
      applyHandleDelta(
        drag.handle,
        dx,
        dy,
        drag.origin,
        layout.displayW,
        layout.displayH,
      ),
    );
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const handleApply = async () => {
    if (!imageSrc || !natural || layout.scale <= 0) return;
    setSaving(true);
    setError(null);
    try {
      const file = await exportNaturalRectCrop({
        src: imageSrc,
        x: crop.x / layout.scale,
        y: crop.y / layout.scale,
        width: crop.w / layout.scale,
        height: crop.h / layout.scale,
        fileName:
          (imageName || "campaign-image").replace(/\.[^.]+$/, "") + "-cropped.jpg",
      });
      await onApply(file);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not crop. Upload the photo first if it came from social.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!open || !imageSrc) return null;

  const handleStyle = (extra: CSSProperties): CSSProperties => ({
    position: "absolute",
    width: 14,
    height: 14,
    background: "hsl(var(--background))",
    border: "2px solid hsl(var(--primary))",
    borderRadius: 2,
    zIndex: 3,
    ...extra,
  });

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-image-resize-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3
            id="campaign-image-resize-title"
            className="inline-flex items-center gap-2 text-sm font-bold"
          >
            <Minimize2 className="size-4 text-primary" />
            Crop image
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            Cancel
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          <p className="text-xs text-muted-foreground">
            Drag any side or corner to crop · drag inside the box to move · Apply
            saves the selection
          </p>

          <div
            ref={stageRef}
            className="relative h-64 w-full touch-none overflow-hidden rounded-xl bg-secondary ring-1 ring-border sm:h-72"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc}
              alt="Crop preview"
              draggable={false}
              referrerPolicy="no-referrer"
              onLoad={onImgLoad}
              className="pointer-events-none absolute max-w-none select-none"
              style={{
                left: layout.offsetX,
                top: layout.offsetY,
                width: layout.displayW,
                height: layout.displayH,
              }}
            />

            {natural ? (
              <div
                className="absolute"
                style={{
                  left: layout.offsetX,
                  top: layout.offsetY,
                  width: layout.displayW,
                  height: layout.displayH,
                }}
              >
                <div
                  role="presentation"
                  className="absolute box-border cursor-move border-2 border-primary bg-transparent"
                  style={{
                    left: crop.x,
                    top: crop.y,
                    width: crop.w,
                    height: crop.h,
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                  }}
                  onPointerDown={onHandleDown("move")}
                >
                  {/* Edge handles */}
                  <span
                    aria-hidden
                    style={handleStyle({
                      left: "50%",
                      top: -7,
                      transform: "translateX(-50%)",
                      cursor: "ns-resize",
                    })}
                    onPointerDown={onHandleDown("n")}
                  />
                  <span
                    aria-hidden
                    style={handleStyle({
                      left: "50%",
                      bottom: -7,
                      transform: "translateX(-50%)",
                      cursor: "ns-resize",
                    })}
                    onPointerDown={onHandleDown("s")}
                  />
                  <span
                    aria-hidden
                    style={handleStyle({
                      top: "50%",
                      left: -7,
                      transform: "translateY(-50%)",
                      cursor: "ew-resize",
                    })}
                    onPointerDown={onHandleDown("w")}
                  />
                  <span
                    aria-hidden
                    style={handleStyle({
                      top: "50%",
                      right: -7,
                      transform: "translateY(-50%)",
                      cursor: "ew-resize",
                    })}
                    onPointerDown={onHandleDown("e")}
                  />
                  {/* Corner handles */}
                  <span
                    aria-hidden
                    style={handleStyle({
                      left: -7,
                      top: -7,
                      cursor: "nwse-resize",
                    })}
                    onPointerDown={onHandleDown("nw")}
                  />
                  <span
                    aria-hidden
                    style={handleStyle({
                      right: -7,
                      top: -7,
                      cursor: "nesw-resize",
                    })}
                    onPointerDown={onHandleDown("ne")}
                  />
                  <span
                    aria-hidden
                    style={handleStyle({
                      left: -7,
                      bottom: -7,
                      cursor: "nesw-resize",
                    })}
                    onPointerDown={onHandleDown("sw")}
                  />
                  <span
                    aria-hidden
                    style={handleStyle({
                      right: -7,
                      bottom: -7,
                      cursor: "nwse-resize",
                    })}
                    onPointerDown={onHandleDown("se")}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="text-xs font-medium text-destructive">{error}</p>
          ) : null}

          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={saving || !natural}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Apply crop"}
          </button>
        </div>
      </div>
    </div>
  );
}
