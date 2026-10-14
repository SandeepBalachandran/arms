// Draws the GOS Admin app icons. Inverse of the member app's: a lime tile with a
// dark dumbbell and a dashboard badge, so the two apps differ at a glance on a
// home screen. Run: node apps/web/scripts/make-admin-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../public/admin-icons/", import.meta.url));
mkdirSync(out, { recursive: true });

// `pad` shrinks the artwork for the maskable icon (Android crops to a circle).
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#a3e635"/>
  <g transform="translate(256 256) scale(${1 - pad}) translate(-256 -256)">
    <g fill="#18181b" transform="translate(0 -30)">
      <rect x="96" y="183" width="58" height="146" rx="14"/><rect x="358" y="183" width="58" height="146" rx="14"/>
      <rect x="154" y="219" width="44" height="74" rx="10"/><rect x="314" y="219" width="44" height="74" rx="10"/>
      <rect x="198" y="241" width="116" height="30"/>
    </g>
    <g transform="translate(256 400)">
      <rect x="-118" y="-46" width="236" height="92" rx="46" fill="#18181b"/>
      <g fill="#a3e635"><rect x="-76" y="-22" width="38" height="18" rx="4"/><rect x="-20" y="-22" width="38" height="18" rx="4"/><rect x="36" y="-22" width="38" height="18" rx="4"/>
      <rect x="-76" y="4" width="94" height="18" rx="4"/><rect x="36" y="4" width="38" height="18" rx="4"/></g>
    </g>
  </g>
</svg>`;

for (const [name, size, pad] of [["icon-192", 192, 0], ["icon-512", 512, 0], ["maskable-512", 512, 0.2], ["apple-touch-icon", 180, 0]]) {
  await sharp(Buffer.from(svg(pad))).resize(size, size).png().toFile(`${out}${name}.png`);
}
console.log("ok");
