/* OZ EKARTS preview — service worker. Precaches every page and image after the first visit so navigation is
   instant; HTML is network-first (fresh deploys show immediately), assets cache-first. 34e373f25d and
   ["/assets/client-logos/APM-Earth-Moving.webp","/assets/client-logos/Adelaide-Thunderbirds.webp","/assets/client-logos/Area1.webp","/assets/client-logos/Arrotex-Pharmacy.webp","/assets/client-logos/Astel-homes.webp","/assets/client-logos/Australian-Defence-Force.webp","/assets/client-logos/Blackwood-Dyno.webp","/assets/client-logos/CMG-LOGO-002-current.webp","/assets/client-logos/Commuserv.webp","/assets/client-logos/DMP-Engineering.webp","/assets/client-logos/Daikin-Australia.webp","/assets/client-logos/Deloitte.webp","/assets/client-logos/Diesel-tune-Adelaide.webp","/assets/client-logos/Epson.webp","/assets/client-logos/Fulton-Hogan.webp","/assets/client-logos/Jaymel.webp","/assets/client-logos/Kustom-joinery.webp","/assets/client-logos/Lofty-Building-Group.webp","/assets/client-logos/Maid-of-Auckland.webp","/assets/client-logos/North-Point-Toyota.webp","/assets/client-logos/Northeast-Isuzu-Iveco.webp","/assets/client-logos/Palo-Alto-Networks.webp","/assets/client-logos/Rinnai-Australia.webp","/assets/client-logos/SA-Gate-Automation-Systems.webp","/assets/client-logos/SA-Premium-Landscapes.webp","/assets/client-logos/Scuderia-Ferrari-Club.webp","/assets/client-logos/Tick-Fitness.webp","/assets/client-logos/Uniq-Stone.webp","/assets/client-logos/Wacky-Warehouse.webp","/assets/client-logos/Wayne-Phillis-Automotive.webp","/assets/client-logos/Zagari-concrete.webp","/assets/client-logos/adelaide-university.webp","/assets/client-logos/campbelltown-council.webp","/assets/client-logos/cfs.webp","/assets/client-logos/maptek.webp","/assets/client-logos/pacificindemnity.webp","/assets/client-logos/st-peter-college.webp","/assets/dc-runtime.js","/assets/favicon.webp","/assets/fonts/aldrich.woff2","/assets/fonts/dameron.ttf","/assets/logo/oze-logo-black.webp","/assets/logo/oze-logo-white.webp","/assets/oze-forms.js","/assets/oze-hours.js","/assets/photos/adult-kart-480.webp","/assets/photos/adult-kart-960.webp","/assets/photos/adult-kart.webp","/assets/photos/birthday-invitation.webp","/assets/photos/drifting-IMG_3999-480.webp","/assets/photos/drifting-IMG_3999-960.webp","/assets/photos/drifting-IMG_3999.webp","/assets/photos/events-IMG_0823-480.webp","/assets/photos/events-IMG_0823-960.webp","/assets/photos/events-IMG_0823.webp","/assets/photos/events-IMG_0878-480.webp","/assets/photos/events-IMG_0878-960.webp","/assets/photos/events-IMG_0878.webp","/assets/photos/events-IMG_20861-480.webp","/assets/photos/events-IMG_20861-960.webp","/assets/photos/events-IMG_20861.webp","/assets/photos/events-IMG_21342-480.webp","/assets/photos/events-IMG_21342-960.webp","/assets/photos/events-IMG_21342.webp","/assets/photos/events-IMG_3856-480.webp","/assets/photos/events-IMG_3856-960.webp","/assets/photos/events-IMG_3856.webp","/assets/photos/events-IMG_5421-480.webp","/assets/photos/events-IMG_5421-960.webp","/assets/photos/events-IMG_5421.webp","/assets/photos/events-IMG_5684-480.webp","/assets/photos/events-IMG_5684-960.webp","/assets/photos/events-IMG_5684.webp","/assets/photos/events-IMG_5745-480.webp","/assets/photos/events-IMG_5745-960.webp","/assets/photos/events-IMG_5745.webp","/assets/photos/header-IMG_2111-480.webp","/assets/photos/header-IMG_2111-960.webp","/assets/photos/header-IMG_2111.webp","/assets/photos/junior-kart-480.webp","/assets/photos/junior-kart-960.webp","/assets/photos/junior-kart.webp","/assets/photos/kids-karting-480.webp","/assets/photos/kids-karting-960.webp","/assets/photos/kids-karting.webp","/assets/photos/racing-IMG_3876-480.webp","/assets/photos/racing-IMG_3876-960.webp","/assets/photos/racing-IMG_3876.webp","/assets/photos/voucher-480.webp","/assets/photos/voucher-960.webp","/assets/photos/voucher.webp","/assets/video/oze-video-hero-poster.webp","/contact.html","/events.html","/faq.html","/index.html","/our-vision.html","/racing.html","/specials.html"] are filled in by build.mjs. */
const VERSION = '__VERSION__';
const CACHE = 'oze-' + VERSION;
const PRECACHE = __PRECACHE__;
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // pages + fonts + runtime first, images in the background (failures must not block install)
    await c.addAll(PRECACHE.filter((u) => !/\.(webp|svg)$/.test(u)));
    await Promise.allSettled(PRECACHE.filter((u) => /\.(webp|svg)$/.test(u)).map((u) => c.add(u)));
    self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => { for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k); await self.clients.claim(); })());
});
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith((async () => {
      try { const r = await fetch(req); const c = await caches.open(CACHE); c.put(req, r.clone()); return r; }
      catch { return (await caches.match(req)) || (await caches.match('/index.html')); }
    })());
    return;
  }
  if (/\.(mp4|webm)$/.test(url.pathname)) return;  // let the browser stream video normally
  e.respondWith((async () => {
    const hit = await caches.match(req); if (hit) return hit;
    const r = await fetch(req); if (r.ok) { const c = await caches.open(CACHE); c.put(req, r.clone()); } return r;
  })());
});
