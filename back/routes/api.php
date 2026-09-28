<?php

use App\Http\Controllers\Api\SubscriberController;
use Illuminate\Support\Facades\Route;

Route::post('/subscribers', [SubscriberController::class, 'store'])
    ->middleware('throttle:6,1')
    ->name('subscribers.store');
