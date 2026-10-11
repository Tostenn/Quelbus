<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Line;
use App\Models\Stop;
use App\Services\Transit\RouteSearchService;
use Illuminate\Http\JsonResponse;

class TransitController extends Controller
{
    public function lines(): JsonResponse
    {
        $lines = Line::query()
            ->withCount('directions')
            ->orderBy('type')
            ->orderByRaw('length(ref), ref')
            ->orderBy('name')
            ->get(['id', 'ref', 'name', 'slug', 'type', 'category']);

        return response()->json(['data' => $lines]);
    }

    public function line(Line $line): JsonResponse
    {
        $line->load(['directions' => fn ($q) => $q->orderBy('id'), 'directions.stops:id,name,slug,lat,lng']);

        return response()->json(['data' => [
            'id' => $line->id,
            'ref' => $line->ref,
            'name' => $line->name,
            'slug' => $line->slug,
            'type' => $line->type,
            'category' => $line->category,
            'operator' => $line->operator,
            'directions' => $line->directions->map(fn ($direction) => [
                'id' => $direction->id,
                'name' => $direction->name,
                'is_loop' => $direction->is_loop,
                'geometry' => $direction->geometry ?? [],
                'stops' => $direction->stops->map(fn ($stop) => $stop->only(['id', 'name', 'slug', 'lat', 'lng'])),
            ]),
        ]]);
    }

    public function stop(Stop $stop, RouteSearchService $geo): JsonResponse
    {
        $directions = $stop->directions()->with('line:id,ref,name,slug,type')->get();

        $nearbyIds = array_diff_key($geo->nearbyStops($stop->lat, $stop->lng, 300), [$stop->id => true]);
        $nearby = Stop::query()->whereIn('id', array_keys($nearbyIds))->get(['id', 'name', 'slug'])
            ->map(fn ($s) => [...$s->only(['id', 'name', 'slug']), 'walk' => $nearbyIds[$s->id]])
            ->sortBy('walk')
            ->unique('name')
            ->values();

        return response()->json(['data' => [
            ...$stop->only(['id', 'name', 'slug', 'lat', 'lng']),
            'lines' => $directions
                ->map(fn ($d) => [
                    'line' => $d->line->only(['id', 'ref', 'name', 'slug', 'type']),
                    'direction' => ['id' => $d->id, 'name' => $d->name],
                ])
                ->sortBy(fn ($l) => [$l['line']['type'], strlen($l['line']['ref'] ?? ''), $l['line']['ref'], $l['direction']['name']])
                ->values(),
            'nearby' => $nearby,
        ]]);
    }
}
