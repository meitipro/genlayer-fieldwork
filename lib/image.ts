/**
 * Normalise a photograph before it is uploaded.
 *
 * Measured on GenLayer Studio: a JPEG whose first bytes are ffd8ffdb — valid,
 * but carrying no JFIF/APP0 header — is rejected outright by the node with
 * `NondetException {'causes': ['INVALID_IMAGE']}`, which surfaces to the worker
 * as an unexplained failure. The same photograph as a standard baseline JFIF
 * (ffd8ffe0) grades fine, at 43KB and at 520KB, so it is the container and not
 * the size that matters.
 *
 * Re-drawing through a canvas and exporting with toBlob('image/jpeg') always
 * produces a baseline JFIF, which removes that entire class of failure. It also
 * strips EXIF (including any GPS the worker did not mean to publish) and bounds
 * the upload.
 */

/** Long edge cap. 1600 keeps a handwritten six character code legible. */
export const MAX_EDGE = 1600;
export const JPEG_QUALITY = 0.9;

export type Normalised = {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
};

export async function normalisePhoto(file: Blob): Promise<Normalised> {
  const bitmap = await loadBitmap(file);

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("this browser cannot process the photograph");

  // A photograph with transparency would otherwise flatten to black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);

  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );
  if (!blob) throw new Error("the photograph could not be prepared for upload");

  return { blob, width, height, bytes: blob.size };
}

async function loadBitmap(
  file: Blob
): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap applies EXIF orientation, so a portrait photo is not
  // graded sideways.
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, {
        imageOrientation: "from-image",
      } as ImageBitmapOptions);
    } catch {
      // fall through to the <img> path
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("that file is not an image"));
      img.src = url;
    });
    return img;
  } finally {
    // revoked after decode; the bitmap/element already holds the pixels
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
