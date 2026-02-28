# Coexisting with Birds

Interactive heatmap of bird observations across Norway. Built as a pre-stage screening tool for understanding bird distribution before infrastructure projects (wind farms, construction, etc.).

## Quick start

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

No build step, no dependencies for the frontend. Just a static HTML file.

## Features

- **Heatmap view**: observation density across Norway (inferno color scale)
- **Points view**: individual observations colored by species
- **Species filter**: filter by any of the top 30 most observed species
- **Month slider**: see seasonal variation (January through December)
- **Kommune boundaries**: Norwegian municipality borders visible on zoom, with name tooltips
- **Top species panel**: live ranking of species in current filter

## Dataset

### Bird observations

- **Source**: [GBIF](https://www.gbif.org/) (Global Biodiversity Information Facility)
- **API**: `https://api.gbif.org/v1/occurrence/search`
- **Scope**: Norway (`country=NO`), class Aves (`classKey=212`), georeferenced only
- **Sample**: 10,000 observations out of ~33.7M available
- **Fields used**: latitude, longitude, species (scientific name), month, county (stateProvince)
- **License**: CC BY 4.0 / CC0 (varies per contributing dataset)
- **Authentication**: none required for the search API
- **Citation**: GBIF.org (28 February 2026) GBIF Occurrence Download

### Municipality boundaries

- **Source**: [Kartverket](https://www.kartverket.no/) via [robhop/fylker-og-kommuner](https://github.com/robhop/fylker-og-kommuner) (GitHub)
- **Format**: GeoJSON, simplified (1.2 MB, 357 kommuner)
- **License**: CC BY 4.0 (based on Kartverket open data)

## Refreshing data

To re-fetch bird observations from GBIF (requires Python 3, no pip packages):

```bash
python3 fetch_data.py
```

Adjust `limit_total` in `fetch_data.py` to change sample size (default: 10,000). Larger samples give denser heatmaps but larger JSON files. 50,000 records takes about 3 minutes.

## File structure

```
index.html          Main app (single file, no build)
fetch_data.py       Data fetching script (GBIF API)
data/
  birds_norway.json   Bird observations + species summary (964 KB)
  kommuner.geojson    Norwegian municipality boundaries (1.2 MB)
```

## Tech stack

- [Leaflet](https://leafletjs.com/) for the map
- [Leaflet.heat](https://github.com/Leaflet/Leaflet.heat) for the heatmap layer
- [CARTO dark basemap](https://carto.com/basemaps/) tiles
- Vanilla JS, no framework, no build step

## Scaling ideas

- Increase sample size or use GBIF bulk download (async, needs free account)
- Add wind turbine locations from [NVE](https://www.nve.no/energi/energisystem/vindkraft-paa-land/data-for-utbygde-vindkraftverk-i-norge/)
- Add bird tracking data from [Movebank](https://datarepository.movebank.org/) for flight altitude
- Use [Artsdatabanken Artskart](https://artskart.artsdatabanken.no/) API for red list species status
- Aggregate by kommune for choropleth "risk score" per municipality
- Computer vision layer: live camera feeds with bird detection models

## License

Data licenses as noted above. Code is open for hackathon purposes.
