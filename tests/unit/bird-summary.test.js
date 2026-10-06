import {describe, it, expect} from 'vitest';
import {summarizeBird} from '../../js/bird-cards.js';

describe('bird sample summaries', () => {
    it('separates visible records from the historical sample and month coverage', () => {
        const records = [{species:'Parus major',month:1,county:'Oslo'}, {species:'Parus major',month:1,county:'Oslo'}, {species:'Parus major',month:3,county:'Vestland'}, {species:'Corvus corax',month:1,county:'Oslo'}];
        const result = summarizeBird('Parus major', records, records.slice(0,1));
        expect(result.total).toBe(3);
        expect(result.visible).toBe(1);
        expect(result.months).toEqual([2,0,1,0,0,0,0,0,0,0,0,0]);
        expect(result.counties).toEqual([['Oslo',2],['Vestland',1]]);
    });
    it('keeps a species missing from the current filter at zero without losing its sample', () => {
        const result = summarizeBird('Parus major', [{species:'Parus major',month:13}], []);
        expect(result.total).toBe(1);
        expect(result.visible).toBe(0);
        expect(result.months.every(count => count === 0)).toBe(true);
    });
});

describe('bird profiles', () => {
    it('does not resolve object prototype properties or unknown species as profiles', async () => {
        const {getBirdInfo} = await import('../../js/bird-info.js');
        for (const name of ['__proto__', 'constructor', 'Unknown bird', null]) expect(getBirdInfo(name)).toBeNull();
        expect(getBirdInfo(' Rallus aquaticus ').commonName).toBe('Water Rail');
    });
    it('covers the sampled scientific names without presenting Latin labels as common names', async () => {
        const {readFileSync} = await import('node:fs');
        const {getBirdInfo} = await import('../../js/bird-info.js');
        const data = JSON.parse(readFileSync(new URL('../../data/birds_norway.json', import.meta.url)));
        for (const name of new Set(data.observations.map(record => record.species))) {
            const profile = getBirdInfo(name);
            expect(profile, name).not.toBeNull();
            expect(profile.commonName.toLowerCase(), name).not.toBe(name.toLowerCase());
            if (profile.fact) expect(profile.source).toMatch(/^https:\/\/(www\.rspb\.org\.uk|www\.allaboutbirds\.org)\//);
        }
    });
});
