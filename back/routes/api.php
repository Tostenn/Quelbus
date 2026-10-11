<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DonationController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SearchController;
use App\Http\Controllers\Api\StatsController;
use App\Http\Controllers\Api\SubscriberController;
use App\Http\Controllers\Api\TransitController;
use Illuminate\Support\Facades\Route;

Route::post('/subscribers', [SubscriberController::class, 'store'])
    ->middleware('throttle:6,1')
    ->name('subscribers.store');

Route::post('/reports', [ReportController::class, 'store'])
    ->middleware('throttle:6,1')
    ->name('reports.store');

Route::post('/visits', [StatsController::class, 'visit'])->middleware('throttle:30,1')->name('visits.store');
Route::post('/donations', [DonationController::class, 'store'])->middleware('throttle:10,1')->name('donations.store');
Route::get('/donations/{reference}', [DonationController::class, 'show'])->middleware('throttle:60,1')->name('donations.show');
Route::post('/paystack/webhook', [DonationController::class, 'webhook'])->name('paystack.webhook');

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1')->name('login');

Route::middleware('auth:sanctum')->prefix('admin')->name('admin.')->group(function () {
    Route::get('/me', [AuthController::class, 'me'])->name('me');
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
    Route::get('/stats', [AdminController::class, 'stats'])->name('stats');
    Route::get('/reports', [AdminController::class, 'reports'])->name('reports');
    Route::get('/subscribers', [AdminController::class, 'subscribers'])->name('subscribers');
    Route::get('/donations', [AdminController::class, 'donations'])->name('donations');
});

Route::middleware('throttle:120,1')->group(function () {
    Route::get('/stats', [StatsController::class, 'show'])->name('stats');
    Route::get('/search', [SearchController::class, 'search'])->name('search');
    Route::get('/suggest', [SearchController::class, 'suggest'])->name('suggest');
    Route::get('/lines', [TransitController::class, 'lines'])->name('lines.index');
    Route::get('/lines/{line:slug}', [TransitController::class, 'line'])->name('lines.show');
    Route::get('/stops/{stop:slug}', [TransitController::class, 'stop'])->name('stops.show');
});
