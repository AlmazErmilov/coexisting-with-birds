# Dataset documentation

This document describes all datasets used in the project, their sources, transformations applied and known limitations.

## 1. Bird observations (`data/birds_norway.json`)

### Source
- **Provider**: GBIF (Global Biodiversity Information Facility)
- **API endpoint**: `https://api.gbif.org/v1/occurrence/search`
- **License**: CC BY 4.0 / CC0 (varies per contributing dataset)
- **Authentication**: none required
- **Fetch script**: `fetch_data.py`

### Query parameters
| Parameter | Value | Purpose |
|-----------|-------|---------|
| country | NO | Norway only |
| classKey | 212 | Class Aves (birds) |
| hasCoordinate | true | Only georeferenced records |
| hasGeospatialIssue | false | Exclude records with known spatial problems |
| month | 1-12 (iterated) | Even distribution across months |
| limit | 300 | Records per page |

### Transformation
1. GBIF returns full occurrence records with 100+ fields
2. Script extracts only: `decimalLatitude`, `decimalLongitude`, `species`, `month`, `stateProvince`
3. Coordinates rounded to 4 decimal places (~11m precision)
4. Saved as JSON with fields renamed: `lat`, `lon`, `species`, `month`, `county`
5. Fetched 833 records per month (12 months) for even seasonal distribution

### Species summary
- Fetched separately using GBIF faceted search (`facet=speciesKey`, `facetLimit=30`)
- Each speciesKey resolved to canonical name via `https://api.gbif.org/v1/species/{key}`
- Contains total observation counts across all 33.7M records (not just the 10K sample)

### Audit results
| Check | Result |
|-------|--------|
| Total records | 9,996 |
| Missing fields | 0 (all lat, lon, species, month present) |
| Latitude range | 57.99 to 71.08 (within Norway) |
| Longitude range | 3.24 to 31.16 (within Norway) |
| Points outside Norway | 0 |
| Unique species | 250 |
| Month distribution | 833 per month (even) |
| Counties represented | All major Norwegian counties |

### Known limitations
- **Sample bias**: 10K is a tiny sample of 33.7M records. Observation density reflects sample, not true population density.
- **Observer bias**: GBIF data comes largely from citizen science (eBird, Artsobservasjoner). Urban areas and popular birding spots are overrepresented.
- **Temporal bias**: Records come from different years. The month distribution is even within this sample, but the actual geographic distribution per month may not be representative.
- **Species identification**: some records may have misidentifications, though GBIF applies quality filters.

---

## 2. Wind turbines (`data/wind_turbines.json`)

### Source
- **Provider**: NVE (Norwegian Water Resources and Energy Directorate)
- **Redistribution**: HuggingFace dataset `rebase-energy/nve-windpower-data`
- **Original file**: `nve-windpower-metadata-extended.csv`
- **License**: NVE open data
- **Authentication**: none required

### Transformation
1. Downloaded CSV with 425 rows (one per turbine, across all status)
2. Filtered: kept only turbines without `DecommissioningDate` (active)
3. Filtered: removed rows without coordinates (lat/lon empty)
4. Result: 393 active turbines

**Turbine record fields extracted:**
`lat`, `lon`, `Name`, `InstalledCapacity_MW`, `County`, `Municipality`, `TurbineManufacturer`, `TurbineType`, `AvgHubHeight`, `AvgRotorDiameter`

**Park aggregation:**
- Turbines grouped by park name
- Hub height and rotor diameter averaged across turbines in each park
- `rotor_min` calculated as `hub_height - rotor_diameter / 2`
- `rotor_max` calculated as `hub_height + rotor_diameter / 2`

### Audit results
| Check | Result |
|-------|--------|
| Active turbines | 393 |
| Wind parks | 62 |
| Turbines match parks total | Yes (393 = 393) |
| Parks with hub height | 62/62 (100%) |
| Hub height range | 31.0 to 145.0m |
| Rotor diameter range | 27.0 to 150.0m |
| Swept zone range | 14 to 220m |
| Total capacity | 5,058.3 MW |
| Lat range | 58.16 to 71.01 (within Norway) |

### Known limitations
- **Coordinate precision**: some parks share a single coordinate for all turbines (park centroid, not individual turbine positions).
- **Hub height type inconsistency**: in the turbines array, `hub_height` and `rotor_diameter` are stored as strings (from CSV). In the parks array they are numbers (computed averages). The app only reads from parks, so this does not affect display.
- **Decommissioned turbines**: 32 turbines excluded. These had coordinates but are no longer operational.

---

## 3. Municipality boundaries (`data/kommuner.geojson`)

### Source
- **Provider**: Kartverket (Norwegian Mapping Authority)
- **Redistribution**: GitHub `robhop/fylker-og-kommuner`, file `Kommuner-S.geojson`
- **License**: CC BY 4.0 (based on Kartverket open data)
- **Authentication**: none required

### Transformation
- No transformation applied. File used as downloaded.
- "S" variant (simplified geometry) chosen for smaller file size (1.2 MB vs ~15 MB for detailed).

### Audit results
| Check | Result |
|-------|--------|
| Municipalities | 357 |
| Missing names | 0 |
| Missing IDs | 0 |
| Duplicate IDs | 0 |
| Geometry types | 151 Polygon, 206 MultiPolygon |
| Bounding box lat | 57.97 to 71.19 |
| Bounding box lon | 4.64 to 31.15 |

### Known limitations
- **Simplified geometry**: boundaries are approximate due to coordinate reduction. Not suitable for precise spatial analysis, but sufficient for map visualization.
- **Update frequency**: file from 2024 Kartverket data. Any kommune mergers after that date are not reflected.

---

## 4. Norwegian Red List (hardcoded in `index.html`)

### Source
- **Provider**: Artsdatabanken (Norwegian Biodiversity Information Centre)
- **Document**: Norwegian Red List for Species 2021 (Rødlista for arter 2021)
- **URL**: https://artsdatabanken.no/rodlisteforarter2021/Artsgruppene/fugler
- **License**: publicly available assessment data

### Transformation
- 56 bird species manually curated from the 2021 assessment
- Categories: CR (4), EN (14), VU (19), NT (19)
- Stored as a JavaScript object mapping scientific name to category code
- Only bird species (class Aves) included

### Audit results
| Check | Result |
|-------|--------|
| Total red-listed species | 56 |
| Found in observation data | 54/56 (96%) |
| Missing from observations | Perdix perdix, Anas penelope |

### Known limitations
- **Not exhaustive**: the full 2021 red list contains 78 bird species. We included 56 of the most relevant ones.
- **Static data**: red list assessments are updated periodically (last: 2021, next expected: 2025/2026). Categories may change.
- **Missing species**: Perdix perdix (grey partridge) and Anas penelope (Eurasian wigeon) are in the red list but not in our 10K observation sample. They would appear with a larger sample.

---

## 5. Flight altitude data (hardcoded in `index.html`)

### Source
- **Type**: approximate estimates based on general ornithological knowledge (not extracted from a single dataset or publication)
- **Note**: the specific [min, max] values were not directly extracted from the references below. They represent typical flight bands as understood from broader ornithological knowledge. The references informed the general approach and provided context for specific species groups.
- **References**:
  - Johnston A. et al. (2014) "Modelling flight heights of marine birds to more accurately assess collision risk with offshore wind turbines." *J. Applied Ecology* 51(1), 31-41. [doi:10.1111/1365-2664.12191](https://doi.org/10.1111/1365-2664.12191)
  - Band W. et al. (2007) "Developing field and analytical methods to assess avian collision risk at wind farms." In: de Lucas M., Janss G., Ferrer M. (eds) *Birds and Wind Farms*. Quercus, Madrid.
  - Scottish Natural Heritage (2000, rev. 2017) "Windfarms and birds: calculating a theoretical collision risk assuming no avoiding action." SNH Guidance Note.
  - Dahl E.L. et al. (2012) "Reduced breeding success in white-tailed eagles at Smøla windfarm, western Norway." *Environmental Research Letters* 7(4). [doi:10.1088/1748-9326/7/4/044009](https://doi.org/10.1088/1748-9326/7/4/044009)
  - BirdLife Norge species fact sheets and field guides. [birdlife.no](https://www.birdlife.no/)

### Transformation
- 98 bird species with typical flight altitude ranges [min_m, max_m]
- Altitudes represent typical flight band during local movements (not migration altitude)
- Stored as a JavaScript object mapping scientific name to [min, max] array

### Rotor zone overlap calculation
```
rotor_zone = [park.rotor_min, park.rotor_max]  // per-park, from NVE data
// range across all 62 parks: 14-220m AGL

overlap = max(0, min(bird_max, park.rotor_max) - max(bird_min, park.rotor_min))
risk = "high"   if overlap > 50% of bird's flight range
risk = "medium" if overlap > 0 but <= 50%
risk = "low"    if no overlap
```

A global fallback of [30m, 200m] is used for species-level views (filters, tooltips) where no specific park context is available.

### Audit results
| Check | Result |
|-------|--------|
| Species with altitude data | 98 |
| Found in observation data | 92/98 (94%) |
| Max altitude | 800m (Anser brachyrhynchus, migrating geese) |
| All ranges valid (min < max) | Yes |

### Known limitations
- **Approximate values**: flight altitudes vary by individual, season, weather, terrain and behavior. The ranges represent typical conditions, not extremes.
- **Local vs migration**: some species fly much higher during migration. The data reflects local/foraging flight, which is more relevant for turbine collision risk.
- **Estimated, not measured**: these are approximate values based on general ornithological knowledge, not GPS tracking or radar derived altitudes. The cited references informed the approach but the specific values were not extracted from their data tables. For precise collision risk assessment, site-specific survey data should be used.
- **Not species-specific to Norway**: altitude ranges are general for the species, not adjusted for Norwegian terrain or wind conditions.

---

## Data pipeline overview

```
GBIF API (33.7M records)
    |
    +--> fetch_data.py (query per month, extract 5 fields)
    |        |
    |        +--> data/birds_norway.json (9,996 records + 30 species summary)
    |
NVE CSV via HuggingFace (425 rows)
    |
    +--> inline Python (filter active, aggregate parks, compute swept zones)
    |        |
    |        +--> data/wind_turbines.json (393 turbines, 62 parks)
    |
Kartverket via GitHub (simplified GeoJSON)
    |
    +--> data/kommuner.geojson (357 municipalities, no transformation)
    |
Artsdatabanken Red List 2021 (manual curation)
    |
    +--> RED_LIST object in index.html (56 species)
    |
General ornithological knowledge (approximate estimates)
    |
    +--> FLIGHT_ALT object in index.html (98 species)
```

---

## Methodology notes

### Distance calculation

The app uses a flat earth approximation instead of the Haversine formula. One degree of latitude is always ~111 km (Earth circumference 40 000 km / 360°). One degree of longitude varies with latitude: at the equator it is also ~111 km, but at 60°N (southern Norway) it shrinks to 111 × cos(60°) ≈ 55 km because meridians converge toward the poles. The `cos(lat)` term corrects for this. At distances under 30 km the error compared to Haversine is negligible (fractions of a percent), so the simpler formula is sufficient for the screening purpose.

### Scoring weights

The red list multipliers (CR = 8, EN = 5, VU = 3, NT = 1.5) are author chosen values, not derived from a published standard. They are designed to reflect the relative severity of IUCN conservation categories: a critically endangered species facing imminent extinction should contribute more to the conflict score than a near threatened one. The exact numbers are subjective, but they preserve the correct ordering of conservation priority and produce a reasonable spread in the final scores.

The rotor zone overlap multipliers (high = 3, medium = 1.5) follow the same principle: species that spend most of their flight time at rotor height face higher collision risk and should be weighted accordingly.

### Normalization constant (300)

The raw score (sum of weighted observations within 30 km) is divided by 300 and clamped to [0, 1]. This constant was calibrated empirically against the current 10K observation sample so that the resulting scores spread across all four risk levels (low, moderate, high, very high). If the observation dataset grows significantly (e.g. from 10K to 100K records), this threshold should be recalibrated to maintain a meaningful distribution.

### Search radius (30 km)

The 30 km radius approximates a typical foraging and commuting range for medium to large birds. All observations within this radius receive equal weight regardless of distance (no decay function). This is a simplification: in practice, birds observed closer to a turbine are at higher risk. A distance decay function could improve accuracy but was not implemented for this screening tool.
