// Profile photos: a private bucket, one folder per user (see the avatars
// migration). profiles.avatar_url stores the storage path, e.g.
// "<user id>/1760000000000.jpg"; apps turn it into a short-lived signed URL.

export const AVATAR_BUCKET = "avatars";
// Photos are cropped square and shrunk to this many pixels before upload.
export const AVATAR_SIZE = 400;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
// Signed URLs last an hour; apps cache by path, so a new URL doesn't mean a new download.
export const AVATAR_URL_SECONDS = 60 * 60;

// A new name each time, so caches never show the old photo.
export function avatarPath(userId: string, ext = "jpg", now = Date.now()) {
  return `${userId}/${now}.${ext}`;
}

// "Ravi Kumar" -> "RK", "Ravi" -> "RA", "" -> "?".
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
}
