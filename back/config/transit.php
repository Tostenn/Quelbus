<?php

return [
    // Cache du réseau pour les correspondances (plusieurs Mo) : un fichier plutôt que la base.
    'cache_store' => env('TRANSIT_CACHE_STORE', env('APP_ENV') === 'testing' ? 'array' : 'file'),
];
