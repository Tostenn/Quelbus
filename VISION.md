# QuelBus : la prochaine étape

> « Quel bus prendre ? » : on sait y répondre. La prochaine question, c'est :
> **« Dans combien de temps il arrive ? »**

---

## D'où on part

Aujourd'hui, QuelBus te dit quelle ligne prendre, où monter et où descendre. C'est déjà beaucoup. Mais une fois arrivé à l'arrêt, tu ne sais toujours pas combien de temps tu vas attendre. Cinq minutes ? Quarante ? Est-ce que le dernier bus est déjà passé ?

À Abidjan, il n'existe pas d'horaires fiables à chaque arrêt, et encore moins de temps réel. Attendre que ces données arrivent d'en haut, c'est attendre longtemps. Mon idée : **les construire nous-mêmes, avec les gens qui prennent le bus tous les jours.**

## L'idée en deux temps

### 1. Récolter seulement le premier et le dernier départ

Pas besoin de relever tous les horaires de toutes les lignes. Pour chaque ligne et chaque sens, on récolte uniquement :

- l'heure du **premier départ** au terminus ;
- l'heure du **dernier départ** au terminus.

C'est simple à obtenir (affiches aux terminus, chauffeurs, contrôleurs, habitués) et ça répond déjà à une vraie question : « Est-ce que mon bus roule encore à cette heure-ci ? »

### 2. Laisser l'usage faire le reste

Ensuite, on met en place un algorithme qui se base sur les **données d'utilisation** pour prédire l'heure d'arrivée du bus.

Quand un utilisateur, avec sa position GPS activée, se sert de l'app et effectue un voyage, **complet ou pas**, l'app récolte en arrière-plan les données qui servent à prédire l'heure du prochain bus, en fonction de l'arrêt où on se trouve.

Avec ces données, et en fonction de l'heure, on sera capable de prédire avec une marge d'erreur faible quand le prochain bus arrivera vers nous. Mais pour ça, il nous faut des **utilisateurs récurrents** : ce sont eux qui permettront à l'algorithme d'accumuler une grande masse de données.

Chaque voyage rend la prédiction un peu meilleure pour tout le monde.

---

## Les données dont on a besoin

### Relevées une fois (à la main)

Pour chaque ligne et chaque sens :

| Donnée | Exemple | Pourquoi |
|---|---|---|
| Premier départ | 5 h 30 | Savoir si le service a commencé |
| Dernier départ | 21 h 45 | Éviter d'attendre un bus qui ne viendra plus |
| Jours concernés | semaine / samedi / dimanche et jours fériés | Les horaires changent souvent le week-end |
| Source | affiche du terminus, chauffeur, utilisateur | Savoir à quel point on peut s'y fier |
| Date du relevé | 30/10/2026 | Repérer les informations trop anciennes |

Ce qu'on a déjà grâce au [scraper](scraper/README.md) : les lignes, leurs sens, les arrêts dans l'ordre avec leurs coordonnées GPS, et le tracé de chaque ligne. Donc **la distance entre deux arrêts est déjà connue**.

### Récoltées pendant les voyages (automatiquement)

| Donnée | Ce que ça nous apprend |
|---|---|
| **Heure de passage à chaque arrêt** | La base de tout : quand le bus est passé, où |
| **Temps entre deux arrêts**, rapporté à la distance | La vitesse réelle sur chaque tronçon, embouteillages compris |
| **Temps passé à l'arrêt** (bus immobile) | Les arrêts où le bus attend longtemps (marchés, gares) |
| **Heure d'arrivée à l'arrêt et heure de montée** | Le temps d'attente réel des usagers, donc l'écart entre deux bus |
| **Ligne et sens** | Choisis par l'utilisateur, ou devinés en comparant sa trace au tracé des lignes |
| **Jour de la semaine, jour férié, vacances scolaires** | Un lundi à 7 h n'a rien à voir avec un dimanche à 7 h |
| **Précision du GPS** | Écarter les points trop imprécis |
| **Voyage complet ou partiel** | Un voyage partiel reste utile : chaque tronçon parcouru compte |

Plus tard, on pourra croiser avec des données extérieures, comme **la pluie**, qui change complètement la circulation à Abidjan.

---

## Comment la prédiction fonctionne

On découpe chaque ligne en **tronçons** (d'un arrêt au suivant) et la journée en **créneaux** (par exemple de 15 minutes). Pour chaque tronçon et chaque créneau, on garde le temps de parcours habituel, calculé à partir de tous les voyages enregistrés.

Pour prédire l'arrivée du prochain bus à ton arrêt, on part du bus le plus proche connu et on additionne les temps de tronçon jusqu'à toi.

On avance par niveaux, selon la quantité de données disponibles :

| Niveau | Données disponibles | Ce que l'app affiche |
|---|---|---|
| **0. Plage de service** | Premier et dernier départ seulement | « Cette ligne roule de 5 h 30 à 21 h 45 » |
| **1. Estimation** | + distance et vitesse moyenne de la ville par créneau | « Bus estimé vers 7 h 40 » (fourchette large) |
| **2. Prédiction apprise** | + voyages enregistrés sur cette ligne | « Prochain bus dans 8 min environ » |
| **3. Temps réel participatif** | + un utilisateur est dans le bus en ce moment | « Le bus vient de passer à Pharmacie Angré, il arrive dans 4 min » |

On affiche toujours le **niveau de confiance**. Mieux vaut dire « estimation » franchement que promettre une minute précise et se tromper.

### Mesurer l'erreur

Chaque nouveau voyage sert aussi d'examen : on compare ce qu'on avait prédit à ce qui s'est vraiment passé. Objectif de départ : **moins de 5 minutes d'écart** dans la majorité des cas, puis on resserre au fil des données.

### Savoir que l'utilisateur est dans un bus

Trois indices, du plus simple au plus fiable :

1. L'utilisateur appuie sur **« Je suis dans le bus »** après une recherche.
2. Sa vitesse et ses arrêts ressemblent à ceux d'un bus (et pas d'un taxi ou d'un piéton).
3. Sa trace suit le tracé d'une ligne connue, arrêt après arrêt.

---

## Pourquoi les gens reviendront

Tout repose sur les utilisateurs récurrents. Il faut donc que l'app soit utile **tous les jours**, pas seulement le jour où on cherche un trajet inconnu :

- **Mes trajets** : enregistrer maison → travail et le retrouver en un geste.
- **Alerte** : « Ton bus arrive dans 5 min, prépare-toi. »
- **Contribution visible** : « Tes voyages ont aidé 230 personnes cette semaine. »
- **Léger** : peu de batterie, peu de données mobiles, ça doit marcher sur un petit Android.

Pour démarrer, on ne vise pas toute la ville d'un coup. On commence par **les lignes les plus recherchées** (le tableau de bord les compte déjà) et on y concentre les premiers contributeurs. Mieux vaut quelques lignes très bien prédites que 70 lignes approximatives.

---

## La vie privée d'abord

Demander la position GPS des gens, c'est leur demander leur confiance. Les règles :

- **Consentement explicite** : la récolte ne démarre que si l'utilisateur l'active, et il peut l'arrêter à tout moment.
- **Anonyme** : chaque voyage reçoit un identifiant au hasard, sans lien avec un compte ou un téléphone.
- **On garde des passages, pas des traces** : on enregistre « bus passé à tel arrêt à telle heure », pas le chemin complet de la personne.
- **Début et fin coupés** : on ignore les premières et dernières centaines de mètres, pour ne jamais révéler où quelqu'un habite ou travaille.
- **Cadre légal** : respect de la loi ivoirienne n° 2013-450 sur la protection des données personnelles (ARTCI).

---

## Ce que ça change dans le code

Une première idée des tables à ajouter côté API, à affiner au moment de l'implémentation :

| Table | Contenu |
|---|---|
| `line_schedules` | sens de ligne, type de jour, premier départ, dernier départ, source, date du relevé |
| `trips` | voyage anonyme : sens de ligne, début, fin, complet ou non |
| `stop_passages` | voyage, arrêt, heure de passage, temps passé à l'arrêt, précision GPS |
| `segment_stats` | tronçon, créneau, type de jour, temps habituel, dispersion, nombre de voyages |

`segment_stats` est recalculée régulièrement à partir de `stop_passages` ; c'est elle que lit la prédiction.

## Les étapes

- [ ] **Horaires de base** : relever premier et dernier départ des lignes les plus recherchées, les afficher sur les fiches ligne
- [ ] **Récolte** : bouton « Je suis dans le bus », enregistrement anonyme des passages aux arrêts
- [ ] **Estimation** : temps de parcours estimés à partir de la distance et de l'heure
- [ ] **Prédiction** : temps appris par tronçon et par créneau, avec mesure de l'erreur
- [ ] **Temps réel participatif** : position des bus en cours, alertes d'arrivée

---

QuelBus a commencé par répondre à « quel bus ». Avec ses utilisateurs, il peut répondre à « quand ». C'est cette version-là que je veux construire.
