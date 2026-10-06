/* Versioned, same-origin application snapshot. No third party tiles are stored.
 * ASVS 1.2.2: cache only an explicit allowlist of paths from our own origin.
 */
const VERSION = 'birds-14c586de947b94a4';
const SNAPSHOT_KEY = '__snapshot_info__';
const CORE = [
    "./",
    "index.html",
    "docs/bird-images.html",
    "docs/bird-images.md",
    "js/app.js",
    "js/bird-images.js",
    "js/data.js",
    "js/dialogs.js",
    "js/flight-visual.js",
    "js/map-config.js",
    "js/offline.js",
    "js/scoring.js",
    "js/ui.js",
    "css/flight-visual.css",
    "css/style.css",
    "data/birds_norway.json",
    "data/kommuner.geojson",
    "data/wind_turbines.json",
    "fonts/RobotoMono-Bold.ttf",
    "fonts/RobotoMono-Light.ttf",
    "fonts/RobotoMono-Medium.ttf",
    "fonts/RobotoMono-Regular.ttf",
    "assets/vendor/leaflet-heat.js",
    "assets/vendor/leaflet/images/layers-2x.png",
    "assets/vendor/leaflet/images/layers.png",
    "assets/vendor/leaflet/leaflet.css",
    "assets/vendor/leaflet/leaflet.js"
];
// Photo paths are added when the thumbnail manifest is generated.
const PHOTOS = [
    "assets/birds/alca-torda.jpg",
    "assets/birds/clangula-hyemalis.jpg",
    "assets/birds/corvus-cornix.jpg",
    "assets/birds/crex-crex.jpg",
    "assets/birds/cyanistes-caeruleus.jpg",
    "assets/birds/erithacus-rubecula.jpg",
    "assets/birds/illustration-placeholder.svg",
    "assets/birds/larus-fuscus.jpg",
    "assets/birds/melanitta-fusca.jpg",
    "assets/birds/numenius-arquata.jpg",
    "assets/birds/parus-major.jpg",
    "assets/birds/pica-pica.jpg",
    "assets/birds/polysticta-stelleri.jpg",
    "assets/birds/pyrrhula-pyrrhula.jpg",
    "assets/birds/rissa-tridactyla.jpg",
    "assets/birds/saxicola-rubetra.jpg",
    "assets/birds/sitta-europaea.jpg",
    "assets/birds/sterna-hirundo.jpg",
    "assets/birds/turdus-merula.jpg",
    "assets/birds/uria-aalge.jpg",
    "assets/birds/vanellus-vanellus.jpg"
];
const urls = new Set([...CORE, ...PHOTOS].map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(VERSION);
        try {
            // Atomic core install: a partial download must never replace a working snapshot.
            await cache.addAll(CORE.map(path => new Request(new URL(path, self.registration.scope), {cache: 'reload'})));
            await cache.put(SNAPSHOT_KEY, new Response(JSON.stringify({
                type: 'SNAPSHOT_READY', version: VERSION, savedAt: new Date().toISOString()
            }), {headers: {'Content-Type': 'application/json'}}));
            // Optional photos cannot prevent the core application from working offline.
            await Promise.allSettled(PHOTOS.map(path => cache.add(new Request(new URL(path, self.registration.scope), {cache: 'reload'}))));
        } catch (error) {
            await caches.delete(VERSION);
            throw error;
        }
    })());
});
self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names.filter(name => name.startsWith('birds-') && name !== VERSION).map(name => caches.delete(name)));
        await self.clients.claim();
        const metadata = await (await caches.open(VERSION)).match(SNAPSHOT_KEY);
        if (metadata) {
            const info = await metadata.json();
            for (const client of await self.clients.matchAll()) client.postMessage(info);
        }
    })());
});
self.addEventListener('message', event => {
    if (event.data?.type === 'ACTIVATE_SNAPSHOT') { self.skipWaiting(); return; }
    if (event.data?.type !== 'SNAPSHOT_STATUS') return;
    event.waitUntil((async () => {
        const metadata = await (await caches.open(VERSION)).match(SNAPSHOT_KEY);
        if (metadata) event.source?.postMessage(await metadata.json());
    })());
});
self.addEventListener('fetch', event => {
    const key = new URL(event.request.url);
    key.search = '';
    if (event.request.method !== 'GET' || !urls.has(key.href)) return;
    event.respondWith((async () => {
        const cache = await caches.open(VERSION);
        const saved = await cache.match(key.href);
        if (saved) return saved;
        // A missing optional photo can still recover online. Never cache an error response.
        const response = await fetch(event.request);
        if (response.ok) await cache.put(key.href, response.clone());
        return response;
    })());
});
