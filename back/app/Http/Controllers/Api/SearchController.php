<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SearchRequest;
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
}
