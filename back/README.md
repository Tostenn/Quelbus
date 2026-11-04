# Back de QuelBus

API Laravel de [QuelBus](../README.md). Pour l'instant, elle enregistre les inscriptions au lancement ; elle accueillera ensuite l'import des lignes SOTRA depuis OpenStreetMap et le moteur de recherche.

```sh
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve        # http://localhost:8000
```

| Élément | Emplacement |
|---|---|
| Route `POST /api/subscribers` | `routes/api.php` |
| Validation (messages en français) | `app/Http/Requests/StoreSubscriberRequest.php` |
| Contrôleur | `app/Http/Controllers/Api/SubscriberController.php` |
| Email de confirmation (en file d'attente) | `app/Mail/SubscriptionConfirmed.php`, `resources/views/mail/` |
| Habillage des emails (logo, couleurs, pied de page) | `resources/views/vendor/mail/`, `resources/views/vendor/notifications/` |
| Newsletter (tableau de bord → onglet Newsletter) | `app/Http/Controllers/Api/AdminNewsletterController.php`, `app/Mail/NewsletterMail.php`, `resources/views/mail/newsletter.blade.php` |
| Désinscription (lien signé des emails) | `app/Http/Controllers/Web/UnsubscribeController.php`, `resources/views/unsubscribe.blade.php` |
| Export CSV (`php artisan subscribers:export`) | `app/Console/Commands/ExportSubscribers.php` |
| Tests | `tests/Feature/SubscriberTest.php` |

`FRONTEND_URL` (dans `.env`) liste les origines autorisées par CORS, séparées par des virgules.

Les emails partent en file d'attente : lancer `php artisan queue:work` à côté du serveur, en local comme en production.

Correspondances : `app/Services/Transit/TransferPlanner.php` (règles et poids en tête du fichier) s'appuie sur `TransitNetwork.php`, le réseau en mémoire, mis en cache dans un fichier (≈ 4 Mo) et reconstruit automatiquement après un import. Pour vérifier les propositions :

```bash
php artisan transit:route "Yopougon Siporex" "Cocody Centre"
php artisan transit:route 5.3405,-4.0905 5.3515,-3.99 --types=sotra
```

Newsletter : un email par inscrit, espacés de `NEWSLETTER_DELAY` secondes (2 par défaut) pour respecter les limites d'envoi de l'hébergeur. Les personnes désinscrites sont exclues. Le lien de désinscription est signé avec `APP_URL` : en production, `APP_URL` doit être l'adresse publique de l'API (`https://api.quelbus.ci`), sinon les liens ne fonctionnent pas. Le lien du groupe WhatsApp se règle avec `WHATSAPP_GROUP_URL`.

Le logo des emails est une image PNG servie par le site : `front/public/email/quelbus-logo.png`, chargée depuis `FRONTEND_URL`. Les clients mail (Gmail, Outlook) n'affichent pas les SVG.

Tests et style : `php artisan test` puis `vendor/bin/pint --test`.

Voir le [guide de contribution](../CONTRIBUTING.md).
