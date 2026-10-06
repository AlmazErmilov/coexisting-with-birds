const IMAGE_BASE_URL = new URL("../assets/birds/", import.meta.url);
const PLACEHOLDER_URL = new URL("illustration-placeholder.svg", IMAGE_BASE_URL).href;
const initializedRoots = new WeakSet();

const BIRD_PHOTOS = new Map([
  [
    "Clangula hyemalis",
    {
      commonName: "Long-tailed Duck",
      file: "clangula-hyemalis.jpg",
      author: "Wolfgang Wander",
      license: "CC BY-SA 3.0",
      source: "https://commons.wikimedia.org/wiki/File:Long-tailed-duck.jpg",
    },
  ],
  [
    "Melanitta fusca",
    {
      commonName: "Velvet Scoter",
      file: "melanitta-fusca.jpg",
      author: "Ómar Runólfsson",
      license: "CC BY 2.0",
      source: "https://commons.wikimedia.org/wiki/File:Melanitta_fusca,_Grindavik,_Iceland_2.jpg",
    },
  ],
  [
    "Crex crex",
    {
      commonName: "Corn Crake",
      file: "crex-crex.jpg",
      author: "Sergey Yeliseev",
      license: "CC BY 2.0",
      source: "https://commons.wikimedia.org/wiki/File:Corncrake.jpg",
    },
  ],
  [
    "Polysticta stelleri",
    {
      commonName: "Steller's Eider",
      file: "polysticta-stelleri.jpg",
      author: "Christoph Moning",
      license: "CC BY 4.0",
      source: "https://commons.wikimedia.org/wiki/File:Polysticta_stelleri,_Svartnes,_Vard%C3%B8,_Norway_194657506.jpg",
    },
  ],
  [
    "Numenius arquata",
    {
      commonName: "Eurasian Curlew",
      file: "numenius-arquata.jpg",
      author: "Ken Billington",
      license: "CC BY-SA 3.0",
      source: "https://commons.wikimedia.org/wiki/File:Curlew_(Numenius_arquata)_(12).jpg",
    },
  ],
  [
    "Vanellus vanellus",
    {
      commonName: "Northern Lapwing",
      file: "vanellus-vanellus.jpg",
      author: "Sébastien FAILLON",
      license: "CC BY 2.0",
      source: "https://commons.wikimedia.org/wiki/File:Vanneau_hupp%C3%A9_(51184097987).jpg",
    },
  ],
  [
    "Larus fuscus",
    {
      commonName: "Lesser Black-backed Gull",
      file: "larus-fuscus.jpg",
      author: "Arild Vågen",
      license: "CC BY-SA 3.0",
      source: "https://commons.wikimedia.org/wiki/File:Larus_fuscus_Finnboda_2012.jpg",
    },
  ],
  [
    "Sterna hirundo",
    {
      commonName: "Common Tern",
      file: "sterna-hirundo.jpg",
      author: "MPF",
      license: "CC BY-SA 4.0",
      source: "https://commons.wikimedia.org/wiki/File:2014-05-18_Sterna_hirundo,_Killingworth_Lake,_Northumberland_02.jpg",
    },
  ],
  [
    "Uria aalge",
    {
      commonName: "Common Guillemot",
      file: "uria-aalge.jpg",
      author: "Charles J. Sharp",
      license: "CC BY-SA 4.0",
      source: "https://commons.wikimedia.org/wiki/File:Guillemot_(Uria_aalge)_in_flight.jpg",
    },
  ],
  [
    "Saxicola rubetra",
    {
      commonName: "Whinchat",
      file: "saxicola-rubetra.jpg",
      author: "Frank Vassen from Brussels, Belgium",
      license: "CC BY 2.0",
      source: "https://commons.wikimedia.org/wiki/File:Saxicola_rubetra_-Belgium_-male-8.jpg",
    },
  ],
  [
    "Rissa tridactyla",
    {
      commonName: "Black-legged Kittiwake",
      file: "rissa-tridactyla.jpg",
      author: "Yathin S Krishnappa",
      license: "CC BY-SA 3.0",
      source: "https://commons.wikimedia.org/wiki/File%3ARissa_tridactyla_%28Vard%C3%B8%2C_2012%29.jpg",
    },
  ],
  [
    "Alca torda",
    {
      commonName: "Razorbill",
      file: "alca-torda.jpg",
      author: "Charles J. Sharp",
      license: "CC BY-SA 4.0",
      source: "https://commons.wikimedia.org/wiki/File:Razorbill_(Alca_torda)_Skomer.jpg",
    },
  ],
  [
    "Parus major",
    {
      commonName: "Great Tit",
      file: "parus-major.jpg",
      author: "Dark one",
      license: "CC BY-SA 2.5",
      source: "https://commons.wikimedia.org/wiki/File:Great_Tit_(Parus_major)_1.jpg",
    },
  ],
  [
    "Cyanistes caeruleus",
    {
      commonName: "Eurasian Blue Tit",
      file: "cyanistes-caeruleus.jpg",
      author: "Luc Viatour",
      license: "CC BY-SA 3.0",
      source: "https://commons.wikimedia.org/wiki/File:Cyanistes_caeruleus_3_Luc_Viatour.jpg",
    },
  ],
  [
    "Pica pica",
    {
      commonName: "Eurasian Magpie",
      file: "pica-pica.jpg",
      author: "Skarabeusz",
      license: "CC BY-SA 2.5",
      source: "https://commons.wikimedia.org/wiki/File:Sroka_Pica_Pica_II.jpg",
    },
  ],
  [
    "Sitta europaea",
    {
      commonName: "Eurasian Nuthatch",
      file: "sitta-europaea.jpg",
      author: "Stefan Berndtsson",
      license: "CC BY 2.0",
      source: "https://commons.wikimedia.org/wiki/File%3ASitta_europaea_europaea%2C_Slottsskogen%2C_G%C3%B6teborg%2C_Sweden_3.jpg",
    },
  ],
  [
    "Turdus merula",
    {
      commonName: "Common Blackbird",
      file: "turdus-merula.jpg",
      author: "Charles J. Sharp",
      license: "CC BY-SA 4.0",
      source: "https://commons.wikimedia.org/wiki/File:Common_blackbird_(Turdus_merula)_male,_young_adult.jpg",
    },
  ],
  [
    "Erithacus rubecula",
    {
      commonName: "European Robin",
      file: "erithacus-rubecula.jpg",
      author: "Francis C. Franklin",
      license: "CC BY-SA 3.0",
      source: "https://commons.wikimedia.org/wiki/File:Erithacus_rubecula_with_cocked_head.jpg",
    },
  ],
  [
    "Pyrrhula pyrrhula",
    {
      commonName: "Eurasian Bullfinch",
      file: "pyrrhula-pyrrhula.jpg",
      author: "Francis Franklin",
      license: "CC BY-SA 3.0",
      source: "https://commons.wikimedia.org/wiki/File:Bullfinch_male.jpg",
    },
  ],
  [
    "Corvus cornix",
    {
      commonName: "Hooded Crow",
      file: "corvus-cornix.jpg",
      author: "Ken Billington",
      license: "CC BY-SA 3.0",
      source: "https://commons.wikimedia.org/wiki/File:Hooded_Crow_(Corvus_cornix)_(11).jpg",
    },
  ],
  [
    "Fratercula arctica",
    {
      commonName: "Atlantic Puffin",
      file: "fratercula-arctica.jpg",
      author: "Andreas Trepte",
      license: "CC BY-SA 2.5",
      source: "https://commons.wikimedia.org/wiki/File%3AAtlantic_Puffin_Fratercula_arctica.jpg",
    },
  ],
  [
    "Uria lomvia",
    {
      commonName: "Brünnich’s Guillemot",
      file: "uria-lomvia.jpg",
      author: "AWeith",
      license: "CC BY-SA 4.0",
      source: "https://commons.wikimedia.org/wiki/File%3AA_Br%C3%BCnnich's_guillemot_(Uria_lomvia)_with_prey.jpg",
    },
  ],
  [
    "Alle alle",
    {
      commonName: "Little Auk",
      file: "alle-alle.jpg",
      author: "AWeith",
      license: "CC BY-SA 4.0",
      source: "https://commons.wikimedia.org/wiki/File%3ALittle_Auk_(Alle_alle)%2C_Fuglesangen%2C_Svalbard.jpg",
    },
  ],
  [
    "Cepphus grylle",
    {
      commonName: "Black Guillemot",
      file: "cepphus-grylle.jpg",
      author: "óskar elías sigurðsson",
      license: "CC BY 2.0",
      source: "https://commons.wikimedia.org/wiki/File%3ATeista_-_Cepphus_grylle_-_Black_Guillemot.jpg",
    },
  ],
  [
    "Morus bassanus",
    {
      commonName: "Northern Gannet",
      file: "morus-bassanus.jpg",
      author: "Andreas Trepte",
      license: "CC BY-SA 2.5",
      source: "https://commons.wikimedia.org/wiki/File%3AMorus_bassanus_adu.jpg",
    },
  ],
  [
    "Fulmarus glacialis",
    {
      commonName: "Northern Fulmar",
      file: "fulmarus-glacialis.jpg",
      author: "Diego Delso",
      license: "CC BY-SA 4.0",
      source: "https://commons.wikimedia.org/wiki/File%3AFulmar_boreal_(Fulmarus_glacialis)%2C_Heimaey%2C_Islas_Vestman%2C_Su%C3%B0urland%2C_Islandia%2C_2014-08-17%2C_DD_100.jpg",
    },
  ],
  [
    "Phalacrocorax carbo",
    {
      commonName: "Great Cormorant",
      file: "phalacrocorax-carbo.jpg",
      author: "JJ Harrison ( https://www.jjharrison.com.au/ )",
      license: "CC BY-SA 3.0",
      source: "https://commons.wikimedia.org/wiki/File%3APhalacrocorax_carbo_Vic.jpg",
    },
  ],
  [
    "Larus argentatus",
    {
      commonName: "European Herring Gull",
      file: "larus-argentatus.jpg",
      author: "Lukasz Lukomski",
      license: "CC BY-SA 3.0",
      source: "https://commons.wikimedia.org/wiki/File%3ALarus_argentatus_argenteus01.jpg",
    },
  ],
]);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function imageMarkup({ src, alt, title, className, imageType, species, commonName }) {
  return (
    '<img class="' +
    className +
    '" src="' +
    escapeHtml(src) +
    '" width="44" height="44" loading="lazy" decoding="async" ' +
    'style="width:44px;height:44px;object-fit:cover;display:block;flex:0 0 44px" ' +
    'alt="' +
    escapeHtml(alt) +
    '" title="' +
    escapeHtml(title) +
    '" data-bird-image="' +
    imageType +
    '" data-bird-species="' +
    escapeHtml(species) +
    '" data-bird-common="' +
    escapeHtml(commonName) +
    '">'
  );
}

function illustrationMarkup(species) {
  const label = species || "unknown species";
  return imageMarkup({
    src: PLACEHOLDER_URL,
    alt: "Illustration placeholder for " + label + "; generic illustration, not a species photo.",
    title: "Illustration placeholder. This is not a species photograph.",
    className: "bird-thumbnail bird-thumbnail--illustration",
    imageType: "illustration",
    species: label,
    commonName: "",
  });
}

/**
 * Return a local 44px photo thumbnail for a supported scientific name.
 * Unsupported names receive a clearly labelled generic illustration.
 */
export function birdThumbnail(species) {
  const scientificName = typeof species === "string" ? species.trim() : "";
  const photo = BIRD_PHOTOS.get(scientificName);

  if (!photo) {
    return illustrationMarkup(scientificName);
  }

  return imageMarkup({
    src: new URL(photo.file, IMAGE_BASE_URL).href,
    alt: "Photo of " + photo.commonName + " (" + scientificName + ").",
    title:
      "Photo of " +
      photo.commonName +
      " (" +
      scientificName +
      ") by " +
      photo.author +
      ", licensed " +
      photo.license +
      ". Source: " +
      photo.source,
    className: "bird-thumbnail",
    imageType: "photo",
    species: scientificName,
    commonName: photo.commonName,
  });
}

function handleBirdImageError(event) {
  const image = event.target;

  if (!image || image.tagName !== "IMG" || image.dataset.birdImage !== "photo") {
    return;
  }

  const species = image.dataset.birdSpecies || "unknown species";
  image.dataset.birdImage = "illustration";
  image.classList.add("bird-thumbnail--illustration");
  image.src = PLACEHOLDER_URL;
  image.alt =
    "Illustration placeholder for " +
    species +
    "; generic illustration, not a species photo. The local photo could not be loaded.";
  image.title = "Illustration placeholder. This is not a species photograph.";
}

/**
 * Install one delegated local-image fallback handler on a document or element.
 * Call once after importing this module. Repeated calls for the same root are safe.
 */
export function initBirdImages(root = globalThis.document) {
  if (!root || typeof root.addEventListener !== "function" || initializedRoots.has(root)) {
    return false;
  }

  initializedRoots.add(root);
  root.addEventListener("error", handleBirdImageError, true);
  return true;
}
