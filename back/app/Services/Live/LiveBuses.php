<?php

namespace App\Services\Live;

use App\Models\Line;
use App\Models\LineDirection;
use App\Models\Stop;
use App\Models\Trip;
use Illuminate\Support\Collection;

/**
 * Les bus en ce moment, d'après les voyages partagés.
 * Plusieurs usagers dans le même bus : leurs positions sont proches sur le même sens, on n'affiche qu'un bus.
 */
class LiveBuses
{
    /** Au-delà, une position n'est plus « en direct » */
    public const FRESH_SECONDS = 180;

    /** Deux voyageurs plus proches que ça sur le même sens sont dans le même bus */
    private const SAME_BUS_M = 200;

    /**
     * Bus d'une ligne.
     *
     * @return list<array>
     */
    public function forLine(Line $line): array
    {
        return $this->build($this->fresh()->where('line_id', $line->id)->get());
    }

    /**
     * Tous les bus en direct, avec leur ligne (page « En direct ») ; ceux d'une seule ligne si elle est donnée.
     *
     * @return list<array>
     */
    public function all(?Line $line = null): array
    {
        $buses = $this->build($this->fresh()->when($line, fn ($q) => $q->where('line_id', $line->id))->get());
        if (! $buses) {
            return [];
        }
        $directions = LineDirection::query()
            ->whereIn('id', array_unique(array_column($buses, 'direction_id')))
            ->with('line:id,city_id,ref,name,slug,type', 'line.city:id,slug,name')
            ->get(['id', 'line_id', 'name', 'destination_label'])
            ->keyBy('id');

        return array_values(array_filter(array_map(function (array $bus) use ($directions) {
            $direction = $directions[$bus['direction_id']] ?? null;
            if (! $direction) {
                return null;
            }

            return [
                ...$bus,
                'direction' => ['id' => $direction->id, 'name' => $direction->name, 'destination' => $direction->destination_label],
                'line' => [
                    ...$direction->line->only(['id', 'ref', 'name', 'slug', 'type']),
                    'city' => $direction->line->city?->slug,
                ],
            ];
        }, $buses)));
    }

    private function fresh()
    {
        return Trip::query()
            ->whereNotNull('line_direction_id')
            ->where('status', Trip::ACTIVE)
            ->where('last_point_at', '>=', now()->subSeconds(self::FRESH_SECONDS))
            ->orderBy('line_direction_id')
            ->orderByDesc('progress_m');
    }

    /**
     * @param  Collection<int, Trip>  $trips
     * @return list<array>
     */
    private function build(Collection $trips): array
    {
        if ($trips->isEmpty()) {
            return [];
        }
        $buses = [];
        foreach ($trips->groupBy('line_direction_id') as $directionId => $group) {
            foreach ($this->cluster($group) as $bus) {
                $buses[] = ['direction_id' => (int) $directionId, ...$bus];
            }
        }

        return $this->withStops($buses);
    }

    /**
     * @param  Collection<int, Trip>  $trips  triés par avancement décroissant
     * @return list<array>
     */
    private function cluster(Collection $trips): array
    {
        $buses = [];
        foreach ($trips as $trip) {
            $last = array_key_last($buses);
            if ($last !== null && $buses[$last]['_lead'] - $trip->progress_m <= self::SAME_BUS_M) {
                $buses[$last]['reporters']++;
                // La position la plus récente fait foi
                if ($trip->last_point_at->gt($buses[$last]['_at'])) {
                    $buses[$last] = [
                        ...$buses[$last],
                        'progress_m' => $trip->progress_m,
                        'lat' => $trip->lat,
                        'lng' => $trip->lng,
                        '_at' => $trip->last_point_at,
                        '_sequence' => $trip->last_sequence,
                    ];
                }

                continue;
            }
            $buses[] = [
                // Identifiant stable tant que ce voyageur reste en tête du groupe (sélection sur la carte)
                '_id' => $trip->id,
                'progress_m' => $trip->progress_m,
                'lat' => $trip->lat,
                'lng' => $trip->lng,
                'reporters' => 1,
                '_lead' => $trip->progress_m,
                '_at' => $trip->last_point_at,
                '_sequence' => $trip->last_sequence,
            ];
        }

        return $buses;
    }

    /**
     * @param  list<array>  $buses
     * @return list<array>
     */
    private function withStops(array $buses): array
    {
        $stops = Stop::query()
            ->join('direction_stops', 'direction_stops.stop_id', '=', 'stops.id')
            ->whereIn('direction_stops.line_direction_id', array_unique(array_column($buses, 'direction_id')))
            ->get(['stops.id', 'stops.name', 'stops.slug', 'direction_stops.line_direction_id', 'direction_stops.sequence'])
            ->groupBy('line_direction_id')
            ->map(fn ($group) => $group->keyBy('sequence'));

        return array_map(function (array $bus) use ($stops) {
            $byDirection = $stops[$bus['direction_id']] ?? collect();
            $stop = fn (?int $sequence) => $sequence !== null && isset($byDirection[$sequence])
                ? ['id' => $byDirection[$sequence]->id, 'name' => $byDirection[$sequence]->name, 'slug' => $byDirection[$sequence]->slug, 'sequence' => $sequence]
                : null;

            return [
                'id' => $bus['_id'],
                'direction_id' => $bus['direction_id'],
                'progress_m' => $bus['progress_m'],
                'lat' => $bus['lat'],
                'lng' => $bus['lng'],
                'seen_at' => $bus['_at']->toIso8601String(),
                'seen_seconds_ago' => (int) max(0, $bus['_at']->diffInSeconds(now(), true)),
                'reporters' => $bus['reporters'],
                'last_stop' => $stop($bus['_sequence']),
                'next_stop' => $stop(($bus['_sequence'] ?? 0) + 1),
            ];
        }, $buses);
    }
}
