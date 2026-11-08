<?php

namespace App\Services\Live;

use App\Models\Line;
use App\Models\LineDirection;
use App\Models\StopPassage;
use App\Models\Trip;
use App\Models\TripPoint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Reçoit les positions d'un voyage partagé : filtre les points douteux, les ramène sur le trajet
 * de la ligne, et relève l'heure de passage à chaque arrêt.
 *
 * Les points arrivent par lots (le téléphone les garde quand le réseau coupe) : un point déjà vu
 * (même heure ou plus ancien) est ignoré, on peut donc renvoyer un lot sans risque.
 *
 * Le sens peut être inconnu au départ (« Je suis dans ce bus » depuis la fiche ligne) : les premiers
 * points sont gardés tels quels, puis rejoués sur le sens où l'avancement augmente.
 *
 * Rien n'est effacé : voyages, passages et points servent aux statistiques et à la prédiction.
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

    /** Avancement minimal dans un sens pour l'adopter */
    private const DETECT_MIN_GAIN_M = 60;

    /** Part des points qui doivent coller au trajet du sens retenu */
    private const DETECT_MIN_SHARE = 0.8;

    /** Distance parcourue sans qu'aucun sens ne colle : l'usager n'est pas sur cette ligne */
    private const DETECT_GIVE_UP_M = 600;

    /** @var array<int, RouteLine> */
    private array $routes = [];

    /**
     * @return array{trip: Trip, token: string}
     */
    public function start(Line $line, ?LineDirection $direction, string $client): array
    {
        $token = Str::random(48);
        $trip = Trip::query()->create([
            'line_id' => $line->id,
            'line_direction_id' => $direction?->id,
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
        if (! $trip->line_direction_id) {
            return $this->ingestUndetected($trip, $points);
        }

        $direction = $trip->direction;
        $route = $this->route($direction);
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

        return ['accepted' => $accepted, 'rejected' => $rejected];
    }

    private function route(LineDirection $direction): RouteLine
    {
        return $this->routes[$direction->id] ??= RouteLine::forDirection($direction);
    }

    /**
     * Sens encore inconnu : on garde les points, puis on cherche le sens où l'usager avance.
     *
     * @param  list<array{lat: float, lng: float, accuracy?: ?float, t: int}>  $points
     * @return array{accepted: int, rejected: int}
     */
    private function ingestUndetected(Trip $trip, array $points): array
    {
        $last = TripPoint::query()->where('trip_id', $trip->id)->max('recorded_at');
        $rows = [];
        $rejected = 0;
        foreach ($points as $point) {
            $at = Carbon::createFromTimestampMs($point['t']);
            if (($last && $at->lte(Carbon::parse($last))) || $at->gt(now()->addMinute()) || $at->lt($trip->started_at->copy()->subMinutes(2))) {
                continue;
            }
            if (($point['accuracy'] ?? 0) > self::MAX_ACCURACY_M) {
                $rejected++;

                continue;
            }
            $rows[] = [
                'trip_id' => $trip->id,
                'lat' => round($point['lat'], 6),
                'lng' => round($point['lng'], 6),
                'accuracy_m' => isset($point['accuracy']) ? (int) min(65535, round($point['accuracy'])) : null,
                'progress_m' => null,
                'recorded_at' => $at,
            ];
        }
        if ($rows) {
            TripPoint::query()->insert($rows);
        }
        $trip->rejected_count += $rejected;
        $trip->updated_at = now(); // l'usager est toujours là (voir transit:trips-cleanup)
        $trip->save();

        $stored = TripPoint::query()->where('trip_id', $trip->id)->orderBy('recorded_at')->get();
        $direction = $this->detectDirection($trip, $stored);
        if (! $direction) {
            return ['accepted' => 0, 'rejected' => $rejected];
        }

        // Sens trouvé : les points gardés sont rejoués sur ce sens, avec leur avancement
        $trip->update(['line_direction_id' => $direction->id]);
        $trip->setRelation('direction', $direction);
        TripPoint::query()->where('trip_id', $trip->id)->delete();
        $replay = $stored->map(fn (TripPoint $p) => [
            'lat' => $p->lat, 'lng' => $p->lng, 'accuracy' => $p->accuracy_m, 't' => $p->recorded_at->getTimestampMs(),
        ])->all();
        $result = $this->ingest($trip, $replay);

        return ['accepted' => $result['accepted'], 'rejected' => $result['rejected'] + $rejected];
    }

    /**
     * Le sens où les points collent au trajet et où l'avancement augmente le plus.
     * Abandonne (voyage « hors ligne ») si l'usager a bien bougé sans suivre aucun sens.
     *
     * @param  Collection<int, TripPoint>  $points
     */
    private function detectDirection(Trip $trip, Collection $points): ?LineDirection
    {
        if ($points->count() < 3) {
            return null;
        }

        $best = null;
        $bestGain = self::DETECT_MIN_GAIN_M;
        foreach ($trip->line->directions as $direction) {
            $route = $this->route($direction);
            $maxOffset = $direction->is_partial ? self::MAX_OFFSET_PARTIAL_M : self::MAX_OFFSET_M;
            $progress = [];
            foreach ($points as $point) {
                $hit = $route->project($point->lat, $point->lng);
                if ($hit && $hit['offset'] <= $maxOffset) {
                    $progress[] = $hit['progress'];
                }
            }
            if (count($progress) < 3 || count($progress) / $points->count() < self::DETECT_MIN_SHARE) {
                continue;
            }
            // Avancement net, et plus de pas en avant qu'en arrière
            $gain = end($progress) - $progress[0];
            $forward = 0;
            for ($i = 1, $n = count($progress); $i < $n; $i++) {
                $forward += $progress[$i] <=> $progress[$i - 1];
            }
            if ($gain > $bestGain && $forward > 0) {
                [$best, $bestGain] = [$direction, $gain];
            }
        }

        if (! $best) {
            $first = $points->first();
            $moved = (new RouteLine([
                ['id' => 0, 'lat' => $first->lat, 'lng' => $first->lng],
                ['id' => 0, 'lat' => $points->last()->lat, 'lng' => $points->last()->lng],
            ]))->total();
            if ($moved >= self::DETECT_GIVE_UP_M) {
                $trip->update(['status' => Trip::OFF_ROUTE, 'ended_at' => now()]);
            }
        }

        return $best;
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
    }
}
