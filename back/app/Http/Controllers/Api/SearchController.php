<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SearchRequest;
use App\Models\Stop;
use App\Services\Stats;
use App\Services\Transit\RouteSearchService;
use App\Services\Transit\StopSuggester;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function search(SearchRequest $request, RouteSearchService $search): JsonResponse
    {
        Stats::record('searches');

        return response()->json($search->search(
            (float) $request->validated('from_lat'),
            (float) $request->validated('from_lng'),
            (float) $request->validated('to_lat'),
            (float) $request->validated('to_lng'),
            (int) ($request->validated('radius') ?? RouteSearchService::RADII[0]),
            $request->validated('types'),
        ));
    }

    public function suggest(Request $request, StopSuggester $suggester): JsonResponse
    {
        $query = trim((string) $request->query('q'));

        return response()->json([
            'data' => mb_strlen($query) >= 2 ? $suggester->suggest(mb_substr($query, 0, 100)) : [],
        ]);
    }

    /**
     * Arrêt le plus proche d'une position (à 500 m au plus), pour nommer un lieu de rendez-vous.
     */
    public function nearestStop(Request $request, RouteSearchService $search): JsonResponse
    {
        $data = $request->validate([
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $nearby = $search->nearbyStops((float) $data['lat'], (float) $data['lng'], 500);
        $id = array_key_first($nearby);
        $stop = $id === null ? null : Stop::find($id, ['id', 'name', 'slug']);

        return response()->json([
            'data' => $stop ? ['name' => $stop->name, 'slug' => $stop->slug, 'walk' => $nearby[$id]] : null,
        ]);
    }
}
