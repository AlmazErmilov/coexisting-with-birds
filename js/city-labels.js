import { escapeHtml } from './data.js';

// Local GeoNames labels stay above the heat layer and also work offline.
export async function initCityLabels(map) {
    const pane = map.createPane('cityLabels');
    pane.style.zIndex = '625';
    pane.style.pointerEvents = 'none';
    const layer = L.layerGroup().addTo(map);
    try {
        const response = await fetch('data/cities_norway.json');
        if (!response.ok) throw new Error('City labels unavailable');
        const { cities } = await response.json();
        map.attributionControl.addAttribution('<a href="https://www.geonames.org/">GeoNames</a>');
        const draw = () => {
            layer.clearLayers();
            const zoom = map.getZoom();
            const bounds = map.getBounds();
            const occupied = [];
            for (const city of cities) {
                if (zoom < 6 && city.population < 12000 || zoom < 8 && city.population < 4000) continue;
                if (!bounds.contains([city.lat, city.lon])) continue;
                const point = map.latLngToContainerPoint([city.lat, city.lon]);
                const width = Math.max(55, city.name.length * 7);
                const box = {left: point.x - 4, right: point.x + width, top: point.y - 12, bottom: point.y + 12};
                if (occupied.some(other => box.left < other.right + 12 && box.right > other.left - 12 && box.top < other.bottom + 12 && box.bottom > other.top - 12)) continue;
                occupied.push(box);
                L.marker([city.lat, city.lon], {pane: 'cityLabels', interactive: false, keyboard: false,
                    icon: L.divIcon({className: 'city-label', html: '<span>' + escapeHtml(city.name) + '</span>', iconSize: [width, 24], iconAnchor: [4, 12]})}).addTo(layer);
            }
        };
        map.on('moveend zoomend', draw);
        draw();
    } catch {
        // The basemap still contains place names if the optional label snapshot fails.
    }
}
