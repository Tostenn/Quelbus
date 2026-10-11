<?php

namespace App\Services\Transit;

use App\Models\Stop;
use Illuminate\Support\Facades\DB;

/**
 * « Je suis ici, je veux aller là-bas : quelle ligne directe prendre ? »
 *
 * Règle (cahier des charges, section 5) :
 *  1. arrêts à moins de R mètres du départ (O) et de la destination (D) ;
 *  2. sens de ligne qui passent par o ∈ O puis d ∈ D (sequence(o) < sequence(d)) ;
 *  3. pour chaque ligne, la paire (o, d) qui minimise la marche totale ;
 *  4. tri par marche totale, puis par nombre d'arrêts.
 *
 * Une ligne qui fait marcher au moins autant que le trajet direct à pied est écartée.
 */
class RouteSearchService
{
    public const RADII = [300, 500, 800];

    private const EARTH_RADIUS_M = 6371000;

    /**
     * Cherche au rayon demandé, puis élargit (500, 800 m) tant qu'aucune ligne n'est trouvée.
     *
     * @param  list<string>|null  $types  sotra, gbaka, woro-woro… (null = tous)
     * @return array{radius: int, requested_radius: int, expanded: bool, walkable: bool, distance: int, results: list<array>}
     */
    public function search(float $fromLat, float $fromLng, float $toLat, float $toLng, int $radius = 300, ?array $types = null): array
    {
        $distance = (int) round($this->distance($fromLat, $fromLng, $toLat, $toLng));
        $radii = array_values(array_unique([$radius, ...array_filter(self::RADII, fn ($r) => $r > $radius)]));

        foreach ($radii as $r) {
            $results = array_values(array_filter(
                $this->directLines($fromLat, $fromLng, $toLat, $toLng, $r, $types),
                fn (array $result) => $result['walk'] < $distance,
            ));
            if ($results) {
                break;
            }
        }

        return [
            'radius' => $r,
            'requested_radius' => $radius,
            'expanded' => $r !== $radius,
            'walkable' => $distance <= $radius,
            'distance' => $distance,
            'results' => $results,
        ];
    }

    /**
     * Lignes directes à un rayon donné, une par ligne (le meilleur sens et la meilleure paire d'arrêts).
     *
     * @param  list<string>|null  $types
     * @return list<array>
     */
    public function directLines(float $fromLat, float $fromLng, float $toLat, float $toLng, int $radius, ?array $types = null): array
    {
        $origins = $this->nearbyStops($fromLat, $fromLng, $radius);
        $destinations = $this->nearbyStops($toLat, $toLng, $radius);
        if (! $origins || ! $destinations) {
            return [];
        }

        $pairs = DB::table('direction_stops as so')
            ->join('direction_stops as sd', 'sd.line_direction_id', '=', 'so.line_direction_id')
            ->join('line_directions as ld', 'ld.id', '=', 'so.line_direction_id')
            ->join('lines as l', 'l.id', '=', 'ld.line_id')
            ->whereIn('so.stop_id', array_keys($origins))
            ->whereIn('sd.stop_id', array_keys($destinations))
            ->whereColumn('sd.stop_id', '!=', 'so.stop_id')
            // Une boucle peut repasser par le terminus : l'ordre inverse est alors valable
            ->where(fn ($q) => $q->whereColumn('sd.sequence', '>', 'so.sequence')->orWhere('ld.is_loop', true))
            ->when($types, fn ($q) => $q->whereIn('l.type', $types))
            ->get([
                'l.id as line_id', 'ld.id as direction_id', 'ld.stops_count',
                'so.stop_id as board_id', 'so.sequence as board_seq',
                'sd.stop_id as alight_id', 'sd.sequence as alight_seq',
            ]);

        $best = [];
        foreach ($pairs as $p) {
            $walk = $origins[$p->board_id] + $destinations[$p->alight_id];
            $stops = $p->alight_seq > $p->board_seq
                ? $p->alight_seq - $p->board_seq
                : ($p->stops_count - $p->board_seq) + ($p->alight_seq - 1); // tour de boucle

            $current = $best[$p->line_id] ?? null;
            if (! $current || $walk < $current['walk'] || ($walk === $current['walk'] && $stops < $current['stops'])) {
                $best[$p->line_id] = ['pair' => $p, 'walk' => $walk, 'stops' => $stops];
            }
        }

        usort($best, fn ($a, $b) => [$a['walk'], $a['stops']] <=> [$b['walk'], $b['stops']]);

        return $this->present($best, $origins, $destinations);
    }

    /**
     * @return array<int, int> id d'arrêt => distance à pied en mètres, triés du plus proche au plus loin
     */
    public function nearbyStops(float $lat, float $lng, int $radius): array
    {
        // Boîte englobante (utilise l'index lat/lng), puis distance exacte
        $dLat = rad2deg($radius / self::EARTH_RADIUS_M);
        $dLng = rad2deg($radius / (self::EARTH_RADIUS_M * cos(deg2rad($lat))));

        $stops = [];
        foreach (Stop::query()
            ->whereBetween('lat', [$lat - $dLat, $lat + $dLat])
            ->whereBetween('lng', [$lng - $dLng, $lng + $dLng])
            ->get(['id', 'lat', 'lng']) as $stop) {
            $d = (int) round($this->distance($lat, $lng, $stop->lat, $stop->lng));
            if ($d <= $radius) {
                $stops[$stop->id] = $d;
            }
        }
        asort($stops);

        return $stops;
    }

    public function distance(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $a = sin(deg2rad($lat2 - $lat1) / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin(deg2rad($lng2 - $lng1) / 2) ** 2;

        return 2 * self::EARTH_RADIUS_M * asin(min(1, sqrt($a)));
    }

    /**
     * @param  list<array>  $best
     * @param  array<int, int>  $origins
     * @param  array<int, int>  $destinations
     * @return list<array>
     */
    private function present(array $best, array $origins, array $destinations): array
    {
        if (! $best) {
            return [];
        }

        $lines = DB::table('lines')->whereIn('id', array_map(fn ($b) => $b['pair']->line_id, $best))
            ->get(['id', 'ref', 'name', 'slug', 'type'])->keyBy('id');
        $directions = DB::table('line_directions')->whereIn('id', array_map(fn ($b) => $b['pair']->direction_id, $best))
            ->get(['id', 'name', 'origin_label', 'destination_label'])->keyBy('id');
        $stopIds = array_merge(...array_map(fn ($b) => [$b['pair']->board_id, $b['pair']->alight_id], $best));
        $stops = Stop::query()->whereIn('id', $stopIds)->get(['id', 'name', 'slug', 'lat', 'lng'])->keyBy('id');

        $stop = fn (int $id, int $walk) => [
            'id' => $id,
            'name' => $stops[$id]->name,
            'slug' => $stops[$id]->slug,
            'lat' => $stops[$id]->lat,
            'lng' => $stops[$id]->lng,
            'walk' => $walk,
        ];

        return array_map(fn ($b) => [
            'line' => (array) $lines[$b['pair']->line_id],
            'direction' => (array) $directions[$b['pair']->direction_id],
            'board' => $stop($b['pair']->board_id, $origins[$b['pair']->board_id]),
            'alight' => $stop($b['pair']->alight_id, $destinations[$b['pair']->alight_id]),
            'stops' => $b['stops'],
            'walk' => $b['walk'],
        ], $best);
    }
}
