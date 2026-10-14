import brand from "./brand.json";

// The product's name lives in brand.json, in one place. Everything people see
// reads it from there: the admin site, the member app (name on the phone,
// permission prompts), install banners, the web app manifest, WhatsApp messages
// and renewal reminders ({app}).
//   name     the product's name
//   logo     the two-colour logo: first part in white/ink, second in lime
//   tagline  after the name in the installed web app's full name
//
// To rename: edit brand.json, run `npm run brand` (redraws the splash image and
// rewrites the sign-in emails in supabase/templates; paste those into the
// Supabase dashboard), then rebuild the app. The demo (docs/gos-demo.html) has
// its own copy in one line at the top.
export const BRAND: { name: string; logo: readonly [string, string]; tagline: string } = {
  name: brand.name,
  logo: [brand.logo[0], brand.logo[1]],
  tagline: brand.tagline,
};
