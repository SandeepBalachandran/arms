// Applies the product's name (packages/shared/src/brand.json) to the files that
// can't read it themselves:
// - the sign-in emails (supabase/templates/*.html and their subjects in
//   supabase/config.toml). Paste these into the hosted project's
//   Authentication → Email Templates afterwards.
// - the app's splash image (apps/mobile/assets/images/splash-icon.png): the
//   dumbbell with the two-colour logo under it.
// Run: npm run brand. Then rebuild the app.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const brand = JSON.parse(readFileSync(root("packages/shared/src/brand.json"), "utf8"));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function rewrite(path, pairs) {
  let s = readFileSync(root(path), "utf8");
  for (const [re, to] of pairs) {
    if (!re.test(s)) throw new Error(`${path}: nothing matches ${re}`);
    s = s.replace(re, to);
  }
  writeFileSync(root(path), s);
  console.log("updated", path);
}

// Emails
rewrite("supabase/templates/confirmation.html", [[/<h2>Welcome to .*?<\/h2>/, `<h2>Welcome to ${esc(brand.name)}</h2>`]]);
rewrite("supabase/templates/magic_link.html", [[/<h2>Sign in to .*?<\/h2>/, `<h2>Sign in to ${esc(brand.name)}</h2>`]]);
rewrite("supabase/config.toml", [[/subject = "Your .*? sign-in code"/g, `subject = "Your ${brand.name.replace(/"/g, "")} sign-in code"`]]);

// Splash: lime dumbbell, logo underneath (first part white, second lime), on a
// transparent 1024² canvas. The splash background colour is set in app.json.
const [first, second] = brand.logo;
const size = Math.min(170, Math.floor(1500 / (first.length + second.length)));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g fill="#c8f04b" transform="translate(0 -60)">
    <rect x="252" y="352" width="94" height="236" rx="22"/><rect x="678" y="352" width="94" height="236" rx="22"/>
    <rect x="346" y="411" width="72" height="118" rx="16"/><rect x="606" y="411" width="72" height="118" rx="16"/>
    <rect x="418" y="446" width="188" height="48"/>
  </g>
  <text x="512" y="${640 + size * 0.75}" text-anchor="middle" font-family="Poppins, 'Arial Black', Arial, sans-serif" font-weight="800" font-size="${size}" letter-spacing="-4"><tspan fill="#ffffff">${esc(first)}</tspan><tspan fill="#c8f04b">${esc(second)}</tspan></text>
</svg>`;
await sharp(Buffer.from(svg)).png().toFile(root("apps/mobile/assets/images/splash-icon.png"));
console.log("updated apps/mobile/assets/images/splash-icon.png");
