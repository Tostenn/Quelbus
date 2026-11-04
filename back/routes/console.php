<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Nouveaux trajets souvent recherchés, lignes et arrêts importés : le sitemap suit.
// Nécessite la tâche cron « * * * * * php artisan schedule:run » (voir README).
Schedule::command('sitemap:generate')->hourly()->withoutOverlapping();
