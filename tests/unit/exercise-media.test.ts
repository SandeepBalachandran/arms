import { describe, expect, it } from "vitest";
import { hasGuide, howToText, videoLink } from "@gymos/shared";

describe("videoLink", () => {
  it("recognises YouTube links in every common shape", () => {
    const want = { kind: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg", label: "YouTube" };
    expect(videoLink("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s")).toEqual(want);
    expect(videoLink("https://youtu.be/dQw4w9WgXcQ?si=abc")).toEqual(want);
    expect(videoLink("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual(want);
    expect(videoLink("https://youtube.com/shorts/dQw4w9WgXcQ")).toEqual(want);
    expect(videoLink("  https://www.youtube.com/embed/dQw4w9WgXcQ  ")).toEqual(want);
  });

  it("recognises Instagram reels and Drive files, and keeps other https links", () => {
    expect(videoLink("https://www.instagram.com/reel/Cx123abc/")?.kind).toBe("instagram");
    expect(videoLink("https://drive.google.com/file/d/1abc/view")?.kind).toBe("drive");
    expect(videoLink("https://vimeo.com/123456")).toEqual({ kind: "link", url: "https://vimeo.com/123456", thumbnail: null, label: "vimeo.com" });
  });

  it("rejects empty, non-https and malformed input", () => {
    expect(videoLink("")).toBeNull();
    expect(videoLink(null)).toBeNull();
    expect(videoLink("http://youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(videoLink("javascript:alert(1)")).toBeNull();
    expect(videoLink("not a link")).toBeNull();
  });
});

describe("howToText", () => {
  const both = { how_to_en: "Keep your back straight.", how_to_ml: "പുറം നേരെ വയ്ക്കുക." };
  it("uses the member's language, falling back to English", () => {
    expect(howToText(both, "ml")).toBe("പുറം നേരെ വയ്ക്കുക.");
    expect(howToText(both, "en")).toBe("Keep your back straight.");
    expect(howToText({ how_to_en: "Keep your back straight.", how_to_ml: " " }, "ml")).toBe("Keep your back straight.");
    expect(howToText({ how_to_en: null, how_to_ml: "പുറം നേരെ വയ്ക്കുക." }, "en")).toBe("പുറം നേരെ വയ്ക്കുക.");
    expect(howToText(null, "en")).toBeNull();
  });
});

describe("hasGuide", () => {
  const empty = { photo_urls: [], video_url: null, how_to_en: null, how_to_ml: "  " };
  it("is true only when there is something to show", () => {
    expect(hasGuide(empty)).toBe(false);
    expect(hasGuide(undefined)).toBe(false);
    expect(hasGuide({ ...empty, video_url: "https://youtu.be/dQw4w9WgXcQ" })).toBe(true);
    expect(hasGuide({ ...empty, photo_urls: ["https://x/y.jpg"] })).toBe(true);
  });
});
