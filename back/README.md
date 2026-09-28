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
| Export CSV (`php artisan subscribers:export`) | `app/Console/Commands/ExportSubscribers.php` |
| Tests | `tests/Feature/SubscriberTest.php` |

`FRONTEND_URL` (dans `.env`) liste les origines autorisées par CORS, séparées par des virgules.

Tests et style : `php artisan test` puis `vendor/bin/pint --test`.

Voir le [guide de contribution](../CONTRIBUTING.md).
