<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Line;
use App\Models\Stop;
use App\Services\Stats;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;

class StatsController extends Controller
{
    public function show(): JsonResponse
    {
        $stats = Cache::remember('public-stats', now()->addMinutes(10), fn () => [
            'lines' => Line::count(),
            'stops' => Stop::count(),
            ...Stats::totals(),
        ]);

        return response()->json(['data' => $stats]);
    }

    public function visit(): Response
    {
        Stats::record('visits');

        return response()->noContent();
    }
}
