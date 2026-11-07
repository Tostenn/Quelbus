# Scraper des lignes de bus d'Abidjan

Récupère les 1234 lignes d'Abidjan (SOTRA, gbaka, woro-woro) depuis
[rues-cote-d-ivoire.openalfa.com](https://rues-cote-d-ivoire.openalfa.com/abidjan/lignes-de-bus) :
arrêts ordonnés avec coordonnées GPS, et tracé de chaque ligne.

> Les données viennent d'OpenStreetMap (licence ODbL). Il faut afficher
> « © OpenStreetMap contributors » dans l'application.

## Lancer

```bash
pip install -r requirements.txt
python scrape.py                # tout : découverte + téléchargement + build (~35-45 min)
python scrape.py --limit 10     # test sur 10 lignes
python scrape.py build          # régénère seulement le JSON final
```

Le script peut être **coupé et relancé à tout moment** : chaque ligne est mise en cache
dans `data/lines/<id>.json`, les lignes déjà téléchargées sont ignorées et les erreurs
(`data/errors.json`) sont retentées au lancement suivant.

Options : `--delay 1.5` (secondes entre requêtes), `--force` (tout re-télécharger),
`--rediscover` (rafraîchir la liste des lignes), `--ids 10291017 ...`.

## Sortie : `data/abidjan_bus.json`

```jsonc
{
  "counts": { "lines": 1234, "stops": 0, "missing": 0 },
  "stops": [ { "id": 1, "name": "Gare Nord", "lat": 5.3589, "lon": -4.0282 } ],
  "lines": [{
    "id": 10291017,               // id de relation OpenStreetMap
    "name": "bus 201 : Abobo PK18 → Hôtel de Ville",
    "type": "sotra",              // sotra | gbaka | woro-woro | autre
    "ref": "201",                 // numéro (null pour gbaka / woro-woro)
    "from": "Abobo PK18", "to": "Hôtel de Ville",
    "category": "Express",        // catégorie du site (monbus, Gbaka d'Adjamé, ...)
    "operator": "SOTRA",          // SOTRA ou "divers"
    "communes": [],
    "source_url": "...",
    "stops": [11, 12, 13],        // ids d'arrêts, dans l'ordre du trajet
    "geometry": [[[5.4434, -4.0484], ...]]  // segments de [lat, lon]
  }]
}
```

Les arrêts identiques (même nom + mêmes coordonnées) sont dédupliqués et partagés
entre lignes. Chaque sens d'une ligne est une ligne distincte (A → B et B → A).

## Villes de l'intérieur : `interior.py`

OpenStreetMap n'a aucun tracé de bus à Bouaké, Korhogo, San-Pédro ni Yamoussoukro. On part du
document SOTRA « Lignes et tarifs » (numéro, tarif, type, deux terminus), et on place les terminus
avec Nominatim.

```bash
python interior.py "../Lignes et tarifs SOTRA_Juillet 2024.pdf"
python interior.py <pdf> --no-geocode   # sans appel réseau (cache + corrections)
```

- Sortie : `data/interior_bus.json`, même format qu'`abidjan_bus.json`, avec `city`, `fare`,
  `fare_type` et `partial: true` sur chaque sens (seuls les terminus sont connus).
- Corrections à la main : `interior_terminus.json` (prioritaire sur Nominatim). Une ligne dont un
  terminus n'a pas de position est importée sans arrêts.
- Import : `php artisan transit:import ../scraper/data/interior_bus.json` (`--prune` ne touche
  qu'aux villes du fichier).

## Villes de l'intérieur : `interior.py`

OpenStreetMap n'a aucun tracé de bus à Bouaké, Korhogo, San-Pédro ni Yamoussoukro. On part du
document SOTRA « Lignes et tarifs » (numéro, tarif, type, deux terminus), et on place les terminus
avec Nominatim.

```bash
python interior.py "../Lignes et tarifs SOTRA_Juillet 2024.pdf"
python interior.py <pdf> --no-geocode   # sans appel réseau (cache + corrections)
```

- Sortie : `data/interior_bus.json`, même format qu'`abidjan_bus.json`, avec `city`, `fare`,
  `fare_type` et `partial: true` sur chaque sens (seuls les terminus sont connus).
- Corrections à la main : `interior_terminus.json`, prioritaire sur Nominatim. Une ligne dont un
  terminus n'a pas de position est importée sans arrêts.
- Import : `php artisan transit:import ../scraper/data/interior_bus.json` (`--prune` ne touche
  qu'aux villes du fichier).
