"""
Scraper des lignes de bus d'Abidjan (SOTRA, gbaka, woro-woro...) depuis
rues-cote-d-ivoire.openalfa.com.

Les données d'origine viennent d'OpenStreetMap (licence ODbL) : l'attribution
« © OpenStreetMap contributors » doit apparaître dans l'application.

Étapes (chaque étape est relançable, les résultats sont mis en cache sur disque) :
  1. discover : parcourt la page Abidjan + les pages des communes -> data/index.json
  2. lines    : télécharge chaque ligne (arrêts + tracé) -> data/lines/<id>.json
  3. build    : fusionne tout -> data/abidjan_bus.json

Usage :
  python scrape.py                     # tout (discover + lines + build)
  python scrape.py --limit 10          # test sur 10 lignes
  python scrape.py --ids 10291017 15800901
  python scrape.py discover | lines | build
"""

import argparse
import html
import json
import logging
import random
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import requests

BASE = "https://rues-cote-d-ivoire.openalfa.com"
CITY = "abidjan"
USER_AGENT = "QuelBusScraper/1.0 (+https://github.com/Tostenn/Quelbus)"

DATA_DIR = Path(__file__).parent / "data"
LINES_DIR = DATA_DIR / "lines"
INDEX_FILE = DATA_DIR / "index.json"
OUTPUT_FILE = DATA_DIR / "abidjan_bus.json"
ERRORS_FILE = DATA_DIR / "errors.json"

log = logging.getLogger("scraper")



class Fetcher:
    def __init__(self, delay: float, retries: int = 5):
        self.delay = delay
        self.retries = retries
        self.session = requests.Session()
        self.session.headers["User-Agent"] = USER_AGENT
        self._last = 0.0

    def get(self, path: str) -> str:
        url = BASE + quote(path, safe="/:")
        for attempt in range(1, self.retries + 1):
            # Délai poli entre deux requêtes (avec un peu d'aléatoire)
            wait = self.delay * random.uniform(0.8, 1.3) - (time.monotonic() - self._last)
            if wait > 0:
                time.sleep(wait)
            self._last = time.monotonic()
            try:
                r = self.session.get(url, timeout=30)
                if r.status_code == 200:
                    r.encoding = "utf-8"
                    return r.text
                if r.status_code == 404:
                    raise FileNotFoundError(url)
                log.warning("HTTP %s sur %s (essai %d)", r.status_code, url, attempt)
            except requests.RequestException as e:
                log.warning("Erreur réseau sur %s (essai %d) : %s", url, attempt, e)
            time.sleep(min(60, 2 ** attempt * 2))
        raise RuntimeError(f"Échec après {self.retries} essais : {url}")



LIST_TOKEN = re.compile(
    r"<h3>(?P<h3>.*?)</h3>"
    r"|<h4>(?P<h4>.*?)</h4>"
    r"|value='\{\"idx\":(?P<id>\d+)\}'.*?<a href='(?P<href>[^']+)'>(?P<name>.*?)</a>",
    re.S,
)
COMMUNE_LINK = re.compile(r'href="/([a-z0-9-]+)/lignes-de-bus"')
STOP = re.compile(
    r"value='\{\"idx\":(\d+),\"lat\":(-?[\d.]+),\"lon\":(-?[\d.]+)\}'>\s*\d+ - (.*?)<br/>",
    re.S,
)
H1 = re.compile(r"<h1>(.*?)</h1>", re.S)
ROAD = re.compile(r"var road_coords = (\[.*?\]);", re.S)


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s))).strip()


def parse_list_page(page: str) -> list[dict]:
    """Retourne les lignes listées sur une page '<commune>/lignes-de-bus'."""
    # On ne garde que le bloc principal (pas les liens vers les autres villes en bas)
    start = page.find('class="entry fix buslist"')
    end = page.find("adslot_bottom", start)
    page = page[start:end] if start != -1 else page

    out, category, operator = [], None, None
    for m in LIST_TOKEN.finditer(page):
        if m.group("h3") is not None:
            category, operator = clean(m.group("h3")) or None, None
        elif m.group("h4") is not None:
            operator = clean(m.group("h4")) or None
        else:
            out.append({
                "id": int(m.group("id")),
                "name": clean(m.group("name")),
                "path": html.unescape(m.group("href")),
                "category": category,
                "operator": operator,
            })
    return out


def parse_name(name: str) -> dict:
    """'bus 201 : Abobo PK18 → Hôtel de Ville' -> ref/from/to.

    Formats rencontrés : 'X : A → B', 'X: A - B', 'X : A -> B', 'divers A - B', 'Nom libre'.
    """
    prefix, sep, rest = name.partition(":")
    if not sep:
        prefix, rest = "", name
    # Le numéro de ligne est le dernier mot du préfixe s'il contient un chiffre ('bus 201', 'Bus 06')
    words = prefix.split()
    ref = words[-1] if words and any(ch.isdigit() for ch in words[-1]) else None

    parts = re.split(r"\s*(?:→|->)\s*", rest, maxsplit=1)
    if len(parts) < 2:
        parts = re.split(r"\s+-\s+", rest, maxsplit=1)
    if len(parts) < 2:
        return {"ref": ref, "from": None, "to": None}
    origin = re.sub(r"^divers\s+", "", parts[0].strip(), flags=re.I)
    return {"ref": ref, "from": origin or None, "to": parts[1].strip() or None}


def line_type(category: str | None, operator: str | None) -> str:
    """Type normalisé, plus fiable que le préfixe du nom (fautes de frappe : 'gkaka', 'wowro-woro')."""
    c = (category or "").lower()
    if "gbaka" in c:
        return "gbaka"
    if "woro" in c:
        return "woro-woro"
    if operator == "SOTRA":
        return "sotra"
    return "autre"


def parse_line_page(page: str) -> dict:
    h1 = H1.search(page)
    title = clean(h1.group(1)) if h1 else None
    stops = [
        {"order": int(i) + 1, "name": clean(n), "lat": float(lat), "lon": float(lon)}
        for i, lat, lon, n in STOP.findall(page)
    ]
    road = ROAD.search(page)
    geometry = json.loads(road.group(1)) if road else []
    return {"title": title, "stops": stops, "geometry": geometry}



def step_discover(f: Fetcher) -> dict:
    log.info("Découverte des lignes...")
    main = f.get(f"/{CITY}/lignes-de-bus")
    communes = sorted({c for c in COMMUNE_LINK.findall(main) if c != CITY})
    lines: dict[int, dict] = {}

    for slug, page in [(CITY, main)] + [(c, None) for c in communes]:
        page = page or f.get(f"/{slug}/lignes-de-bus")
        found = parse_list_page(page)
        for l in found:
            entry = lines.setdefault(l["id"], {**l, "communes": []})
            if slug != CITY and slug not in entry["communes"]:
                entry["communes"].append(slug)
            # La page Abidjan a parfois des catégories vides : compléter si possible
            for k in ("category", "operator"):
                if not entry[k] and l[k]:
                    entry[k] = l[k]
        log.info("  %-14s %4d lignes (total unique : %d)", slug, len(found), len(lines))

    index = {
        "scraped_at": now(),
        "communes": communes,
        "lines": sorted(lines.values(), key=lambda l: (l["category"] or "", l["name"])),
    }
    write_json(INDEX_FILE, index)
    log.info("%d lignes -> %s", len(lines), INDEX_FILE)
    return index


def step_lines(f: Fetcher, index: dict, limit: int | None, ids: list[int] | None, force: bool):
    LINES_DIR.mkdir(parents=True, exist_ok=True)
    todo = index["lines"]
    if ids:
        todo = [l for l in todo if l["id"] in set(ids)]
    if not force:
        todo = [l for l in todo if not (LINES_DIR / f"{l['id']}.json").exists()]
    if limit:
        todo = todo[:limit]

    log.info("%d lignes à télécharger", len(todo))
    errors = read_json(ERRORS_FILE, {})
    t0 = time.monotonic()
    for n, line in enumerate(todo, 1):
        try:
            detail = parse_line_page(f.get(line["path"]))
            if not detail["stops"] and not detail["geometry"]:
                raise ValueError("aucun arrêt ni tracé trouvé (format de page changé ?)")
            write_json(LINES_DIR / f"{line['id']}.json", {**line, **detail, "scraped_at": now()})
            errors.pop(str(line["id"]), None)
            log.info("[%d/%d] %s  (%d arrêts)", n, len(todo), line["name"], len(detail["stops"]))
        except Exception as e:  # on continue, la ligne sera retentée au prochain lancement
            errors[str(line["id"])] = {"path": line["path"], "error": str(e), "at": now()}
            log.error("[%d/%d] ÉCHEC %s : %s", n, len(todo), line["name"], e)
        if n % 25 == 0:
            write_json(ERRORS_FILE, errors)
            eta = (time.monotonic() - t0) / n * (len(todo) - n)
            log.info("--- progression %d/%d, reste ~%d min", n, len(todo), eta // 60)
    write_json(ERRORS_FILE, errors)
    if errors:
        log.warning("%d lignes en erreur (voir %s) — relancer le script pour les retenter", len(errors), ERRORS_FILE)


def step_build(index: dict):
    """Fusionne les fichiers par ligne en un JSON prêt à importer."""
    stops: dict[tuple, dict] = {}
    lines, missing = [], []

    for meta in index["lines"]:
        p = LINES_DIR / f"{meta['id']}.json"
        if not p.exists():
            missing.append(meta["id"])
            continue
        d = read_json(p)
        stop_ids = []
        for s in d["stops"]:
            key = (s["name"], round(s["lat"], 6), round(s["lon"], 6))
            if key not in stops:
                stops[key] = {"id": len(stops) + 1, "name": s["name"], "lat": s["lat"], "lon": s["lon"]}
            stop_ids.append(stops[key]["id"])
        lines.append({
            "id": d["id"],  # = id de relation OpenStreetMap
            "name": d["name"],
            "type": line_type(d["category"], d["operator"]),
            **parse_name(d["name"]),
            "category": d["category"],
            "operator": d["operator"],
            "communes": d["communes"],
            "source_url": BASE + d["path"],
            "stops": stop_ids,
            "geometry": d["geometry"],  # liste de segments [[lat, lon], ...]
        })

    out = {
        "source": BASE + f"/{CITY}/lignes-de-bus",
        "license": "ODbL — © OpenStreetMap contributors",
        "built_at": now(),
        "counts": {"lines": len(lines), "stops": len(stops), "missing": len(missing)},
        "stops": list(stops.values()),
        "lines": lines,
    }
    write_json(OUTPUT_FILE, out, indent=None)
    log.info("%d lignes, %d arrêts -> %s", len(lines), len(stops), OUTPUT_FILE)
    if missing:
        log.warning("%d lignes pas encore téléchargées", len(missing))



def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def read_json(p: Path, default=None):
    if not p.exists():
        return default
    return json.loads(p.read_text(encoding="utf-8"))


def write_json(p: Path, data, indent=2):
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=indent), encoding="utf-8")
    tmp.replace(p)  # écriture atomique : pas de fichier corrompu si on coupe le script


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("step", nargs="?", default="all", choices=["all", "discover", "lines", "build"])
    ap.add_argument("--limit", type=int, help="nombre max de lignes à télécharger")
    ap.add_argument("--ids", type=int, nargs="+", help="ids de lignes précis")
    ap.add_argument("--delay", type=float, default=1.5, help="secondes entre deux requêtes (défaut 1.5)")
    ap.add_argument("--force", action="store_true", help="re-télécharger même si déjà en cache")
    ap.add_argument("--rediscover", action="store_true", help="refaire la découverte même si index.json existe")
    args = ap.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-7s %(message)s",
        datefmt="%H:%M:%S",
        handlers=[logging.StreamHandler(sys.stdout), logging.FileHandler(DATA_DIR / "scrape.log", encoding="utf-8")],
    )
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    f = Fetcher(args.delay)
    index = read_json(INDEX_FILE)
    if args.step == "discover" or index is None or (args.rediscover and args.step == "all"):
        index = step_discover(f)
    if args.step in ("all", "lines"):
        step_lines(f, index, args.limit, args.ids, args.force)
    if args.step in ("all", "build"):
        step_build(index)


if __name__ == "__main__":
    main()
