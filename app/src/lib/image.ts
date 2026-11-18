/** Gør et billede mindre før upload (højst 1600 px, JPEG ~80 %). Kan browseren ikke læse det, sendes originalen. */
export async function shrinkImage(file: Blob, max = 1600, quality = 0.8): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
    return out && out.size < file.size ? out : file;
  } catch { return file; }
}
