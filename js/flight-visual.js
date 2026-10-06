import {
    FLIGHT_ALT, escapeHtml, DEFAULT_HUB_HEIGHT, DEFAULT_ROTOR_DIAMETER
} from './data.js';

let diagramSequence = 0;
let introController = null;
let introPending = false;

// ASVS 2.2.1: accept finite metre values, including decimal strings from NVE.
function metres(value, allowZero = false) {
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    if (typeof value === 'string' && !/^\d+(?:\.\d+)?$/.test(value.trim())) return null;
    const number = Number(value);
    return Number.isFinite(number) && number <= 1e6 && (allowZero ? number >= 0 : number > 0)
        ? number : null;
}

const formatMetres = value => Number(value.toFixed(1)).toLocaleString('en-GB');
const rangeText = (min, max) => `${formatMetres(min)}–${formatMetres(max)} m`;

function geometry(options) {
    let hub = metres(options.hubHeight);
    let diameter = metres(options.rotorDiameter);
    const lower = metres(options.rotorMin, true);
    const upper = metres(options.rotorMax);
    const suppliedZone = lower !== null && upper !== null && upper > lower;
    let hubSource = 'supplied';
    let diameterSource = 'supplied';
    const notes = [];

    if (hub === null) {
        hub = suppliedZone ? (lower + upper) / 2 : DEFAULT_HUB_HEIGHT;
        hubSource = suppliedZone ? 'derived from bounds' : 'default estimate';
    }
    if (diameter === null) {
        diameter = suppliedZone ? upper - lower : DEFAULT_ROTOR_DIAMETER;
        diameterSource = suppliedZone ? 'derived from bounds' : 'default estimate';
    }
    const min = suppliedZone ? lower : Math.max(0, hub - diameter / 2);
    const max = suppliedZone ? upper : hub + diameter / 2;
    const zoneSource = suppliedZone ? 'supplied bounds'
        : hubSource === 'default estimate' || diameterSource === 'default estimate'
            ? 'derived using default estimates' : 'derived from dimensions';

    if (!suppliedZone && (options.rotorMin != null || options.rotorMax != null)) {
        notes.push('Incomplete or invalid swept bounds were replaced with bounds derived from the displayed dimensions.');
    }
    if (suppliedZone && (Math.abs(min - Math.max(0, hub - diameter / 2)) > 1
        || Math.abs(max - (hub + diameter / 2)) > 1)) {
        notes.push('Supplied swept bounds differ from the displayed rotor geometry. Hatching uses the supplied bounds.');
    }
    if (hub < diameter / 2) {
        notes.push('The displayed rotor extends below ground. Check the turbine dimensions; altitude overlap starts at ground level.');
    }
    return { hub, diameter, min, max, hubSource, diameterSource, zoneSource, notes };
}

function tickStep(span) {
    const rough = span / 5;
    const power = 10 ** Math.floor(Math.log10(rough));
    return [1, 2, 5, 10].find(step => step * power >= rough) * power;
}

function birdPath(x, y, size = 9) {
    return `M ${x - size} ${y - size / 3} Q ${x - size / 2} ${y - size / 2} ${x} ${y + size / 3} Q ${x + size / 2} ${y - size / 2} ${x + size} ${y - size / 3}`;
}

/**
 * Return a self-contained figure. Bands are native links to expandable species
 * details, so dynamically inserted diagrams need no event binding or initializer.
 * Dimensions and bird bands share one linear vertical scale in metres AGL.
 */
export function flightDiagram(options = {}) {
    options = options && typeof options === 'object' ? options : {};
    const turbine = geometry(options);
    const names = Array.isArray(options.species)
        ? [...new Set(options.species.filter(name => typeof name === 'string' && name.trim()))] : [];
    const birds = names.map(name => {
        const altitude = Object.hasOwn(FLIGHT_ALT, name) ? FLIGHT_ALT[name] : null;
        const min = Array.isArray(altitude) ? metres(altitude[0], true) : null;
        const max = Array.isArray(altitude) ? metres(altitude[1], true) : null;
        const known = min !== null && max !== null && max >= min;
        const overlapMin = known ? Math.max(min, turbine.min) : null;
        const overlapMax = known ? Math.min(max, turbine.max) : null;
        const overlap = known && overlapMax > overlapMin;
        const touches = known && overlapMax === overlapMin;
        return { name, min, max, known, overlapMin, overlapMax, overlap, touches };
    });
    const id = `flight-visual-${++diagramSequence}`;
    const plotTop = 52;
    const plotBottom = 340;
    const extentMin = Math.min(0, turbine.hub - turbine.diameter / 2);
    const extentMax = Math.max(100, turbine.max, turbine.hub + turbine.diameter / 2,
        ...birds.filter(bird => bird.known).map(bird => bird.max));
    const step = tickStep(extentMax - extentMin);
    const scaleMin = Math.floor(extentMin / step) * step;
    const scaleMax = Math.ceil(extentMax / step) * step;
    const scale = (plotBottom - plotTop) / (scaleMax - scaleMin);
    const y = value => plotBottom - (value - scaleMin) * scale;
    const width = Math.max(560, 382 + Math.max(1, birds.length) * 62 + 24);
    const hubX = 200;
    const hubY = y(turbine.hub);
    const radius = turbine.diameter * scale / 2;
    const ground = y(0);
    const zoneTop = y(turbine.max);
    const zoneBottom = y(turbine.min);
    const dimensionX = Math.max(315, hubX + radius + 16);
    const ticks = [];
    for (let value = scaleMin; value <= scaleMax + step / 100; value += step) {
        ticks.push(`<g class="flight-grid"><path d="M 52 ${y(value)} H ${width - 18}"/><text x="43" y="${y(value) + 4}" text-anchor="end">${formatMetres(value)}</text></g>`);
    }

    const bands = birds.map((bird, index) => {
        const x = 382 + index * 62;
        const centre = x + 14;
        const detail = !bird.known ? 'Flight altitude unavailable. No band or overlap inferred.'
            : bird.overlap ? `Estimated band ${rangeText(bird.min, bird.max)}. Intersection ${rangeText(bird.overlapMin, bird.overlapMax)}.`
                : bird.touches ? `Estimated band ${rangeText(bird.min, bird.max)}. Touches the swept boundary only.`
                    : `Estimated band ${rangeText(bird.min, bird.max)}. No intersection in these estimated ranges.`;
        // ASVS 1.2.1: encode names where they enter HTML or SVG attributes/text.
        const label = escapeHtml(`${bird.name}. ${detail} Open species details.`);
        return `<a class="flight-band" href="#${id}-species-${index}" aria-label="${label}">
            <title>${label}</title>
            <rect class="flight-band__hit" x="${x - 9}" y="${plotTop}" width="46" height="${plotBottom - plotTop + 35}"/>
            <path class="flight-band__guide" d="M ${centre} ${plotTop} V ${plotBottom}"/>
            ${bird.known ? `<rect class="flight-band__range" x="${x}" y="${y(bird.max)}" width="28" height="${(bird.max - bird.min) * scale}"/>
                <path class="flight-band__caps" d="M ${x - 3} ${y(bird.max)} H ${x + 31} M ${x - 3} ${y(bird.min)} H ${x + 31}"/>
                ${bird.overlap ? `<rect class="flight-band__overlap" x="${x}" y="${y(bird.overlapMax)}" width="28" height="${(bird.overlapMax - bird.overlapMin) * scale}" fill="url(#${id}-hatch)"/>` : ''}
                ${bird.touches ? `<path class="flight-band__touch" d="M ${x} ${y(bird.overlapMin)} H ${x + 28}"/>` : ''}
                <path class="flight-bird" d="${birdPath(centre, y((bird.min + bird.max) / 2))}"/>`
            : `<text class="flight-band__unknown" x="${centre}" y="${plotTop + 120}" text-anchor="middle">?</text>`}
            <text class="flight-band__number" x="${centre}" y="${plotBottom + 25}" text-anchor="middle">${index + 1}</text>
        </a>
            <g class="flight-band__readout" aria-hidden="true">
                <rect x="52" y="386" width="${width - 70}" height="30" rx="4"/>
                <text x="64" y="405">${!bird.known ? `Band ${index + 1}: altitude unknown` : `Band ${index + 1}: ${rangeText(bird.min, bird.max)} · ${bird.overlap ? `intersection ${rangeText(bird.overlapMin, bird.overlapMax)}` : bird.touches ? 'boundary contact only' : 'no intersection'}`}</text>
            </g>`;
    }).join('');

    const speciesDetails = birds.map((bird, index) => `<details class="flight-species">
        <summary id="${id}-species-${index}"><span class="flight-species__number">${index + 1}</span><i>${escapeHtml(bird.name)}</i><span class="flight-species__range">${bird.known ? `${rangeText(bird.min, bird.max)} estimated` : 'Altitude unknown'}</span></summary>
        <p>${!bird.known ? 'No flight altitude estimate is available for this species. Overlap cannot be assessed.'
            : `${bird.overlap ? `Geometric intersection with the swept zone is ${rangeText(bird.overlapMin, bird.overlapMax)} AGL.` : bird.touches ? 'The estimated flight band touches the swept boundary. No interval is hatched.' : 'The estimated flight band does not intersect the displayed swept zone.'} This approximate reference band is not a local flight measurement or a collision probability.`}</p>
    </details>`).join('');

    return `<figure class="flight-diagram" aria-labelledby="${id}-heading">
        <figcaption class="flight-diagram__heading" id="${id}-heading">Flight altitude &amp; rotor swept zone<span>Vertical section · metres above ground level</span></figcaption>
        <dl class="flight-dimensions">
            <div><dt>Hub height</dt><dd>${formatMetres(turbine.hub)} m<small>${turbine.hubSource}</small></dd></div>
            <div><dt>Rotor diameter</dt><dd>${formatMetres(turbine.diameter)} m<small>${turbine.diameterSource}</small></dd></div>
            <div><dt>Swept zone</dt><dd>${rangeText(turbine.min, turbine.max)}<small>${turbine.zoneSource}</small></dd></div>
        </dl>
        ${turbine.notes.map(note => `<p class="flight-diagram__notice">${note}</p>`).join('')}
        <div class="flight-diagram__scroll" tabindex="0" role="region" aria-label="Altitude drawing. Scroll horizontally on narrow screens.">
            <svg class="flight-diagram__svg" xmlns="http://www.w3.org/2000/svg" width="${width}" height="424" viewBox="0 0 ${width} 424" style="min-width:${width}px" role="group" aria-labelledby="${id}-title ${id}-desc">
                <title id="${id}-title">Bird altitude bands and turbine geometry</title>
                <desc id="${id}-desc">One linear vertical metre scale for the rotor and all bird bands. Amber hatching marks only altitude intersection. Numbered bands link to species details. Horizontal spacing represents separate lanes, not distance from a turbine.</desc>
                <defs><pattern id="${id}-hatch" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M -2 2 L 2 -2 M 0 7 L 7 0 M 5 9 L 9 5" class="flight-hatch"/></pattern></defs>
                <text class="flight-plot-label" x="14" y="26">m AGL</text>
                <text class="flight-plot-label" x="200" y="26" text-anchor="middle">Turbine section</text>
                <text class="flight-plot-label" x="382" y="26">Bird bands</text>
                <rect class="flight-swept" x="52" y="${zoneTop}" width="${width - 70}" height="${zoneBottom - zoneTop}"/>
                ${ticks.join('')}
                <path class="flight-ground" d="M 52 ${ground} H ${width - 18}"/>
                <path class="flight-tower flight-draw" d="M ${hubX - 4} ${hubY} L ${hubX - 12} ${ground} H ${hubX + 12} L ${hubX + 4} ${hubY}"/>
                <circle class="flight-rotor-envelope flight-draw" cx="${hubX}" cy="${hubY}" r="${radius}"/>
                <g transform="translate(${hubX} ${hubY})"><g class="flight-rotor">
                    ${[0, 120, 240].map(angle => `<path class="flight-blade" transform="rotate(${angle})" d="M -2 0 L -4 ${-radius * 0.38} L 0 ${-radius} L 4 ${-radius * 0.2} Z"/>`).join('')}
                </g></g>
                <circle class="flight-hub" cx="${hubX}" cy="${hubY}" r="4"/>
                <path class="flight-dimension" d="M 68 ${ground} V ${hubY} M 62 ${ground} H 74 M 62 ${hubY} H 74 M 74 ${hubY} H ${hubX - 8}"/>
                <path class="flight-dimension" d="M ${dimensionX} ${hubY - radius} V ${hubY + radius} M ${dimensionX - 6} ${hubY - radius} H ${dimensionX + 6} M ${dimensionX - 6} ${hubY + radius} H ${dimensionX + 6}"/>
                <text class="flight-dimension-label" x="82" y="${plotBottom + 25}">H ${formatMetres(turbine.hub)} m</text>
                <text class="flight-dimension-label" x="220" y="${plotBottom + 25}">Ø ${formatMetres(turbine.diameter)} m</text>
                ${bands}
                <text class="flight-readout-hint" x="52" y="405">${birds.length ? 'Hover or focus a band; select it for species details.' : 'No species selected. Turbine geometry only.'}</text>
            </svg>
        </div>
        <div class="flight-key" aria-label="Drawing legend"><span><b class="flight-key__band"></b>Estimated flight band</span><span><b class="flight-key__zone"></b>Swept zone</span><span><b class="flight-key__overlap"></b>Altitude intersection</span></div>
        <div class="flight-species-list">${speciesDetails || '<p class="flight-diagram__empty">No species selected. Add species to compare their estimated flight bands.</p>'}</div>
        <p class="flight-diagram__caveat">Flight bands are approximate reference estimates from general ornithological knowledge. Horizontal spacing is schematic. Altitude intersection alone does not establish collision risk, habitat use or measured local flight activity.</p>
    </figure>`;
}

function introDrawing() {
    // Decorative schematic only. It has no altitude labels or site data claims.
    return `<svg class="flight-intro__drawing" viewBox="0 0 300 120" aria-hidden="true" focusable="false">
        <defs><clipPath id="intro-swept-clip"><circle cx="214" cy="53" r="36"/></clipPath><pattern id="intro-overlap-hatch" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 7L7 0" class="flight-hatch"/></pattern></defs>
        <rect class="flight-intro__altitude-band" x="12" y="36" width="276" height="34"/>
        <rect x="178" y="36" width="72" height="34" fill="url(#intro-overlap-hatch)" clip-path="url(#intro-swept-clip)"/>
        <text class="flight-intro__band-label" x="14" y="30">Illustrative flight band</text>
        <path class="flight-intro__grid" d="M 12 26 H 288 M 12 52 H 288 M 12 78 H 288 M 52 14 V 106 M 104 14 V 106 M 156 14 V 106 M 208 14 V 106 M 260 14 V 106"/>
        <circle class="flight-rotor-envelope flight-draw" cx="214" cy="53" r="36"/>
        <path class="flight-tower flight-draw" d="M 211 53 L 206 106 H 222 L 217 53"/>
        <path class="flight-ground flight-draw" d="M 12 106 H 288"/>
        <g transform="translate(214 53)"><g class="flight-rotor">${[0, 120, 240].map(angle => `<path class="flight-blade" transform="rotate(${angle})" d="M -2 0 L -3 -14 L 0 -35 L 3 -8 Z"/>`).join('')}</g></g>
        <circle class="flight-hub" cx="214" cy="53" r="3"/>
        <path class="flight-intro__route flight-draw" d="M 18 77 C 60 79 80 39 121 42 S 163 61 185 36"/>
        <path class="flight-bird flight-intro__bird" d="${birdPath(75, 62, 12)}"/>
        <path class="flight-bird flight-intro__bird flight-intro__bird--second" d="${birdPath(133, 35, 9)}"/>
    </svg>`;
}

/** Mount once, without stealing focus, covering the map with a backdrop or trapping input. */
export function initFlightIntro() {
    if (typeof document === 'undefined') return null;
    if (!document.body) {
        if (!introPending) {
            introPending = true;
            document.addEventListener('DOMContentLoaded', () => {
                introPending = false;
                initFlightIntro();
            }, { once: true });
        }
        return null;
    }
    if (introController?.element.isConnected) return introController;
    // A removed instance should release its timer and listeners before remounting.
    introController?.destroy();
    const root = document.createElement('div');
    root.className = 'flight-intro';
    const titleId = `flight-intro-title-${++diagramSequence}`;
    root.innerHTML = `<section class="flight-intro__card" id="${titleId}-card" aria-labelledby="${titleId}">
        <div class="flight-intro__topline"><span>Coexisting with birds</span><button class="flight-intro__close" type="button" aria-label="Dismiss introduction">×</button></div>
        ${introDrawing()}
        <h2 id="${titleId}">Room for flight.</h2>
        <p>Explore bird records and turbine geometry.<br>Open a wind park to compare altitude bands.</p>
        <small>Illustrative drawing · the map is ready to explore</small>
    </section>
    <button class="flight-intro__replay" type="button" aria-label="Replay flight introduction" aria-controls="${titleId}-card" aria-expanded="true">↻ <span>Flight intro</span></button>`;
    const card = root.querySelector('.flight-intro__card');
    const close = root.querySelector('.flight-intro__close');
    const replay = root.querySelector('.flight-intro__replay');
    let timer;
    const hide = () => {
        clearTimeout(timer);
        const focused = card.contains(document.activeElement);
        card.hidden = true;
        replay.setAttribute('aria-expanded', 'false');
        if (focused) replay.focus({ preventScroll: true });
    };
    const autoHide = () => {
        // Do not remove a control while a keyboard user is interacting with it.
        if (card.contains(document.activeElement)) timer = setTimeout(autoHide, 1000);
        else hide();
    };
    const show = () => {
        clearTimeout(timer);
        card.hidden = false;
        card.classList.remove('flight-intro__card--playing');
        // Restart the finite CSS reveal on each explicit replay.
        void card.offsetWidth;
        card.classList.add('flight-intro__card--playing');
        replay.setAttribute('aria-expanded', 'true');
        timer = setTimeout(autoHide, 4000);
    };
    const onEscape = event => {
        if (event.key === 'Escape' && !card.hidden && root.contains(document.activeElement)) hide();
    };
    close.addEventListener('click', hide);
    replay.addEventListener('click', show);
    root.addEventListener('keydown', onEscape);
    document.body.append(root);
    introController = {
        element: root, show, hide,
        destroy() {
            clearTimeout(timer);
            close.removeEventListener('click', hide);
            replay.removeEventListener('click', show);
            root.removeEventListener('keydown', onEscape);
            root.remove();
            if (introController?.element === root) introController = null;
        }
    };
    show();
    return introController;
}
