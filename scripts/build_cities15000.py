#!/usr/bin/env python3

import csv
import io
import json
import sys
import zipfile
from pathlib import Path


def normalize(value: str) -> str:
    return " ".join(value.strip().lower().split())


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: build_cities15000.py <cities15000.zip> <output.json>", file=sys.stderr)
        return 1

    source_zip = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    with zipfile.ZipFile(source_zip) as archive:
      source_name = next(name for name in archive.namelist() if name.endswith(".txt"))
      with archive.open(source_name) as handle:
        reader = csv.reader(io.TextIOWrapper(handle, encoding="utf-8"), delimiter="\t")
        deduped = {}

        for row in reader:
            if len(row) < 18:
                continue

            feature_class = row[6]
            name = row[1].strip()
            ascii_name = row[2].strip()
            latitude_raw = row[4].strip()
            longitude_raw = row[5].strip()
            country_code = row[8].strip()
            population_raw = row[14].strip()
            time_zone = row[17].strip()

            if feature_class != "P" or not name or not time_zone:
                continue

            try:
                latitude = float(latitude_raw)
                longitude = float(longitude_raw)
            except ValueError:
                continue

            population = int(population_raw or "0")
            key = (normalize(name), time_zone)
            previous = deduped.get(key)
            if previous and previous["population"] >= population:
                continue

            deduped[key] = {
                "label": name,
                "ascii": ascii_name if normalize(ascii_name) != normalize(name) else "",
                "timeZone": time_zone,
                "countryCode": country_code,
                "population": population,
                "lat": round(latitude, 4),
                "lon": round(longitude, 4),
            }

    cities = sorted(
        deduped.values(),
        key=lambda item: (-item["population"], item["label"], item["timeZone"])
    )

    compact = {
        "source": "GeoNames cities15000",
        "count": len(cities),
        "cities": [
            [
                city["label"],
                city["ascii"],
                city["timeZone"],
                city["countryCode"],
                city["population"],
                city["lat"],
                city["lon"],
            ]
            for city in cities
        ]
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(compact, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8"
    )
    print(f"Wrote {len(cities)} cities to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
