// Constants and reference data for Coexisting with Birds

export const MONTH_NAMES = [
    'All months', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// Norwegian Red List 2021 (Artsdatabanken) for birds
// CR = Critically Endangered, EN = Endangered, VU = Vulnerable, NT = Near Threatened
export const RED_LIST = {
    // CR
    'Crex crex': 'CR', 'Clangula hyemalis': 'CR', 'Polysticta stelleri': 'CR',
    'Melanitta fusca': 'CR',
    // EN
    'Fratercula arctica': 'EN', 'Sterna hirundo': 'EN', 'Sterna paradisaea': 'EN',
    'Morus bassanus': 'EN', 'Rissa tridactyla': 'EN', 'Uria aalge': 'EN',
    'Alca torda': 'EN', 'Limosa limosa': 'EN', 'Numenius arquata': 'EN',
    'Vanellus vanellus': 'EN', 'Gallinago media': 'EN', 'Larus fuscus': 'EN',
    'Saxicola rubetra': 'EN', 'Circus aeruginosus': 'EN',
    // VU
    'Larus argentatus': 'VU', 'Larus canus': 'VU', 'Chloris chloris': 'VU',
    'Stercorarius parasiticus': 'VU', 'Anas acuta': 'VU', 'Anas crecca': 'VU',
    'Perdix perdix': 'VU', 'Aythya fuligula': 'VU', 'Aythya marila': 'VU',
    'Strix nebulosa': 'VU', 'Mergellus albellus': 'VU',
    'Charadrius hiaticula': 'VU', 'Calidris alpina': 'VU',
    'Calidris pugnax': 'VU', 'Pluvialis apricaria': 'VU',
    'Motacilla flava': 'VU', 'Emberiza hortulana': 'VU',
    'Passer montanus': 'VU', 'Linaria cannabina': 'VU',
    // NT
    'Anas penelope': 'NT', 'Somateria mollissima': 'NT',
    'Mergus serrator': 'NT', 'Podiceps cristatus': 'NT',
    'Haematopus ostralegus': 'NT', 'Tringa totanus': 'NT',
    'Actitis hypoleucos': 'NT', 'Gallinago gallinago': 'NT',
    'Cepphus grylle': 'NT', 'Phalacrocorax carbo': 'NT',
    'Asio flammeus': 'NT', 'Ficedula hypoleuca': 'NT',
    'Hirundo rustica': 'NT', 'Delichon urbicum': 'NT',
    'Sturnus vulgaris': 'NT', 'Turdus pilaris': 'NT',
    'Passer domesticus': 'NT', 'Carduelis carduelis': 'NT',
    'Acanthis flammea': 'NT',
};

// Consolidated red list category metadata (single source of truth for JS)
export const RED_LIST_CATEGORIES = {
    CR: { color: '#8b0000', label: 'Critically endangered', weight: 8 },
    EN: { color: '#d32f2f', label: 'Endangered', weight: 5 },
    VU: { color: '#f57c00', label: 'Vulnerable', weight: 3 },
    NT: { color: '#fbc02d', label: 'Near threatened', weight: 1.5 },
};

// Typical flight altitude ranges [min_m, max_m] in meters AGL.
// Values are approximate estimates based on general ornithological knowledge.
// Informed by (not directly extracted from): Johnston et al. 2014, Band et al. 2007,
// SNH guidance, Dahl et al. 2012, BirdLife Norge. For precise assessments use site-specific data.
export const FLIGHT_ALT = {
    // Seabirds
    'Fratercula arctica': [5, 50], 'Alca torda': [5, 60], 'Uria aalge': [5, 60],
    'Uria lomvia': [5, 50], 'Alle alle': [5, 40], 'Cepphus grylle': [3, 30],
    'Morus bassanus': [10, 100], 'Rissa tridactyla': [10, 80],
    'Fulmarus glacialis': [10, 50], 'Phalacrocorax carbo': [5, 80],
    // Gulls and terns
    'Larus argentatus': [10, 150], 'Larus canus': [10, 120], 'Larus fuscus': [10, 200],
    'Larus marinus': [10, 150], 'Larus ridibundus': [10, 100],
    'Sterna hirundo': [5, 80], 'Sterna paradisaea': [5, 60],
    'Stercorarius parasiticus': [10, 100],
    // Raptors (high risk, fly at rotor height)
    'Haliaeetus albicilla': [50, 300], 'Aquila chrysaetos': [100, 400],
    'Buteo buteo': [30, 200], 'Buteo lagopus': [30, 200],
    'Accipiter gentilis': [20, 150], 'Accipiter nisus': [10, 100],
    'Milvus milvus': [30, 200], 'Circus aeruginosus': [5, 100],
    'Circus cyaneus': [5, 80], 'Falco peregrinus': [50, 500],
    'Falco tinnunculus': [20, 150], 'Pandion haliaetus': [30, 200],
    // Ducks and geese (migrants fly high, local flights low)
    'Anas platyrhynchos': [10, 100], 'Anas crecca': [10, 150],
    'Anas acuta': [10, 200], 'Anas penelope': [10, 150],
    'Aythya fuligula': [10, 100], 'Aythya marila': [10, 100],
    'Bucephala clangula': [10, 100], 'Clangula hyemalis': [5, 60],
    'Somateria mollissima': [5, 50], 'Melanitta fusca': [5, 60],
    'Mergus merganser': [10, 100], 'Mergus serrator': [5, 80],
    'Branta leucopsis': [50, 500], 'Anser anser': [50, 500],
    'Anser brachyrhynchus': [50, 800],
    // Waders
    'Haematopus ostralegus': [10, 80], 'Vanellus vanellus': [10, 100],
    'Pluvialis apricaria': [20, 200], 'Charadrius hiaticula': [10, 60],
    'Numenius arquata': [20, 150], 'Numenius phaeopus': [20, 200],
    'Limosa limosa': [20, 200], 'Tringa totanus': [10, 80],
    'Actitis hypoleucos': [5, 30], 'Gallinago gallinago': [10, 100],
    'Gallinago media': [10, 200], 'Calidris alpina': [10, 100],
    'Calidris pugnax': [10, 150], 'Crex crex': [5, 50],
    // Owls
    'Strix nebulosa': [5, 50], 'Strix aluco': [5, 50],
    'Asio flammeus': [5, 80], 'Asio otus': [5, 60],
    'Bubo bubo': [10, 100], 'Aegolius funereus': [5, 40],
    // Passerines (generally low, some exceptions)
    'Parus major': [2, 30], 'Cyanistes caeruleus': [2, 25],
    'Corvus cornix': [5, 80], 'Corvus corax': [10, 200],
    'Corvus monedula': [10, 100], 'Pica pica': [3, 40],
    'Turdus merula': [3, 40], 'Turdus pilaris': [5, 80],
    'Turdus iliacus': [5, 100], 'Turdus philomelos': [5, 80],
    'Sturnus vulgaris': [5, 100], 'Alauda arvensis': [10, 200],
    'Hirundo rustica': [5, 100], 'Delichon urbicum': [10, 150],
    'Chloris chloris': [3, 30], 'Carduelis carduelis': [5, 40],
    'Linaria cannabina': [3, 30], 'Acanthis flammea': [3, 40],
    'Fringilla coelebs': [5, 50], 'Passer domesticus': [2, 20],
    'Passer montanus': [2, 20], 'Motacilla alba': [3, 30],
    'Motacilla flava': [3, 30], 'Emberiza citrinella': [3, 30],
    'Emberiza hortulana': [3, 30], 'Erithacus rubecula': [2, 20],
    'Ficedula hypoleuca': [3, 30], 'Saxicola rubetra': [3, 30],
    'Phylloscopus trochilus': [3, 40], 'Sylvia atricapilla': [3, 30],
    'Regulus regulus': [3, 20], 'Bombycilla garrulus': [10, 60],
    'Poecile montanus': [2, 25],
};

// Typical rotor swept zone in Norway (derived from NVE data).
// Used as default for species-level views. Park scoring uses per-park rotor_min/rotor_max.
export const ROTOR_ZONE = { min: 30, max: 200 };

// Named constants for values used in multiple places or likely to be tuned
export const SEARCH_RADIUS_KM = 30;
// Empirical threshold for 10K sample; scale proportionally with sample size
export const SCORE_NORMALIZATION = 300;
export const MAX_RENDERED_POINTS = 5000;

export function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
