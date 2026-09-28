# Journal des modifications

Toutes les évolutions notables du projet sont consignées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet adhère au [versionnage sémantique](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

- Page d'accueil de présentation du projet (`front/`) : le problème, le fonctionnement, ce que QuelBus fait et ne fait pas, l'appel aux contributeurs et la feuille de route.
- Page contact `/contact` pour s'inscrire au lancement : prénom, nom, email, profil (utilisateur, contributeur, les deux) et message facultatif.
- API Laravel `POST /api/subscribers` (`back/`) : validation en français, email unique, limite de 6 requêtes par minute, champ piège contre les robots.
- Commande `php artisan subscribers:export` pour exporter les inscriptions en CSV.
- Fichiers communautaires : licence, code de conduite, guide de contribution, politique de sécurité, modèles d'issues et de pull request, intégration continue.

[Non publié]: https://github.com/Tostenn/Quelbus/commits/main
