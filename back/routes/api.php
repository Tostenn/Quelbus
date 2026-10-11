<?php

use App\Http\Controllers\Api\SearchController;
use App\Http\Controllers\Api\SubscriberController;
use App\Http\Controllers\Api\TransitController;
use Illuminate\Support\Facades\Route;

Route::post('/subscribers', [SubscriberController::class, 'store'])
    ->middleware('throttle:6,1')
    ->name('subscribers.store');

Route::middleware('throttle:120,1')->group(function () {
    Route::get('/search', [SearchController::class, 'search'])->name('search');
    Route::get('/suggest', [SearchController::class, 'suggest'])->name('suggest');
    Route::get('/lines', [TransitController::class, 'lines'])->name('lines.index');
    Route::get('/lines/{line:slug}', [TransitController::class, 'line'])->name('lines.show');
    Route::get('/stops/{stop:slug}', [TransitController::class, 'stop'])->name('stops.show');
});
