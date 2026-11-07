<?php

namespace App\Services\Transit;

use App\Models\LineSchedule;
use App\Models\Stop;
use Illuminate\Support\Facades\DB;

/**
 * Combinaisons de lignes quand aucune ligne directe ne convient.
 *
 * Chaque trajet reçoit un « coût » en minutes ressenties, qui imite les choix d'un habitué :
 *  - la marche pèse plus lourd que le trajet assis, surtout pour changer de ligne ;
 *  - chaque montée coûte une attente, chaque changement une gêne en plus : un changement plutôt que deux ;
 *  - le bus SOTRA passe avant le gbaka et le wôrô-wôrô à trajet comparable ;
 *  - on change de préférence dans une grande gare (Adjamé, Plateau…), où passent beaucoup de lignes ;
 *  - pas de détour démesuré, pas de bus pour quelques centaines de mètres, pas deux fois la même ligne.
 *
 * Le calcul part du départ (premières lignes possibles) et de l'arrivée (dernières lignes possibles),
 * puis cherche où les raccorder, à pied ou par une ligne intermédiaire.
 */
class TransferPlanner
{
    // Vitesses moyennes, arrêts et embouteillages compris
    private const WALK_M_PER_MIN = 75;

    private const RIDE_M_PER_MIN = 250;

    // Poids ressentis
    private const WALK_WEIGHT = 1.5;

    private const TRANSFER_WALK_WEIGHT = 2.0;

    private const BOARDING_MIN = 5;   // attente à chaque montée

    private const TRANSFER_MIN = 7;   // gêne d'un changement, en plus de l'attente

    /** Préférence pour le bus : pénalité en minutes par trajet… */
    private const MODE_MIN = ['sotra' => 0, 'gbaka' => 3, 'woro-woro' => 5, 'autre' => 5];

    /** … et par kilomètre : on reste dans le bus plutôt que de finir en wôrô-wôrô, plus cher. */
    private const MODE_RIDE_WEIGHT = ['sotra' => 1.0, 'gbaka' => 1.05, 'woro-woro' => 1.2, 'autre' => 1.2];

    /** En dessous, on marche plutôt que de prendre un bus. */
    private const MIN_LEG_M = 600;

    /** Lignes gardées par arrêt à chaque étape (pour varier les propositions). */
    private const KEEP_PER_STOP = 4;

    /** Écart de coût toléré avec la meilleure proposition. */
    private const MAX_EXTRA_MIN = 20;

    private const MAX_RESULTS = 5;

    /** À moins de tant de minutes ressenties de la meilleure, une combinaison 100 % bus SOTRA passe devant. */
    private const BUS_FIRST_WINDOW_MIN = 15;

    private RouteSearchService $geo;

    private TransitNetwork $net;

    /** @var array<int, true>|null lignes autorisées (filtre de types) */
    private ?array $allowedDirs = null;

    public function __construct()
    {
        $this->geo = new RouteSearchService;
    }

    /**
     * @param  array<int, int>  $origins  arrêts proches du départ => marche en m
     * @param  array<int, int>  $destinations  arrêts proches de l'arrivée => marche en m
     * @param  list<string>|null  $types
     * @return list<array>
     */
    public function plan(float $fromLat, float $fromLng, float $toLat, float $toLng, array $origins, array $destinations, ?array $types = null): array
    {
        if (! $origins || ! $destinations) {
            return [];
        }

        $this->net = TransitNetwork::load();
        $this->allowedDirs = $types ? array_fill_keys(array_keys(array_filter($this->net->dirs, fn ($d) => in_array($d['type'], $types, true))), true) : null;
        $crow = $this->geo->distance($fromLat, $fromLng, $toLat, $toLng);
        $ctx = ['from' => [$fromLat, $fromLng], 'to' => [$toLat, $toLng], 'crow' => $crow];

        $forward = $this->forward($origins);
        $backward = $this->backward($destinations);

        $plans = $this->oneChange($forward, $backward, $ctx);
        $max = self::MAX_RESULTS;
        if (! $plans) {
            $plans = $this->twoChanges($forward, $backward, $ctx);
            $max = 3;
        }
        if (! $plans) {
            return [];
        }

        usort($plans, fn ($a, $b) => $a['cost'] <=> $b['cost']);
        $plans = $this->diversify($this->busFirst($plans), $max);

        return $this->present($plans, $origins, $destinations);
    }

    /**
     * Coût ressenti d'un trajet direct, pour le comparer aux combinaisons.
     */
    public function directCost(array $result): ?float
    {
        $this->net ??= TransitNetwork::load();
        $dir = $this->net->dirs[$result['direction']['id']] ?? null;
        if (! $dir) {
            return null;
        }
        $i = array_search($result['board']['id'], $dir['seq'], true);
        $j = $i === false ? false : $this->indexAfter($dir, $result['alight']['id'], $i);
        if ($j === null || $j === false) {
            return null;
        }

        return $this->walkMin($result['walk']) + $this->rideMin($dir['cum'][$j] - $dir['cum'][$i], $dir) + $this->boarding($dir);
    }

    /**
     * Premières lignes : depuis chaque arrêt proche du départ, jusqu'à chaque arrêt en aval.
     *
     * @param  array<int, int>  $origins
     * @return array<int, list<array>> arrêt d'arrivée => meilleures montées, une par ligne
     */
    private function forward(array $origins): array
    {
        // Pour chaque sens : le point de montée qui donne le moins de marche, à trajet égal
        $boards = [];
        foreach ($origins as $stop => $walk) {
            foreach ($this->net->passages($stop) as [$dirId, $i]) {
                if (! $this->allowed($dirId)) {
                    continue;
                }
                $dir = $this->net->dirs[$dirId];
                $score = $this->walkMin($walk) - $this->rideMin($dir['cum'][$i], $dir);
                if (! isset($boards[$dirId]) || $score < $boards[$dirId]['score']) {
                    $boards[$dirId] = ['score' => $score, 'i' => $i, 'walk' => $walk];
                }
            }
        }

        $labels = [];
        foreach ($boards as $dirId => $b) {
            $dir = $this->net->dirs[$dirId];
            $end = $dir['loop'] ? $b['i'] + $dir['n'] : count($dir['seq']);
            for ($j = $b['i'] + 1; $j < $end; $j++) {
                $ride = $dir['cum'][$j] - $dir['cum'][$b['i']];
                if ($ride < self::MIN_LEG_M) {
                    continue;
                }
                $this->keep($labels, $dir['seq'][$j], [
                    'dir' => $dirId, 'line' => $dir['line'], 'i' => $b['i'], 'j' => $j, 'walk' => $b['walk'], 'ride' => $ride,
                    'cost' => $this->walkMin($b['walk']) + $this->rideMin($ride, $dir) + $this->boarding($dir),
                ]);
            }
        }

        return $labels;
    }

    /**
     * Dernières lignes : depuis chaque arrêt en amont, jusqu'à un arrêt proche de l'arrivée.
     *
     * @param  array<int, int>  $destinations
     * @return array<int, list<array>> arrêt de montée => meilleures descentes, une par ligne
     */
    private function backward(array $destinations): array
    {
        $alights = [];
        foreach ($destinations as $stop => $walk) {
            foreach ($this->net->passages($stop) as [$dirId, $j]) {
                if (! $this->allowed($dirId)) {
                    continue;
                }
                $dir = $this->net->dirs[$dirId];
                $j = $dir['loop'] ? $j + $dir['n'] : $j; // sur une boucle, on peut monter avant le terminus
                $score = $this->walkMin($walk) + $this->rideMin($dir['cum'][$j], $dir);
                if (! isset($alights[$dirId]) || $score < $alights[$dirId]['score']) {
                    $alights[$dirId] = ['score' => $score, 'j' => $j, 'walk' => $walk];
                }
            }
        }

        $labels = [];
        foreach ($alights as $dirId => $a) {
            $dir = $this->net->dirs[$dirId];
            $start = $dir['loop'] ? $a['j'] - $dir['n'] + 1 : 0;
            for ($i = $start; $i < $a['j']; $i++) {
                $ride = $dir['cum'][$a['j']] - $dir['cum'][$i];
                if ($ride < self::MIN_LEG_M) {
                    continue;
                }
                $this->keep($labels, $dir['seq'][$i], [
                    'dir' => $dirId, 'line' => $dir['line'], 'i' => $i, 'j' => $a['j'], 'walk' => $a['walk'], 'ride' => $ride,
                    'cost' => $this->walkMin($a['walk']) + $this->rideMin($ride, $dir) + $this->boarding($dir),
                ]);
            }
        }

        return $labels;
    }

    /**
     * Une ligne jusqu'à un arrêt de changement, puis une autre ligne jusqu'à l'arrivée.
     */
    private function oneChange(array $forward, array $backward, array $ctx): array
    {
        $best = [];
        foreach ($forward as $t => $firsts) {
            if (! $this->onTheWay($t, $ctx)) {
                continue;
            }
            foreach ($this->walkable($t) as $u => $walk) {
                foreach ($backward[$u] ?? [] as $last) {
                    foreach ($firsts as $first) {
                        if ($first['line'] === $last['line']) {
                            continue;
                        }
                        $detour = $this->detour($first['ride'] + $last['ride'], $ctx['crow']);
                        if ($detour === null) {
                            continue;
                        }
                        $cost = $first['cost'] + $last['cost'] + $this->change($walk, $t, $u) + $detour;
                        $key = $first['line'].'-'.$last['line'];
                        if (! isset($best[$key]) || $cost < $best[$key]['cost']) {
                            $best[$key] = ['cost' => $cost, 'legs' => [$first, $last], 'walks' => [$walk]];
                        }
                    }
                }
            }
        }

        return array_values($best);
    }

    /**
     * Deux changements : une ligne intermédiaire relie une première ligne à une dernière.
     */
    private function twoChanges(array $forward, array $backward, array $ctx): array
    {
        // Montée dans chaque ligne intermédiaire possible : la moins coûteuse
        $middles = [];
        foreach ($forward as $t => $firsts) {
            if (! $this->onTheWay($t, $ctx)) {
                continue;
            }
            foreach ($this->walkable($t) as $u => $walk) {
                foreach ($this->net->passages($u) as [$dirId, $i]) {
                    if (! $this->allowed($dirId)) {
                        continue;
                    }
                    $dir = $this->net->dirs[$dirId];
                    foreach ($firsts as $first) {
                        if ($first['line'] === $dir['line']) {
                            continue;
                        }
                        $score = $first['cost'] + $this->change($walk, $t, $u) - $this->rideMin($dir['cum'][$i], $dir);
                        if (! isset($middles[$dirId]) || $score < $middles[$dirId]['score']) {
                            $middles[$dirId] = ['score' => $score, 'i' => $i, 'first' => $first, 'walk' => $walk];
                        }
                        break; // les premières lignes sont triées : la première convenable suffit
                    }
                }
            }
        }

        $best = [];
        foreach ($middles as $dirId => $m) {
            $dir = $this->net->dirs[$dirId];
            $end = $dir['loop'] ? $m['i'] + $dir['n'] : count($dir['seq']);
            for ($j = $m['i'] + 1; $j < $end; $j++) {
                $ride = $dir['cum'][$j] - $dir['cum'][$m['i']];
                $s = $dir['seq'][$j];
                if ($ride < self::MIN_LEG_M || ! $this->onTheWay($s, $ctx)) {
                    continue;
                }
                $middle = ['dir' => $dirId, 'line' => $dir['line'], 'i' => $m['i'], 'j' => $j, 'ride' => $ride];
                foreach ($this->walkable($s) as $v => $walk) {
                    foreach ($backward[$v] ?? [] as $last) {
                        if ($last['line'] === $dir['line'] || $last['line'] === $m['first']['line']) {
                            continue;
                        }
                        $detour = $this->detour($m['first']['ride'] + $ride + $last['ride'], $ctx['crow']);
                        if ($detour === null) {
                            continue;
                        }
                        $cost = $m['score'] + $this->rideMin($dir['cum'][$j], $dir) + $this->boarding($dir)
                            + $this->change($walk, $s, $v) + $last['cost'] + $detour;
                        $key = $m['first']['line'].'-'.$dir['line'].'-'.$last['line'];
                        if (! isset($best[$key]) || $cost < $best[$key]['cost']) {
                            $best[$key] = ['cost' => $cost, 'legs' => [$m['first'], $middle, $last], 'walks' => [$m['walk'], $walk]];
                        }
                    }
                }
            }
        }

        return array_values($best);
    }

    /**
     * Le bus d'abord : parmi les propositions proches de la meilleure, celles entièrement en SOTRA passent en tête.
     */
    private function busFirst(array $plans): array
    {
        $window = $plans[0]['cost'] + self::BUS_FIRST_WINDOW_MIN;
        $bus = $others = [];
        foreach ($plans as $plan) {
            $allBus = ! array_filter($plan['legs'], fn ($leg) => $this->net->dirs[$leg['dir']]['type'] !== 'sotra');
            $allBus && $plan['cost'] <= $window ? $bus[] = $plan : $others[] = $plan;
        }

        return [...$bus, ...$others];
    }

    /**
     * Garde des propositions variées : pas cinq fois la même première ligne ou le même changement.
     */
    private function diversify(array $plans, int $max): array
    {
        $limit = min(array_column($plans, 'cost')) + self::MAX_EXTRA_MIN;
        $kept = [];
        $firsts = $lasts = $hubs = [];
        foreach ($plans as $plan) {
            if ($plan['cost'] > $limit || count($kept) >= $max) {
                break;
            }
            $first = $plan['legs'][0]['line'];
            $last = end($plan['legs'])['line'];
            $hub = $this->net->dirs[$plan['legs'][1]['dir']]['seq'][$plan['legs'][1]['i']];
            if (($firsts[$first] ?? 0) >= 2 || ($lasts[$last] ?? 0) >= 2 || ($hubs[$hub] ?? 0) >= 2) {
                continue;
            }
            $firsts[$first] = ($firsts[$first] ?? 0) + 1;
            $lasts[$last] = ($lasts[$last] ?? 0) + 1;
            $hubs[$hub] = ($hubs[$hub] ?? 0) + 1;
            $kept[] = $plan;
        }

        return $kept;
    }

    /**
     * Mise en forme : une étape par ligne, avec les arrêts de montée et de descente.
     */
    private function present(array $plans, array $origins, array $destinations): array
    {
        $stopIds = $lineIds = $dirIds = [];
        foreach ($plans as $plan) {
            foreach ($plan['legs'] as $leg) {
                $dir = $this->net->dirs[$leg['dir']];
                $stopIds[] = $dir['seq'][$leg['i']];
                $stopIds[] = $dir['seq'][$leg['j']];
                $lineIds[] = $dir['line'];
                $dirIds[] = $leg['dir'];
            }
        }
        $stops = Stop::query()->whereIn('id', array_unique($stopIds))->get(['id', 'name', 'slug', 'lat', 'lng'])->keyBy('id');
        $lines = DB::table('lines')->whereIn('id', array_unique($lineIds))->get(['id', 'ref', 'name', 'slug', 'type', 'fare', 'accepts_student_card'])->keyBy('id');
        $directions = DB::table('line_directions')->whereIn('id', array_unique($dirIds))
            ->get(['id', 'name', 'origin_label', 'destination_label'])->keyBy('id');
        $schedules = LineSchedule::query()->whereIn('line_direction_id', $directions->keys())->get()->groupBy('line_direction_id');

        $stop = fn (int $id, int $walk) => [
            'id' => $id, 'name' => $stops[$id]->name, 'slug' => $stops[$id]->slug,
            'lat' => $stops[$id]->lat, 'lng' => $stops[$id]->lng, 'walk' => $walk,
        ];

        return array_map(function (array $plan) use ($stop, $lines, $directions, $schedules, $origins, $destinations) {
            $count = count($plan['legs']);
            $legs = [];
            $walk = 0;
            $stopsCount = 0;
            foreach ($plan['legs'] as $k => $leg) {
                $dir = $this->net->dirs[$leg['dir']];
                $boardId = $dir['seq'][$leg['i']];
                $alightId = $dir['seq'][$leg['j']];
                $boardWalk = $k === 0 ? $origins[$boardId] : $plan['walks'][$k - 1];
                $alightWalk = $k === $count - 1 ? $destinations[$alightId] : 0;
                $walk += $boardWalk + $alightWalk;
                $stopsCount += $leg['j'] - $leg['i'];
                $legs[] = [
                    'line' => (array) $lines[$dir['line']],
                    'direction' => [
                        ...(array) $directions[$leg['dir']],
                        'schedules' => ($schedules[$leg['dir']] ?? collect())->map->summary()->values()->all(),
                    ],
                    'board' => $stop($boardId, $boardWalk),
                    'alight' => $stop($alightId, $alightWalk),
                    'stops' => $leg['j'] - $leg['i'],
                    // Lignes au lieu de montée : pour un changement, la taille de la gare
                    'lines_here' => $k === 0 ? ($this->net->hubs[$boardId] ?? 1)
                        : $this->linesAt($this->net->dirs[$plan['legs'][$k - 1]['dir']]['seq'][$plan['legs'][$k - 1]['j']], $boardId),
                ];
            }

            return [
                'legs' => $legs,
                'changes' => $count - 1,
                'walk' => $walk,
                'stops' => $stopsCount,
                'score' => (int) round($plan['cost']),
            ];
        }, $plans);
    }

    // ---------- Règles ----------

    private function allowed(int $dirId): bool
    {
        return $this->allowedDirs === null || isset($this->allowedDirs[$dirId]);
    }

    private function walkMin(int $meters, float $weight = self::WALK_WEIGHT): float
    {
        return $meters / self::WALK_M_PER_MIN * $weight;
    }

    private function boarding(array $dir): float
    {
        return self::BOARDING_MIN + (self::MODE_MIN[$dir['type']] ?? 5);
    }

    private function rideMin(int $meters, array $dir): float
    {
        return $meters / self::RIDE_M_PER_MIN * (self::MODE_RIDE_WEIGHT[$dir['type']] ?? 1.2);
    }

    /** Coût d'un changement de l'arrêt $from à l'arrêt $to (à pied) ; les grandes gares sont favorisées. */
    private function change(int $walk, int $from, int $to): float
    {
        $lines = $this->linesAt($from, $to);

        return self::TRANSFER_MIN + $this->walkMin($walk, self::TRANSFER_WALK_WEIGHT) - min(5, 1.5 * log(1 + $lines));
    }

    /** Pénalité de détour, ou null si le trajet fait un crochet qu'un habitué ne ferait pas. */
    private function detour(int $ride, float $crow): ?float
    {
        if ($ride > 2.2 * $crow + 1500) {
            return null;
        }

        return max(0, $ride - 1.4 * $crow) / self::RIDE_M_PER_MIN * 0.5;
    }

    /** Un changement ne doit pas trop éloigner du chemin entre le départ et l'arrivée. */
    private function onTheWay(int $stop, array $ctx): bool
    {
        [$lat, $lng] = $this->net->position($stop);

        return $this->geo->distance($ctx['from'][0], $ctx['from'][1], $lat, $lng)
            + $this->geo->distance($lat, $lng, $ctx['to'][0], $ctx['to'][1]) <= 1.6 * $ctx['crow'] + 1000;
    }

    /** L'arrêt lui-même et ceux à distance de marche pour changer, du plus proche au plus loin. */
    private function walkable(int $stop): array
    {
        return [$stop => 0] + $this->net->neighbours($stop);
    }

    /** Nombre de lignes au lieu du changement (le plus grand des deux arrêts). */
    private function linesAt(int $from, int $to): int
    {
        return max($this->net->hubs[$from] ?? 1, $this->net->hubs[$to] ?? 1);
    }

    private function keep(array &$labels, int $stop, array $label): void
    {
        foreach ($labels[$stop] ?? [] as $k => $existing) {
            if ($existing['line'] === $label['line']) {
                if ($label['cost'] < $existing['cost']) {
                    $labels[$stop][$k] = $label;
                    usort($labels[$stop], fn ($a, $b) => $a['cost'] <=> $b['cost']);
                }

                return;
            }
        }
        $labels[$stop][] = $label;
        usort($labels[$stop], fn ($a, $b) => $a['cost'] <=> $b['cost']);
        if (count($labels[$stop]) > self::KEEP_PER_STOP) {
            array_pop($labels[$stop]);
        }
    }

    private function indexAfter(array $dir, int $stop, int $i): ?int
    {
        $end = $dir['loop'] ? $i + $dir['n'] : count($dir['seq']);
        for ($j = $i + 1; $j < $end; $j++) {
            if ($dir['seq'][$j] === $stop) {
                return $j;
            }
        }

        return null;
    }
}
