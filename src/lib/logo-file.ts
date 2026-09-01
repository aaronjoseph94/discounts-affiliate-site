/** Client-side checks before we read a logo into a data URL. */
export const MAX_LOGO_BYTES = 700_000;

export function logoFileError(file: File): string | null {
  if (file.size > MAX_LOGO_BYTES) return "Logo must be under 700KB";
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return "Use a PNG, JPG, or WebP";
  return null;
}
