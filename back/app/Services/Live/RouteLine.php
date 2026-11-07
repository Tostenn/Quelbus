<?php

namespace App\Services\Live;

use App\Models\LineDirection;

/**
 * Le trajet d'un sens de ligne, comme la suite de ses arrêts reliés en ligne droite.
 * Toujours ordonné et dans le bon sens, contrairement aux tracés OpenStreetMap, parfois en morceaux.
 *
 * Calculs en mètres sur une projection plane locale : largement assez précis à l'échelle d'une ville.
 */
class RouteLine
{
    private const M_PER_DEG_LAT = 110_540;

    private const M_PER_DEG_LNG_EQUATOR = 111_320;

    private float $cosLat;

    /** @var list<array{float, float}> arrêts en mètres (x, y) */
    private array $xy = [];

    /** @var list<float> distance cumulée de chaque arrêt depuis le départ */
    public array $cumulative = [];

    /**
     * @param  list<array{id: int, lat: float, lng: float}>  $stops  dans l'ordre du trajet
     */
    public function __construct(public readonly array $stops)
    {
        $lat0 = $stops ? array_sum(array_column($stops, 'lat')) / count($stops) : 0;
        $this->cosLat = cos(deg2rad($lat0));

        $total = 0.0;
        foreach ($stops as $i => $stop) {
            $this->xy[$i] = $this->toXy($stop['lat'], $stop['lng']);
            if ($i > 0) {
                $total += $this->length($this->xy[$i - 1], $this->xy[$i]);
            }
            $this->cumulative[$i] = $total;
        }
    }

    public static function forDirection(LineDirection $direction): self
    {
        $stops = $direction->stops()->get(['stops.id', 'lat', 'lng'])
            ->map(fn ($s) => ['id' => $s->id, 'lat' => (float) $s->lat, 'lng' => (float) $s->lng])
            ->all();

        return new self($stops);
    }

    public function total(): float
    {
        return $this->cumulative ? end($this->cumulative) : 0.0;
    }

    /**
     * Le point du trajet le plus proche, cherché entre deux avancements (pour ne pas sauter
     * sur l'autre bout d'une boucle ou d'un aller-retour qui se superposent).
     *
     * @return array{progress: float, offset: float, lat: float, lng: float}|null
     */
    public function project(float $lat, float $lng, float $from = 0, float $to = INF): ?array
    {
        if (count($this->xy) < 2) {
            return null;
        }
        $p = $this->toXy($lat, $lng);
        $best = null;
        for ($i = 1, $n = count($this->xy); $i < $n; $i++) {
            if ($this->cumulative[$i] < $from || $this->cumulative[$i - 1] > $to) {
                continue;
            }
            [$ax, $ay] = $this->xy[$i - 1];
            [$bx, $by] = $this->xy[$i];
            $dx = $bx - $ax;
            $dy = $by - $ay;
            $len2 = $dx * $dx + $dy * $dy;
            $t = $len2 > 0 ? max(0, min(1, (($p[0] - $ax) * $dx + ($p[1] - $ay) * $dy) / $len2)) : 0;
            $x = $ax + $t * $dx;
            $y = $ay + $t * $dy;
            $offset = hypot($p[0] - $x, $p[1] - $y);
            $progress = $this->cumulative[$i - 1] + $t * sqrt($len2);
            if ($progress < $from || $progress > $to) {
                continue;
            }
            if ($best === null || $offset < $best['offset']) {
                $best = ['progress' => $progress, 'offset' => $offset, 'x' => $x, 'y' => $y];
            }
        }
        if ($best === null) {
            return null;
        }
        [$snapLat, $snapLng] = $this->toLatLng($best['x'], $best['y']);

        return ['progress' => $best['progress'], 'offset' => $best['offset'], 'lat' => $snapLat, 'lng' => $snapLng];
    }

    /**
     * Position sur le trajet à un avancement donné.
     *
     * @return array{float, float} lat, lng
     */
    public function pointAt(float $progress): array
    {
        $n = count($this->xy);
        if ($n === 0) {
            return [0.0, 0.0];
        }
        for ($i = 1; $i < $n; $i++) {
            if ($this->cumulative[$i] >= $progress) {
                $length = $this->cumulative[$i] - $this->cumulative[$i - 1];
                $t = $length > 0 ? ($progress - $this->cumulative[$i - 1]) / $length : 0;
                [$ax, $ay] = $this->xy[$i - 1];
                [$bx, $by] = $this->xy[$i];

                return $this->toLatLng($ax + $t * ($bx - $ax), $ay + $t * ($by - $ay));
            }
        }

        return $this->toLatLng(...$this->xy[$n - 1]);
    }

    /**
     * @return array{float, float}
     */
    private function toXy(float $lat, float $lng): array
    {
        return [$lng * self::M_PER_DEG_LNG_EQUATOR * $this->cosLat, $lat * self::M_PER_DEG_LAT];
    }

    /**
     * @return array{float, float}
     */
    private function toLatLng(float $x, float $y): array
    {
        return [round($y / self::M_PER_DEG_LAT, 6), round($x / (self::M_PER_DEG_LNG_EQUATOR * $this->cosLat), 6)];
    }

    /**
     * @param  array{float, float}  $a
     * @param  array{float, float}  $b
     */
    private function length(array $a, array $b): float
    {
        return hypot($b[0] - $a[0], $b[1] - $a[1]);
    }
}
