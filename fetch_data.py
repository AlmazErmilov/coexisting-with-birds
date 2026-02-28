"""
Fetch bird observation data from GBIF API for Norway.

Source:  GBIF (Global Biodiversity Information Facility)
API:     https://api.gbif.org/v1/occurrence/search
Scope:   Norway, class Aves (birds), georeferenced records only
Auth:    none required for search endpoint
License: CC BY 4.0 / CC0 (varies per contributing dataset)

Output:  data/birds_norway.json
  - observations: list of {lat, lon, species, month, county}
  - species_summary: top 30 species with total observation counts
  - metadata: source info, sample size, license

Usage:
  python3 fetch_data.py

Adjust limit_total below to change sample size (default 10,000).
At 300 records per page with 0.2s delay, 10K takes about 1 minute.
"""
import json
import urllib.request
import urllib.parse
import time

BASE_URL = "https://api.gbif.org/v1/occurrence/search"

def fetch_observations(limit_total=10000, page_size=300):
    """Fetch bird observations from GBIF for Norway, spread evenly across months."""
    all_records = []
    per_month = limit_total // 12

    for month in range(1, 13):
        offset = 0
        month_records = []
        print(f"Fetching month {month}...")

        while len(month_records) < per_month:
            params = {
                "country": "NO",
                "classKey": 212,  # Aves (birds)
                "hasCoordinate": "true",
                "hasGeospatialIssue": "false",
                "month": month,
                "limit": page_size,
                "offset": offset,
            }
            url = f"{BASE_URL}?{urllib.parse.urlencode(params)}"

            req = urllib.request.Request(url)
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode())

            results = data.get("results", [])
            if not results:
                break

            for r in results:
                lat = r.get("decimalLatitude")
                lon = r.get("decimalLongitude")
                species = r.get("species")
                if lat and lon and species:
                    month_records.append({
                        "lat": round(lat, 4),
                        "lon": round(lon, 4),
                        "species": species,
                        "month": month,
                        "county": r.get("stateProvince", ""),
                    })

            offset += page_size
            if data.get("endOfRecords"):
                break
            time.sleep(0.15)

        all_records.extend(month_records[:per_month])
        print(f"  Month {month}: {len(month_records[:per_month])} records")

    return all_records


def fetch_species_summary():
    """Get top species with counts."""
    url = f"{BASE_URL}?country=NO&classKey=212&limit=0&hasCoordinate=true&facet=speciesKey&facetLimit=30"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())

    species_counts = []
    for facet in data.get("facets", []):
        for c in facet.get("counts", []):
            key = c["name"]
            count = c["count"]
            # resolve species name
            sp_url = f"https://api.gbif.org/v1/species/{key}"
            with urllib.request.urlopen(sp_url) as sp_resp:
                sp_data = json.loads(sp_resp.read().decode())
            species_counts.append({
                "species": sp_data.get("canonicalName", sp_data.get("scientificName", "Unknown")),
                "count": count,
            })
            time.sleep(0.1)

    return species_counts


def main():
    print("=== Fetching bird observations for Norway ===")
    records = fetch_observations(limit_total=10000, page_size=300)
    print(f"Total records fetched: {len(records)}")

    # Get unique species
    species_set = set(r["species"] for r in records)
    print(f"Unique species: {len(species_set)}")

    print("\n=== Fetching top species summary ===")
    species_summary = fetch_species_summary()
    for s in species_summary[:10]:
        print(f"  {s['species']}: {s['count']:,}")

    output = {
        "observations": records,
        "species_summary": species_summary,
        "metadata": {
            "source": "GBIF (Global Biodiversity Information Facility)",
            "country": "Norway",
            "class": "Aves (Birds)",
            "total_available": 33_700_000,
            "sample_size": len(records),
            "license": "CC BY 4.0 / CC0",
        }
    }

    out_path = "data/birds_norway.json"
    with open(out_path, "w") as f:
        json.dump(output, f)
    print(f"\nSaved to {out_path} ({len(json.dumps(output)) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
