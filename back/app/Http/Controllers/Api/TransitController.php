<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\City;
use App\Models\Line;
use App\Models\Stop;
use App\Services\Stats;
use App\Services\Transit\RouteSearchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TransitController extends Controller
{
    public function cities(): JsonResponse
    {
        $cities = City::query()->withCount('lines')->orderBy('position')->orderBy('name')->get()
            ->map(fn (City $city) => [...$city->summary(), 'lines_count' => $city->lines_count]);

        return response()->json(['data' => $cities]);
    }

    public function lines(Request $request): JsonResponse
    {
        $city = $request->query('city');
        $cityIds = City::query()->pluck('slug', 'id');

        $lines = Line::query()
            ->when(is_string($city), fn ($q) => $q->whereHas('city', fn ($c) => $c->where('slug', $city)))
            ->withCount('directions')
            ->orderBy('type')
            ->orderByRaw('length(ref), ref')
            ->orderBy('name')
            ->get(['id', 'city_id', 'ref', 'name', 'slug', 'type', 'category', 'fare', 'accepts_student_card'])
            ->map(fn (Line $line) => [
                ...$line->only(['id', 'ref', 'name', 'slug', 'type', 'category', 'directions_count', 'fare', 'accepts_student_card']),
                'city' => $cityIds[$line->city_id] ?? null,
            ]);

        return response()->json(['data' => $lines]);
    }

    public function line(Line $line): JsonResponse
    {
        Stats::lineView($line->id);
        $line->load(['city', 'directions' => fn ($q) => $q->orderBy('id'), 'directions.stops:id,name,slug,lat,lng', 'directions.schedules']);

        return response()->json(['data' => [
            'id' => $line->id,
            'ref' => $line->ref,
            'name' => $line->name,
            'slug' => $line->slug,
            'type' => $line->type,
            'category' => $line->category,
            'operator' => $line->operator,
            'city' => $line->city?->summary(),
            ...$line->fareSummary(),
            'directions' => $line->directions->map(fn ($direction) => [
                'id' => $direction->id,
                'name' => $direction->name,
                'is_loop' => $direction->is_loop,
                'is_partial' => $direction->is_partial,
                'schedules' => $direction->schedules->map->summary(),
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
            'city' => $stop->city?->summary(),
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
