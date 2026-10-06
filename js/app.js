// Entry point: map init, data loading, marker creation, events

import {
    RED_LIST, RED_LIST_CATEGORIES, FLIGHT_ALT, SEARCH_RADIUS_KM,
    DEFAULT_HUB_HEIGHT, DEFAULT_ROTOR_DIAMETER, MONTH_NAMES, escapeHtml
} from './data.js';
import { scorePark, scoreToColor, riskLabel, getAltRisk, pointInFeature, scoreKommune, distanceKm } from './scoring.js';
import {
    initUI, updateState, toggleUI, applyFilters, setView,
    toggleTurbines, toggleConfidence, getFilteredData
} from './ui.js';

import { initOfflineSnapshot } from './offline.js';
import { BASEMAP } from './map-config.js';
import { initCityLabels } from './city-labels.js';
import { flightDiagram, initFlightIntro } from './flight-visual.js';
import { birdThumbnail, initBirdImages } from './bird-images.js';
import { openDialog, closeDialog, initDialogs } from './dialogs.js';
import { initBirdCards, birdIdentity, birdDetailsButton } from './bird-cards.js';

initOfflineSnapshot();
initDialogs();
initBirdImages();
initFlightIntro();

// State
let allData = [];
let kommuneLayer = null;
let turbineLayer = null;
const parkMarkers = [];
let selectedPark = null;
let screeningRadius = null;
let refreshBirdCard = () => {};

// Init map centered on Norway
const map = L.map('map', {
    center: [64.5, 14],
    zoom: 5,
    zoomControl: false,
    attributionControl: true
});

L.control.zoom({ position: 'topright' }).addTo(map);
initCityLabels(map);

const basemap = L.tileLayer(BASEMAP.url, BASEMAP.options).addTo(map);
const mapStatus = document.getElementById('map-status');
let tileErrors = 0;
basemap.on('loading', () => { tileErrors = 0; });
basemap.on('tileerror', () => { tileErrors++; });
basemap.on('load', () => {
    mapStatus.hidden = tileErrors === 0;
    updateState('basemapUnavailable', tileErrors > 0);
    mapStatus.textContent = 'Basemap unavailable. Local municipality outlines remain visible; observations and studies still work.';
    if (kommuneLayer && tileErrors > 0) kommuneLayer.setStyle({ color: '#5d8195', weight: .8, fillColor: '#203844', fillOpacity: .45 });
});

async function loadJSON(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error('Data request failed');
    return response.json();
}

// Load data
Promise.all([
    loadJSON('data/birds_norway.json'),
    loadJSON('data/kommuner.geojson').catch(() => null),
    loadJSON('data/wind_turbines.json').catch(() => null)
]).then(([birdData, kommuneGeoJSON, turbineData]) => {
    document.getElementById('loading').style.display = 'none';
    if (!Array.isArray(birdData.observations)) throw new Error('Invalid bird data');
    allData = birdData.observations;
    const missing = [];
    if (!kommuneGeoJSON) missing.push('Municipality boundaries');
    if (!turbineData) missing.push('Wind park data');
    if (missing.length) {
        const warning = document.createElement('p');
        warning.className = 'confidence-warning';
        warning.textContent = missing.join(' and ') + ' unavailable. Reload to try again.';
        document.querySelector('.panel').prepend(warning);
    }

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
                color: tileErrors ? '#5d8195' : 'rgba(255,255,255,0.12)',
                weight: 0.5,
                fillColor: tileErrors ? '#203844' : 'transparent',
                fillOpacity: tileErrors ? .45 : 0
            },
            onEachFeature: (feature, layer) => {
                const name = feature.properties.kommunenavn || feature.properties.name || '';
                layer.bindTooltip(escapeHtml(name), {
                    className: 'kommune-tooltip',
                    sticky: true
                });
                layer.on('click', () => openKommuneModal(layer, name));
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
            turbineData.metadata.total_turbines + ' turbine records in the NVE sample';

        parks.forEach(park => {
            const { normScore, riskSpecies, nearbyCount } = scorePark(park, allData);
            park._score = normScore;
            park._nearby = nearbyCount;
            park._riskSpecies = riskSpecies;

            const parkColor = nearbyCount < 15 ? '#9daeb8' : scoreToColor(normScore);
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
            const marker = L.marker([park.lat, park.lon], { icon, title: park.name, alt: park.name });

            marker.bindPopup(parkPopup(park, { normScore, riskSpecies, nearbyCount }));
            marker.on('popupopen', () => {
                if (screeningRadius) map.removeLayer(screeningRadius);
                screeningRadius = L.circle([park.lat, park.lon], {
                    radius: SEARCH_RADIUS_KM * 1000, color: '#80dace', weight: 1,
                    dashArray: '5 7', fillOpacity: .04, interactive: false
                }).addTo(map);
                const button = marker.getPopup().getElement()?.querySelector('.park-details-button');
                if (button) button.onclick = () => {
                    selectedPark = park;
                    renderParkDetail();
                    openDialog('park-modal');
                };
            });
            marker.on('popupclose', () => {
                if (screeningRadius) map.removeLayer(screeningRadius);
                screeningRadius = null;
            });
            parkMarkers.push({ park, marker });
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
        confidenceMode: false,
        onFiltersChange: updateParks
    });

    refreshBirdCard = initBirdCards({allRecords: () => allData, visibleRecords: getFilteredData, filterSpecies: name => {
        document.getElementById('species-filter').value = name;
        applyFilters();
    }});
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
        openDialog('info-modal');
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

    // Kommune modal: input listeners attached once to avoid accumulation
    const hubInput = document.getElementById('kommune-hub');
    const rotorInput = document.getElementById('kommune-rotor');
    let currentKommuneLayer = null;
    let debounceTimer = null;

    function recalculate() {
        if (!currentKommuneLayer) return;

        let hub = parseFloat(hubInput.value);
        let diam = parseFloat(rotorInput.value);
        if (!Number.isFinite(hub) || hub < 10 || hub > 500) {
            hub = DEFAULT_HUB_HEIGHT;
            hubInput.value = hub;
        }
        if (!Number.isFinite(diam) || diam < 10 || diam > 500) {
            diam = DEFAULT_ROTOR_DIAMETER;
            rotorInput.value = diam;
        }

        const rotorMin = Math.max(0, hub - diam / 2);
        const rotorMax = hub + diam / 2;

        document.getElementById('kommune-swept').textContent =
            `Swept zone: ${Math.round(rotorMin)}\u2013${Math.round(rotorMax)}m AGL`;

        const filtered = getFilteredData();
        const result = scoreKommune(currentKommuneLayer, filtered, rotorMin, rotorMax);
        const risk = riskLabel(result.normScore);
        document.getElementById('kommune-diagram').innerHTML = flightDiagram({
            hubHeight: hub, rotorDiameter: diam, rotorMin, rotorMax,
            species: Object.entries(result.riskSpecies).sort((a,b) => b[1].count-a[1].count).slice(0,4).map(([sp]) => sp)
        });

        document.getElementById('kommune-stats').textContent =
            `${result.observationCount.toLocaleString()} observations, ${result.speciesCount} species`;

        // Confidence warning
        const confEl = document.getElementById('kommune-confidence');
        if (result.observationCount === 0) {
            confEl.style.display = 'block';
            confEl.className = 'confidence-warning severe';
            confEl.textContent = 'No observation data available for this municipality with current filters.';
        } else if (result.observationCount < 15) {
            confEl.style.display = 'block';
            confEl.className = 'confidence-warning';
            confEl.textContent = `Low data confidence: only ${result.observationCount} observations. Results may not reflect actual bird activity.`;
        } else {
            confEl.style.display = 'none';
        }

        // Risk label
        const riskEl = document.getElementById('kommune-risk');
        if (result.observationCount === 0) {
            riskEl.innerHTML = '<span class="kommune-empty">No data available</span>';
        } else if (result.observationCount < 15) {
            riskEl.textContent = 'Sparse records · conflict uncertain';
            riskEl.style.color = '#aebbc2';
        } else {
            riskEl.innerHTML = `<span style="color:${risk.color}">${risk.text}</span>`;
        }

        // Species at risk list (top 10)
        const listEl = document.getElementById('kommune-species-list');
        const sorted = Object.entries(result.riskSpecies)
            .sort((a, b) => {
                const rlOrder = { CR: 0, EN: 1, VU: 2, NT: 3 };
                const rlA = a[1].rl; const rlB = b[1].rl;
                if (rlA && !rlB) return -1;
                if (!rlA && rlB) return 1;
                if (rlA && rlB) return (rlOrder[rlA] ?? 9) - (rlOrder[rlB] ?? 9);
                return b[1].count - a[1].count;
            })
            .slice(0, 10);

        const headerHtml = '<div style="font-size:11px;color:#888;margin:8px 0 6px 0">' +
            'Species at risk ' +
            '<span style="font-size:10px">(' +
            '<span style="color:#8b0000">CR</span> critically endangered, ' +
            '<span style="color:#d32f2f">EN</span> endangered, ' +
            '<span style="color:#f57c00">VU</span> vulnerable, ' +
            '<span style="color:#fbc02d">NT</span> near threatened)' +
            '</span></div>';

        if (sorted.length === 0 && result.observationCount > 0) {
            listEl.innerHTML = '<div class="kommune-empty">No species with risk factors found</div>';
        } else if (sorted.length === 0) {
            listEl.innerHTML = '';
        } else {
            listEl.innerHTML = headerHtml + sorted.map(([sp, d]) => {
                const rlCat = d.rl ? RED_LIST_CATEGORIES[d.rl] : null;
                const badge = d.rl
                    ? `<span style="color:${rlCat.color};font-weight:700" title="${rlCat.label}">${d.rl}</span> `
                    : '';
                const riskMark = d.risk === 'high'
                    ? ' <span style="color:#ff6b6b" title="High rotor zone overlap">&#9650;</span>'
                    : d.risk === 'medium'
                        ? ' <span style="color:#fbc02d" title="Partial rotor zone overlap">&#9679;</span>'
                        : '';
                const alt = FLIGHT_ALT[sp];
                const altText = alt ? ` <span style="color:#888;font-size:10px">${alt[0]}\u2013${alt[1]}m</span>` : '';
                return birdDetailsButton(sp, birdThumbnail(sp) + `<span class="species-info">${badge}${birdIdentity(sp)}${riskMark}${altText}</span><span class="obs-count">${d.count}</span>`, 'risk-species-item');
            }).join('');
        }

        // Footnote with filter context
        const speciesFilter = document.getElementById('species-filter').value;
        const monthVal = parseInt(document.getElementById('month-slider').value);
        let filterNote = '';
        if (speciesFilter !== 'all' || monthVal > 0) {
            const parts = [];
            if (speciesFilter !== 'all') parts.push(`species: ${speciesFilter}`);
            if (monthVal > 0) parts.push(`month: ${MONTH_NAMES[monthVal]}`);
            filterNote = ` Active filters: ${parts.join(', ')}.`;
        }
        document.getElementById('kommune-footnote').innerHTML =
            `<span style="color:#ff6b6b">&#9650;</span> high rotor zone overlap, ` +
            `<span style="color:#fbc02d">&#9679;</span> partial overlap. ` +
            `Based on unique species. Flight altitudes are approximate estimates, not GPS tracked.${escapeHtml(filterNote)}`;
    }

    function debouncedRecalculate() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(recalculate, 200);
    }

    hubInput.addEventListener('input', debouncedRecalculate);
    rotorInput.addEventListener('input', debouncedRecalculate);

    function openKommuneModal(layer, name) {
        currentKommuneLayer = layer;
        document.getElementById('kommune-name').textContent = name;
        hubInput.value = DEFAULT_HUB_HEIGHT;
        rotorInput.value = DEFAULT_ROTOR_DIAMETER;
        recalculate();
        openDialog('kommune-modal');
    }
}).catch(() => {
    const loading = document.getElementById('loading');
    loading.style.display = 'block';
    loading.textContent = 'Bird data could not load. Check your connection and reload.';
    const retry = document.createElement('button');
    retry.textContent = 'Reload';
    retry.addEventListener('click', () => location.reload());
    loading.appendChild(retry);
});

function parkPopup(park, result) {
    const risk = riskLabel(result.normScore);
    const label = result.nearbyCount === 0 ? 'No nearby records in this view' : result.nearbyCount < 15 ? 'Sparse records · conflict uncertain' : risk.text;
    return '<b>' + escapeHtml(park.name) + '</b><br>' +
        park.turbine_count + ' turbines in sample | ' + park.capacity_mw + ' MW<br>' +
        '<span style="color:' + (result.nearbyCount < 15 ? '#aebbc2' : risk.color) + '">' + label + '</span><br>' +
        result.nearbyCount + ' observations within ' + SEARCH_RADIUS_KM + ' km · current filters<br><small>Dashed circle: screening radius, not habitat</small><br>' +
        '<button type="button" class="park-details-button">Explore flight overlap</button>';
}
function updateParks(filtered) {
    refreshBirdCard();
    parkMarkers.forEach(({park, marker}) => {
        const result = scorePark(park, filtered);
        park._result = result;
        marker.setPopupContent(parkPopup(park, result));
        const color = result.nearbyCount < 15 ? '#9daeb8' : scoreToColor(result.normScore);
        marker.getIcon().options.html = marker.getIcon().options.html.replace(/fill="(?!rgba)[^"]*"/g, 'fill="' + color + '"');
        marker.getElement()?.querySelectorAll('[fill]').forEach(el => {
            if (!el.getAttribute('fill').startsWith('rgba')) el.setAttribute('fill', color);
        });
    });
    if (selectedPark && document.getElementById('park-modal').classList.contains('open')) renderParkDetail();
}
function renderParkDetail() {
    const park = selectedPark;
    const result = park._result || scorePark(park, getFilteredData());
    const nearby = getFilteredData().filter(o => distanceKm(park.lat, park.lon, o.lat, o.lon) < SEARCH_RADIUS_KM);
    const counts = new Map();
    nearby.forEach(o => counts.set(o.species, (counts.get(o.species) || 0) + 1));
    const species = [...counts].sort((a,b) => b[1]-a[1]);
    document.getElementById('park-name').textContent = park.name;
    document.getElementById('park-meta').textContent = park.municipality + ' · ' + park.turbine_count + ' sampled turbines · ' + park.capacity_mw + ' MW';
    document.getElementById('park-diagram').innerHTML = flightDiagram({
        hubHeight: park.hub_height, rotorDiameter: park.rotor_diameter,
        rotorMin: park.rotor_min, rotorMax: park.rotor_max,
        species: [...species].sort((a,b) => {
            const rank = {high: 3, medium: 2, low: 1};
            return (rank[getAltRisk(b[0], park.rotor_min, park.rotor_max)] || 0) -
                (rank[getAltRisk(a[0], park.rotor_min, park.rotor_max)] || 0) || b[1] - a[1];
        }).slice(0,4).map(([sp]) => sp)
    });
    document.getElementById('park-summary').textContent = result.nearbyCount + ' nearby records · ' + species.length + ' species · current filters. ' +
        (result.nearbyCount === 0 ? 'No records, so conflict cannot be assessed.' : result.nearbyCount < 15 ? 'Sparse records, so confidence is limited.' : riskLabel(result.normScore).text);
    // ASVS 1.2.1: encode dataset names at the HTML output boundary.
    document.getElementById('park-species').innerHTML = species.slice(0,12).map(([sp,count]) =>
        birdDetailsButton(sp, birdThumbnail(sp) + '<span>' + birdIdentity(sp) + '<small>' +
        (FLIGHT_ALT[sp] ? FLIGHT_ALT[sp].join('–') + ' m estimated flight band' : 'Flight altitude unknown') +
        '</small></span><span>' + count + '</span>', 'park-bird')).join('');
}

// Global event listeners (need to work before data loads)
document.getElementById('hide-ui-btn').addEventListener('click', toggleUI);

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(closeDialog);
        return;
    }
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'h' || e.key === 'H') toggleUI();
});

document.getElementById('panel-toggle').addEventListener('click', e => {
    const collapsed = document.body.classList.toggle('panel-collapsed');
    e.currentTarget.setAttribute('aria-expanded', String(!collapsed));
});
