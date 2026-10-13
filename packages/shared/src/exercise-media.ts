// Exercise guides: equipment photos, a video link and how-to text in English
// and Malayalam (table exercise_media).

export const EXERCISE_MEDIA_BUCKET = "exercise-media";
export const MAX_EXERCISE_PHOTOS = 3;
export const EXERCISE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const EXERCISE_PHOTO_MAX_SIDE = 1280;
export const HOW_TO_MAX = 1000;

export type GuideLanguage = "en" | "ml";
export const GUIDE_LANGUAGES: Record<GuideLanguage, string> = { en: "English", ml: "മലയാളം (Malayalam)" };

export type VideoLink = {
  kind: "youtube" | "instagram" | "drive" | "link";
  // Where to send the viewer (the original link, tidied).
  url: string;
  // A preview image when the site offers one without an API call.
  thumbnail: string | null;
  label: string;
};

// Recognises the video links trainers paste. Only https links are accepted;
// returns null for anything that isn't one.
export function videoLink(input: string | null | undefined): VideoLink | null {
  const raw = input?.trim();
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^(www|m)\./, "");

  const youtubeId =
    host === "youtu.be"
      ? u.pathname.slice(1).split("/")[0]
      : host === "youtube.com" || host === "music.youtube.com"
        ? (u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1] ?? "")
        : "";
  if (youtubeId && /^[\w-]{6,20}$/.test(youtubeId)) {
    return {
      kind: "youtube",
      url: `https://www.youtube.com/watch?v=${youtubeId}`,
      thumbnail: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
      label: "YouTube",
    };
  }
  if (host === "instagram.com" && /^\/(reel|reels|p|tv)\//.test(u.pathname)) {
    return { kind: "instagram", url: u.toString(), thumbnail: null, label: "Instagram" };
  }
  if (host === "drive.google.com") {
    return { kind: "drive", url: u.toString(), thumbnail: null, label: "Google Drive" };
  }
  return { kind: "link", url: u.toString(), thumbnail: null, label: host };
}

// The how-to text in the member's language, falling back to English.
export function howToText(guide: { how_to_en: string | null; how_to_ml: string | null } | null | undefined, language: string | null | undefined) {
  if (!guide) return null;
  if (language === "ml" && guide.how_to_ml?.trim()) return guide.how_to_ml.trim();
  return guide.how_to_en?.trim() || guide.how_to_ml?.trim() || null;
}

// True when a guide has anything to show.
export function hasGuide(guide: { photo_urls: string[]; video_url: string | null; how_to_en: string | null; how_to_ml: string | null } | null | undefined) {
  return !!guide && (guide.photo_urls.length > 0 || !!guide.video_url || !!guide.how_to_en?.trim() || !!guide.how_to_ml?.trim());
}
