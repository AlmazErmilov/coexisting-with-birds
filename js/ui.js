// DOM updates: filters, species list, toggles

import {
    RED_LIST, RED_LIST_CATEGORIES, FLIGHT_ALT, MONTH_NAMES,
    MAX_RENDERED_POINTS, escapeHtml
} from './data.js';
import { getAltRisk, speciesColor, pointInFeature } from './scoring.js';

// Filter predicates (pure functions, independently testable)
export const FILTER_PREDICATES = {
    'red-list': (d) => RED_LIST[d.species] != null,
    'threatened': (d) => ['CR', 'EN', 'VU'].includes(RED_LIST[d.species]),
    'rotor-risk': (d) => {
        const r = getAltRisk(d.species);
        return r === 'high' || r === 'medium';
    }
};

// Shared state references (set by app.js via initUI)
let map, heatLayer, pointsLayer, allData, currentView, kommuneLayer, confidenceMode;

export function initUI(state) {
    map = state.map;
    heatLayer = state.heatLayer;
    pointsLayer = state.pointsLayer;
    allData = state.allData;
    currentView = state.currentView;
    kommuneLayer = state.kommuneLayer;
    confidenceMode = state.confidenceMode;
}

// Called by app.js when shared state changes
export function updateState(key, value) {
    if (key === 'currentView') currentView = value;
    else if (key === 'kommuneLayer') kommuneLayer = value;
    else if (key === 'confidenceMode') confidenceMode = value;
    else if (key === 'allData') allData = value;
    else if (key === 'heatLayer') heatLayer = value;
    else if (key === 'pointsLayer') pointsLayer = value;
}

export function toggleUI() {
    const btn = document.getElementById('hide-ui-btn');
    document.body.classList.toggle('ui-hidden');
    const hidden = document.body.classList.contains('ui-hidden');
    btn.innerHTML = hidden ? 'Show UI <span class="shortcut">[H]</span>' : 'Hide UI <span class="shortcut">[H]</span>';
}

export function applyFilters() {
    const speciesFilter = document.getElementById('species-filter').value;
    const monthVal = parseInt(document.getElementById('month-slider').value);
    document.getElementById('month-label').textContent = MONTH_NAMES[monthVal];

    let filtered = allData;
    const predicate = FILTER_PREDICATES[speciesFilter];
    if (predicate) {
        filtered = filtered.filter(predicate);
    } else if (speciesFilter !== 'all') {
        filtered = filtered.filter(d => d.species === speciesFilter);
    }
    if (monthVal > 0) {
        filtered = filtered.filter(d => d.month === monthVal);
    }

    document.getElementById('stat-obs').textContent = filtered.length.toLocaleString();
    document.getElementById('stat-species').textContent = new Set(filtered.map(d => d.species)).size;

    if (currentView === 'heatmap') {
        // Fourth-root dampening prevents visual washout when filtering to small subsets
        const ratio = allData.length / Math.max(1, filtered.length);
        heatLayer.options.max = Math.min(4.0, 0.6 * Math.pow(ratio, 0.25));
        const heatPoints = filtered.map(d => [d.lat, d.lon, 1.0]);
        heatLayer.setLatLngs(heatPoints);
    }

    pointsLayer.clearLayers();
    if (currentView === 'points') {
        const speciesCounts = new Map();
        filtered.forEach(o => speciesCounts.set(o.species, (speciesCounts.get(o.species) || 0) + 1));

        const step = Math.max(1, Math.floor(filtered.length / MAX_RENDERED_POINTS));
        for (let i = 0; i < filtered.length; i += step) {
            const d = filtered[i];
            const marker = L.circleMarker([d.lat, d.lon], {
                radius: 4, color: '#fff',
                fillColor: speciesColor(d.species), fillOpacity: 0.8,
                weight: 1, opacity: 0.3
            });
            const rl = RED_LIST[d.species];
            const rlCat = rl ? RED_LIST_CATEGORIES[rl] : null;
            const rlHtml = rl ? `<br><span style="color:${rlCat.color};font-weight:700">${rl}</span> ${escapeHtml(rlCat.label)}` : '';
            const alt = FLIGHT_ALT[d.species];
            const risk = getAltRisk(d.species);
            const altHtml = alt ? `<br>Flight altitude: ${alt[0]}-${alt[1]}m` : '';
            const riskHtml = risk === 'high' ? '<br><span style="color:#ff6b6b;font-weight:700">&#9650; High rotor zone overlap</span>'
                : risk === 'medium' ? '<br><span style="color:#fbc02d">&#9679; Partial rotor zone overlap</span>' : '';

            const sCount = speciesCounts.get(d.species) || 0;
            const pct = (sCount / filtered.length * 100).toFixed(1);
            const kommune = d._kl?.feature?.properties?.kommunenavn || d._kl?.feature?.properties?.name || '';
            const statsHtml = `<br><span style="color:#888;font-size:11px;border-top:1px solid rgba(255,255,255,0.15);display:block;margin-top:4px;padding-top:4px">${kommune ? escapeHtml(kommune) + ' · ' : ''}${sCount} obs of this species in view (${pct}%)</span>`;

            marker.bindPopup(`<b style="font-style:italic">${escapeHtml(d.species)}</b>${rlHtml}${altHtml}${riskHtml}<br>Month: ${MONTH_NAMES[d.month] || '?'}<br>County: ${escapeHtml(d.county || '?')}${statsHtml}`);
            pointsLayer.addLayer(marker);
        }
    }

    if (confidenceMode) {
        updateKommuneDisplay(filtered);
    }

    updateSpeciesList(filtered);
}

export function updateSpeciesList(data) {
    const counts = {};
    data.forEach(d => { counts[d.species] = (counts[d.species] || 0) + 1; });
    const rlOrder = { 'CR': 0, 'EN': 1, 'VU': 2, 'NT': 3 };
    const sorted = Object.entries(counts).sort((a, b) => {
        const rlA = RED_LIST[a[0]]; const rlB = RED_LIST[b[0]];
        if (rlA && !rlB) return -1;
        if (!rlA && rlB) return 1;
        if (rlA && rlB) return (rlOrder[rlA] ?? 9) - (rlOrder[rlB] ?? 9);
        return b[1] - a[1];
    }).slice(0, 20);

    const container = document.getElementById('species-list');
    container.innerHTML = sorted.map(([name, count]) => {
        const rl = RED_LIST[name];
        const rlCat = rl ? RED_LIST_CATEGORIES[rl] : null;
        const badge = rl
            ? `<span class="rl-badge" style="background:${rlCat.color};" title="${escapeHtml(rlCat.label)}">${rl}</span>`
            : '';
        const alt = FLIGHT_ALT[name];
        const risk = getAltRisk(name);
        const riskIcon = risk === 'high' ? '&#9650;' : risk === 'medium' ? '&#9679;' : '';
        const riskColor = risk === 'high' ? '#ff6b6b' : risk === 'medium' ? '#fbc02d' : '';
        const altText = alt ? `${alt[0]}-${alt[1]}m` : '';
        const riskHtml = riskIcon
            ? `<span style="color:${riskColor};font-size:10px;margin-left:2px" title="Rotor zone overlap: ${risk}">${riskIcon}</span>`
            : '';
        const altHtml = altText
            ? `<span class="alt-tag">${altText}${riskHtml}</span>`
            : '';
        return `
                <div class="species-item" data-species="${escapeHtml(name)}">
                    <span class="species-name">${badge}${escapeHtml(name)}${altHtml}</span>
                    <span class="species-count">${count}</span>
                </div>`;
    }).join('');
}

export function setView(view) {
    currentView = view;
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    if (view === 'heatmap') {
        map.removeLayer(pointsLayer);
        map.addLayer(heatLayer);
    } else {
        map.removeLayer(heatLayer);
        map.addLayer(pointsLayer);
    }
    applyFilters();
}

export function toggleTurbines(turbineLayer) {
    const show = document.getElementById('turbine-toggle').checked;
    if (turbineLayer) {
        if (show) { map.addLayer(turbineLayer); }
        else { map.removeLayer(turbineLayer); }
    }
}

export function updateKommuneDisplay(filtered) {
    if (!kommuneLayer) return;
    const counts = new Map();
    filtered.forEach(o => {
        if (o._kl) counts.set(o._kl, (counts.get(o._kl) || 0) + 1);
    });
    kommuneLayer.eachLayer(layer => {
        const count = counts.get(layer) || 0;
        const name = layer.feature.properties.kommunenavn || layer.feature.properties.name || '';
        let fillColor, fillOpacity;
        if (count === 0) {
            fillColor = '#555'; fillOpacity = 0.5;
        } else if (count < 5) {
            fillColor = '#d32f2f'; fillOpacity = 0.4;
        } else if (count < 15) {
            fillColor = '#f57c00'; fillOpacity = 0.3;
        } else if (count < 30) {
            fillColor = '#fbc02d'; fillOpacity = 0.2;
        } else {
            fillColor = 'transparent'; fillOpacity = 0;
        }
        layer.setStyle({ fillColor, fillOpacity });
        layer.unbindTooltip();
        layer.bindTooltip(`${escapeHtml(name)} \u2014 ${count} observations`, {
            className: 'kommune-tooltip', sticky: true
        });
    });
}

export function resetKommuneDisplay() {
    if (!kommuneLayer) return;
    kommuneLayer.eachLayer(layer => {
        const name = layer.feature.properties.kommunenavn || layer.feature.properties.name || '';
        layer.setStyle({ fillColor: 'transparent', fillOpacity: 0 });
        layer.unbindTooltip();
        layer.bindTooltip(escapeHtml(name), {
            className: 'kommune-tooltip', sticky: true
        });
    });
}

export function toggleConfidence(newVal) {
    confidenceMode = newVal;
    if (confidenceMode) {
        applyFilters();
    } else {
        resetKommuneDisplay();
    }
}
