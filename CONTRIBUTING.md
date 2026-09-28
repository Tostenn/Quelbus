# Contribuer à QuelBus

Merci de vouloir aider ! QuelBus répond à une question simple : « quel bus SOTRA prendre pour aller de là à là-bas ? ». Chaque contribution compte, qu'elle soit du code, du design, des données ou un simple signalement.

En participant, vous acceptez de respecter notre [code de conduite](CODE_OF_CONDUCT.md).

## Plusieurs façons d'aider

| Vous êtes… | Vous pouvez… |
|---|---|
| Usager du bus à Abidjan | Signaler une ligne ou un arrêt faux avec le modèle d'issue « Erreur de données » |
| Contributeur OpenStreetMap | Ajouter ou corriger les arrêts et les relations de lignes SOTRA sur [openstreetmap.org](https://www.openstreetmap.org) |
| Développeur (Laravel, React) | Prendre une issue marquée `good first issue` ou `help wanted` |
| Designer | Améliorer l'accessibilité et la lisibilité sur petits écrans, en plein soleil |
| Personne qui écrit bien | Relire les textes, la documentation, les messages d'erreur |

Pas encore prêt à contribuer ? Inscrivez-vous sur la page contact du site pour être tenu au courant.

## Avant de commencer

- Cherchez dans les [issues](https://github.com/Tostenn/Quelbus/issues) si le sujet existe déjà.
- Pour un changement important, ouvrez d'abord une issue pour en discuter. Cela évite de travailler sur quelque chose qui ne sera pas retenu.
- Le périmètre du projet est décrit dans le [cahier des charges](Maquette%20app%20avec%20deux%20directions/uploads/quelbus-projet.md). Les horaires, le temps réel et les autres modes de transport sont hors du périmètre actuel.

## Installer le projet

Voir la section « Lancer le projet en local » du [README](README.md). En résumé : PHP 8.3+, Composer et Node 20+.

## Proposer une modification

1. Forkez le dépôt et créez une branche depuis `main` :
   `git checkout -b feat/recherche-par-arret`
2. Faites des commits petits et ciblés, un par étape logique.
3. Vérifiez que tout passe :
   ```sh
   cd back && php artisan test && vendor/bin/pint --test
   cd front && npm run lint && npm run build
   ```
4. Ajoutez une ligne dans la section « Non publié » du [CHANGELOG](CHANGELOG.md) si votre changement est visible par les utilisateurs.
5. Ouvrez une pull request vers `main` en remplissant le modèle.

## Conventions

### Messages de commit

Nous suivons [Conventional Commits](https://www.conventionalcommits.org/fr/v1.0.0/) :

```
feat: ajouter la recherche par numéro de ligne
fix: corriger le sens de la ligne 81
docs: préciser l'installation sous Windows
```

Types courants : `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`.

### Code

- **Back** : style Laravel, formaté avec [Pint](https://laravel.com/docs/pint). La logique métier vit dans des services testés, pas dans les contrôleurs.
- **Front** : TypeScript strict, ESLint sans erreur. Pas de dépendance lourde sans discussion préalable : l'application doit rester rapide sur un téléphone d'entrée de gamme en 3G.
- **Langue** : l'interface est en français. Le code (noms de variables, fonctions) est en anglais ; les commentaires peuvent être en français.
- **Accessibilité** : libellés sur tous les champs, contraste élevé, cibles tactiles d'au moins 44 px.

### Données

- Les données viennent d'OpenStreetMap (licence ODbL). La mention « © contributeurs OpenStreetMap » doit rester visible.
- Signalez toute hypothèse sur les données plutôt que de la masquer.
- Le site est indépendant : n'utilisez ni le logo ni la charte graphique de la SOTRA.
- Ne committez jamais de données personnelles (emails d'inscrits, fichiers `.env`, exports CSV).

## Questions

Ouvrez une issue avec votre question. Il n'y a pas de question bête.
