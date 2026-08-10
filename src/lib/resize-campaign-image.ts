/**
 * Campaign image resize helper (additive).
 *
 * Purpose: Downscale oversized uploads before POST /api/uploads/image so
 * gallery/cover files stay reasonably sized while keeping aspect ratio.
 * Also exports a zoom/pan crop for the visible Resize dialog.
 *
 * Inputs:
 *   file — original image File from the file picker
 *   options.maxWidth — longest-edge cap in CSS pixels (default 1600)
 *   options.quality — JPEG/WebP quality 0–1 (default 0.88)
 *
 * Outputs:
 *   Promise<File> — resized file, or the original when already small enough
 *   or when the browser cannot decode/draw the image
 *
 * Changelog: Added for campaign gallery max-8 + upload resize option.
 * Changelog: Added exportCroppedCampaignImage for the Resize dialog.
 */

const DEFAULT_MAX_WIDTH = 1600;
const DEFAULT_QUALITY = 0.88;

/**
 * Loads a File into an HTMLImageElement for canvas drawing.
 *
 * Inputs: file — image blob/file
 * Outputs: Promise resolving to a loaded Image (object URL revoked after load)
 */
function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode image for resize"));
    };
    img.src = url;
  });
}

/**
 * Loads an image from a URL (blob:, data:, same-origin, or CORS-enabled https).
 *
 * Inputs: src — browser-loadable image URL
 * Outputs: Promise resolving to a loaded Image (crossOrigin=anonymous for http(s))
 */
export function loadImageFromSrc(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:\/\//i.test(src)) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Could not load image for resize (CORS or bad URL)"));
    img.src = src;
  });
}

/**
 * Downscales a campaign image file when its width exceeds maxWidth.
 * Height scales proportionally. Does not upscale small images.
 *
 * Inputs: file, optional maxWidth / quality
 * Outputs: resized File (same or jpeg/webp/png mime) or the original file
 */
export async function resizeCampaignImageFile(
  file: File,
  options?: { maxWidth?: number; quality?: number },
): Promise<File> {
  const maxWidth = options?.maxWidth ?? DEFAULT_MAX_WIDTH;
  const quality = options?.quality ?? DEFAULT_QUALITY;

  if (!file.type.startsWith("image/")) return file;
  if (typeof document === "undefined") return file;

  try {
    const img = await loadImageFromFile(file);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height || width <= maxWidth) return file;

    const scale = maxWidth / width;
    const nextW = Math.max(1, Math.round(width * scale));
    const nextH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = nextW;
    canvas.height = nextH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, nextW, nextH);

    const outType =
      file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg";

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), outType, quality);
    });
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "campaign-image";
    const ext = outType === "image/png" ? "png" : outType === "image/webp" ? "webp" : "jpg";
    return new File([blob], `${baseName}.${ext}`, {
      type: outType,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

export interface CropExportParams {
  /** Image URL currently shown in the resize dialog. */
  src: string;
  /** Zoom multiplier on top of object-cover fit (1 = cover the frame). */
  zoom: number;
  /** Image translate in frame pixels (after cover fit × zoom). */
  offsetX: number;
  offsetY: number;
  /** Visible crop frame width in CSS pixels. */
  frameWidth: number;
  /** Visible crop frame height in CSS pixels. */
  frameHeight: number;
  /** Output canvas width (defaults to min(1600, natural crop width)). */
  outputMaxWidth?: number;
  quality?: number;
  fileName?: string;
}

/**
 * Exports the visible zoom/pan crop from the Resize dialog as a JPEG File.
 *
 * Inputs: CropExportParams (src, zoom, offsets, frame size)
 * Outputs: Promise<File> — cropped JPEG suitable for uploadImage()
 * @deprecated Prefer exportNaturalRectCrop for all-sides crop UI.
 */
export async function exportCroppedCampaignImage(
  params: CropExportParams,
): Promise<File> {
  const {
    src,
    zoom,
    offsetX,
    offsetY,
    frameWidth,
    frameHeight,
    outputMaxWidth = DEFAULT_MAX_WIDTH,
    quality = DEFAULT_QUALITY,
    fileName = "campaign-crop.jpg",
  } = params;

  if (frameWidth <= 0 || frameHeight <= 0) {
    throw new Error("Invalid crop frame size");
  }

  const img = await loadImageFromSrc(src);
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  if (!nw || !nh) throw new Error("Image has no dimensions");

  const coverScale = Math.max(frameWidth / nw, frameHeight / nh);
  const eff = coverScale * Math.max(1, zoom);

  const sx = Math.max(0, Math.min(nw, -offsetX / eff));
  const sy = Math.max(0, Math.min(nh, -offsetY / eff));
  const sw = Math.max(1, Math.min(nw - sx, frameWidth / eff));
  const sh = Math.max(1, Math.min(nh - sy, frameHeight / eff));

  return canvasCropToFile(img, sx, sy, sw, sh, {
    outputMaxWidth,
    quality,
    fileName,
  });
}

export interface NaturalRectCropParams {
  src: string;
  /** Crop rectangle in natural image pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
  outputMaxWidth?: number;
  quality?: number;
  fileName?: string;
}

/**
 * Draws a source image region to JPEG File.
 * Inputs: loaded image + natural crop rect + export options
 * Outputs: Promise<File>
 */
async function canvasCropToFile(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  options: { outputMaxWidth: number; quality: number; fileName: string },
): Promise<File> {
  const outScale = Math.min(1, options.outputMaxWidth / sw);
  const outW = Math.max(1, Math.round(sw * outScale));
  const outH = Math.max(1, Math.round(sh * outScale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", options.quality);
  });
  if (!blob) {
    throw new Error(
      "Could not export crop. If this is a social preview, upload the photo first, then resize.",
    );
  }

  const name = options.fileName.endsWith(".jpg")
    ? options.fileName
    : `${options.fileName}.jpg`;
  return new File([blob], name, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

/**
 * Exports a free rectangle crop in natural image pixels as a JPEG File.
 *
 * Inputs: NaturalRectCropParams (src + x/y/width/height in natural pixels)
 * Outputs: Promise<File> for uploadImage()
 *
 * Changelog: Added for all-sides crop handles (not zoom/pan-only).
 */
export async function exportNaturalRectCrop(
  params: NaturalRectCropParams,
): Promise<File> {
  const {
    src,
    outputMaxWidth = DEFAULT_MAX_WIDTH,
    quality = DEFAULT_QUALITY,
    fileName = "campaign-crop.jpg",
  } = params;

  const img = await loadImageFromSrc(src);
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  if (!nw || !nh) throw new Error("Image has no dimensions");

  const sx = Math.max(0, Math.min(nw - 1, Math.round(params.x)));
  const sy = Math.max(0, Math.min(nh - 1, Math.round(params.y)));
  const sw = Math.max(1, Math.min(nw - sx, Math.round(params.width)));
  const sh = Math.max(1, Math.min(nh - sy, Math.round(params.height)));

  return canvasCropToFile(img, sx, sy, sw, sh, {
    outputMaxWidth,
    quality,
    fileName,
  });
}
