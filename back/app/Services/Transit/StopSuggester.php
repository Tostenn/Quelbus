<?php

namespace App\Services\Transit;

use App\Models\Stop;

/**
 * Un même arrêt existe souvent plusieurs fois à quelques mètres d'écart :
 * les arrêts homonymes proches sont regroupés en une seule suggestion.
 */
class StopSuggester
{
    private const MERGE_DISTANCE_M = 400;

    public function __construct(private RouteSearchService $geo) {}

    /**
     * @return list<array{name: string, lat: float, lng: float, stops: int}>
     */
    public function suggest(string $query, int $limit = 8): array
    {
        $words = array_filter(explode(' ', TransitImporter::normalize($query)));
        if (! $words) {
            return [];
        }

        $stops = Stop::query()
            ->where(function ($q) use ($words) {
                foreach ($words as $word) {
                    $q->where('search_name', 'like', '%'.$word.'%');
                }
            })
            ->orderBy('search_name')
            ->limit(200)
            ->get(['name', 'search_name', 'lat', 'lng']);

        $groups = [];
        foreach ($stops as $stop) {
            foreach ($groups as &$group) {
                if ($group['search_name'] === $stop->search_name
                    && $this->geo->distance($group['lat'], $group['lng'], $stop->lat, $stop->lng) <= self::MERGE_DISTANCE_M) {
                    $group['lat'] = ($group['lat'] * $group['stops'] + $stop->lat) / ($group['stops'] + 1);
                    $group['lng'] = ($group['lng'] * $group['stops'] + $stop->lng) / ($group['stops'] + 1);
                    $group['stops']++;

                    continue 2;
                }
            }
            unset($group);
            $groups[] = ['name' => $stop->name, 'search_name' => $stop->search_name, 'lat' => $stop->lat, 'lng' => $stop->lng, 'stops' => 1];
        }

        // D'abord les noms qui commencent par la saisie, puis les plus desservis
        $first = $words[array_key_first($words)];
        usort($groups, fn ($a, $b) => [! str_starts_with($a['search_name'], $first), -$a['stops'], $a['name']]
            <=> [! str_starts_with($b['search_name'], $first), -$b['stops'], $b['name']]);

        return array_map(fn ($g) => [
            'name' => $g['name'],
            'lat' => round($g['lat'], 6),
            'lng' => round($g['lng'], 6),
            'stops' => $g['stops'],
        ], array_slice($groups, 0, $limit));
    }
}
