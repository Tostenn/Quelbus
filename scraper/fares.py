"""
Tarifs et horaires des lignes SOTRA, pour `php artisan transit:fares`.

- Tarifs : document SOTRA « Lignes et tarifs » (numéro, tarif, type), pages d'Abidjan et de l'intérieur.
- Horaires : tableur des premiers et derniers départs relevés (articles de presse, document SOTRA),
  une ligne par sens.

Usage :
  python fares.py "../Lignes et tarifs SOTRA_Juillet 2024.pdf" "../horaires_sotra_avec_prix_liens_copiables (1).xlsx"

Sortie : data/fares.json
"""

import argparse
import json
import re
import sys
from pathlib import Path

from openpyxl import load_workbook
from pypdf import PdfReader

from interior import CITIES, parse_pdf as parse_interior

HERE = Path(__file__).parent
OUTPUT_FILE = HERE / "data" / "fares.json"
FARE_TYPES = "MONBUS|URBAIN|MARCHE|WIBUS|EXPRESS|NAVETTE|MONBATO"
ROW_RE = re.compile(rf"^(\d{{2,3}})\s+(\d+)\s+({FARE_TYPES})\b", re.M)

# « Non spécifié » et assimilés : la source ne distingue pas les jours
DAYS = {"semaine": "semaine", "lundi": "semaine", "samedi": "samedi", "dimanche": "dimanche", "férié": "dimanche"}


def parse_fares(pdf: Path) -> list[dict]:
    pages = PdfReader(pdf).pages
    interior = {line["ref"]: line for line in parse_interior(pdf)}
    fares, seen = [], set()
    for page in pages:
        for ref, fare, fare_type in ROW_RE.findall(page.extract_text()):
            ref = ref.lstrip("0") or "0"
            if ref in seen:
                continue
            seen.add(ref)
            city = CITIES[interior[ref]["city"]]["slug"] if ref in interior else "abidjan"
            fares.append({"city": city, "ref": ref, "fare": int(fare), "fare_type": fare_type})
    return fares


def parse_schedules(xlsx: Path) -> list[dict]:
    sheet = load_workbook(xlsx, read_only=True).active
    rows = sheet.iter_rows(values_only=True)
    header = [str(h or "").strip().lower() for h in next(rows)]

    def col(*names):
        return next(i for i, h in enumerate(header) if any(n in h for n in names))

    ref_i, dir_i, first_i, last_i = col("numéro", "numero"), col("sens"), col("premier"), col("dernier")
    days_i, src_i, url_i = col("jours"), col("source /", "vérification"), col("url")

    schedules = []
    for row in rows:
        if not row or row[ref_i] is None:
            continue
        sens = str(row[dir_i] or "")
        # « Aller (Koweït Résidentiel -> Liberté Adjamé) » -> « Koweït Résidentiel -> Liberté Adjamé »
        inner = re.search(r"\((.+)\)", sens)
        days_text = str(row[days_i] or "").lower()
        schedules.append({
            "city": "abidjan",
            "ref": str(row[ref_i]).strip().lstrip("0"),
            "direction": (inner.group(1) if inner else sens).strip(),
            "first_departure": time_text(row[first_i]),
            "last_departure": time_text(row[last_i]),
            "day_type": next((v for k, v in DAYS.items() if k in days_text), "tous"),
            "source": str(row[src_i] or "").strip() or None,
            "source_url": str(row[url_i] or "").strip() or None,
        })
    return schedules


def time_text(value) -> str:
    """« 5:00 », datetime.time ou « 05:00 » -> « 05:00 »."""
    if hasattr(value, "strftime"):
        return value.strftime("%H:%M")
    hours, minutes = str(value).strip().replace("h", ":").split(":")[:2]
    return f"{int(hours):02d}:{int(minutes or 0):02d}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("xlsx", type=Path, nargs="?")
    args = parser.parse_args()

    data = {
        "source": "SOTRA, « Lignes et tarifs », édition de juillet 2024",
        "fares": parse_fares(args.pdf),
        "schedules": parse_schedules(args.xlsx) if args.xlsx else [],
    }
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    by_city: dict[str, int] = {}
    for fare in data["fares"]:
        by_city[fare["city"]] = by_city.get(fare["city"], 0) + 1
    print("Tarifs : " + ", ".join(f"{c} {n}" for c, n in by_city.items()))
    print(f"Horaires : {len(data['schedules'])} sens")
    print(f"-> {OUTPUT_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
