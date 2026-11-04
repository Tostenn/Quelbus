<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SearchRequest;
use App\Jobs\RecordSearch;
use App\Models\Stop;
use App\Services\Stats;
use App\Services\Transit\RouteSearchService;
use App\Services\Transit\SearchIndex;
use App\Services\Transit\StopSuggester;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function search(SearchRequest $request, RouteSearchService $search): JsonResponse
    {
        Stats::record('searches');

        $from = ['lat' => (float) $request->validated('from_lat'), 'lng' => (float) $request->validated('from_lng'), 'name' => $request->validated('from_name')];
        $to = ['lat' => (float) $request->validated('to_lat'), 'lng' => (float) $request->validated('to_lng'), 'name' => $request->validated('to_name')];
        $radius = (int) ($request->validated('radius') ?? RouteSearchService::RADII[0]);
        $types = $request->validated('types');

        $result = $search->search($from['lat'], $from['lng'], $to['lat'], $to['lng'], $radius, $types);

        // Indexation en file d'attente : la réponse n'attend pas
        RecordSearch::dispatch([
            'from' => $from,
            'to' => $to,
            'radius' => $radius,
            'types' => $types ?: null,
            'at' => now()->toIso8601String(),
            ...SearchIndex::summarize($result),
        ]);

        return response()->json($result);
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
