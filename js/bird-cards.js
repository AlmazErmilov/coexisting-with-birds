import { RED_LIST, RED_LIST_CATEGORIES, FLIGHT_ALT, MONTH_NAMES, escapeHtml } from './data.js';
import { birdThumbnail } from './bird-images.js';
import { openDialog, closeDialog } from './dialogs.js';
import { getBirdInfo } from './bird-info.js';

export function birdProfile(name) {
    return getBirdInfo(name) || {};
}
export function birdName(name) { return birdProfile(name).commonName || name; }
export function birdIdentity(name) {
    const common = birdName(name);
    return '<span class="bird-profile-line"><strong>' + escapeHtml(common) + '</strong>' +
        (common !== name ? '<i>' + escapeHtml(name) + '</i>' : '') + '</span>';
}
export function birdDetailsButton(name, content, className = 'bird-detail-button') {
    return '<button type="button" class="' + className + '" data-bird-details="' + escapeHtml(name) +
        '" aria-label="About ' + escapeHtml(birdName(name)) + '">' + (content || 'ⓘ') + '</button>';
}

// Records in a sampled dataset are not estimates of local abundance.
export function summarizeBird(name, allRecords, visibleRecords) {
    const records = allRecords.filter(record => record.species === name);
    const months = Array.from({length: 12}, (_, index) => records.filter(record => record.month === index + 1).length);
    const counties = new Map();
    for (const record of records) if (record.county) counties.set(record.county, (counties.get(record.county) || 0) + 1);
    return { total: records.length, visible: visibleRecords.filter(record => record.species === name).length,
        months, counties: [...counties].sort((a,b) => b[1] - a[1]).slice(0,3) };
}

export function initBirdCards({allRecords, visibleRecords, filterSpecies}) {
    let selected;
    const overlay = document.getElementById('bird-modal');
    const render = () => {
        if (!selected) return;
        const name = selected, profile = birdProfile(name), summary = summarizeBird(name, allRecords(), visibleRecords());
        const alt = FLIGHT_ALT[name], rl = RED_LIST[name], category = RED_LIST_CATEGORIES[rl];
        const source = profile.source || profile.sourceUrl;
        const statusColor = {CR:'#ff9ca8', EN:'#ffb09b', VU:'#ffd092', NT:'#e5dc8a', LC:'#9bd3bb'}[rl] || '#c7d4dc';
        const fact = profile.fact || '';
        const maximum = Math.max(1, ...summary.months);
        const coverage = summary.months.map((count,index) => MONTH_NAMES[index + 1] + ': ' + count).join(', ');
        document.getElementById('bird-card').innerHTML =
            '<header class="bird-card-head">' + birdThumbnail(name) + '<div><h2 id="bird-name">' + escapeHtml(birdName(name)) + '</h2>' +
            (birdName(name) !== name ? '<i>' + escapeHtml(name) + '</i>' : '') +
            (category ? '<p class="sample-caption"><span style="color:' + statusColor + '">' + rl + ' · ' + escapeHtml(category.label) + '</span> · Norway 2021</p>' : '') + '</div></header>' +
            '<div class="bird-metrics"><div><strong>' + summary.visible + '</strong><small>records in view</small></div><div><strong>' + summary.total + '</strong><small>records in sample</small></div><div><strong>' + (alt ? alt.join('–') + ' m' : '?') + '</strong><small>' + (alt ? 'estimated height' : 'height unknown') + '</small></div></div>' +
            (fact ? '<p class="bird-fact">' + escapeHtml(fact) + '</p>' : '') +
            '<p class="sample-caption">Month coverage in sample</p><div class="bird-months" role="img" aria-label="' + escapeHtml(coverage) + '">' + summary.months.map((count,index) => '<span style="height:' + Math.max(2, count / maximum * 54) + 'px" title="' + escapeHtml(MONTH_NAMES[index + 1]) + ': ' + count + ' records"></span>').join('') + '</div><div class="bird-month-labels"><span>Jan</span><span>Jun</span><span>Dec</span></div>' +
            '<details class="compact-help"><summary>Sources &amp; sample</summary><p>Historical GBIF sample, retrieved February 2026. Monthly quotas and reporting effort affect counts. These bars show record coverage, not seasonal abundance.</p>' +
            (summary.counties.length ? '<p>Top reported counties: ' + summary.counties.map(([county,count]) => escapeHtml(county) + ' (' + count + ')').join(', ') + '.</p>' : '') +
            (source && /^https:\/\//.test(source) ? '<p><a href="' + escapeHtml(source) + '" target="_blank" rel="noopener">Bird fact source</a></p>' : '') +
            '<p><a href="about.html">Data methods</a> · <a href="docs/bird-images.html">Photo credits</a></p></details><button type="button" class="bird-card-action" id="bird-filter-action">Show this bird on the map</button>';
        document.getElementById('bird-filter-action').onclick = () => { closeDialog(overlay); document.querySelectorAll('.modal-overlay.open').forEach(closeDialog); filterSpecies(name); };
    };
    document.addEventListener('click', event => {
        const button = event.target.closest('[data-bird-details]');
        if (!button) return;
        event.preventDefault();
        selected = button.dataset.birdDetails;
        render();
        openDialog('bird-modal');
    });
    return () => { if (overlay.classList.contains('open')) render(); };
}
