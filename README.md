# Coexisting with Birds

<a href="https://www.tekna.no/en/events/hackathon-code-your-way-to-a-greener-world-51380/">
  <img src="https://www.tekna.no/Static/Web2020/img/icons/tekna-logo-2020.svg" alt="Tekna" height="40">
</a>

Built at [Tekna Hackathon: Code your way to a greener world](https://www.tekna.no/en/events/hackathon-code-your-way-to-a-greener-world-51380/) (Feb 27-28, 2026, Oslo)

**Live demo**: https://coexisting-with-birds.vercel.app/

**Demo presentation**: [Google Slides](https://docs.google.com/presentation/d/1pbhZNtN1zdDCPGJ1UySyacmfEBx5ucUs1B6r2pYHjcE/edit?usp=sharing)

Interactive heatmap of bird observations across Norway. A pre-stage screening tool for understanding bird distribution before infrastructure projects (wind farms, construction, etc.).

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
- **Wind turbines**: 62 wind parks (393 turbines) from NVE, togglable layer with popups
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

### Wind turbines

- **Source**: [NVE](https://www.nve.no/) via [HuggingFace](https://huggingface.co/datasets/rebase-energy/nve-windpower-data)
- **Scope**: 393 active turbines across 62 wind parks in Norway
- **Fields used**: latitude, longitude, park name, capacity (MW), municipality, county, turbine count
- **License**: NVE open data
- **Authentication**: none required

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
index.html              Main app (single file, no build)
fetch_data.py           Data fetching script (GBIF API)
data/
  birds_norway.json     Bird observations + species summary (964 KB)
  wind_turbines.json    Wind parks and turbines (99 KB)
  kommuner.geojson      Norwegian municipality boundaries (1.2 MB)
```

## Tech stack

- [Leaflet](https://leafletjs.com/) for the map
- [Leaflet.heat](https://github.com/Leaflet/Leaflet.heat) for the heatmap layer
- [CARTO dark basemap](https://carto.com/basemaps/) tiles
- Vanilla JS, no framework, no build step

## Scaling ideas

- Increase sample size or use GBIF bulk download (async, needs free account)
- ~~Add wind turbine locations from NVE~~ (done)
- Add bird tracking data from [Movebank](https://datarepository.movebank.org/) for flight altitude
- Use [Artsdatabanken Artskart](https://artskart.artsdatabanken.no/) API for red list species status
- Aggregate by kommune for choropleth "risk score" per municipality
- Computer vision layer: live camera feeds with bird detection models

## References

Artsdatabanken. (2021). *Norwegian Red List for Species 2021* (Rødlista for arter 2021). Norwegian Biodiversity Information Centre. https://artsdatabanken.no/rodlisteforarter2021/Artsgruppene/fugler

Band, W., Madders, M., & Whitfield, D.P. (2007). Developing field and analytical methods to assess avian collision risk at wind farms. In M. de Lucas, G.F.E. Janss, & M. Ferrer (Eds.), *Birds and Wind Farms: Risk Assessment and Mitigation* (pp. 259–275). Quercus.

CARTO. (n.d.). *CARTO Basemaps*. https://carto.com/basemaps/

GBIF.org. (2026). GBIF Occurrence Download. Global Biodiversity Information Facility. https://www.gbif.org/

Johnston, A., Cook, A.S.C.P., Wright, L.J., Humphreys, E.M., & Burton, N.H.K. (2014). Modelling flight heights of marine birds to more accurately assess collision risk with offshore wind turbines. *Journal of Applied Ecology*, 51(1), 31–41. https://doi.org/10.1111/1365-2664.12191

Kartverket. (2024). *Administrative boundaries of Norway* [GeoJSON]. Norwegian Mapping Authority. Redistributed via https://github.com/robhop/fylker-og-kommuner

NVE. (n.d.). *Norwegian wind power data*. Norwegian Water Resources and Energy Directorate. Redistributed via https://huggingface.co/datasets/rebase-energy/nve-windpower-data

OpenStreetMap contributors. (n.d.). *OpenStreetMap*. https://www.openstreetmap.org/

Scottish Natural Heritage. (n.d.). *Guidance on assessing collision risk between birds and onshore wind turbines*. NatureScot.

Agafonkin, V. (2023). *Leaflet: an open source JavaScript library for interactive maps* (Version 1.9.4) [Software]. https://leafletjs.com/

Agafonkin, V. (n.d.). *Leaflet.heat: a tiny, simple and fast heatmap plugin for Leaflet* (Version 0.2.0) [Software]. https://github.com/Leaflet/Leaflet.heat

## Team

| Name | Email | LinkedIn |
|------|-------|----------|
| Almaz Ermilov | Almaz.Ermilov@gmail.com | [linkedin.com/in/almazermilov](https://www.linkedin.com/in/almazermilov/) |
| Michael Bitney | michaelsb7@gmail.com | [linkedin.com/in/michael-bitney](https://www.linkedin.com/in/michael-bitney/) |
| Dmitri Kuzkin | himynameisroo@gmail.com | [linkedin.com/in/kuzkindmitriy](https://www.linkedin.com/in/kuzkindmitriy/) |
| Marian Øverli | marian.overli@gmail.com | [linkedin.com/in/marianhelcloverli](https://www.linkedin.com/in/marianhelcloverli/) |

## License

Data licenses as noted above. Code is MIT licensed.
