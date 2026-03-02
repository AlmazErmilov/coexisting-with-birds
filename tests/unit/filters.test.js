import { describe, it, expect } from 'vitest';
import { FILTER_PREDICATES } from '../../js/ui.js';

describe('FILTER_PREDICATES', () => {
    describe('red-list', () => {
        it('passes for CR species', () => {
            expect(FILTER_PREDICATES['red-list']({ species: 'Crex crex' })).toBe(true);
        });

        it('passes for EN species', () => {
            expect(FILTER_PREDICATES['red-list']({ species: 'Fratercula arctica' })).toBe(true);
        });

        it('passes for VU species', () => {
            expect(FILTER_PREDICATES['red-list']({ species: 'Larus argentatus' })).toBe(true);
        });

        it('passes for NT species', () => {
            expect(FILTER_PREDICATES['red-list']({ species: 'Anas penelope' })).toBe(true);
        });

        it('fails for unlisted species', () => {
            expect(FILTER_PREDICATES['red-list']({ species: 'Parus major' })).toBe(false);
        });
    });

    describe('threatened', () => {
        it('passes for CR species', () => {
            expect(FILTER_PREDICATES['threatened']({ species: 'Crex crex' })).toBe(true);
        });

        it('passes for EN species', () => {
            expect(FILTER_PREDICATES['threatened']({ species: 'Fratercula arctica' })).toBe(true);
        });

        it('passes for VU species', () => {
            expect(FILTER_PREDICATES['threatened']({ species: 'Larus argentatus' })).toBe(true);
        });

        it('fails for NT species (near threatened is not threatened)', () => {
            expect(FILTER_PREDICATES['threatened']({ species: 'Anas penelope' })).toBe(false);
        });

        it('fails for unlisted species', () => {
            expect(FILTER_PREDICATES['threatened']({ species: 'Parus major' })).toBe(false);
        });
    });

    describe('rotor-risk', () => {
        it('passes for species with high rotor overlap', () => {
            // Haliaeetus albicilla: [50, 300], high overlap at default 30-200m
            expect(FILTER_PREDICATES['rotor-risk']({ species: 'Haliaeetus albicilla' })).toBe(true);
        });

        it('passes for species with medium rotor overlap', () => {
            // Carduelis carduelis: [5, 40], medium overlap at default 30-200m
            expect(FILTER_PREDICATES['rotor-risk']({ species: 'Carduelis carduelis' })).toBe(true);
        });

        it('fails for species with low rotor overlap', () => {
            // Cepphus grylle: [3, 30], no overlap with 30-200m zone
            expect(FILTER_PREDICATES['rotor-risk']({ species: 'Cepphus grylle' })).toBe(false);
        });

        it('fails for unknown species (no flight data)', () => {
            expect(FILTER_PREDICATES['rotor-risk']({ species: 'Unknown species' })).toBe(false);
        });
    });
});
