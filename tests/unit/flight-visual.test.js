import {describe, it, expect} from 'vitest';
import {flightDiagram} from '../../js/flight-visual.js';

describe('flight study data boundaries', () => {
    it('hatches actual intersection and keeps a low band separate', () => {
        const html = flightDiagram({hubHeight: 90, rotorDiameter: 160, rotorMin: 10, rotorMax: 170,
            species: ['Haliaeetus albicilla', 'Passer domesticus']});
        expect(html).toContain('50–170 m AGL');
        expect(html).toContain('10–20 m AGL');
        expect(html).toContain('flight-band__overlap');
    });
    it('unknown species cannot invent an altitude or inject HTML', () => {
        const html = flightDiagram({species: ['<img src=x onerror=alert(1)>']});
        expect(html).toContain('Altitude unknown');
        expect(html).toContain('&lt;img');
        expect(html).not.toContain('<img');
        expect(html).not.toContain('NaN');
        expect(html).toContain('default estimate');
    });
    it('boundary contact has no interval hatching', () => {
        const html = flightDiagram({rotorMin: 30, rotorMax: 200, species: ['Parus major']});
        expect(html).toContain('touches the swept boundary');
        expect(html).not.toContain('<rect class="flight-band__overlap"');
    });
    it('invalid geometry falls back without nonfinite SVG coordinates', () => {
        const html = flightDiagram({hubHeight: Infinity, rotorDiameter: -1, rotorMin: 500, rotorMax: 10});
        expect(html).toContain('default estimate');
        expect(html).not.toMatch(/NaN|Infinity/);
    });
});
