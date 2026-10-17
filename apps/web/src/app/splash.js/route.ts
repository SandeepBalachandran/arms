import { BRAND } from "@gymos/shared";

// The animated opening screen of the installed app, served as /splash.js and
// loaded first thing by the admin (app/layout.tsx) and the member app
// (apps/mobile/public/index.html). The phone's own splash (manifest icon on
// #1f2a10) comes first; this one starts on the same colour so it carries on
// from it: the logo settles, the name rises, a barbell loads, and the four
// things the app is for appear one by one. Only in the installed app, once
// per launch; never in a browser tab. Gone as soon as the page has loaded
// (at least ~1.6 s so it can be read, at most 4 s).

const LINES = ["Check in", "Train", "Track", "Renew"];

const script = `(function () {
  try {
    var standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    if (!standalone || sessionStorage.getItem("gos.booted")) return;
    sessionStorage.setItem("gos.booted", "1");
  } catch (e) { return; }
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var css = ${JSON.stringify(`
#gos-splash{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;background:#1f2a10;color:#fff;font-family:Poppins,system-ui,sans-serif;transition:opacity .45s ease,visibility .45s;padding:24px;text-align:center}
#gos-splash.out{opacity:0;visibility:hidden}
#gos-splash .logo{width:96px;height:96px;border-radius:24px;animation:gos-pop .7s cubic-bezier(.2,.9,.3,1.3) both}
#gos-splash .name{font-size:34px;font-weight:800;letter-spacing:-.02em;line-height:1;animation:gos-rise .6s .25s ease-out both}
#gos-splash .name b{color:#c8f04b;font-weight:800}
#gos-splash .tag{margin-top:-10px;font-size:15px;color:rgba(255,255,255,.72);animation:gos-rise .6s .4s ease-out both}
#gos-splash .bar{position:relative;width:200px;height:8px;margin-top:6px;animation:gos-rise .5s .5s ease-out both}
#gos-splash .bar:before,#gos-splash .bar:after{content:"";position:absolute;top:-8px;width:8px;height:24px;border-radius:3px;background:#c8f04b}
#gos-splash .bar:before{left:-12px}#gos-splash .bar:after{right:-12px}
#gos-splash .track{height:100%;border-radius:99px;background:rgba(255,255,255,.14);overflow:hidden}
#gos-splash .fill{height:100%;width:100%;border-radius:99px;background:#c8f04b;transform-origin:left;animation:gos-load 1.4s .55s cubic-bezier(.6,0,.2,1) both}
#gos-splash .lines{display:flex;gap:10px;font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.85)}
#gos-splash .lines span{animation:gos-rise .45s ease-out both}
#gos-splash .lines i{color:#c8f04b;font-style:normal;animation:gos-rise .45s ease-out both}
@keyframes gos-pop{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}
@keyframes gos-rise{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}
@keyframes gos-load{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@media (prefers-reduced-motion: reduce){#gos-splash *{animation:none!important}}
`)};
  var lines = ${JSON.stringify(LINES)};
  var words = "";
  for (var i = 0; i < lines.length; i++) {
    var delay = (0.75 + i * 0.22).toFixed(2) + "s";
    if (i) words += '<i aria-hidden="true" style="animation-delay:' + delay + '">·</i>';
    words += '<span style="animation-delay:' + delay + '">' + lines[i] + "</span>";
  }
  var el = document.createElement("div");
  el.id = "gos-splash";
  el.setAttribute("role", "status");
  el.setAttribute("aria-label", ${JSON.stringify(`${BRAND.name} is opening`)});
  el.innerHTML =
    "<style>" + css + "</style>" +
    '<img class="logo" src="/icons/icon-192.png" alt="">' +
    '<div class="name">' + ${JSON.stringify(BRAND.logo[0])} + "<b>" + ${JSON.stringify(BRAND.logo[1])} + "</b></div>" +
    '<div class="tag">' + ${JSON.stringify(BRAND.tagline)} + "</div>" +
    '<div class="bar"><div class="track"><div class="fill"></div></div></div>' +
    '<div class="lines">' + words + "</div>";
  (document.body || document.documentElement).appendChild(el);

  var started = Date.now();
  var minMs = reduce ? 600 : 1700;
  var done = false;
  function hide() {
    if (done) return;
    done = true;
    el.className = "out";
    setTimeout(function () { el.remove(); }, 500);
  }
  function whenReady() { setTimeout(hide, Math.max(0, minMs - (Date.now() - started))); }
  if (document.readyState === "complete") whenReady();
  else addEventListener("load", whenReady);
  setTimeout(hide, 4000);
})();`;

export function GET() {
  return new Response(script, {
    headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}

export const dynamic = "force-static";
