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
import math
import os
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE_URL = "https://api.gbif.org/v1/occurrence/search"
API_TIMEOUT_SECONDS = 30
API_MAX_ATTEMPTS = 3
API_RETRY_BACKOFF_SECONDS = 0.5
OUTPUT_PATH = Path("data/birds_norway.json")


class GBIFRequestError(RuntimeError):
    """A GBIF response could not be fetched or decoded safely."""


def fetch_json(url):
    """Fetch a GBIF JSON object, retrying transient failures a bounded number of times."""
    for attempt in range(1, API_MAX_ATTEMPTS + 1):
        try:
            request = urllib.request.Request(url)
            with urllib.request.urlopen(request, timeout=API_TIMEOUT_SECONDS) as response:
                try:
                    data = json.loads(response.read().decode("utf-8"))
                except (UnicodeDecodeError, json.JSONDecodeError) as error:
                    raise GBIFRequestError("GBIF returned invalid JSON") from error
            if not isinstance(data, dict):
                raise GBIFRequestError("GBIF returned an unexpected JSON value")
            return data
        except urllib.error.HTTPError as error:
            retryable = error.code == 429 or 500 <= error.code < 600
            cause = error
            detail = f"HTTP {error.code}"
        except (urllib.error.URLError, TimeoutError) as error:
            retryable = True
            cause = error
            detail = str(getattr(error, "reason", error))

        if not retryable or attempt == API_MAX_ATTEMPTS:
            raise GBIFRequestError(
                f"GBIF request failed after {attempt} attempt(s): {detail}"
            ) from cause
        time.sleep(API_RETRY_BACKOFF_SECONDS * (2 ** (attempt - 1)))

    raise GBIFRequestError("GBIF request failed")


def valid_coordinate(value, minimum, maximum):
    """Return whether a GBIF coordinate is a finite numeric value in range."""
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return False
    try:
        return math.isfinite(value) and minimum <= value <= maximum
    except OverflowError:
        return False


def fetch_observations(limit_total=10000, page_size=300):
    """Fetch bird observations for Norway, spread evenly across months."""
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
            data = fetch_json(url)
            results = data.get("results")
            if not isinstance(results, list):
                raise GBIFRequestError("GBIF returned an invalid results list")
            if not results:
                break

            for record in results:
                if not isinstance(record, dict):
                    continue
                lat = record.get("decimalLatitude")
                lon = record.get("decimalLongitude")
                species = record.get("species")
                if (valid_coordinate(lat, -90, 90)
                        and valid_coordinate(lon, -180, 180)
                        and isinstance(species, str) and species.strip()):
                    month_records.append({
                        "lat": round(lat, 4),
                        "lon": round(lon, 4),
                        "species": species,
                        "month": month,
                        "county": record.get("stateProvince", ""),
                    })

            offset += page_size
            if data.get("endOfRecords"):
                break
            time.sleep(0.15)

        all_records.extend(month_records[:per_month])
        print(f"  Month {month}: {len(month_records[:per_month])} records")

    return all_records


def fetch_species_summary():
    """Get the top species and their occurrence counts."""
    url = f"{BASE_URL}?country=NO&classKey=212&limit=0&hasCoordinate=true&facet=speciesKey&facetLimit=30"
    data = fetch_json(url)
    facets = data.get("facets")
    if not isinstance(facets, list):
        raise GBIFRequestError("GBIF returned an invalid species summary")

    species_counts = []
    for facet in facets:
        counts = facet.get("counts") if isinstance(facet, dict) else None
        if not isinstance(counts, list):
            raise GBIFRequestError("GBIF returned an invalid species count list")
        for count in counts:
            if (
                not isinstance(count, dict)
                or not isinstance(count.get("name"), str)
                or not isinstance(count.get("count"), int)
            ):
                raise GBIFRequestError("GBIF returned an invalid species count")
            key = count["name"]
            species_url = f"https://api.gbif.org/v1/species/{key}"
            species_data = fetch_json(species_url)
            species_counts.append({
                "species": species_data.get("canonicalName", species_data.get("scientificName", "Unknown")),
                "count": count["count"],
            })
            time.sleep(0.1)

    return species_counts


def write_output_atomic(output, path=None):
    """Replace the existing snapshot only after the complete JSON is written."""
    destination = Path(path if path is not None else OUTPUT_PATH)
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        mode = destination.stat().st_mode & 0o777
    except FileNotFoundError:
        mode = 0o644

    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=destination.parent,
            prefix=f".{destination.name}.", suffix=".tmp", delete=False
        ) as temporary:
            temporary_path = temporary.name
            json.dump(output, temporary)
            temporary.write("\n")
            temporary.flush()
            os.fsync(temporary.fileno())
        os.chmod(temporary_path, mode)
        os.replace(temporary_path, destination)
    except BaseException:
        if temporary_path:
            try:
                os.unlink(temporary_path)
            except FileNotFoundError:
                pass
        raise


def main():
    print("=== Fetching bird observations for Norway ===")
    try:
        records = fetch_observations(limit_total=10000, page_size=300)
        print(f"Total records fetched: {len(records)}")

        species_set = set(record["species"] for record in records)
        print(f"Unique species: {len(species_set)}")

        print("\n=== Fetching top species summary ===")
        species_summary = fetch_species_summary()
    except GBIFRequestError as error:
        print(f"Error: {error}. The existing data snapshot was not changed.", file=sys.stderr)
        return 1

    for species in species_summary[:10]:
        print(f"  {species['species']}: {species['count']:,}")

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

    try:
        write_output_atomic(output)
    except OSError as error:
        print(f"Error: could not write {OUTPUT_PATH}: {error}", file=sys.stderr)
        return 1
    print(f"\nSaved to {OUTPUT_PATH} ({len(json.dumps(output)) / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
