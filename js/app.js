// Entry point: map init, data loading, marker creation, events

import { RED_LIST_CATEGORIES, SEARCH_RADIUS_KM, escapeHtml } from './data.js';
import { scorePark, scoreToColor, riskLabel, getAltRisk, pointInFeature } from './scoring.js';
import {
    initUI, updateState, toggleUI, applyFilters, setView,
    toggleTurbines, toggleConfidence
} from './ui.js';

// State
let allData = [];
let kommuneLayer = null;
let turbineLayer = null;

// Init map centered on Norway
const map = L.map('map', {
    center: [64.5, 14],
    zoom: 5,
    zoomControl: false,
    attributionControl: false
});

L.control.zoom({ position: 'topright' }).addTo(map);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 18
}).addTo(map);

// Load data
Promise.all([
    fetch('data/birds_norway.json').then(r => r.json()),
    fetch('data/kommuner.geojson').then(r => r.json()).catch(() => null),
    fetch('data/wind_turbines.json').then(r => r.json()).catch(() => null)
]).then(([birdData, kommuneGeoJSON, turbineData]) => {
    document.getElementById('loading').style.display = 'none';
    allData = birdData.observations;

    document.getElementById('stat-obs').textContent = allData.length.toLocaleString();
    const uniqueSpecies = new Set(allData.map(d => d.species));
    document.getElementById('stat-species').textContent = uniqueSpecies.size;

    // Populate species filter
    const select = document.getElementById('species-filter');
    const speciesCounts = new Map();
    allData.forEach(d => speciesCounts.set(d.species, (speciesCounts.get(d.species) || 0) + 1));
    const sortedSpecies = [...speciesCounts.entries()].sort((a, b) => b[1] - a[1]);
    sortedSpecies.forEach(([species, count]) => {
        const opt = document.createElement('option');
        opt.value = species;
        opt.textContent = count >= 1000
            ? `${species} (${(count / 1000).toFixed(0)}K)`
            : `${species} (${count})`;
        select.appendChild(opt);
    });

    // Kommune boundaries
    if (kommuneGeoJSON) {
        kommuneLayer = L.geoJSON(kommuneGeoJSON, {
            style: {
                color: 'rgba(255,255,255,0.12)',
                weight: 0.5,
                fillColor: 'transparent',
                fillOpacity: 0
            },
            onEachFeature: (feature, layer) => {
                const name = feature.properties.kommunenavn || feature.properties.name || '';
                layer.bindTooltip(escapeHtml(name), {
                    className: 'kommune-tooltip',
                    sticky: true
                });
            }
        }).addTo(map);

        // Pre-assign each observation to its kommune (one-time point-in-polygon)
        const kLayers = [];
        kommuneLayer.eachLayer(l => kLayers.push(l));
        allData.forEach(o => {
            for (const kl of kLayers) {
                const b = kl.getBounds();
                if (o.lat >= b.getSouth() && o.lat <= b.getNorth() &&
                    o.lon >= b.getWest() && o.lon <= b.getEast()) {
                    if (pointInFeature(o.lat, o.lon, kl.feature.geometry)) {
                        o._kl = kl;
                        break;
                    }
                }
            }
        });
        updateState('kommuneLayer', kommuneLayer);
    }

    // Wind turbine layer with bird conflict scoring
    if (turbineData) {
        turbineLayer = L.layerGroup();
        const parks = turbineData.parks;
        document.getElementById('turbine-count').textContent = parks.length + ' parks';
        document.getElementById('turbine-info').textContent =
            turbineData.metadata.total_turbines + ' turbines total (NVE open data)';

        parks.forEach(park => {
            const { normScore, riskSpecies, nearbyCount } = scorePark(park, allData);
            park._score = normScore;
            park._nearby = nearbyCount;
            park._riskSpecies = riskSpecies;

            const parkColor = scoreToColor(normScore);
            const sz = Math.max(20, Math.min(36, Math.sqrt(park.capacity_mw) * 4));
            const szH = Math.round(sz * 1.5);
            const icon = L.divIcon({
                html: `<svg viewBox="0 0 60 90" width="${sz}" height="${szH}" style="filter:drop-shadow(0 2px 6px rgba(0,0,0,0.8))">
                    <path d="M28 35 L26.5 87 L33.5 87 L32 35 Z" fill="${parkColor}" opacity="0.85"/>
                    <path d="M28 35 L26.5 87 L29 87 L29.5 35 Z" fill="rgba(255,255,255,0.14)"/>
                    <path d="M24 30 L38 31 L37 36 L25 35 Z" fill="${parkColor}" opacity="0.9"/>
                    <path d="M24 30 L38 31 L38 33 L24 32 Z" fill="rgba(255,255,255,0.08)"/>
                    <circle cx="30" cy="32" r="4" fill="${parkColor}"/>
                    <circle cx="29" cy="31" r="1.8" fill="rgba(255,255,255,0.4)"/>
                    <path d="M26 28 C 16 16, 6 4, 2 0 C 14 10, 26 24, 34 35 Z" fill="${parkColor}"/>
                    <path d="M26 28 C 16 16, 6 4, 2 0 C 10 6, 20 17, 26 28 Z" fill="rgba(255,255,255,0.12)"/>
                    <path d="M34 28 C 46 18, 54 9, 60 3 C 53 15, 40 28, 28 36 Z" fill="${parkColor}"/>
                    <path d="M34 28 C 46 18, 54 9, 60 3 C 56 8, 47 17, 34 28 Z" fill="rgba(255,255,255,0.1)"/>
                    <path d="M33 36 C 40 43, 48 51, 54 58 C 47 52, 37 41, 28 32 Z" fill="${parkColor}" opacity="0.45"/>
                </svg>`,
                className: 'turbine-marker',
                iconSize: [sz, szH],
                iconAnchor: [sz / 2, szH]
            });
            const marker = L.marker([park.lat, park.lon], { icon });

            const risk = riskLabel(normScore);
            const topRisk = Object.entries(riskSpecies)
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 4)
                .map(([sp, d]) => {
                    const badge = d.rl ? `<span style="color:${RED_LIST_CATEGORIES[d.rl]?.color};font-weight:700">${d.rl}</span> ` : '';
                    const riskMark = d.risk === 'high' ? ' &#9650;' : d.risk === 'medium' ? ' &#9679;' : '';
                    return `${badge}<i>${escapeHtml(sp)}</i>${riskMark} (${d.count})`;
                }).join('<br>');

            const hubHtml = park.hub_height
                ? `<br>Hub: ${park.hub_height}m | Rotor: ${park.rotor_diameter}m`
                : '';
            const sweptHtml = park.rotor_min != null
                ? ` | Swept: ${park.rotor_min}-${park.rotor_max}m`
                : '';

            marker.bindPopup(
                `<b>${escapeHtml(park.name)}</b><br>` +
                `${park.turbine_count} turbines | ${park.capacity_mw} MW` +
                hubHtml + sweptHtml +
                `<br><span style="color:${risk.color};font-weight:700">${risk.text}</span>` +
                ` <span style="color:#888">(${nearbyCount} obs within ${SEARCH_RADIUS_KM}km)</span>` +
                (topRisk ? `<br><span style="font-size:11px">${topRisk}</span>` : '') +
                `<br><span style="color:#888;font-size:10px">${escapeHtml(park.municipality)}, ${escapeHtml(park.county)}</span>`
            );
            turbineLayer.addLayer(marker);
        });
        turbineLayer.addTo(map);
    }

    // Init layers
    const heatLayer = L.heatLayer([], {
        radius: 25,
        blur: 15,
        maxZoom: 12,
        max: 0.6,
        minOpacity: 0.3,
        gradient: { 0.1: '#1a0533', 0.2: '#3b0f70', 0.35: '#8c2981', 0.5: '#de4968', 0.65: '#fe9f6d', 0.8: '#fecf92', 1.0: '#fcfdbf' }
    }).addTo(map);

    const pointsLayer = L.layerGroup();

    // Pass state to UI module
    initUI({
        map,
        heatLayer,
        pointsLayer,
        allData,
        currentView: 'heatmap',
        kommuneLayer,
        confidenceMode: false
    });

    applyFilters();

    // Event listeners (replacing inline handlers)
    document.getElementById('species-filter').addEventListener('change', applyFilters);
    document.getElementById('month-slider').addEventListener('input', applyFilters);
    document.getElementById('turbine-toggle').addEventListener('change', () => toggleTurbines(turbineLayer));
    document.getElementById('confidence-toggle').addEventListener('change', () => {
        toggleConfidence(document.getElementById('confidence-toggle').checked);
    });

    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => setView(btn.dataset.view));
    });

    document.querySelector('.info-btn').addEventListener('click', () => {
        document.getElementById('info-modal').classList.add('open');
    });

    // Species list click delegation
    document.getElementById('species-list').addEventListener('click', (e) => {
        const item = e.target.closest('.species-item');
        if (!item) return;
        const species = item.dataset.species;
        if (!species) return;
        const sel = document.getElementById('species-filter');
        sel.value = species;
        applyFilters();
    });
});

// Global event listeners (need to work before data loads)
document.getElementById('hide-ui-btn').addEventListener('click', toggleUI);

document.getElementById('info-modal').addEventListener('click', function (e) {
    if (e.target === this) this.classList.remove('open');
});

document.querySelector('.modal-close').addEventListener('click', () => {
    document.getElementById('info-modal').classList.remove('open');
});

document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'h' || e.key === 'H') toggleUI();
    if (e.key === 'Escape') document.getElementById('info-modal').classList.remove('open');
});
