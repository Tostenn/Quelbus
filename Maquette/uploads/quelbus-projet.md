# QuelBus — Quel bus SOTRA prendre à Abidjan ?

> Nom provisoire : **QuelBus** (à remplacer si besoin).
> Ce document sert de source unique pour (1) la maquette réalisée avec Claude Design et (2) l'implémentation progressive avec Claude Code.

---

## 1. Résumé

QuelBus est une application web en français qui répond à une question simple, posée tous les jours par des milliers d'Abidjanais :

> « Je suis ici, je veux aller là-bas. Quel bus SOTRA dois-je prendre ? »

L'utilisateur indique sa destination (par exemple « Mosquée d'Adjamé »). Sa position actuelle est détectée par le navigateur, ou saisie à la main. L'application affiche la liste des **lignes de bus SOTRA directes** qui :

1. passent à moins de **300 m** de sa position, **et**
2. passent à moins de **300 m** de la destination, **et**
3. vont **dans le bon sens** (l'arrêt de montée vient avant l'arrêt de descente sur le trajet).

## 2. Problème et contexte

- Le réseau SOTRA compte environ 70 lignes. Les itinéraires sont difficiles à mémoriser, et l'information est dispersée (affiches aux arrêts, site sotra.ci, application officielle jugée peu cohérente par certains utilisateurs).
- Les outils existants montrent les lignes une par une. Ils répondent mal à la question inverse : « Quelle ligne prendre pour aller à tel endroit depuis ici ? »
- Pas de temps réel ni d'horaires fiables dans ce projet. On répond uniquement à « quelle ligne », pas à « quand passe-t-elle ».

## 3. Périmètre

### Dans le MVP
- Bus SOTRA uniquement (pas de gbaka, woro-woro, bateau-bus, BHNS, métro).
- Recherche de lignes **directes** (sans correspondance).
- Position de départ : géolocalisation navigateur **ou** saisie manuelle.
- Destination : lieu-repère, arrêt ou quartier via autocomplétion.
- Rayon de marche par défaut de 300 m, réglable (300 / 500 / 800 m).
- Pages publiques indexables : lignes, arrêts, lieux-repères.

### Hors MVP (idées pour plus tard)
- Recherche avec une correspondance.
- Horaires ou temps réel.
- Autres modes de transport.
- Comptes utilisateurs, favoris.
- Signalement d'erreurs par les utilisateurs (prévu en version simple dans la phase 5).

## 4. Utilisateurs et scénarios

**Persona principal** : une personne qui se déplace à Abidjan, sur smartphone Android d'entrée ou de milieu de gamme, connexion mobile variable, qui ne connaît pas les numéros de bus pour un trajet donné.

**Scénario type** : Tosten est à Angré et veut aller à la mosquée d'Adjamé. Il ouvre le site, autorise la localisation, tape « mosquée adjamé », choisit la suggestion, et voit : « Ligne 81 — montez à *Pharmacie Angré* (120 m à pied), descendez à *Mosquée Adjamé* (40 m à pied), 25 arrêts. »

**Autres scénarios** :
- L'utilisateur refuse la localisation : il tape son point de départ.
- Aucune ligne directe : l'application élargit le rayon (proposition) et l'indique clairement.
- Un visiteur arrive depuis Google sur « Quel bus pour aller à la Mosquée d'Adjamé ? » : il voit directement les lignes concernées.

## 5. Règle de recherche (cœur métier)

**Entrées** : point de départ (lat, lng), destination (lat, lng), rayon R (défaut 300 m).

**Algorithme** (basé sur les *arrêts*, car c'est là qu'on monte et qu'on descend) :

1. `O` = arrêts à moins de R mètres du départ, avec leur distance à pied.
2. `D` = arrêts à moins de R mètres de la destination, avec leur distance à pied.
3. Chercher les *sens de ligne* (voir modèle de données) qui contiennent un arrêt `o ∈ O` et un arrêt `d ∈ D` avec `sequence(o) < sequence(d)`.
4. Pour chaque sens de ligne, garder la meilleure paire `(o, d)` : celle qui minimise `distance_à_pied(o) + distance_à_pied(d)`.
5. Trier les résultats par marche totale croissante, puis par nombre d'arrêts croissant.
6. Regrouper par numéro de ligne pour l'affichage.

**Sortie par résultat** : numéro de ligne, terminus (« Gare Nord → Terminus Angré »), arrêt de montée + distance à pied, arrêt de descente + distance à pied, nombre d'arrêts entre les deux.

**Esquisse SQL** :

```sql
SELECT so.direction_id, so.stop_id AS board_stop, sd.stop_id AS alight_stop,
       (sd.sequence - so.sequence) AS nb_stops
FROM direction_stops so
JOIN direction_stops sd
  ON sd.direction_id = so.direction_id
 AND sd.sequence > so.sequence
WHERE so.stop_id IN (:origin_stop_ids)
  AND sd.stop_id IN (:destination_stop_ids);
```

**Cas particuliers à traiter** :
- Aucun résultat : proposer R = 500 puis 800 m, et l'afficher honnêtement (« aucune ligne directe à 300 m »).
- Un sens de ligne circulaire (boucle) : gérer les deux ordres possibles.
- Départ et destination très proches (moins de R m) : message « vous pouvez y aller à pied ».

## 6. Données

### 6.1 Constat sur la source envisagée (openalfa)

La page d'une ligne sur `rues-cote-d-ivoire.openalfa.com` (exemple : ligne 81, Gare Nord → Terminus Angré, 31 arrêts) fournit la **liste ordonnée des noms d'arrêts**, mais **pas leurs coordonnées** dans le contenu de la page. Or le calcul « à moins de 300 m » exige des coordonnées. De plus, le site indique lui-même que ses données proviennent d'**OpenStreetMap** (© contributeurs OpenStreetMap), et l'identifiant de la page (`10238034`) ressemble à un identifiant de relation OSM.

**Décision recommandée** : utiliser **OpenStreetMap directement** via l'API **Overpass**, au lieu de scraper openalfa. On obtient ainsi les arrêts avec leurs coordonnées, l'ordre des arrêts, et des données ouvertes sous licence claire. Openalfa reste utile comme référence visuelle pour vérifier des lignes.

### 6.2 Import depuis OpenStreetMap

Requête Overpass de départ (à valider et à ajuster sur le terrain ; la boîte englobante couvre le Grand Abidjan) :

```
[out:json][timeout:180];
relation["type"="route"]["route"="bus"](5.15,-4.25,5.55,-3.75);
out geom;
```

Points à vérifier au premier import :
- Quels tags identifient une ligne SOTRA (`operator`, `network`, `ref`) ? Filtrer pour ne garder que la SOTRA. La page openalfa affiche « monbus » dans le titre, ce qui peut venir d'un tag `network` : à confirmer.
- Chaque relation liste ses membres (arrêts) dans l'ordre. Le rôle du membre (`stop`, `platform`, etc.) peut varier : gérer les deux.
- Les deux sens d'une ligne sont en général deux relations distinctes.
- Certaines relations peuvent être incomplètes ou obsolètes : prévoir un rapport d'import (lignes importées, ignorées, avec anomalies).

### 6.3 Commande d'import

- Commande Artisan : `php artisan transit:import` (télécharge, transforme, écrit en base dans une transaction).
- Idempotente : relancer l'import met à jour sans dupliquer (clé : identifiant OSM).
- Conserver l'identifiant OSM de chaque ligne et de chaque arrêt.
- Planifiable (par exemple mensuellement) une fois stable.

### 6.4 Licence et mentions obligatoires

Les données OSM sont sous licence **ODbL**. Afficher sur toutes les pages une mention visible : *« Données © contributeurs OpenStreetMap »*, avec lien vers openstreetmap.org/copyright. Ajouter aussi : *« Site indépendant, non affilié à la SOTRA. Les données peuvent être incomplètes ou dépassées. »*

## 7. Modèle de données

Base recommandée : **PostgreSQL + PostGIS** (requêtes de distance fiables et indexées). Alternative acceptable pour un MVP : MySQL 8 avec `ST_Distance_Sphere`. Le volume est faible (quelques milliers d'arrêts), donc un simple calcul Haversine avec boîte englobante suffit aussi.

| Table | Colonnes principales |
|---|---|
| `lines` | id, ref (ex. « 81 »), name, slug, operator, osm_ref |
| `line_directions` | id, line_id, name (ex. « Gare Nord → Terminus Angré »), origin_label, destination_label, osm_relation_id, is_loop |
| `stops` | id, name, slug, lat, lng, commune (nullable), osm_id |
| `direction_stops` | id, direction_id, stop_id, sequence (ordre dans le sens) |
| `places` | id, name, slug, type (mosquée, marché, hôpital, gare, carrefour, quartier…), lat, lng, commune, source (osm / manuel) |

Index : `direction_stops (direction_id, sequence)`, `direction_stops (stop_id)`, index spatial ou `(lat, lng)` sur `stops` et `places`.

`places` alimente l'autocomplétion et les pages « Aller à… ». Elle est remplie depuis OSM (mosquées, marchés, hôpitaux, gares routières, etc.) plus quelques ajouts manuels. **Le lieu « Mosquée d'Adjamé » doit être présent dès le départ** : c'est le cas d'usage de référence.

## 8. Stack technique

- **Laravel** (dernière version stable) + **Blade** (rendu serveur, pour un SEO naturel).
- **PostgreSQL** (+ PostGIS si possible).
- **Tailwind CSS** pour le style. **Alpine.js** pour les petites interactions (autocomplétion, bouton « Ma position »). Pas de framework JS lourd.
- **Leaflet** + tuiles OpenStreetMap pour les cartes, chargées seulement sur les pages qui en ont besoin.
- Tests avec **Pest** ou PHPUnit.
- Cache de pages publiques (par exemple `spatie/laravel-responsecache`), invalidé après chaque import.

**Principes** :
- Toute page utile est rendue côté serveur et lisible sans JavaScript.
- La recherche fonctionne en **GET** avec une URL partageable (ex. `/recherche?depart=…&arrivee=mosquee-adjame&rayon=300`).
- Le JavaScript sert uniquement à la géolocalisation, à l'autocomplétion et aux cartes.

## 9. Pages et routes

| Route | Contenu |
|---|---|
| `/` | Accueil : formulaire de recherche (départ + destination), lignes populaires, lieux populaires |
| `/recherche` | Résultats de la recherche (rendu serveur) |
| `/lignes` | Index de toutes les lignes SOTRA |
| `/lignes/{ref}-{slug}` | Fiche d'une ligne : sens, liste ordonnée des arrêts, carte |
| `/arrets/{slug}` | Fiche d'un arrêt : lignes qui y passent, lieux proches |
| `/aller-a/{lieu-slug}` | Page SEO « Quel bus pour aller à {lieu} ? » : lignes qui passent à moins de 300 m, arrêts les plus proches, carte |
| `/quartiers/{commune-slug}` | (optionnel) Lignes et lieux d'une commune |
| `/api/suggest?q=` | JSON pour l'autocomplétion (lieux + arrêts) |
| `/sitemap.xml`, `/robots.txt` | SEO technique |
| `/a-propos` | Sources de données, licence, avertissements, contact |

## 10. SEO

- Une page par ligne, par arrêt, et par lieu-repère, avec un `<title>` et une `meta description` uniques générés à partir des données. Exemple : « Quel bus pour aller à la Mosquée d'Adjamé ? Lignes SOTRA à Abidjan ».
- Éviter le contenu mince : chaque page doit avoir du contenu propre (liste d'arrêts, lignes proches, carte, petite FAQ générée).
- URLs propres, en français, sans accents dans les slugs. Balise `canonical` sur chaque page.
- Données structurées JSON-LD : `BreadcrumbList` partout, `FAQPage` sur les pages « Aller à… ».
- `sitemap.xml` généré automatiquement, `robots.txt`, balises Open Graph.
- Performance : rendu serveur, images minimales, CSS/JS légers, cartes chargées en différé. Cible : bon score mobile Core Web Vitals sur connexion 3G/4G.
- `lang="fr"` et `hreflang` inutile au MVP (site en français uniquement).

## 11. Brief pour Claude Design (maquette)

**À produire** : maquette **mobile-first** (puis adaptation desktop) en français.

**Ton et style** : clair, rassurant, rapide à lire en marchant dans la rue. Grande lisibilité, gros boutons, contraste élevé (utilisation en plein soleil). Pas de reproduction de la charte ou du logo de la SOTRA (site indépendant). Le numéro de ligne est l'élément visuel le plus important (grand badge).

**Écrans à concevoir** :

1. **Accueil** : titre court, deux champs (« Où êtes-vous ? » avec bouton « Utiliser ma position », et « Où allez-vous ? »), bouton principal « Trouver mon bus ». Dessous : lieux populaires (ex. Mosquée d'Adjamé, Gare Nord, Marché de Cocody…) et lignes populaires.
2. **Résultats** : résumé du trajet en haut. Liste de cartes, une par ligne : badge du numéro, sens (« Gare Nord → Terminus Angré »), « Montez à … (120 m à pied) », « Descendez à … (40 m à pied) », nombre d'arrêts. Un mini-plan repliable par carte. Sélecteur de rayon (300 / 500 / 800 m).
3. **Aucun résultat** : message honnête, proposition d'élargir le rayon, lien vers l'index des lignes.
4. **Fiche ligne** : badge, terminus, carte avec tracé, liste verticale des arrêts numérotés (style « métro »), arrêts de montée et de descente mis en évidence quand on vient d'une recherche.
5. **Page lieu (« Aller à… »)** : titre « Quel bus pour aller à … ? », lignes concernées, carte, FAQ courte.
6. **Index des lignes** : grille de badges numérotés, recherche par numéro.
7. **À propos** : sources, licence OSM, avertissement, non-affiliation SOTRA.

**États à prévoir** : chargement de la localisation, localisation refusée (saisie manuelle mise en avant), hors ligne / connexion lente, erreur.

**Contraintes** : pas d'éléments lourds (images plein écran, vidéos), composants simples réalisables en Tailwind, accessibilité de base (contrastes, tailles de police, libellés de champs).

## 12. Plan d'implémentation pour Claude Code

Travailler **phase par phase**. À la fin de chaque phase, les tests passent et le résultat est démontrable avant de passer à la suivante.

### Phase 0 — Socle
- Nouveau projet Laravel, PostgreSQL, Tailwind, Alpine, Pest.
- Layout Blade de base (en-tête, pied de page avec mentions OSM et non-affiliation).
- **Critère** : page d'accueil vide servie, tests qui tournent.

### Phase 1 — Modèle et import des données
- Migrations et modèles selon la section 7.
- Commande `transit:import` (section 6) avec rapport d'import.
- Seeders de lieux-repères, dont **Mosquée d'Adjamé**.
- **Critère** : après import, lignes, sens et arrêts ordonnés en base ; la ligne 81 est présente avec ses 31 arrêts dans l'ordre (Gare Nord → Terminus Angré) si les données OSM correspondent à la page openalfa de référence.

### Phase 2 — Moteur de recherche
- Service `RouteSearchService` implémentant la section 5.
- Tests unitaires, notamment :
  - un trajet valide renvoie la ligne attendue ;
  - le **sens** est respecté (l'ordre inverse ne renvoie pas le mauvais sens) ;
  - aucun résultat à 300 m, puis résultat à 500 m ;
  - départ et destination très proches.
- **Critère** : cas de référence « Gare Nord → Mosquée Adjamé » renvoie la ligne 81 (arrêt 1 vers arrêt 2), à confirmer avec les données réelles importées.

### Phase 3 — Interface de recherche
- Accueil, formulaire, `/recherche` en rendu serveur.
- Géolocalisation navigateur avec repli sur saisie manuelle.
- Autocomplétion `/api/suggest`.
- **Critère** : parcours complet fonctionnel sur mobile, aussi avec JavaScript désactivé (saisie manuelle).

### Phase 4 — Pages publiques et SEO
- Pages lignes, arrêts, `/aller-a/{lieu}`, index des lignes.
- Titres, descriptions, canonical, JSON-LD, sitemap, robots.txt, cache de pages.
- **Critère** : pages générées pour toutes les lignes importées, sitemap valide.

### Phase 5 — Finitions
- Cartes Leaflet sur les fiches.
- Bouton simple de signalement d'erreur (« Ce trajet est faux ? »).
- Page « À propos », gestion d'erreurs, page 404 utile.
- Déploiement, planification de l'import, vérification des performances mobiles.

### Règles de travail pour Claude Code
- Petits commits, un par étape logique. Ne pas commencer une phase avant que la précédente soit validée.
- Toute la logique métier de recherche vit dans un service testé, pas dans les contrôleurs ni les vues Blade.
- Ne pas ajouter de dépendance JavaScript lourde sans nécessité.
- Signaler toute hypothèse sur les données OSM plutôt que la masquer.

## 13. Risques et questions ouvertes

- **Qualité des données OSM** : lignes manquantes, arrêts mal placés ou mal ordonnés. À mesurer dès le premier import. Prévoir un rapport de qualité et une vérification manuelle des lignes principales.
- **Ordre des arrêts** : dépend de la façon dont les contributeurs ont saisi les relations. Vérifier ligne par ligne sur un échantillon.
- **Données SOTRA officielles** : tenter de les obtenir auprès de la SOTRA pour compléter ou corriger OSM (à explorer en parallèle, non bloquant).
- **Distance à pied** : le MVP utilise la distance à vol d'oiseau. Une distance réelle par la route (routage piéton) pourrait venir plus tard.
- **Précision GPS** : la géolocalisation navigateur est parfois imprécise en ville ; toujours permettre de corriger le point de départ.
- **Nom du produit** et nom de domaine : à décider.
