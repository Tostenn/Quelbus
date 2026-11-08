<?php

namespace App\Services\Live;

use App\Models\LineDirection;
use App\Models\Stop;
use App\Models\StopPassage;
use App\Models\Trip;
use App\Services\Transit\RouteSearchService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Prochains passages estimés à un arrêt, d'après les passages relevés pendant les voyages partagés.
 *
 * Pour chaque sens qui passe à l'arrêt, on prend les heures de passage des semaines passées, le même type de jour
 * (semaine, samedi, dimanche), et on regroupe celles qui tombent à quelques minutes d'écart : chaque groupe est
 * un passage habituel. Les sens qui ont un bus en direct en amont de l'arrêt sont laissés au direct.
 */
class ArrivalPredictor
{
    /** Passages pris en compte : les dernières semaines */
    private const HISTORY_DAYS = 56;

    /** On annonce les passages habituels de cette fenêtre */
    private const WINDOW_MINUTES = 180;

    /** Deux passages à moins de ça, des jours différents, sont le même passage habituel */
    private const SAME_SLOT_MINUTES = 6;

    /** Passages annoncés par sens */
    private const PER_DIRECTION = 3;

    public function __construct(private RouteSearchService $search) {}

    /**
     * Sens qui passent près d'une position, avec leurs prochains passages estimés.
     * Avec un sens donné : son arrêt le plus proche seulement.
     *
     * @return list<array>
     */
    public function near(float $lat, float $lng, ?int $directionId = null, ?Carbon $at = null): array
    {
        $at ??= now();
        $nearby = $this->search->nearbyStops($lat, $lng, $directionId ? 1500 : 500);
        if (! $nearby) {
            return [];
        }

        // Pour chaque sens, l'arrêt le plus proche de la position
        $stopsByDirection = [];
        foreach (DB::table('direction_stops')
            ->whereIn('stop_id', array_keys($nearby))
            ->when($directionId, fn ($q) => $q->where('line_direction_id', $directionId))
            ->get(['line_direction_id', 'stop_id', 'sequence']) as $row) {
            $current = $stopsByDirection[$row->line_direction_id] ?? null;
            if (! $current || $nearby[$row->stop_id] < $nearby[$current->stop_id]) {
                $stopsByDirection[$row->line_direction_id] = $row;
            }
        }
        if (! $stopsByDirection) {
            return [];
        }

        $live = $this->liveUpstream($stopsByDirection);
        $passages = StopPassage::query()
            ->whereIn('line_direction_id', array_keys($stopsByDirection))
            ->whereIn('stop_id', array_unique(array_map(fn ($row) => $row->stop_id, $stopsByDirection)))
            ->where('passed_at', '>=', $at->copy()->subDays(self::HISTORY_DAYS)->startOfDay())
            ->where('passed_at', '<', $at->copy()->startOfDay())
            ->get(['line_direction_id', 'stop_id', 'passed_at'])
            ->groupBy('line_direction_id');

        $results = [];
        foreach ($stopsByDirection as $id => $row) {
            if (isset($live[$id])) {
                continue;
            }
            $times = ($passages[$id] ?? collect())->where('stop_id', $row->stop_id);
            $next = $this->upcoming($times, $at);
            if ($next) {
                $results[$id] = ['stop_id' => $row->stop_id, 'walk_m' => $nearby[$row->stop_id], 'next' => $next];
            }
        }

        return $this->present($results);
    }

    /**
     * Sens qui ont des passages relevés : on peut y estimer le prochain bus.
     *
     * @param  list<int>  $directionIds
     * @return array<int, true>
     */
    public function withHistory(array $directionIds): array
    {
        return StopPassage::query()
            ->whereIn('line_direction_id', $directionIds)
            ->where('passed_at', '>=', now()->subDays(self::HISTORY_DAYS)->startOfDay())
            ->where('passed_at', '<', now()->startOfDay())
            ->distinct()
            ->pluck('line_direction_id')
            ->mapWithKeys(fn ($id) => [(int) $id => true])
            ->all();
    }

    /**
     * Passages habituels à venir.
     *
     * @param  Collection<int, StopPassage>  $passages
     * @return list<array{at: string, in_minutes: int, days: int}>
     */
    private function upcoming(Collection $passages, Carbon $at): array
    {
        $dayType = $this->dayType($at);
        $sameDays = $passages->filter(fn ($p) => $this->dayType($p->passed_at) === $dayType);
        // Pas encore de relevé ce type de jour : les autres jours valent mieux que rien
        $pool = $sameDays->isNotEmpty() ? $sameDays : $passages;

        $nowMinute = $at->hour * 60 + $at->minute + $at->second / 60;
        $minutes = $pool
            ->map(fn ($p) => ['minute' => $p->passed_at->hour * 60 + $p->passed_at->minute + $p->passed_at->second / 60, 'day' => $p->passed_at->toDateString()])
            ->filter(fn ($m) => $m['minute'] >= $nowMinute && $m['minute'] <= $nowMinute + self::WINDOW_MINUTES)
            ->sortBy('minute')
            ->values();

        $slots = [];
        foreach ($minutes as $m) {
            $last = array_key_last($slots);
            if ($last !== null && $m['minute'] - end($slots[$last])['minute'] <= self::SAME_SLOT_MINUTES) {
                $slots[$last][] = $m;
            } else {
                $slots[] = [$m];
            }
        }

        return array_map(function (array $slot) use ($at, $nowMinute) {
            $values = array_column($slot, 'minute');
            sort($values);
            $median = $values[intdiv(count($values), 2)];

            return [
                'at' => $at->copy()->startOfDay()->addSeconds((int) round($median * 60))->toIso8601String(),
                'in_minutes' => (int) max(0, round($median - $nowMinute)),
                'days' => count(array_unique(array_column($slot, 'day'))),
            ];
        }, array_slice($slots, 0, self::PER_DIRECTION));
    }

    private function dayType(Carbon $date): string
    {
        return match ($date->dayOfWeekIso) {
            6 => 'samedi',
            7 => 'dimanche',
            default => 'semaine',
        };
    }

    /**
     * Sens où un bus en direct n'a pas encore passé l'arrêt.
     *
     * @param  array<int, object>  $stopsByDirection
     * @return array<int, true>
     */
    private function liveUpstream(array $stopsByDirection): array
    {
        $live = [];
        foreach (Trip::query()
            ->whereIn('line_direction_id', array_keys($stopsByDirection))
            ->where('status', Trip::ACTIVE)
            ->where('last_point_at', '>=', now()->subSeconds(LiveBuses::FRESH_SECONDS))
            ->get(['line_direction_id', 'last_sequence']) as $trip) {
            if ($trip->last_sequence === null || $trip->last_sequence < $stopsByDirection[$trip->line_direction_id]->sequence) {
                $live[$trip->line_direction_id] = true;
            }
        }

        return $live;
    }

    /**
     * @param  array<int, array>  $results  par sens
     * @return list<array>
     */
    private function present(array $results): array
    {
        if (! $results) {
            return [];
        }
        $directions = LineDirection::query()
            ->whereIn('id', array_keys($results))
            ->with('line:id,city_id,ref,name,slug,type', 'line.city:id,slug')
            ->get(['id', 'line_id', 'name', 'destination_label'])
            ->keyBy('id');
        $stops = Stop::query()->whereIn('id', array_column($results, 'stop_id'))->get(['id', 'name', 'slug'])->keyBy('id');

        $items = [];
        foreach ($results as $id => $result) {
            $direction = $directions[$id] ?? null;
            $stop = $stops[$result['stop_id']] ?? null;
            if (! $direction || ! $stop) {
                continue;
            }
            $items[] = [
                'line' => [...$direction->line->only(['id', 'ref', 'name', 'slug', 'type']), 'city' => $direction->line->city?->slug],
                'direction' => ['id' => $direction->id, 'name' => $direction->name, 'destination' => $direction->destination_label],
                'stop' => ['id' => $stop->id, 'name' => $stop->name, 'slug' => $stop->slug, 'walk_m' => $result['walk_m']],
                'next' => $result['next'],
            ];
        }
        usort($items, fn ($a, $b) => [$a['next'][0]['in_minutes'], $a['stop']['walk_m']] <=> [$b['next'][0]['in_minutes'], $b['stop']['walk_m']]);

        return $items;
    }
}
