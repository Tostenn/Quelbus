<?php

namespace App\Services\Transit;

use App\Models\Line;
use App\Models\SearchedRoute;
use App\Models\Stop;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Index des recherches : chaque recherche est rattachée à un arrêt de départ et à un arrêt
 * d'arrivée, puis comptée pour ce trajet, avec les lignes proposées.
 * Appelé depuis la file d'attente (voir RecordSearch), jamais pendant la réponse.
 */
class SearchIndex
{
    /** Un point plus loin que ça de tout arrêt n'est rattaché à aucun arrêt. */
    private const ANCHOR_RADIUS_M = 500;

    /** Les arrêts homonymes plus proches que ça (quais d'une même gare) forment un seul arrêt. */
    private const MERGE_DISTANCE_M = 400;

    /** Options gardées dans la réponse d'un trajet. */
    private const ANSWER_OPTIONS = 3;

    public function __construct(private RouteSearchService $geo) {}

    /**
     * Ce qu'il faut garder d'un résultat de recherche : le type de réponse et les lignes proposées.
     *
     * @param  array{results: list<array>, combinations: list<array>, walkable: bool, prefer: string, distance: int}  $result
     * @return array{outcome: string, distance: int, direct: list<int>, combinations: list<list<int>>}
     */
    public static function summarize(array $result): array
    {
        $direct = array_map(fn ($r) => (int) $r['line']['id'], array_slice($result['results'], 0, 10));
        $combinations = array_map(
            fn ($c) => array_map(fn ($leg) => (int) $leg['line']['id'], $c['legs']),
            array_slice($result['combinations'] ?? [], 0, 5),
        );

        $outcome = match (true) {
            $combinations && ($result['prefer'] === 'combinations' || ! $direct) => 'combination',
            (bool) $direct => 'direct',
            $result['walkable'] => 'walk',
            default => 'none',
        };

        return ['outcome' => $outcome, 'distance' => (int) $result['distance'], 'direct' => $direct, 'combinations' => $combinations];
    }

    /**
     * @param  array{from: array{lat: float, lng: float, name: ?string}, to: array{lat: float, lng: float, name: ?string}, radius: int, types: ?list<string>, at: string, outcome: string, distance: int, direct: list<int>, combinations: list<list<int>>}  $search
     */
    public function record(array $search): void
    {
        $from = $this->anchor($search['from']['lat'], $search['from']['lng']);
        $to = $this->anchor($search['to']['lat'], $search['to']['lng']);
        $at = Carbon::parse($search['at']);
        // Un filtre de transport réduit la réponse : elle ne remplace pas celle du trajet
        $filtered = (bool) $search['types'];

        DB::transaction(function () use ($search, $from, $to, $at, $filtered) {
            $routeId = null;
            if ($from && $to && $from->id !== $to->id) {
                $answer = $filtered ? null : json_encode($this->answer($search));
                $outcome = $filtered ? null : $search['outcome'];
                DB::table('searched_routes')->upsert(
                    [[
                        'from_stop_id' => $from->id,
                        'to_stop_id' => $to->id,
                        'slug' => $from->slug.'--'.$to->slug,
                        'searches_count' => 1,
                        'outcome' => $outcome,
                        'answer' => $answer,
                        'last_searched_at' => $at,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]],
                    ['from_stop_id', 'to_stop_id'],
                    [
                        'searches_count' => DB::raw('searched_routes.searches_count + 1'),
                        'last_searched_at' => DB::raw('greatest(searched_routes.last_searched_at, excluded.last_searched_at)'),
                        'updated_at' => now(),
                        ...($filtered ? [] : ['outcome' => $outcome, 'answer' => $answer]),
                    ],
                );
                $routeId = SearchedRoute::query()->where('from_stop_id', $from->id)->where('to_stop_id', $to->id)->value('id');
            }

            $logId = DB::table('search_logs')->insertGetId([
                'searched_route_id' => $routeId,
                'from_stop_id' => $from?->id,
                'to_stop_id' => $to?->id,
                'from_gps' => ($search['from']['name'] ?? null) === 'Ma position',
                'outcome' => $search['outcome'],
                'distance' => $search['distance'],
                'radius' => $search['radius'],
                'types' => $filtered ? mb_substr(implode(',', $search['types']), 0, 60) : null,
                'combination' => $search['combinations'] ? implode('-', $search['combinations'][0]) : null,
                'from_area' => $this->area($search['from']['lat'], $search['from']['lng']),
                'to_area' => $this->area($search['to']['lat'], $search['to']['lng']),
                'created_at' => $at,
            ]);

            $existing = Line::query()->whereIn('id', [...$search['direct'], ...array_merge(...$search['combinations'] ?: [[]])])->pluck('id')->flip();
            $rows = [];
            foreach ($search['direct'] as $rank => $lineId) {
                $rows[] = ['search_log_id' => $logId, 'line_id' => $lineId, 'kind' => 'direct', 'rank' => $rank];
            }
            foreach ($search['combinations'] as $rank => $lines) {
                foreach (array_unique($lines) as $lineId) {
                    $rows[] = ['search_log_id' => $logId, 'line_id' => $lineId, 'kind' => 'combination', 'rank' => $rank];
                }
            }
            // Une ligne supprimée par un import entre la recherche et le traitement est ignorée
            $rows = array_values(array_filter($rows, fn ($row) => isset($existing[$row['line_id']])));
            if ($rows) {
                DB::table('search_log_lines')->insert($rows);
            }
        });
    }

    /**
     * Arrêt qui représente un point : l'arrêt le plus proche, et pour une gare à plusieurs quais
     * toujours le même (le premier importé parmi les homonymes proches).
     */
    public function anchor(float $lat, float $lng): ?Stop
    {
        $nearest = array_key_first($this->geo->nearbyStops($lat, $lng, self::ANCHOR_RADIUS_M));
        $stop = $nearest === null ? null : Stop::find($nearest, ['id', 'name', 'search_name', 'slug', 'lat', 'lng']);
        if (! $stop) {
            return null;
        }

        $close = array_keys($this->geo->nearbyStops($stop->lat, $stop->lng, self::MERGE_DISTANCE_M));

        return Stop::query()
            ->whereIn('id', $close)
            ->where('search_name', $stop->search_name)
            ->orderBy('id')
            ->first(['id', 'name', 'search_name', 'slug', 'lat', 'lng']) ?? $stop;
    }

    /**
     * Lignes à prendre, dans l'ordre affiché : chaque option est une ligne directe ou une combinaison.
     *
     * @return array{options: list<array{lines: list<array>}>}
     */
    private function answer(array $search): array
    {
        $direct = array_map(fn ($id) => [$id], $search['direct']);
        $options = $search['outcome'] === 'combination'
            ? [...$search['combinations'], ...$direct]
            : [...$direct, ...$search['combinations']];
        $options = array_slice($options, 0, self::ANSWER_OPTIONS);

        $lines = Line::query()->whereIn('id', array_merge(...$options ?: [[]]))->get(['id', 'ref', 'name', 'slug', 'type'])->keyBy('id');

        return ['options' => array_values(array_filter(array_map(
            fn (array $ids) => array_map(fn ($id) => $lines->get($id)?->only(['ref', 'name', 'slug', 'type']), $ids),
            $options,
        ), fn ($lines) => ! in_array(null, $lines, true)))];
    }

    /** Coordonnées arrondies au centième de degré, soit une zone d'environ 1 km. */
    private function area(float $lat, float $lng): string
    {
        return sprintf('%.2f,%.2f', $lat, $lng);
    }
}
