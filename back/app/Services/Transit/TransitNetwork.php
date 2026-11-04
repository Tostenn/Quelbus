<?php

namespace App\Services\Transit;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Le réseau en mémoire pour le calcul des correspondances : arrêts, sens de lignes avec distances
 * cumulées, arrêts proches à pied et « taille » de chaque arrêt (nombre de lignes qui y passent).
 *
 * Construit une fois puis mis en cache ; la clé change dès qu'un import modifie les données.
 */
class TransitNetwork
{
    /** Marche maximale pour changer de ligne. */
    public const TRANSFER_WALK_M = 250;

    /** Rayon dans lequel on compte les lignes d'un arrêt : une gare s'étend sur plusieurs arrêts. */
    private const HUB_RADIUS_M = 250;

    /** Cellule de la grille spatiale, en degrés (≈ 280 m). */
    private const CELL = 0.0025;

    /*
     * Données compactes (un réseau complet tient en quelques Mo) : un passage ou un voisin = un entier.
     */

    /** @var array<int, float> */
    public array $lat = [];

    /** @var array<int, float> */
    public array $lng = [];

    /**
     * Sens de ligne. Pour une boucle, la séquence est déroulée deux fois pour pouvoir repasser
     * par le terminus ; `n` est alors le nombre d'arrêts d'un tour.
     *
     * @var array<int, array{line: int, type: string, loop: bool, n: int, seq: list<int>, cum: list<int>}>
     */
    public array $dirs = [];

    /** @var array<int, string> id d'arrêt => passages, en binaire (entiers 32 bits : id du sens << 11 | position) */
    public array $at = [];

    /** @var array<int, string> id d'arrêt => voisins à pied, en binaire (id << 9 | distance en m) */
    public array $near = [];

    /** Voisins gardés par arrêt (les plus proches). */
    private const MAX_NEIGHBOURS = 16;

    /** @var array<int, int> id d'arrêt => nombre de lignes distinctes autour */
    public array $hubs = [];

    private static ?self $memo = null;

    private static ?string $memoKey = null;

    public static function load(): self
    {
        $fingerprint = implode('|', [
            DB::table('direction_stops')->count(), DB::table('direction_stops')->max('id'),
            DB::table('line_directions')->max('updated_at'), DB::table('stops')->max('id'), DB::table('stops')->max('updated_at'),
        ]);
        $key = 'transit-network:v3:'.md5($fingerprint);

        if (self::$memoKey !== $key) {
            // Le cache ne restaure pas d'objets : on y range de simples tableaux
            $data = Cache::store(config('transit.cache_store'))->rememberForever($key, fn () => self::build()->toArray());
            self::$memo = self::fromArray($data);
            self::$memoKey = $key;
        }

        return self::$memo;
    }

    public static function forget(): void
    {
        self::$memo = null;
        self::$memoKey = null;
    }

    /** @return list<array{0: int, 1: int}> [[id du sens, position], …] */
    public function passages(int $stop): array
    {
        if (! isset($this->at[$stop])) {
            return [];
        }

        return array_map(fn (int $p) => [$p >> 11, $p & 2047], array_values(unpack('V*', $this->at[$stop])));
    }

    /** @return array<int, int> arrêts à distance de marche => distance en m, du plus proche au plus loin */
    public function neighbours(int $stop): array
    {
        $near = [];
        if (isset($this->near[$stop])) {
            foreach (unpack('V*', $this->near[$stop]) as $packed) {
                $near[$packed >> 9] = $packed & 511;
            }
        }

        return $near; // déjà triés à la construction
    }

    /** @return array{0: float, 1: float} */
    public function position(int $stop): array
    {
        return [$this->lat[$stop], $this->lng[$stop]];
    }

    private function toArray(): array
    {
        return ['lat' => $this->lat, 'lng' => $this->lng, 'dirs' => $this->dirs, 'at' => $this->at, 'near' => $this->near, 'hubs' => $this->hubs];
    }

    private static function fromArray(array $data): self
    {
        $network = new self;
        foreach ($data as $property => $value) {
            $network->{$property} = $value;
        }

        return $network;
    }

    private static function build(): self
    {
        $network = new self;

        foreach (DB::table('stops')->select(['id', 'lat', 'lng'])->cursor() as $stop) {
            $network->lat[$stop->id] = (float) $stop->lat;
            $network->lng[$stop->id] = (float) $stop->lng;
        }

        $meta = [];
        foreach (DB::table('line_directions as ld')->join('lines as l', 'l.id', '=', 'ld.line_id')
            ->get(['ld.id', 'ld.line_id', 'ld.is_loop', 'l.type']) as $row) {
            $meta[$row->id] = [(int) $row->line_id, (bool) $row->is_loop, $row->type];
        }

        $sequences = [];
        foreach (DB::table('direction_stops')->select(['line_direction_id', 'stop_id'])
            ->orderBy('line_direction_id')->orderBy('sequence')->cursor() as $row) {
            $sequences[$row->line_direction_id][] = (int) $row->stop_id;
        }

        $geo = new RouteSearchService;
        $lineSets = [];
        $passages = [];
        foreach ($sequences as $dirId => $seq) {
            if (! isset($meta[$dirId]) || count($seq) < 2) {
                continue;
            }
            [$lineId, $isLoop, $type] = $meta[$dirId];
            $loop = $isLoop && $seq[0] === end($seq);
            if ($loop) {
                array_pop($seq);
                $seq = [...$seq, ...$seq];
            }

            $cum = [0];
            for ($i = 1, $count = count($seq); $i < $count; $i++) {
                $cum[] = $cum[$i - 1] + (int) round($geo->distance(
                    $network->lat[$seq[$i - 1]], $network->lng[$seq[$i - 1]], $network->lat[$seq[$i]], $network->lng[$seq[$i]],
                ));
            }

            $n = min($loop ? intdiv(count($seq), 2) : count($seq), 2047);
            $network->dirs[$dirId] = ['line' => $lineId, 'type' => $type, 'loop' => $loop, 'n' => $n, 'seq' => $seq, 'cum' => $cum];
            for ($i = 0; $i < $n; $i++) {
                $passages[$seq[$i]][] = $dirId << 11 | $i;
                $lineSets[$seq[$i]][$lineId] = true;
            }
        }
        unset($sequences);
        foreach ($passages as $stop => $list) {
            $network->at[$stop] = pack('V*', ...$list);
        }
        unset($passages);

        // Grille spatiale : voisins à pied et taille des arrêts
        $grid = [];
        foreach ($network->lat as $id => $lat) {
            $grid[(int) floor($lat / self::CELL)][(int) floor($network->lng[$id] / self::CELL)][] = $id;
        }
        foreach ($network->lat as $id => $lat) {
            $lng = $network->lng[$id];
            $cy = (int) floor($lat / self::CELL);
            $cx = (int) floor($lng / self::CELL);
            $lines = $lineSets[$id] ?? [];
            $near = [];
            for ($y = $cy - 1; $y <= $cy + 1; $y++) {
                for ($x = $cx - 1; $x <= $cx + 1; $x++) {
                    foreach ($grid[$y][$x] ?? [] as $other) {
                        if ($other === $id || ! isset($lineSets[$other])) {
                            continue;
                        }
                        $d = (int) round($geo->distance($lat, $lng, $network->lat[$other], $network->lng[$other]));
                        if ($d <= self::TRANSFER_WALK_M) {
                            $near[$other] = $d;
                        }
                        if ($d <= self::HUB_RADIUS_M) {
                            $lines += $lineSets[$other];
                        }
                    }
                }
            }
            if ($near) {
                asort($near);
                $network->near[$id] = pack('V*', ...array_map(
                    fn (int $other, int $d) => $other << 9 | $d,
                    array_keys($near = array_slice($near, 0, self::MAX_NEIGHBOURS, true)), $near,
                ));
            }
            if ($lines) {
                $network->hubs[$id] = count($lines);
            }
        }

        return $network;
    }
}
