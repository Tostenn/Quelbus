<div align="center">

# 🚌 QuelBus

**Quel bus SOTRA prendre à Abidjan ?**

Indiquez d'où vous partez et où vous allez : QuelBus vous montre les lignes de bus qui y vont directement, où monter et où descendre.

[![CI](https://github.com/Tostenn/Quelbus/actions/workflows/ci.yml/badge.svg)](https://github.com/Tostenn/Quelbus/actions/workflows/ci.yml)
[![Licence : MIT](https://img.shields.io/badge/licence-MIT-CE5B22.svg)](LICENSE)
[![Données : ODbL](https://img.shields.io/badge/donn%C3%A9es-OpenStreetMap%20ODbL-1A1613.svg)](https://www.openstreetmap.org/copyright)
[![PR bienvenues](https://img.shields.io/badge/PR-bienvenues-2f7d4a.svg)](CONTRIBUTING.md)

**[quelbus.monradar.ci](https://quelbus.monradar.ci)**

[Contribuer](CONTRIBUTING.md) · [Signaler une erreur](https://github.com/Tostenn/Quelbus/issues/new/choose) · [Feuille de route](#feuille-de-route)

</div>

---

## Le problème

Le réseau SOTRA compte environ 70 lignes. Les itinéraires sont difficiles à retenir et l'information est éparpillée : affiches aux arrêts, site officiel, bouche-à-oreille. Les outils existants montrent les lignes une par une, mais répondent mal à la question qu'on se pose tous les jours :

> « Pour aller à la Mosquée d'Adjamé depuis Angré, je prends quel bus ? »

## La réponse de QuelBus

1. **Où êtes-vous ?** Position détectée par le téléphone, ou saisie à la main.
2. **Où allez-vous ?** Un lieu connu, un arrêt ou un quartier, avec autocomplétion.
3. **Vos lignes directes.** Les lignes SOTRA qui passent à moins de 300 m de vous et de votre destination, **dans le bon sens**, avec l'arrêt de montée, l'arrêt de descente et la distance à pied.

Ce que QuelBus ne fait pas (encore) : horaires, temps réel, trajets avec correspondance, gbakas et wôrô-wôrôs. Le périmètre détaillé est dans le [cahier des charges](Maquette/uploads/quelbus-projet.md).

## Feuille de route

- [x] **Présentation** : page d'accueil et inscriptions au lancement
- [x] **Données** : import des lignes, sens et arrêts (SOTRA, gbaka, woro-woro), issus d'OpenStreetMap
- [x] **Recherche** : moteur « quel bus prendre », testé sur des cas réels
- [x] **Interface** : recherche sur mobile, avec ou sans géolocalisation
- [x] **Pages publiques** : une fiche par ligne et par arrêt, avec titre et description propres
- [ ] **Finitions** : cartes, signalement d'erreurs, mise en ligne

## Structure du dépôt

| Dossier | Contenu |
|---|---|
| [`front/`](front) | Landing page et page contact (React, TypeScript, Vite) |
| [`back/`](back) | API Laravel : inscriptions, puis import des données et recherche |
| [`Maquette/`](Maquette) | Maquettes de l'application et cahier des charges |

## Démarrage rapide

Prérequis : PHP 8.3+ (extension `pdo_pgsql`), Composer, Node 20+, une base PostgreSQL.

```sh
git clone https://github.com/Tostenn/Quelbus.git
cd Quelbus
```

**API** (`back/`)

```sh
cd back
composer install
cp .env.example .env        # régler DB_* (PostgreSQL)
php artisan key:generate
php artisan migrate
php artisan serve           # http://localhost:8000
```

**Front** (`front/`)

```sh
cd front
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:8000
npm run dev                 # http://localhost:5173
```

`FRONTEND_URL` dans `back/.env` doit contenir l'adresse du front (CORS) : `http://localhost:5173` en local, `https://quelbus.monradar.ci` en production.

### Données de transport

Les lignes viennent du [scraper](scraper/README.md) (SOTRA, gbaka, woro-woro d'Abidjan). Pour les charger en base :

```sh
cd back
php artisan transit:import ../scraper/data/abidjan_bus.json
```

Sans argument, la commande lit `storage/app/transit/abidjan_bus.json` (emplacement à utiliser en production). Elle peut être relancée sans créer de doublons, s'exécute dans une transaction et affiche un rapport d'anomalies. `--prune` supprime en plus ce qui a disparu du fichier (refusé si le fichier est incomplet).

Modèle : `lines` (une ligne) → `line_directions` (ses sens, un par relation OpenStreetMap) → `direction_stops` (arrêts ordonnés) ← `stops`.

### Recherche

- `GET /api/search?from_lat=&from_lng=&to_lat=&to_lng=` : lignes directes entre deux points. Options : `radius` (300, 500 ou 800 m ; élargi automatiquement si rien n'est trouvé) et `types[]` (`sotra`, `gbaka`, `woro-woro`). La réponse indique le rayon utilisé, si le trajet se fait à pied, et pour chaque ligne l'arrêt de montée, l'arrêt de descente, la marche et le nombre d'arrêts.
- `GET /api/suggest?q=mosquee adjame` : arrêts correspondant à la saisie (accents ignorés, arrêts homonymes proches fusionnés).
- `GET /api/lines`, `GET /api/lines/{slug}`, `GET /api/stops/{slug}` : index des lignes, fiche d'une ligne (sens et arrêts ordonnés), fiche d'un arrêt.
- `php artisan sitemap:generate` réécrit `front/public/sitemap.xml` (pages fixes, lignes et arrêts) ; à relancer après chaque import.
- La logique est dans `app/Services/Transit/RouteSearchService.php`.

### Inscriptions

- `POST /api/subscribers` avec `first_name`, `last_name`, `email`, `profile` (`utilisateur`, `contributeur` ou `les_deux`) et `message` (facultatif).
- Une adresse n'est enregistrée qu'une fois ; 6 requêtes par minute et par IP au maximum ; un champ piège (`website`) écarte les robots.
- Export : `php artisan subscribers:export` écrit `storage/app/subscribers.csv`.

### Emails

Chaque nouvelle inscription reçoit un email de confirmation, dont le texte dépend du profil choisi. **Tous les emails passent par la file d'attente** (`QUEUE_CONNECTION=database`) : sans worker, ils restent en attente dans la table `jobs`.

- En local : `php artisan queue:work` dans un terminal à part. Avec `MAIL_MAILER=log`, les emails sont écrits dans `storage/logs/laravel.log`.
- En production : garder `php artisan queue:work --tries=3` actif en permanence (Supervisor, systemd, ou le gestionnaire de processus de l'hébergeur), et renseigner `MAIL_MAILER`, `MAIL_HOST`, `MAIL_USERNAME`, `MAIL_PASSWORD` et `MAIL_FROM_ADDRESS` avec un vrai serveur SMTP.
- Les gabarits sont dans `back/resources/views/mail/` (contenu) et `back/resources/views/vendor/mail/` (couleurs et pied de page).

### Tests

Les tests vident la base à chaque lancement : ils utilisent une **base dédiée**, jamais celle de l'application. En local, créer `back/.env.testing` (copie de `.env` avec `APP_ENV=testing` et `DB_DATABASE=quelbus_test`, ignoré par git). La CI lance son propre PostgreSQL.

```sh
cd back && php artisan test && vendor/bin/pint --test
cd front && npm run lint && npm run build
```

### Mise en ligne du front

Le front est une application monopage : l'hébergeur doit renvoyer `index.html` pour toutes les routes (dont `/contact`). Sur Netlify, un fichier `public/_redirects` contenant `/* /index.html 200` suffit ; Vercel et Cloudflare Pages le gèrent par défaut. `VITE_API_URL` doit être défini au moment du build.

## Contribuer

Usager du bus, développeur, designer ou cartographe OpenStreetMap : toute aide est la bienvenue. Lisez le [guide de contribution](CONTRIBUTING.md) et le [code de conduite](CODE_OF_CONDUCT.md). Pour une faille de sécurité, suivez la [politique de sécurité](SECURITY.md).

Les évolutions sont consignées dans le [CHANGELOG](CHANGELOG.md).

## Licence et mentions

- Code : [MIT](LICENSE).
- Données de lignes et d'arrêts : © [contributeurs OpenStreetMap](https://www.openstreetmap.org/copyright), licence ODbL.
- QuelBus est un projet indépendant, **non affilié à la SOTRA**. Les données peuvent être incomplètes ou dépassées.
