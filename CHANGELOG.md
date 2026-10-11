# Journal des modifications

Toutes les évolutions notables du projet sont consignées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet adhère au [versionnage sémantique](https://semver.org/lang/fr/).

## [Non publié]

### Modifié

- La base de données passe de MySQL à PostgreSQL ; les tests utilisent une base PostgreSQL dédiée.

### Ajouté

- Page d'accueil de présentation du projet (`front/`) : le problème, le fonctionnement, ce que QuelBus fait et ne fait pas, l'appel aux contributeurs et la feuille de route.
- Page contact `/contact` pour s'inscrire au lancement : prénom, nom, email, profil (utilisateur, contributeur, les deux) et message facultatif.
- API Laravel `POST /api/subscribers` (`back/`) : validation en français, email unique, limite de 6 requêtes par minute, champ piège contre les robots.
- Commande `php artisan subscribers:export` pour exporter les inscriptions en CSV.
- Animation du logo à l'arrivée et à chaque changement de page (désactivée si l'appareil limite les animations).
- Référencement et partage pour https://quelbus.monradar.ci : image d'aperçu 1200×630, balises Open Graph et Twitter, adresse canonique et titre par page, `robots.txt` et `sitemap.xml`.
- Email de confirmation après inscription, adapté au profil (utilisateur, contributeur, les deux), aux couleurs du site et envoyé en file d'attente.
- Boutons de partage après l'inscription (WhatsApp, Facebook, X, LinkedIn, Telegram, copier le lien, partage natif sur mobile), avec un texte et un message pré-rempli adaptés au profil.
- Icônes [Phosphor](https://phosphoricons.com) sur les boutons, les étapes, les cartes contributeurs et le formulaire.
- Scraper des lignes de bus d'Abidjan (`scraper/`) : 1234 sens de circulation SOTRA, gbaka et woro-woro, 6423 arrêts avec coordonnées et tracés.
- Base de données PostgreSQL : tables `lines`, `line_directions`, `stops`, `direction_stops`, et commande `php artisan transit:import` (relançable, transactionnelle, rapport d'anomalies, option `--prune`).
- Moteur de recherche « quel bus prendre » : lignes directes à moins de 300 m du départ et de l'arrivée, dans le bon sens, avec arrêts de montée et de descente ; élargissement automatique à 500 puis 800 m ; boucles gérées.
- Écran de recherche (`/recherche`) : départ par géolocalisation ou saisie, destination avec autocomplétion au clavier, résultats avec arrêts de montée et de descente, choix du rayon de marche et du type de transport, recherche partageable par lien. Formulaire de recherche en tête de la page d'accueil.
- Pages des lignes (`/lignes`, `/lignes/:slug`) et des arrêts (`/arrets/:slug`) : arrêts dans l'ordre pour chaque sens, trajet de la recherche surligné, lignes qui passent à un arrêt, arrêts proches. Titre et description propres à chaque page.
- API `GET /api/lines`, `GET /api/lines/{slug}`, `GET /api/stops/{slug}` et commande `php artisan sitemap:generate`.
- API `GET /api/search` (recherche) et `GET /api/suggest` (autocomplétion des arrêts, sans tenir compte des accents).
- Fichiers communautaires : licence, code de conduite, guide de contribution, politique de sécurité, modèles d'issues et de pull request, intégration continue.

[Non publié]: https://github.com/Tostenn/Quelbus/commits/main
