// Public configuration only. No credentials are needed by this provider.
// Normal viewport requests and browser HTTP caching follow the OSM tile policy.
export const BASEMAP = {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        className: 'basemap-tile',
        keepBuffer: 1,
        updateWhenIdle: true
    }
};
