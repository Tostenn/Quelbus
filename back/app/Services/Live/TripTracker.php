<?php

namespace App\Services\Live;

use App\Models\LineDirection;
use App\Models\StopPassage;
use App\Models\Trip;
use App\Models\TripPoint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Reçoit les positions d'un voyage partagé : filtre les points douteux, les ramène sur le trajet
 * de la ligne, et relève l'heure de passage à chaque arrêt.
 *
 * Les points arrivent par lots (le téléphone les garde quand le réseau coupe) : un point déjà vu
 * (même heure ou plus ancien) est ignoré, on peut donc renvoyer un lot sans risque.
 */
class TripTracker
{
    /** Précision GPS au-delà de laquelle un point est écarté */
    public const MAX_ACCURACY_M = 150;

    /** Écart toléré entre la position et le trajet (arrêts reliés en ligne droite, la route tourne entre deux) */
    private const MAX_OFFSET_M = 250;

    /** Ligne dont on ne connaît que les terminus : le trajet est une simple droite */
    private const MAX_OFFSET_PARTIAL_M = 2500;

    /** Points hors du trajet d'affilée avant de conclure que l'usager n'est pas dans ce bus */
    private const OFF_ROUTE_LIMIT = 8;

    /** Vitesse maximale crédible d'un bus en ville (≈ 110 km/h) */
    private const MAX_SPEED_MS = 30;

    /** Recul toléré (imprécision du GPS) */
    private const BACKTRACK_M = 80;

    /** Rayon autour d'un arrêt pour mesurer le temps passé à l'arrêt */
    private const STOP_RADIUS_M = 40;

    /** Un point plus vieux que ça n'est plus accepté (lot renvoyé très tard) */
    private const MAX_AGE_HOURS = 3;

    /** @var array<int, RouteLine> */
    private array $routes = [];

    /**
     * @return array{trip: Trip, token: string}
     */
    public function start(LineDirection $direction, string $client): array
    {
        $token = Str::random(48);
        $trip = Trip::query()->create([
            'line_direction_id' => $direction->id,
            'token_hash' => hash('sha256', $token),
            'client' => $client,
            'status' => Trip::ACTIVE,
            'started_at' => now(),
        ]);

        return ['trip' => $trip, 'token' => $token];
    }

    /**
     * @param  list<array{lat: float, lng: float, accuracy?: ?float, t: int}>  $points  t en millisecondes depuis 1970
     * @return array{accepted: int, rejected: int}
     */
    public function ingest(Trip $trip, array $points): array
    {
        if ($trip->status !== Trip::ACTIVE) {
            return ['accepted' => 0, 'rejected' => count($points)];
        }

        $direction = $trip->direction;
        $route = $this->routes[$direction->id] ??= RouteLine::forDirection($direction);
        $maxOffset = $direction->is_partial ? self::MAX_OFFSET_PARTIAL_M : self::MAX_OFFSET_M;
        usort($points, fn ($a, $b) => $a['t'] <=> $b['t']);

        $state = $trip->state ?? [];
        $accepted = 0;
        $rejected = 0;
        $rows = [];

        DB::transaction(function () use ($trip, $points, $route, $maxOffset, &$state, &$accepted, &$rejected, &$rows) {
            foreach ($points as $point) {
                $at = Carbon::createFromTimestampMs($point['t']);
                $last = $trip->last_point_at;

                // Doublon, point du futur ou trop ancien : ignoré sans compter comme une erreur
                if (($last && $at->lte($last)) || $at->gt(now()->addMinute()) || $at->lt(now()->subHours(self::MAX_AGE_HOURS))
                    || $at->lt($trip->started_at->copy()->subMinutes(2))) {
                    continue;
                }
                if (($point['accuracy'] ?? 0) > self::MAX_ACCURACY_M) {
                    $rejected++;

                    continue;
                }

                // Fenêtre de recherche : là où le bus peut être depuis le point précédent
                $seconds = $last ? max(1, $at->diffInSeconds($last, true)) : null;
                $from = $last ? max(0, $trip->progress_m - self::BACKTRACK_M) : 0;
                $to = $last ? $trip->progress_m + self::MAX_SPEED_MS * $seconds + 200 : INF;
                $hit = $route->project($point['lat'], $point['lng'], $from, $to);

                if (! $hit || $hit['offset'] > $maxOffset) {
                    $rejected++;
                    $trip->off_route_streak++;
                    if ($trip->off_route_streak >= self::OFF_ROUTE_LIMIT) {
                        $trip->status = Trip::OFF_ROUTE;
                        $trip->ended_at = now();
                        break;
                    }

                    continue;
                }

                $trip->off_route_streak = 0;
                $previous = ['t' => $last?->getTimestampMs(), 'progress' => $trip->progress_m];
                $progress = max($trip->progress_m, (int) round($hit['progress']));
                $arrived = $progress >= $route->total() - self::STOP_RADIUS_M;
                if ($arrived) {
                    $progress = (int) ceil($route->total()); // le passage au terminus est relevé
                }

                $this->recordPassages($trip, $route, $previous, $progress, $point);
                $this->trackDwell($trip, $route, $progress, $at, $state);

                [$trip->lat, $trip->lng] = $route->pointAt($progress);
                $trip->progress_m = $progress;
                $trip->last_point_at = $at;
                $trip->points_count++;
                $accepted++;
                $rows[] = [
                    'trip_id' => $trip->id,
                    'lat' => round($point['lat'], 6),
                    'lng' => round($point['lng'], 6),
                    'accuracy_m' => isset($point['accuracy']) ? (int) min(65535, round($point['accuracy'])) : null,
                    'progress_m' => $progress,
                    'recorded_at' => $at,
                ];

                if ($arrived) {
                    $trip->status = Trip::ENDED;
                    $trip->complete = true;
                    $trip->ended_at = now();
                    break;
                }
            }

            if ($rows) {
                TripPoint::query()->insert($rows);
            }
            $trip->rejected_count += $rejected;
            $trip->state = $state ?: null;
            $trip->save();
        });

        if ($trip->status !== Trip::ACTIVE) {
            $this->trim($trip);
        }

        return ['accepted' => $accepted, 'rejected' => $rejected];
    }

    /**
     * Arrêts franchis entre deux points : l'heure de passage est interpolée selon la distance.
     *
     * @param  array{t: ?int, progress: int}  $previous
     */
    private function recordPassages(Trip $trip, RouteLine $route, array $previous, int $progress, array $point): void
    {
        $next = $trip->last_sequence === null ? 0 : $trip->last_sequence; // index (0) de l'arrêt suivant à franchir
        foreach ($route->cumulative as $i => $cumulative) {
            if ($i < $next || $cumulative > $progress) {
                continue;
            }
            // Le premier point du voyage tombe déjà au-delà de certains arrêts : on ne les a pas vus passer
            if ($previous['t'] === null && $cumulative < $progress - self::STOP_RADIUS_M) {
                $trip->last_sequence = $i + 1;

                continue;
            }
            $span = max(1, $progress - $previous['progress']);
            $ratio = $previous['t'] === null ? 1 : max(0, min(1, ($cumulative - $previous['progress']) / $span));
            $t = $previous['t'] === null ? $point['t'] : (int) round($previous['t'] + $ratio * ($point['t'] - $previous['t']));

            StopPassage::query()->insertOrIgnore([
                'trip_id' => $trip->id,
                'line_direction_id' => $trip->line_direction_id,
                'stop_id' => $route->stops[$i]['id'],
                'sequence' => $i + 1,
                'passed_at' => Carbon::createFromTimestampMs($t),
                'accuracy_m' => isset($point['accuracy']) ? (int) round($point['accuracy']) : null,
            ]);
            $trip->last_sequence = $i + 1;
        }
    }

    /**
     * Temps passé à l'arrêt : du premier au dernier point à moins de 40 m de l'arrêt.
     */
    private function trackDwell(Trip $trip, RouteLine $route, int $progress, Carbon $at, array &$state): void
    {
        $near = null;
        foreach ($route->cumulative as $i => $cumulative) {
            if (abs($progress - $cumulative) <= self::STOP_RADIUS_M) {
                $near = $i + 1;
                break;
            }
        }

        $current = $state['near'] ?? null;
        if ($current && $current['sequence'] !== $near) {
            // On vient de quitter l'arrêt : on enregistre le temps qu'on y a passé
            $dwell = (int) round(($current['last'] - $current['since']) / 1000);
            StopPassage::query()
                ->where(['trip_id' => $trip->id, 'sequence' => $current['sequence']])
                ->update(['dwell_seconds' => min(3600, $dwell)]);
            unset($state['near']);
        }
        if ($near !== null) {
            $since = ($state['near']['sequence'] ?? null) === $near ? $state['near']['since'] : $at->getTimestampMs();
            $state['near'] = ['sequence' => $near, 'since' => $since, 'last' => $at->getTimestampMs()];
        }
    }

    public function end(Trip $trip): void
    {
        if ($trip->status === Trip::ACTIVE) {
            $trip->update(['status' => Trip::ENDED, 'ended_at' => now()]);
        }
        $this->trim($trip);
    }

    /**
     * Vie privée : début et fin du voyage effacés (on ne garde pas où l'usager est monté ni descendu
     * à quelques mètres près). Les passages aux arrêts, lieux publics, sont gardés.
     */
    public function trim(Trip $trip, int $meters = 300): void
    {
        $range = TripPoint::query()->where('trip_id', $trip->id)
            ->selectRaw('min(progress_m) as first, max(progress_m) as last')->first();
        if ($range?->first === null) {
            return;
        }
        TripPoint::query()->where('trip_id', $trip->id)
            ->where(fn ($q) => $q->where('progress_m', '<', $range->first + $meters)->orWhere('progress_m', '>', $range->last - $meters))
            ->delete();
    }
}
