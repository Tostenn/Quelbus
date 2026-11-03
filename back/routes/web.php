<?php

use App\Http\Controllers\Web\UnsubscribeController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Lien de désinscription des emails (URL signée, sans expiration)
Route::middleware(['signed', 'throttle:30,1'])->group(function () {
    Route::get('/desinscription/{subscriber}', [UnsubscribeController::class, 'show'])->name('subscribers.unsubscribe');
    Route::post('/desinscription/{subscriber}', [UnsubscribeController::class, 'destroy'])->name('subscribers.unsubscribe.confirm');
});
