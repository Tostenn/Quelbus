<div align="center">

# 🚌 QuelBus

**Quel bus SOTRA prendre à Abidjan ?**

Vous êtes ici, vous voulez aller là-bas. QuelBus vous montre les lignes de bus qui y vont directement, où monter et où descendre.

[![CI](https://github.com/Tostenn/Quelbus/actions/workflows/ci.yml/badge.svg)](https://github.com/Tostenn/Quelbus/actions/workflows/ci.yml)
[![Licence : MIT](https://img.shields.io/badge/licence-MIT-CE5B22.svg)](LICENSE)
[![Données : ODbL](https://img.shields.io/badge/donn%C3%A9es-OpenStreetMap%20ODbL-1A1613.svg)](https://www.openstreetmap.org/copyright)
[![PR bienvenues](https://img.shields.io/badge/PR-bienvenues-2f7d4a.svg)](CONTRIBUTING.md)

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

Ce que QuelBus ne fait pas (encore) : horaires, temps réel, trajets avec correspondance, gbakas et wôrô-wôrôs. Le périmètre détaillé est dans le [cahier des charges](Maquette%20app%20avec%20deux%20directions/uploads/quelbus-projet.md).

## Feuille de route

- [x] **Présentation** : page d'accueil et inscriptions au lancement
- [ ] **Données** : import des lignes, sens et arrêts SOTRA depuis OpenStreetMap
- [ ] **Recherche** : moteur « quel bus prendre », testé sur des cas réels
- [ ] **Interface** : recherche sur mobile, avec ou sans géolocalisation
- [ ] **Pages publiques** : une fiche par ligne, arrêt et lieu, optimisées pour le référencement
- [ ] **Finitions** : cartes, signalement d'erreurs, mise en ligne

## Structure du dépôt

| Dossier | Contenu |
|---|---|
| [`front/`](front) | Landing page et page contact (React, TypeScript, Vite) |
| [`back/`](back) | API Laravel : inscriptions, puis import des données et recherche |
| [`Maquette app avec deux directions/`](Maquette%20app%20avec%20deux%20directions) | Maquettes de l'application et cahier des charges |

## Démarrage rapide

Prérequis : PHP 8.3+, Composer, Node 20+.

```sh
git clone https://github.com/Tostenn/Quelbus.git
cd Quelbus
```

**API** (`back/`)

```sh
cd back
composer install
cp .env.example .env        # régler DB_* (MySQL par défaut, ou DB_CONNECTION=sqlite)
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

`FRONTEND_URL` dans `back/.env` doit contenir l'adresse du front (CORS).

### Inscriptions

- `POST /api/subscribers` avec `first_name`, `last_name`, `email`, `profile` (`utilisateur`, `contributeur` ou `les_deux`) et `message` (facultatif).
- Une adresse n'est enregistrée qu'une fois ; 6 requêtes par minute et par IP au maximum ; un champ piège (`website`) écarte les robots.
- Export : `php artisan subscribers:export` écrit `storage/app/subscribers.csv`.

### Tests

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
