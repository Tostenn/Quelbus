<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AdminNewsletterController;
use App\Http\Controllers\Api\AdminTransitController;
use App\Http\Controllers\Api\AdminUserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\PasswordController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SearchController;
use App\Http\Controllers\Api\SearchedRouteController;
use App\Http\Controllers\Api\StatsController;
use App\Http\Controllers\Api\SubscriberController;
use App\Http\Controllers\Api\TransitController;
use App\Http\Controllers\Api\TripController;
use Illuminate\Support\Facades\Route;

Route::post('/subscribers', [SubscriberController::class, 'store'])
    ->middleware('throttle:6,1')
    ->name('subscribers.store');

Route::post('/reports', [ReportController::class, 'store'])
    ->middleware('throttle:6,1')
    ->name('reports.store');

Route::post('/visits', [StatsController::class, 'visit'])->middleware('throttle:30,1')->name('visits.store');

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1')->name('login');
Route::post('/password/forgot', [PasswordController::class, 'forgot'])->middleware('throttle:3,1')->name('password.forgot');
Route::post('/password/reset', [PasswordController::class, 'reset'])->middleware('throttle:5,1')->name('password.update');

// Voyages partagés : un envoi toutes les 10 à 15 s par téléphone, lots possibles après une coupure
Route::post('/trips', [TripController::class, 'start'])->middleware('throttle:20,1')->name('trips.start');
Route::post('/trips/{trip}/positions', [TripController::class, 'positions'])->middleware('throttle:30,1')->whereUuid('trip')->name('trips.positions');
Route::post('/trips/{trip}/end', [TripController::class, 'end'])->middleware('throttle:20,1')->whereUuid('trip')->name('trips.end');

Route::middleware('auth:sanctum')->prefix('admin')->name('admin.')->group(function () {
    Route::get('/me', [AuthController::class, 'me'])->name('me');
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
    Route::get('/stats', [AdminController::class, 'stats'])->name('stats');
    Route::get('/insights', [AdminController::class, 'insights'])->name('insights');
    Route::get('/reports', [AdminController::class, 'reports'])->name('reports');
    Route::get('/subscribers', [AdminController::class, 'subscribers'])->name('subscribers');
    Route::get('/users', [AdminUserController::class, 'index'])->name('users.index');
    Route::post('/users', [AdminUserController::class, 'store'])->middleware('throttle:10,1')->name('users.store');
    Route::post('/users/{user}/invitation', [AdminUserController::class, 'resend'])->middleware('throttle:5,1')->name('users.invite');
    Route::delete('/users/{user}', [AdminUserController::class, 'destroy'])->name('users.destroy');
    Route::put('/lines/{line}/fare', [AdminTransitController::class, 'updateFare'])->middleware('throttle:60,1')->name('lines.fare');
    Route::get('/lines/{line}/changes', [AdminTransitController::class, 'changes'])->name('lines.changes');
    Route::put('/directions/{direction}/schedules', [AdminTransitController::class, 'updateSchedules'])->middleware('throttle:60,1')->name('directions.schedules');
    Route::put('/directions/{direction}/stops', [AdminTransitController::class, 'updateStops'])->middleware('throttle:60,1')->name('directions.stops');
    Route::get('/newsletters', [AdminNewsletterController::class, 'index'])->name('newsletters.index');
    Route::post('/newsletters/preview', [AdminNewsletterController::class, 'preview'])->middleware('throttle:60,1')->name('newsletters.preview');
    Route::post('/newsletters/test', [AdminNewsletterController::class, 'test'])->middleware('throttle:5,1')->name('newsletters.test');
    Route::post('/newsletters', [AdminNewsletterController::class, 'store'])->middleware('throttle:3,1')->name('newsletters.store');
});

Route::middleware('throttle:120,1')->group(function () {
    Route::get('/stats', [StatsController::class, 'show'])->name('stats');
    Route::get('/search', [SearchController::class, 'search'])->name('search');
    Route::get('/suggest', [SearchController::class, 'suggest'])->name('suggest');
    Route::get('/nearest-stop', [SearchController::class, 'nearestStop'])->name('nearest-stop');
    Route::get('/cities', [TransitController::class, 'cities'])->name('cities.index');
    Route::get('/lines', [TransitController::class, 'lines'])->name('lines.index');
    Route::get('/lines/{line:slug}', [TransitController::class, 'line'])->name('lines.show');
    Route::get('/lines/{line:slug}/live', [TripController::class, 'live'])->name('lines.live');
    Route::get('/live', [TripController::class, 'all'])->name('live');
    Route::get('/routes/{slug}', [SearchedRouteController::class, 'show'])->name('routes.show');
    Route::get('/stops/{stop:slug}', [TransitController::class, 'stop'])->name('stops.show');
});
