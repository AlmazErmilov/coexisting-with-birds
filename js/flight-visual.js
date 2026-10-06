import {
    FLIGHT_ALT, escapeHtml, DEFAULT_HUB_HEIGHT, DEFAULT_ROTOR_DIAMETER
} from './data.js';
import { birdThumbnail } from './bird-images.js';
import { birdName, birdDetailsButton } from './bird-cards.js';

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
    const plotTop = 36;
    const plotBottom = 248;
    const extentMin = Math.min(0, turbine.hub - turbine.diameter / 2);
    const extentMax = Math.max(100, turbine.max, turbine.hub + turbine.diameter / 2,
        ...birds.filter(bird => bird.known).map(bird => bird.max));
    const step = tickStep(extentMax - extentMin);
    const scaleMin = Math.floor(extentMin / step) * step;
    const scaleMax = Math.ceil(extentMax / step) * step;
    const scale = (plotBottom - plotTop) / (scaleMax - scaleMin);
    const y = value => plotBottom - (value - scaleMin) * scale;
    const width = Math.max(336, 222 + Math.max(1, birds.length) * 24 + 18);
    const hubX = 118;
    const hubY = y(turbine.hub);
    const radius = turbine.diameter * scale / 2;
    const ground = y(0);
    const zoneTop = y(turbine.max);
    const zoneBottom = y(turbine.min);
    const dimensionX = 206;
    const ticks = [];
    for (let value = scaleMin; value <= scaleMax + step / 100; value += step) {
        ticks.push(`<g class="flight-grid"><path d="M 40 ${y(value)} H ${width - 12}"/><text x="32" y="${y(value) + 4}" text-anchor="end">${formatMetres(value)}</text></g>`);
    }

    const bands = birds.map((bird, index) => {
        const x = 222 + index * 24;
        const centre = x + 7;
        const detail = !bird.known ? 'Flight altitude unavailable. No band or overlap inferred.'
            : bird.overlap ? `Estimated band ${rangeText(bird.min, bird.max)}. Intersection ${rangeText(bird.overlapMin, bird.overlapMax)}.`
                : bird.touches ? `Estimated band ${rangeText(bird.min, bird.max)}. Touches the swept boundary only.`
                    : `Estimated band ${rangeText(bird.min, bird.max)}. No intersection in these estimated ranges.`;
        // ASVS 1.2.1: encode names where they enter HTML or SVG attributes/text.
        const label = escapeHtml(`${bird.name}. ${detail} Open species details.`);
        return `<a class="flight-band" data-bird-details="${escapeHtml(bird.name)}" href="#${id}-species-${index}" aria-label="${label}">
            <title>${label}</title>
            <rect class="flight-band__hit" x="${x - 4}" y="${plotTop}" width="22" height="${plotBottom - plotTop + 35}"/>
            <path class="flight-band__guide" d="M ${centre} ${plotTop} V ${plotBottom}"/>
            ${bird.known ? `<rect class="flight-band__range" x="${x}" y="${y(bird.max)}" width="14" height="${(bird.max - bird.min) * scale}"/>
                <path class="flight-band__caps" d="M ${x - 3} ${y(bird.max)} H ${x + 17} M ${x - 3} ${y(bird.min)} H ${x + 17}"/>
                ${bird.overlap ? `<rect class="flight-band__overlap" x="${x}" y="${y(bird.overlapMax)}" width="14" height="${(bird.overlapMax - bird.overlapMin) * scale}" fill="url(#${id}-hatch)"/>` : ''}
                ${bird.touches ? `<path class="flight-band__touch" d="M ${x} ${y(bird.overlapMin)} H ${x + 14}"/>` : ''}
                <path class="flight-bird" d="${birdPath(centre, y((bird.min + bird.max) / 2), 5)}"/>`
            : `<text class="flight-band__unknown" x="${centre}" y="${plotTop + 120}" text-anchor="middle">?</text>`}
            <text class="flight-band__number" x="${centre}" y="${plotBottom + 25}" text-anchor="middle">${index + 1}</text>
        </a>`;
    }).join('');

    const speciesDetails = birds.map((bird, index) => `<details class="flight-species">
        <summary id="${id}-species-${index}"><span class="flight-species__number">${index + 1}</span>${/^[A-Z][a-z]+ [a-z]+$/.test(bird.name) ? birdThumbnail(bird.name) : ''}<span class="bird-profile-line"><strong>${escapeHtml(birdName(bird.name))}</strong><span class="flight-species__range">${bird.known ? `${rangeText(bird.min, bird.max)} estimated` : 'Altitude unknown'}</span></span></summary>
        <p>${!bird.known ? 'No flight altitude estimate is available for this species. Overlap cannot be assessed.'
            : `${bird.overlap ? `Geometric intersection with the swept zone is ${rangeText(bird.overlapMin, bird.overlapMax)} AGL.` : bird.touches ? 'The estimated flight band touches the swept boundary. No interval is hatched.' : 'The estimated flight band does not intersect the displayed swept zone.'} This approximate reference band is not a local flight measurement or a collision probability.`}</p>${/^[A-Z][a-z]+ [a-z]+$/.test(bird.name) ? birdDetailsButton(bird.name, 'Bird facts &amp; summary', 'bird-card-action') : ''}
    </details>`).join('');

    return `<figure class="flight-diagram" aria-labelledby="${id}-heading">
        <figcaption class="flight-diagram__heading" id="${id}-heading">Flight &amp; rotor<span>Height above ground · metres</span></figcaption>
        <dl class="flight-dimensions">
            <div><dt>Hub</dt><dd>${formatMetres(turbine.hub)} m${turbine.hubSource === 'supplied' ? '' : `<small>${turbine.hubSource}</small>`}</dd></div>
            <div><dt>Rotor Ø</dt><dd>${formatMetres(turbine.diameter)} m${turbine.diameterSource === 'supplied' ? '' : `<small>${turbine.diameterSource}</small>`}</dd></div>
            <div><dt>Rotor zone</dt><dd>${rangeText(turbine.min, turbine.max)}${turbine.zoneSource === 'supplied bounds' || turbine.zoneSource === 'derived from dimensions' ? '' : `<small>${turbine.zoneSource}</small>`}</dd></div>
        </dl>
        ${turbine.notes.map(note => `<p class="flight-diagram__notice">${note}</p>`).join('')}
        <div class="flight-diagram__scroll" role="region" aria-label="Full altitude drawing">
            <svg class="flight-diagram__svg" xmlns="http://www.w3.org/2000/svg" width="${width}" height="286" viewBox="0 0 ${width} 286" role="group" aria-labelledby="${id}-title ${id}-desc">
                <title id="${id}-title">Bird altitude bands and turbine geometry</title>
                <desc id="${id}-desc">One linear vertical metre scale for the rotor and all bird bands. Amber hatching marks only altitude intersection. Numbered bands link to species details. Horizontal spacing represents separate lanes, not distance from a turbine.</desc>
                <defs><pattern id="${id}-hatch" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M -2 2 L 2 -2 M 0 7 L 7 0 M 5 9 L 9 5" class="flight-hatch"/></pattern></defs>
                <text class="flight-plot-label" x="4" y="20">m AGL</text>
                <text class="flight-plot-label" x="118" y="20" text-anchor="middle">Rotor</text>
                <text class="flight-plot-label" x="222" y="20">Birds</text>
                <rect class="flight-swept" x="40" y="${zoneTop}" width="${width - 52}" height="${zoneBottom - zoneTop}"/>
                ${ticks.join('')}
                <path class="flight-ground" d="M 40 ${ground} H ${width - 12}"/>
                <path class="flight-tower flight-draw" d="M ${hubX - 4} ${hubY} L ${hubX - 12} ${ground} H ${hubX + 12} L ${hubX + 4} ${hubY}"/>
                <circle class="flight-rotor-envelope flight-draw" cx="${hubX}" cy="${hubY}" r="${radius}"/>
                <g transform="translate(${hubX} ${hubY})"><g class="flight-rotor">
                    ${[0, 120, 240].map(angle => `<path class="flight-blade" transform="rotate(${angle})" d="M -2 0 L -4 ${-radius * 0.38} L 0 ${-radius} L 4 ${-radius * 0.2} Z"/>`).join('')}
                </g></g>
                <circle class="flight-hub" cx="${hubX}" cy="${hubY}" r="4"/>
                <path class="flight-dimension" d="M 68 ${ground} V ${hubY} M 62 ${ground} H 74 M 62 ${hubY} H 74 M 74 ${hubY} H ${hubX - 8}"/>
                <path class="flight-dimension" d="M ${dimensionX} ${hubY - radius} V ${hubY + radius} M ${dimensionX - 6} ${hubY - radius} H ${dimensionX + 6} M ${dimensionX - 6} ${hubY + radius} H ${dimensionX + 6}"/>
                <text class="flight-dimension-label" x="40" y="${plotBottom + 25}">H ${formatMetres(turbine.hub)} m</text>
                <text class="flight-dimension-label" x="144" y="${plotBottom + 25}">Ø ${formatMetres(turbine.diameter)} m</text>
                ${bands}
            </svg>
        </div>
        <div class="flight-key" aria-label="Drawing legend"><span><b class="flight-key__band"></b>Flight</span><span><b class="flight-key__zone"></b>Rotor</span><span><b class="flight-key__overlap"></b>Overlap</span></div>
        <div class="flight-species-list">${speciesDetails || '<p class="flight-diagram__empty">No species selected. Add species to compare their estimated flight bands.</p>'}</div>
        <details class="flight-method"><summary>About this drawing</summary><p class="flight-diagram__caveat">Estimated altitude bands, not local flight measurements. Horizontal spacing is schematic. Intersection does not establish collision risk or habitat use.</p></details>
    </figure>`;
}

function introDrawing() {
    return `<svg class="flight-intro__drawing flight-intro__drawing--wide" viewBox="0 0 1000 450" aria-hidden="true" focusable="false">
        <defs><pattern id="intro-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" class="flight-intro__grid"/></pattern><clipPath id="intro-swept-clip"><circle cx="670" cy="205" r="124"/></clipPath><pattern id="intro-overlap-hatch" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L8 0" class="flight-hatch"/></pattern><marker id="intro-arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><path d="M1 1L7 4L1 7" fill="none" stroke="#aac3c8"/></marker></defs>
        <rect class="flight-intro__grid-stage" x="20" y="20" width="960" height="400" fill="url(#intro-grid)"/>
        <path class="flight-intro__datum flight-draw" d="M40 370H960 M40 45V390 M35 80H45 M35 170H45 M35 260H45 M35 370H45"/>
        <g class="flight-intro__band-stage"><rect class="flight-intro__altitude-band" x="40" y="152" width="920" height="108"/><path class="flight-swept" d="M40 152H960M40 260H960"/><text class="flight-intro__band-label" x="52" y="140">ILLUSTRATIVE FLIGHT BAND</text></g>
        <circle class="flight-rotor-envelope flight-draw" cx="670" cy="205" r="124"/>
        <rect class="flight-intro__intersection" x="546" y="152" width="248" height="108" fill="url(#intro-overlap-hatch)" clip-path="url(#intro-swept-clip)"/>
        <path class="flight-tower flight-draw" d="M665 205L650 370H690L675 205"/>
        <g transform="translate(670 205)"><g class="flight-rotor">${[0,120,240].map(angle => `<path class="flight-blade" transform="rotate(${angle})" d="M-3 0L-6 -47L0 -122L6 -27Z"/>`).join('')}</g></g>
        <circle class="flight-hub" cx="670" cy="205" r="5"/>
        <path class="flight-intro__route flight-draw" d="M64 293C180 300 225 146 340 174S479 238 557 142"/>
        <g class="flight-intro__bird"><path class="flight-bird" d="${birdPath(240,230,18)}"/></g><g class="flight-intro__bird flight-intro__bird--second"><path class="flight-bird" d="${birdPath(420,182,14)}"/></g>
        <g class="flight-intro__annotation-stage"><path class="flight-dimension" d="M830 82V328M820 82H840M820 328H840M670 395H794" marker-start="url(#intro-arrow)" marker-end="url(#intro-arrow)"/><text class="flight-intro__band-label" x="850" y="199">ROTOR</text><text class="flight-intro__band-label" x="850" y="222">DIAMETER</text><path class="flight-dimension" d="M718 231L840 288H958"/><text class="flight-intro__band-label" x="843" y="313">INTERSECTION</text><text class="flight-intro__band-label" x="52" y="402">VERTICAL SECTION</text><text class="flight-intro__band-label" x="52" y="424">SCHEMATIC · NOT TO SCALE</text></g>
    </svg><svg class="flight-intro__drawing flight-intro__drawing--compact" viewBox="0 0 420 380" aria-hidden="true" focusable="false">
        <defs><pattern id="intro-mobile-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" class="flight-intro__grid"/></pattern><pattern id="intro-mobile-overlap-hatch" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L8 0" class="flight-hatch"/></pattern><clipPath id="intro-mobile-swept"><circle cx="267" cy="171" r="87"/></clipPath></defs>
        <rect class="flight-intro__grid-stage" x="20" y="24" width="380" height="316" fill="url(#intro-mobile-grid)"/>
        <path class="flight-intro__datum flight-draw" d="M24 320H396 M24 32V332"/>
        <g class="flight-intro__band-stage"><rect class="flight-intro__altitude-band" x="24" y="132" width="372" height="76"/><path class="flight-swept" d="M24 132H396 M24 208H396"/><text class="flight-intro__band-label" x="34" y="120">ILLUSTRATIVE FLIGHT BAND</text></g>
        <circle class="flight-rotor-envelope flight-draw" cx="267" cy="171" r="87"/>
        <rect class="flight-intro__intersection" x="180" y="132" width="174" height="76" fill="url(#intro-mobile-overlap-hatch)" clip-path="url(#intro-mobile-swept)"/>
        <path class="flight-tower flight-draw" d="M263 171L252 320H282L271 171"/>
        <g transform="translate(267 171)"><g class="flight-rotor">${[0,120,240].map(angle => `<path class="flight-blade" transform="rotate(${angle})" d="M-2 0L-4 -35L0 -85L4 -18Z"/>`).join('')}</g></g><circle class="flight-hub" cx="267" cy="171" r="4"/>
        <path class="flight-intro__route flight-draw" d="M34 270C98 276 112 152 170 168S218 204 248 140"/>
        <g class="flight-intro__bird"><path class="flight-bird" d="${birdPath(103,223,12)}"/></g><g class="flight-intro__bird flight-intro__bird--second"><path class="flight-bird" d="${birdPath(180,174,10)}"/></g>
        <g class="flight-intro__annotation-stage"><path class="flight-dimension" d="M354 207L370 278H393"/><text class="flight-intro__band-label" x="290" y="299">OVERLAP</text><text class="flight-intro__band-label" x="26" y="351">VERTICAL SECTION · SCHEMATIC</text></g>
    </svg>`;
}

export function initFlightIntro() {
    if (typeof document === 'undefined') return null;
    if (!document.body) {
        if (!introPending) {
            introPending = true;
            document.addEventListener('DOMContentLoaded', () => { introPending = false; initFlightIntro(); }, {once:true});
        }
        return null;
    }
    if (introController?.element.isConnected) return introController;
    introController?.destroy();
    const root = document.createElement('div');
    root.className = 'flight-intro';
    const titleId = `flight-intro-title-${++diagramSequence}`;
    root.innerHTML = `<section class="flight-intro__card" id="${titleId}-card" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
        <div class="flight-intro__topline"><span>Coexisting with birds</span><button class="flight-intro__close" type="button" aria-label="Dismiss introduction">×</button></div>
        <div class="flight-intro__composition"><header><p class="flight-intro__eyebrow">Norway · birds &amp; wind energy</p><h2 id="${titleId}">Room for flight.</h2></header>${introDrawing()}<footer><p>Observe. Compare. Coexist.</p><button class="flight-intro__explore" type="button">Explore the map <span>↗</span></button></footer></div>
        <small class="flight-intro__caption">Estimated bands · illustrative geometry</small>
    </section><button class="flight-intro__replay" type="button" aria-label="Replay flight introduction" aria-controls="${titleId}-card" aria-expanded="true">↻ <span>Flight intro</span></button>`;
    const card = root.querySelector('.flight-intro__card'), close = root.querySelector('.flight-intro__close'), replay = root.querySelector('.flight-intro__replay'), explore = root.querySelector('.flight-intro__explore');
    let timer, previousFocus, interacted = false;
    const inertBefore = new Map();
    const hide = () => {
        clearTimeout(timer);
        card.hidden = true;
        root.classList.remove('flight-intro--open');
        replay.hidden = false;
        replay.setAttribute('aria-expanded','false');
        for (const [element, wasInert] of inertBefore) element.inert = wasInert;
        inertBefore.clear();
        if (previousFocus?.isConnected && previousFocus !== document.body) previousFocus.focus({preventScroll:true});
        else replay.focus({preventScroll:true});
    };
    const show = (automatic = false) => {
        clearTimeout(timer);
        previousFocus = document.activeElement;
        interacted = false;
        for (const element of document.body.children) {
            if (element === root || element.tagName === 'SCRIPT') continue;
            if (!inertBefore.has(element)) inertBefore.set(element, element.inert);
            element.inert = true;
        }
        card.hidden = false;
        root.classList.add('flight-intro--open');
        card.classList.remove('flight-intro__card--playing');
        void card.offsetWidth;
        card.classList.add('flight-intro__card--playing');
        replay.hidden = true;
        replay.setAttribute('aria-expanded','true');
        close.focus({preventScroll:true});
        if (automatic) timer = setTimeout(() => { if (!interacted) hide(); }, 8000);
    };
    const onKey = event => {
        if (card.hidden) return;
        interacted = true;
        if (event.key === 'Escape') { event.stopPropagation(); hide(); return; }
        if (event.key === 'Tab') {
            if (event.shiftKey && document.activeElement === close) {event.preventDefault(); explore.focus();}
            else if (!event.shiftKey && document.activeElement === explore) {event.preventDefault(); close.focus();}
        }
    };
    const replayIntro = () => show(false);
    close.addEventListener('click',hide); explore.addEventListener('click',hide); replay.addEventListener('click',replayIntro); root.addEventListener('keydown',onKey);
    document.body.append(root);
    introController = {element:root,show:() => show(false),hide,destroy() {hide();close.removeEventListener('click',hide);explore.removeEventListener('click',hide);replay.removeEventListener('click',replayIntro);root.removeEventListener('keydown',onKey);root.remove();if(introController?.element === root) introController=null;}};
    show(true);
    return introController;
}
