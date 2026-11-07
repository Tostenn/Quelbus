# QuelBus : plan de travail

> Plan suivi pas à pas. On coche au fur et à mesure, on note les décisions dans la section du lot concerné.
> Ordre : **1 → 2 → 3 → 4**. Chaque lot est livrable seul (migration + API + front + tests), puis une PR.
>
> Une **app mobile** est prévue une fois le back terminé : c'est elle qui enverra la position en arrière-plan. L'API du lot 3 doit être pensée pour elle dès le départ (envoi par lots, reprise après coupure réseau).

| Lot | Sujet | Dépend de |
|---|---|---|
| 1 | Lignes des villes de l'intérieur (Bouaké, Korhogo, San-Pédro, Yamoussoukro) | — |
| 2 | Horaires, tarifs, carte étudiant (modifiables dans le tableau de bord) | 1 (notion de ville) |
| 3 | Position des bus en temps réel, partagée par les voyageurs | 1 |
| 4 | Prédiction de l'arrivée des prochains bus à un arrêt | 2, 3 |

---

## Lot 1 : villes de l'intérieur

### Ce qu'on sait (recherche du 07/11/2026)

**Ce qu'on a :** le PDF SOTRA de juillet 2024 donne pour chaque ligne : numéro, tarif, type, terminus 1, terminus 2.

| Ville | Lignes | Tarif |
|---|---|---|
| Bouaké | 301, 302, 303, 304, 305, 307, 308, 309 | 200 F (MONBUS) |
| Korhogo | 371 à 377 | 200 F |
| San-Pédro | 351 à 354 | 200 F |
| Yamoussoukro | 331, 332, 333, 335, 336 | 200 F |

**Ce qui manque :** les arrêts intermédiaires, leurs coordonnées GPS et le tracé des lignes.

**Sources vérifiées :**

| Source | Résultat |
|---|---|
| OpenStreetMap (Overpass) | **Aucune** relation `route=bus` dans les 4 villes. Seulement des arrêts isolés : 16 à Bouaké, 37 à Yamoussoukro, 0 à Korhogo et San-Pédro |
| openalfa.com (notre source pour Abidjan) | Page Bouaké vide. Normal : le site reprend OSM |
| sotra.ci | Site en maintenance, renvoie vers la page Facebook |
| Moovit | Pas de couverture trouvée pour ces villes. Et ses conditions d'utilisation interdisent le scraping |
| Presse (afrique-sur7, Koaci, Fratmat, Connectionivoirienne) | Quelques quartiers desservis, dates de lancement, tarifs (200 F, abonnement élève 3 000 F/mois, fonctionnaire 7 500 F/mois à Bouaké). Pas d'arrêts |
| Page Facebook SOTRA | Annonces de lignes avec parfois des itinéraires en image. Pas de données structurées ; scraping contraire aux conditions de Facebook |

**Conclusion : aucun site ne donne les arrêts de ces villes, il n'y a rien à scraper.** Il faut produire la donnée. Approche retenue, en trois couches :

1. **Squelette depuis le PDF** : lignes et terminus, terminus géocodés (Nominatim + correction à la main). La ligne existe dans l'app, avec ses deux terminus, sans arrêts intermédiaires.
2. **Saisie dans le tableau de bord** : un éditeur de ligne sur carte (poser les arrêts dans l'ordre, tracer le chemin). On s'aide des articles de presse et des affiches.
3. **Traces des voyageurs** (lot 3) : quand des gens partagent leur position dans un bus d'une ligne sans tracé, on agrège les traces pour proposer le tracé et les arrêts (points où le bus s'arrête souvent). L'admin valide.

Bonus : verser les tracés validés dans OpenStreetMap (licence ODbL compatible), ce qui profite à tout le monde.

### Tâches

- [x] Vérifier qu'aucune ligne d'Abidjan n'a les numéros 301-377 : aucune collision parmi les 112 numéros SOTRA d'Abidjan. Une clé avec la ville reste plus sûre pour les futures lignes
- [x] Migration : table `cities` (nom, slug, emprise) et `city_id` sur `lines` et `stops` ; Abidjan pour l'existant
- [x] Clé de ligne : on garde `sotra:<ref>` pour Abidjan (clés existantes inchangées), `<ville>:sotra:<ref>` ailleurs
- [x] Sens de ligne : `external_id` (« osm:… », « sotra-pdf:301:aller ») remplace `osm_relation_id` comme clé d'import ; `is_partial` marque les sens dont on ne connaît que les terminus
- [x] Script `scraper/interior.py` : lit le PDF (`pypdf`), sort `data/interior_bus.json` (même format qu'Abidjan + ville, tarif, type)
- [x] Géocodage des terminus (Nominatim, 1 req/s) + corrections à la main dans `scraper/interior_terminus.json` : 25 terminus placés (au quartier près), 13 sans position
- [x] Importer : villes, lignes sans arrêts, `--prune` limité aux villes du fichier
- [x] API : `/cities` ; ville dans `/lines`, `/lines/{slug}`, `/stops/{slug}` ; filtre `?city=` sur `/lines` et `/suggest`. La recherche et l'arrêt le plus proche marchent déjà par coordonnées, donc ville par ville
- [x] Front : page Lignes par ville ; positions acceptées dans toutes les villes couvertes (plus seulement Abidjan)
- [x] Front : avis « terminus seulement, arrêts en cours de relevé » sur la fiche ligne
- [ ] Importer `interior_bus.json` en production : `php artisan transit:import ../scraper/data/interior_bus.json`
- [ ] Compléter les 13 terminus sans position : Tchelekro, Kahankro, CIDT, Corridor Sud, Tolakouadiokro (Bouaké) ; Katiofi, Torgokaha (Korhogo) ; Mosquée de la cité (San-Pédro)
- [x] Front : choix de la ville dans le formulaire de recherche (gardé d'une visite à l'autre, changé tout seul par « Utiliser ma position »), autocomplétion limitée à cette ville
- [ ] Front : textes « à Abidjan » de l'accueil et des partages (à réécrire quand les lignes de l'intérieur seront en ligne)
- [x] Admin : onglet « Lignes », éditeur des arrêts d'un sens sur carte (ajouter, déplacer, renommer, ordonner, reprendre l'autre sens inversé, marquer « complet »). `PUT /api/admin/directions/{id}/stops`
- [x] Import : un sens modifié dans le tableau de bord n'est plus écrasé ni purgé (`edited_at`, `edited_by`)
- [ ] Admin : tracé du chemin entre les arrêts (pour l'instant une ligne droite d'arrêt en arrêt ; viendra des traces des voyageurs, lot 3)
- [x] Tests : import des lignes de l'intérieur, purge par ville, filtre par ville

---

## Lot 2 : horaires, tarifs, carte étudiant

### Données de départ

- PDF juillet 2024 : tarif et type de toutes les lignes (MONBUS 200, URBAIN 200, MARCHE 200, WIBUS 300, NAVETTE 500, EXPRESS 500, MONBATO 150).
- `horaires_sotra_avec_prix_liens_copiables (1).xlsx` : premier et dernier départ par sens pour 10 lignes (11, 13, 25, 39, 50, 603, 604, 712, 715, 716), avec la source (Linfodrome, document SOTRA).
- Source à suivre pour les horaires : les articles « infos pratiques » de Linfodrome (premiers départs, derniers passages). Récupération article par article, pas de scraping massif.

### Tâches

- [x] Migration `lines` : `fare` (FCFA), `fare_type` (MONBUS, WIBUS…), `accepts_student_card` (null = inconnu), `fare_edited_at`
- [x] Migration `line_schedules` : sens, type de jour (tous / semaine / samedi / dimanche-férié), premier et dernier départ, source, lien, date du relevé, admin qui l'a saisi
- [x] Migration `transit_changes` : historique des modifications du tableau de bord (tarif, horaires, arrêts)
- [x] Script `scraper/fares.py` (PDF + tableur) et commande `php artisan transit:fares` : 132 tarifs et 22 horaires importés sur la base de dev
- [x] Rattachement des horaires au bon sens par les noms des terminus ; « à vérifier » quand un seul terminus correspond
- [x] L'import n'écrase jamais un tarif ou des horaires saisis dans le tableau de bord
- [x] Admin : tarif, type, carte étudiant ; horaires par sens et type de jour ; historique (qui, quand, quoi)
- [x] API : tarif, carte étudiant et horaires dans `/lines`, `/lines/{slug}` et les résultats de `/search` (directs et correspondances)
- [x] Front : prix et carte étudiant sur les résultats et la fiche ligne
- [x] Front : départs du terminus sur la fiche ligne, avec l'état du service à l'heure d'Abidjan (pas commencé / en service / plus de départ)
- [x] Trajet avec correspondance : prix total quand le prix de chaque ligne est connu
- [x] Tests
- [x] Carte étudiant : commande `php artisan transit:student-cards` (2 chiffres : oui, 3 chiffres : non ; exceptions avec `--refuse=` et `--accept=`, aperçu avec `--dry-run`)
- [ ] Carte étudiant : lancer la commande en production avec la liste des exceptions
- [ ] 23 lignes du PDF absentes des données OpenStreetMap (9, 65, 88, 98, 405 à 408, 412, 501 à 503, 600, 618, 623, 632, 633, 730 à 733, 776) : à créer, avec les lignes 603 et 604
- [ ] Vérifier les 4 horaires rattachés sur un seul terminus (lignes 50 et 715)
- [ ] Jours fériés : comptés comme des jours de semaine pour l'instant (pas de calendrier)

---

## Lot 3 : position des bus en temps réel

Principe : un voyageur appuie sur **« Je suis dans le bus »**, choisit ligne et sens (ou on les propose depuis sa recherche), et sa position est envoyée tant qu'il est à bord. Règles de vie privée de [VISION.md](VISION.md) : consentement, voyage anonyme, début et fin coupés, on garde des passages aux arrêts, pas des traces.

### Choix techniques

- **Transport des positions** : envoi HTTP par lots toutes les 15 s (jusqu'à 120 points, renvoi sans risque après une coupure : les doublons sont ignorés). Les autres usagers interrogent `/lines/{slug}/live` toutes les 20 s. Laravel Reverb si la charge le justifie.
- **Trajet de référence** : les arrêts du sens reliés en ligne droite (toujours ordonnés, contrairement aux tracés OSM). Écart toléré 250 m, 2,5 km pour une ligne dont on n'a que les terminus.
- **Stockage** : dernière position sur le voyage (`trips`), passages aux arrêts gardés (`stop_passages`), points bruts (`trip_points`) effacés après 2 h, ou 30 jours pour une ligne sans tracé (pour le dessiner).
- **Arrière-plan** : un site web ne peut pas envoyer la position écran éteint de façon fiable. Sur le site : écran allumé (Wake Lock API). L'app mobile, prévue après le back, prendra le relais pour l'envoi en arrière-plan.

### Tâches

- [x] Migrations `trips` (id UUID, jeton haché, statut, avancement), `stop_passages`, `trip_points`
- [x] API `POST /trips`, `POST /trips/{id}/positions` (en-tête `X-Trip-Token`), `POST /trips/{id}/end`, limites de débit. Même API pour le site et l'app (`client: web | app`)
- [x] Filtrage : précision GPS (> 150 m écarté), vitesse plausible (fenêtre de recherche), écart au trajet ; 8 points hors ligne d'affilée : voyage marqué « hors ligne »
- [x] Calage sur la ligne, passage à chaque arrêt avec heure interpolée, temps passé à l'arrêt, terminus atteint : voyage terminé
- [x] Vie privée : 300 premiers et derniers mètres effacés à la fin du voyage ; position publique ramenée sur le trajet
- [x] Commande planifiée `transit:trips-cleanup` (toutes les 5 min) : voyages silencieux depuis 10 min terminés, points bruts effacés
- [x] API `GET /lines/{slug}/live` : bus en cours, voyageurs du même bus regroupés (moins de 200 m sur le même sens), dernier arrêt passé, arrêt suivant, fraîcheur
- [x] Front : « Je suis dans ce bus » sur la fiche ligne (consentement par le bouton, écran maintenu allumé, envoi par lots, reprise après coupure, arrêt)
- [x] Front : bus en direct sur la carte et dans la liste de la fiche ligne
- [x] Tests
- [ ] Front : bus en approche sur la fiche arrêt (avec le lot 4)
- [ ] Admin : proposer le tracé d'une ligne sans arrêts à partir des traces gardées (lot 1, couche 3)
- [ ] Mention vie privée dans la page « À propos » (loi 2013-450, ARTCI) : texte à valider par vous
- [ ] App mobile : envoi en arrière-plan, même API

---

## Lot 4 : prédiction des arrivées

Niveaux de [VISION.md](VISION.md), on affiche toujours le niveau de confiance :

| Niveau | Base | Affichage |
|---|---|---|
| 0 | Horaires (lot 2) | « Roule de 5 h 30 à 21 h 45 » |
| 1 | Distance + vitesse moyenne de la ville par créneau | « Bus estimé vers 7 h 40 » |
| 2 | Temps appris par tronçon et créneau (`segment_stats`) | « Prochain bus dans 8 min environ » |
| 3 | Bus en direct (lot 3) + temps des tronçons restants | « Passé à Pharmacie Angré, arrive dans 4 min » |

### Tâches

- [ ] Migration `segment_stats` : tronçon (arrêt → arrêt suivant), créneau de 15 min, type de jour, médiane, dispersion, nombre de voyages
- [ ] Commande planifiée qui recalcule `segment_stats` depuis `stop_passages`
- [ ] Service `ArrivalPredictor` : pour un arrêt et une ligne/sens, renvoie les 1 à 3 prochains passages avec niveau et marge
- [ ] Niveau 1 : vitesse moyenne par défaut (à calibrer avec les premiers voyages)
- [ ] Mesure de l'erreur : comparer prédiction et passage réel, tableau de bord admin (écart médian par ligne)
- [ ] API `GET /stops/{slug}/arrivals`
- [ ] Front : prochains passages sur la fiche arrêt et dans les résultats de recherche
- [ ] Front : « Je suis à cet arrêt » → alerte « ton bus arrive dans 5 min » (notification web)
- [ ] Commencer par les lignes les plus recherchées (déjà comptées dans le tableau de bord)
- [ ] Tests

---

## Journal

| Date | Fait |
|---|---|
| 07/11/2026 | Plan écrit. Recherche des sources pour l'intérieur : rien à scraper, voir lot 1 |
| 07/11/2026 | Lot 1, première partie : villes en base, 24 lignes de l'intérieur lues dans le PDF, API et front |
| 07/11/2026 | Lot 1, deuxième partie : ville dans le formulaire de recherche, éditeur d'arrêts dans le tableau de bord |
| 07/11/2026 | Base de dev à jour (migrations, lignes de l'intérieur). Lot 2 : tarifs, carte étudiant, horaires, historique. Écrans vérifiés en local |
