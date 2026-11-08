# QuelBus mobile

L'app QuelBus pour Android et iPhone, en **React Native + Expo** (rendu natif, une seule base de code).
Elle utilise la même API que le site : `https://api.quelbus.ci`.

## Écrans

| Onglet / écran | Ce qu'il fait | API |
|---|---|---|
| **Trajet** | Départ (ou « Ma position »), destination, types de transport, ville | — |
| Choisir un lieu | Autocomplétion, lieux récents, position GPS | `GET /api/suggest` |
| Vos bus | Lignes directes et trajets avec changement | `GET /api/search` |
| Ligne | Carte du tracé (montée/descente en avant), sens, horaires, arrêts | `GET /api/lines/{slug}` |
| Arrêt | Lignes qui y passent, arrêts à côté | `GET /api/stops/{slug}` |
| **Près de moi** | Prochains passages estimés aux arrêts proches | `GET /api/arrivals`, `GET /api/nearest-stop` |
| **Lignes** | Toutes les lignes d'une ville, avec filtre | `GET /api/lines` |

La carte est native (MapLibre) avec le fond libre [OpenFreeMap](https://openfreemap.org) (données OpenStreetMap, sans clé d'API).

## Organisation

```
src/app/          écrans (Expo Router : un fichier = un écran)
src/components/   composants (cartes de résultat, carte, badges…)
src/lib/          logique sans interface : API, horaires, tarifs, état, GPS (testée)
```

`src/lib/api.ts`, `fares.ts`, `search.ts` reprennent la logique du front web (`front/src/lib`) : gardez-les alignés.

## Commandes

```bash
npm ci              # installer
npm run lint        # lint
npm run typecheck   # TypeScript
npm test            # tests unitaires (src/lib)
```

La CI (`.github/workflows/ci.yml`, job *Mobile*) lance tout cela et vérifie que l'app compile pour Android.

## Tester sur un téléphone, sans Android Studio

L'app contient du code natif (carte MapLibre) : elle ne tourne pas dans Expo Go, il faut une version compilée.
Tout se fait dans le cloud avec **EAS Build** :

1. Créer un compte sur [expo.dev](https://expo.dev), puis un projet nommé `quelbus`. Reporter son identifiant
   dans `app.json` : `expo.extra.eas.projectId` (et `expo.owner` = votre nom d'utilisateur Expo).
2. Créer un jeton : expo.dev > Account settings > Access tokens. L'ajouter dans GitHub :
   Settings > Secrets and variables > Actions > `EXPO_TOKEN`.
3. GitHub > Actions > **Mobile build (EAS)** > Run workflow, profil `preview`, plateforme `android`.
4. Quand la compilation est finie (sur expo.dev), ouvrir le lien sur le téléphone et installer l'APK.

## Publier sur les stores

- **Play Store** : profil `production` (fichier `.aab`). Le premier envoi se fait à la main dans la Play Console ;
  ensuite, cocher « submit » dans le workflow envoie automatiquement sur la piste de test interne.
- **App Store** : profil `production`, plateforme `ios`. EAS compile sur ses Mac et gère les certificats
  avec votre compte Apple Developer.

Identifiant de l'app : `ci.quelbus.app` (Android et iOS).

## Pointer vers une autre API

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.10:8000 npx expo start
```
