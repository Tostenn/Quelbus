<?php

namespace App\Services\Transit;

use App\Models\Stop;

/**
 * Autocomplétion des lieux de départ et d'arrivée à partir des noms d'arrêts.
 *
 * Un même arrêt existe souvent plusieurs fois (une par ligne ou par trottoir, à quelques
 * mètres d'écart) : les arrêts de même nom proches les uns des autres sont fusionnés
 * en une seule suggestion, placée à leur position moyenne.
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

        // Les noms qui commencent par la saisie d'abord, puis les arrêts les plus desservis
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
