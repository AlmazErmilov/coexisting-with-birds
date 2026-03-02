// Pure functions: risk calculation, geo, park scoring, color mapping
// Zero DOM access, fully testable

import {
    FLIGHT_ALT, ROTOR_ZONE, RED_LIST, RED_LIST_CATEGORIES,
    SEARCH_RADIUS_KM, SCORE_NORMALIZATION
} from './data.js';

export function getAltRisk(species, rotorMin, rotorMax) {
    const alt = FLIGHT_ALT[species];
    if (!alt) return null;
    const rMin = rotorMin != null ? rotorMin : ROTOR_ZONE.min;
    const rMax = rotorMax != null ? rotorMax : ROTOR_ZONE.max;
    const overlap = Math.max(0,
        Math.min(alt[1], rMax) - Math.max(alt[0], rMin));
    const range = alt[1] - alt[0];
    if (overlap === 0) return 'low';
    if (overlap / range > 0.5) return 'high';
    return 'medium';
}

// Ray-casting point-in-polygon for GeoJSON rings (coordinates are [lon, lat])
export function pointInRing(lat, lon, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const yi = ring[i][1], xi = ring[i][0];
        const yj = ring[j][1], xj = ring[j][0];
        if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

export function pointInFeature(lat, lon, geometry) {
    if (geometry.type === 'Polygon') {
        if (!pointInRing(lat, lon, geometry.coordinates[0])) return false;
        for (let i = 1; i < geometry.coordinates.length; i++) {
            if (pointInRing(lat, lon, geometry.coordinates[i])) return false;
        }
        return true;
    } else if (geometry.type === 'MultiPolygon') {
        for (const poly of geometry.coordinates) {
            if (pointInRing(lat, lon, poly[0])) {
                let inHole = false;
                for (let i = 1; i < poly.length; i++) {
                    if (pointInRing(lat, lon, poly[i])) { inHole = true; break; }
                }
                if (!inHole) return true;
            }
        }
        return false;
    }
    return false;
}

// Flat-earth approximation, accurate to ~10% at Norway's latitudes (58-71 N)
export function distanceKm(lat1, lon1, lat2, lon2) {
    const dlat = (lat2 - lat1) * 111;
    const dlon = (lon2 - lon1) * 111 * Math.cos(lat1 * Math.PI / 180);
    return Math.sqrt(dlat * dlat + dlon * dlon);
}

// Core scoring algorithm: compute bird conflict score for a wind park
export function scorePark(park, observations) {
    const nearby = observations.filter(o =>
        distanceKm(park.lat, park.lon, o.lat, o.lon) < SEARCH_RADIUS_KM
    );

    let score = 0;
    const riskSpecies = {};
    nearby.forEach(o => {
        let w = 1;
        const rl = RED_LIST[o.species];
        if (rl) w *= (RED_LIST_CATEGORIES[rl]?.weight || 1);
        const risk = getAltRisk(o.species, park.rotor_min, park.rotor_max);
        if (risk === 'high') w *= 3;
        else if (risk === 'medium') w *= 1.5;
        score += w;
        if (rl || risk === 'high' || risk === 'medium') {
            if (!riskSpecies[o.species]) riskSpecies[o.species] = { count: 0, rl, risk };
            riskSpecies[o.species].count++;
        }
    });

    const normScore = Math.min(1, score / SCORE_NORMALIZATION);
    return { normScore, riskSpecies, nearbyCount: nearby.length };
}

// Green (low) -> yellow -> red (high)
export function scoreToColor(normScore) {
    const r = Math.round(normScore > 0.5 ? 255 : normScore * 2 * 255);
    const g = Math.round(normScore < 0.5 ? 180 : (1 - normScore) * 2 * 180);
    return `rgb(${r},${g},40)`;
}

export function riskLabel(normScore) {
    if (normScore < 0.2) return { text: 'Low bird conflict', color: '#4ecdc4' };
    if (normScore < 0.5) return { text: 'Moderate bird conflict', color: '#fbc02d' };
    if (normScore < 0.75) return { text: 'High bird conflict', color: '#ff6b6b' };
    return { text: 'Very high bird conflict', color: '#ff6b6b' };
}

// Deterministic hash-based color for species
export function speciesColor(species) {
    let hash = 0;
    for (let i = 0; i < species.length; i++) {
        hash = species.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 70%, 60%)`;
}
