<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SearchedRoute;
use App\Services\Transit\RouteSearchService;
use Illuminate\Http\JsonResponse;

/**
 * Page publique d'un trajet déjà recherché : « Quel bus pour aller de A à B ? ».
 */
class SearchedRouteController extends Controller
{
    private const RELATED = 6;

    public function show(string $slug, RouteSearchService $search): JsonResponse
    {
        $route = SearchedRoute::query()
            ->with(['from:id,name,slug,lat,lng', 'to:id,name,slug,lat,lng'])
            ->where('slug', $slug)
            ->firstOrFail();

        // Toujours recalculée : la réponse suit les imports de données
        $result = $search->search($route->from->lat, $route->from->lng, $route->to->lat, $route->to->lng);

        $related = fn (string $column, int $stopId, string $other) => SearchedRoute::query()
            ->with("{$other}:id,name")
            ->where($column, $stopId)
            ->whereKeyNot($route->id)
            ->where('searches_count', '>=', SearchedRoute::SITEMAP_MIN_SEARCHES)
            ->orderByDesc('searches_count')
            ->limit(self::RELATED)
            ->get()
            ->map(fn (SearchedRoute $r) => ['slug' => $r->slug, 'name' => $r->{$other}->name]);

        return response()->json(['data' => [
            'slug' => $route->slug,
            'from' => $route->from->only(['id', 'name', 'slug', 'lat', 'lng']),
            'to' => $route->to->only(['id', 'name', 'slug', 'lat', 'lng']),
            'search' => $result,
            'to_same_place' => $related('to_stop_id', $route->to_stop_id, 'from'),
            'from_same_place' => $related('from_stop_id', $route->from_stop_id, 'to'),
        ]]);
    }
}
