"""
Lignes SOTRA des villes de l'intérieur (Bouaké, Korhogo, San-Pédro, Yamoussoukro).

Aucun site ne publie les arrêts de ces lignes (OpenStreetMap n'a aucun tracé, voir PLAN.md).
On part donc du document officiel « Lignes et tarifs SOTRA », qui donne pour chaque ligne :
numéro, tarif, type et les deux terminus. Les terminus sont placés sur la carte avec
Nominatim (OpenStreetMap), puis corrigés à la main dans interior_terminus.json.

Une ligne dont un terminus n'a pas de position est gardée, mais sans arrêts : elle apparaît
dans la liste des lignes, pas dans la recherche.

Usage :
  python interior.py "../Lignes et tarifs SOTRA_Juillet 2024.pdf"
  python interior.py <pdf> --no-geocode     # ne garde que les positions déjà connues

Sortie : data/interior_bus.json, au même format que data/abidjan_bus.json, avec en plus
« city », « fare » et « fare_type » sur chaque sens de ligne.
"""

import argparse
import json
import re
import sys
import time
import unicodedata
from pathlib import Path

import requests
from pypdf import PdfReader

USER_AGENT = "QuelBusScraper/1.0 (+https://github.com/Tostenn/Quelbus)"
NOMINATIM = "https://nominatim.openstreetmap.org/search"

HERE = Path(__file__).parent
DATA_DIR = HERE / "data"
OUTPUT_FILE = DATA_DIR / "interior_bus.json"
CACHE_FILE = DATA_DIR / "geocode_cache.json"
# Positions relevées ou vérifiées à la main : prioritaires sur le géocodage
MANUAL_FILE = HERE / "interior_terminus.json"

# Nom tel qu'il apparaît dans le PDF -> ville. bbox : sud, ouest, nord, est
CITIES = {
    "Bouaké": {"slug": "bouake", "name": "Bouaké", "bbox": (7.60, -5.12, 7.78, -4.95)},
    "Korhogo": {"slug": "korhogo", "name": "Korhogo", "bbox": (9.38, -5.70, 9.53, -5.55)},
    "San Pedro": {"slug": "san-pedro", "name": "San-Pédro", "bbox": (4.70, -6.70, 4.82, -6.58)},
    "Yamoussoukro": {"slug": "yamoussoukro", "name": "Yamoussoukro", "bbox": (6.75, -5.35, 6.88, -5.20)},
}

LINE_RE = re.compile(r"^(\d{3})\s+(\d+)\s+([A-ZÉ]+)\s+(Terminus .+)$")


def parse_pdf(path: Path) -> list[dict]:
    """Lignes des villes de l'intérieur : {ref, fare, fare_type, city, ends: [nom, nom]}."""
    text = "\n".join(page.extract_text() for page in PdfReader(path).pages)
    city_names = "|".join(re.escape(c) for c in CITIES)
    end_re = re.compile(rf"Terminus\s+(.+?)\s+({city_names})(?=\s+Terminus|\s*$)")

    lines = []
    for raw in text.splitlines():
        match = LINE_RE.match(raw.strip())
        if not match:
            continue
        ref, fare, fare_type, rest = match.groups()
        ends = end_re.findall(rest)
        if len(ends) != 2 or ends[0][1] != ends[1][1]:
            continue  # ligne d'Abidjan, ou terminus mal découpés
        lines.append({
            "ref": ref,
            "fare": int(fare),
            "fare_type": fare_type,
            "city": ends[0][1],
            "ends": [clean_name(ends[0][0]), clean_name(ends[1][0])],
        })
    return lines


def clean_name(name: str) -> str:
    name = re.sub(r"\s+", " ", name).strip()
    return name[0].upper() + name[1:]


def ascii_key(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


class Geocoder:
    def __init__(self, enabled: bool):
        self.enabled = enabled
        self.manual = load_json(MANUAL_FILE, {})
        self.cache = load_json(CACHE_FILE, {})
        self.session = requests.Session()
        self.session.headers["User-Agent"] = USER_AGENT
        self._last = 0.0

    def locate(self, city: dict, name: str) -> dict | None:
        """{lat, lon, source} ou None si introuvable."""
        manual = self.manual.get(city["slug"], {}).get(name)
        if manual and manual.get("lat") is not None:
            return {"lat": manual["lat"], "lon": manual["lon"], "source": "verifie" if manual.get("verifie") else "manuel"}

        key = f"{city['slug']}|{ascii_key(name)}"
        if key not in self.cache and self.enabled:
            self.cache[key] = self._search(city, name)
            save_json(CACHE_FILE, self.cache)
        found = self.cache.get(key)
        return {**found, "source": "nominatim"} if found else None

    def _search(self, city: dict, name: str) -> dict | None:
        south, west, north, east = city["bbox"]
        # « Quartier Résidentiel » est trop vague : on essaie le nom complet puis sans les mots génériques
        queries = [name, re.sub(r"^(Quartier|Cité|Base|nouveau)\s+", "", name, flags=re.I)]
        for query in dict.fromkeys(queries):
            wait = 1.1 - (time.monotonic() - self._last)  # 1 requête/s maximum (règles Nominatim)
            if wait > 0:
                time.sleep(wait)
            self._last = time.monotonic()
            response = self.session.get(NOMINATIM, params={
                "q": f"{query}, {city['name']}, Côte d'Ivoire",
                "format": "jsonv2",
                "limit": 1,
                "countrycodes": "ci",
                "viewbox": f"{west},{north},{east},{south}",
                "bounded": 1,
            }, timeout=30)
            response.raise_for_status()
            results = response.json()
            if results:
                hit = results[0]
                return {"lat": round(float(hit["lat"]), 6), "lon": round(float(hit["lon"]), 6),
                        "label": hit.get("display_name", "")}
        return None


def build(parsed: list[dict], geocoder: Geocoder) -> dict:
    stops: dict[tuple, dict] = {}
    entries = []
    unplaced = []

    for line in parsed:
        city = CITIES[line["city"]]
        names = [f"Terminus {end}" for end in line["ends"]]
        places = [geocoder.locate(city, end) for end in line["ends"]]
        for end, place in zip(line["ends"], places):
            if place is None:
                unplaced.append(f"{city['name']} : {end} (ligne {line['ref']})")

        stop_ids = []
        if all(places):
            for name, place in zip(names, places):
                key = (name, place["lat"], place["lon"])
                if key not in stops:
                    stops[key] = {"id": len(stops) + 1, "name": name, "lat": place["lat"], "lon": place["lon"],
                                  "city": city["slug"], "verified": place["source"] == "verifie"}
                stop_ids.append(stops[key]["id"])

        for sens, (a, b) in (("aller", (0, 1)), ("retour", (1, 0))):
            entries.append({
                "id": f"sotra-pdf:{line['ref']}:{sens}",
                "name": f"bus {line['ref']} : {line['ends'][a]} → {line['ends'][b]}",
                "type": "sotra",
                "ref": line["ref"],
                "from": line["ends"][a],
                "to": line["ends"][b],
                "category": line["fare_type"].lower(),
                "operator": "SOTRA",
                "city": city["slug"],
                "fare": line["fare"],
                "fare_type": line["fare_type"],
                "source_url": None,
                "stops": [stop_ids[a], stop_ids[b]] if stop_ids else [],
                "geometry": None,
                # Seuls les terminus sont connus : arrêts intermédiaires et tracé à relever
                "partial": True,
            })

    return {
        "source": "SOTRA, « Lignes et tarifs », édition de juillet 2024",
        "counts": {"lines": len(entries), "stops": len(stops), "missing": 0, "unplaced": len(unplaced)},
        "cities": [{"slug": c["slug"], "name": c["name"], "bbox": c["bbox"]} for c in CITIES.values()],
        "stops": list(stops.values()),
        "lines": entries,
        "unplaced": unplaced,
    }


def load_json(path: Path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--no-geocode", action="store_true", help="ne pas interroger Nominatim")
    args = parser.parse_args()

    parsed = parse_pdf(args.pdf)
    if not parsed:
        print("Aucune ligne de l'intérieur trouvée dans le PDF.", file=sys.stderr)
        return 1

    data = build(parsed, Geocoder(enabled=not args.no_geocode))
    save_json(OUTPUT_FILE, data)

    by_city: dict[str, int] = {}
    for line in parsed:
        by_city[line["city"]] = by_city.get(line["city"], 0) + 1
    print(", ".join(f"{city} : {n} lignes" for city, n in by_city.items()))
    print(f"{data['counts']['stops']} terminus placés, {len(data['unplaced'])} sans position :")
    for item in data["unplaced"]:
        print(f"  - {item}")
    print(f"-> {OUTPUT_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
