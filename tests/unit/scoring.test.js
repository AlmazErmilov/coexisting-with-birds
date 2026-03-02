import { describe, it, expect } from 'vitest';
import {
    getAltRisk, pointInRing, pointInFeature, distanceKm,
    scorePark, scoreToColor, riskLabel, speciesColor
} from '../../js/scoring.js';

describe('getAltRisk', () => {
    it('returns high for white-tailed eagle at default rotor zone', () => {
        // Haliaeetus albicilla: [50, 300], rotor 30-200
        // overlap = min(300,200) - max(50,30) = 150, range = 250, ratio = 0.6 > 0.5
        expect(getAltRisk('Haliaeetus albicilla')).toBe('high');
    });

    it('returns medium for goldfinch at default rotor zone', () => {
        // Hirundo rustica: [5, 100], rotor 30-200
        // overlap = min(100,200) - max(5,30) = 70, range = 95, ratio = 0.74 > 0.5
        // Actually this is high. Let's use a species with partial overlap.
        // Phalacrocorax carbo: [5, 80], rotor 30-200
        // overlap = min(80,200) - max(5,30) = 50, range = 75, ratio = 0.67 > 0.5 -> high
        // Sterna hirundo: [5, 80] same
        // Let's check Anas platyrhynchos: [10, 100]
        // overlap = min(100,200) - max(10,30) = 70, range = 90, ratio = 0.78 -> high
        // Corvus cornix: [5, 80], overlap = 50, range = 75, ratio = 0.67 -> high
        // Bombycilla garrulus: [10, 60], overlap = min(60,200) - max(10,30) = 30, range = 50, ratio = 0.6 -> high
        // Carduelis carduelis: [5, 40], overlap = min(40,200) - max(5,30) = 10, range = 35, ratio = 0.29 -> medium
        expect(getAltRisk('Carduelis carduelis')).toBe('medium');
    });

    it('returns low for puffin at default rotor zone', () => {
        // Fratercula arctica: [5, 50], rotor 30-200
        // overlap = min(50,200) - max(5,30) = 20, range = 45, ratio = 0.44 -> medium
        // Cepphus grylle: [3, 30], overlap = min(30,200) - max(3,30) = 0 -> low
        expect(getAltRisk('Cepphus grylle')).toBe('low');
    });

    it('returns null for unknown species', () => {
        expect(getAltRisk('Unknown species')).toBe(null);
    });

    it('uses custom rotor range when provided', () => {
        // Parus major: [2, 30] with rotor zone 5-25
        // overlap = min(30,25) - max(2,5) = 20, range = 28, ratio = 0.71 -> high
        expect(getAltRisk('Parus major', 5, 25)).toBe('high');
    });

    it('returns low when flight band is entirely above rotor zone', () => {
        // Aquila chrysaetos: [100, 400] with rotor zone 5-50
        // overlap = min(400,50) - max(100,5) = -50 -> 0 -> low
        expect(getAltRisk('Aquila chrysaetos', 5, 50)).toBe('low');
    });
});

describe('pointInRing', () => {
    // Simple rectangle: (0,0) to (10,10) in GeoJSON [lon, lat] format
    const rect = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];

    it('returns true for point inside', () => {
        expect(pointInRing(5, 5, rect)).toBe(true);
    });

    it('returns false for point outside', () => {
        expect(pointInRing(15, 5, rect)).toBe(false);
    });

    it('returns false for point far outside', () => {
        expect(pointInRing(-5, -5, rect)).toBe(false);
    });
});

describe('pointInFeature', () => {
    it('handles Polygon geometry', () => {
        const polygon = {
            type: 'Polygon',
            coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]
        };
        expect(pointInFeature(5, 5, polygon)).toBe(true);
        expect(pointInFeature(15, 5, polygon)).toBe(false);
    });

    it('handles Polygon with hole (point in hole returns false)', () => {
        const polygon = {
            type: 'Polygon',
            coordinates: [
                [[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]],  // outer
                [[5, 5], [15, 5], [15, 15], [5, 15], [5, 5]]    // hole
            ]
        };
        expect(pointInFeature(10, 10, polygon)).toBe(false); // in hole
        expect(pointInFeature(2, 2, polygon)).toBe(true);    // in outer, not in hole
    });

    it('handles MultiPolygon', () => {
        const multi = {
            type: 'MultiPolygon',
            coordinates: [
                [[[0, 0], [5, 0], [5, 5], [0, 5], [0, 0]]],
                [[[10, 10], [15, 10], [15, 15], [10, 15], [10, 10]]]
            ]
        };
        expect(pointInFeature(2, 2, multi)).toBe(true);
        expect(pointInFeature(12, 12, multi)).toBe(true);
        expect(pointInFeature(7, 7, multi)).toBe(false);
    });

    it('returns false for unsupported geometry type', () => {
        expect(pointInFeature(0, 0, { type: 'Point', coordinates: [0, 0] })).toBe(false);
    });
});

describe('distanceKm', () => {
    it('returns 0 for same point', () => {
        expect(distanceKm(60, 10, 60, 10)).toBe(0);
    });

    it('computes Oslo to Bergen (~300 km)', () => {
        // Oslo: 59.91, 10.75 -> Bergen: 60.39, 5.32
        const d = distanceKm(59.91, 10.75, 60.39, 5.32);
        expect(d).toBeGreaterThan(250);
        expect(d).toBeLessThan(350);
    });
});

describe('scorePark', () => {
    const mockPark = {
        lat: 60, lon: 10,
        rotor_min: 30, rotor_max: 200
    };

    it('returns zero score when no observations nearby', () => {
        const far = [{ lat: 80, lon: 30, species: 'Parus major' }];
        const result = scorePark(mockPark, far);
        expect(result.nearbyCount).toBe(0);
        expect(result.normScore).toBe(0);
    });

    it('counts nearby observations', () => {
        const nearby = [
            { lat: 60.01, lon: 10.01, species: 'Parus major' },
            { lat: 60.02, lon: 10.02, species: 'Turdus merula' },
        ];
        const result = scorePark(mockPark, nearby);
        expect(result.nearbyCount).toBe(2);
    });

    it('scores red listed species higher', () => {
        const obs = [{ lat: 60.01, lon: 10.01, species: 'Crex crex' }]; // CR, weight 8
        const result = scorePark(mockPark, obs);
        const obsNormal = [{ lat: 60.01, lon: 10.01, species: 'Parus major' }]; // not listed
        const resultNormal = scorePark(mockPark, obsNormal);
        expect(result.normScore).toBeGreaterThan(resultNormal.normScore);
    });

    it('includes risk species in result', () => {
        const obs = [
            { lat: 60.01, lon: 10.01, species: 'Haliaeetus albicilla' }, // high rotor risk
        ];
        const result = scorePark(mockPark, obs);
        expect(result.riskSpecies['Haliaeetus albicilla']).toBeDefined();
        expect(result.riskSpecies['Haliaeetus albicilla'].count).toBe(1);
    });

    it('clamps normScore at 1.0', () => {
        // Many high-weight observations to exceed normalization threshold
        const obs = Array.from({ length: 200 }, (_, i) => ({
            lat: 60 + (i * 0.001), lon: 10, species: 'Crex crex' // CR=8 weight
        }));
        const result = scorePark(mockPark, obs);
        expect(result.normScore).toBe(1);
    });
});

describe('scoreToColor', () => {
    it('returns valid rgb string for low score', () => {
        const color = scoreToColor(0);
        expect(color).toMatch(/^rgb\(\d+,\d+,40\)$/);
    });

    it('returns valid rgb string for mid score', () => {
        const color = scoreToColor(0.5);
        expect(color).toMatch(/^rgb\(\d+,\d+,40\)$/);
    });

    it('returns valid rgb string for high score', () => {
        const color = scoreToColor(1.0);
        expect(color).toMatch(/^rgb\(\d+,\d+,40\)$/);
    });

    it('gives greener color for low score and redder for high', () => {
        const low = scoreToColor(0.1);
        const high = scoreToColor(0.9);
        // Parse rgb values
        const [, lr, lg] = low.match(/rgb\((\d+),(\d+),/);
        const [, hr, hg] = high.match(/rgb\((\d+),(\d+),/);
        expect(Number(hr)).toBeGreaterThan(Number(lr)); // higher red
        expect(Number(lg)).toBeGreaterThan(Number(hg)); // higher green for low
    });
});

describe('riskLabel', () => {
    it('returns low for score < 0.2', () => {
        const r = riskLabel(0.1);
        expect(r.text).toBe('Low bird conflict');
        expect(r.color).toBe('#4ecdc4');
    });

    it('returns moderate for score 0.2-0.5', () => {
        const r = riskLabel(0.3);
        expect(r.text).toBe('Moderate bird conflict');
    });

    it('returns high for score 0.5-0.75', () => {
        const r = riskLabel(0.6);
        expect(r.text).toBe('High bird conflict');
    });

    it('returns very high for score >= 0.75', () => {
        const r = riskLabel(0.9);
        expect(r.text).toBe('Very high bird conflict');
    });
});

describe('speciesColor', () => {
    it('returns valid hsl string', () => {
        expect(speciesColor('Parus major')).toMatch(/^hsl\(\d+, 70%, 60%\)$/);
    });

    it('is deterministic (same input = same output)', () => {
        expect(speciesColor('Corvus corax')).toBe(speciesColor('Corvus corax'));
    });

    it('produces different colors for different species', () => {
        expect(speciesColor('Parus major')).not.toBe(speciesColor('Corvus corax'));
    });
});
