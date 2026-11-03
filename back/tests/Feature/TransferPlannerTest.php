<?php

namespace Tests\Feature;

use App\Services\Transit\RouteSearchService;
use App\Services\Transit\TransitImporter;
use App\Services\Transit\TransitNetwork;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Réseau fictif inspiré d'Abidjan (0,001° ≈ 111 m) :
 *
 *   Yopougon ── 27 (SOTRA) / gbaka ──> Adjamé Gare ··150 m à pied··> Adjamé Liberté ── 81 ──> Cocody ──> Riviera
 *        └──────── 27 passe aussi par Petit Carrefour ── 82 (par le Plateau, long) ──> Cocody
 *   Adjamé Gare : grande gare (plusieurs lignes vers Abobo, le Plateau…)
 *   Plateau ── 13 ──> Treichville ──> Koumassi            (accessible seulement avec deux changements)
 *   Yopougon ── 50 ──> Abobo Nord ── 51 ──> Cocody         (détour par le nord, à écarter)
 *   Riviera ⟲ wôrô-wôrô en boucle : Cocody → Riviera → Riviera Palmeraie → Cocody
 */
class TransferPlannerTest extends TestCase
{
    use RefreshDatabase;

    private const YOP = [5.3405, -4.0905];     // ~55 m du premier arrêt

    private const COCODY = [5.3515, -3.9900];  // ~55 m de Cocody Centre

    private RouteSearchService $search;

    protected function setUp(): void
    {
        parent::setUp();
        TransitNetwork::forget();

        $stops = [
            [1, 'Yopougon Siporex', 5.340, -4.090],
            [2, 'Yopougon Mairie', 5.342, -4.075],
            [3, 'Pont', 5.348, -4.055],
            [4, 'Petit Carrefour', 5.352, -4.040],
            [5, 'Adjamé Gare', 5.356, -4.026],
            [6, 'Adjamé Liberté', 5.3573, -4.0255],
            [7, 'Blokosso', 5.350, -4.005],
            [8, 'Cocody Centre', 5.352, -3.990],
            [9, 'Riviera', 5.355, -3.975],
            [10, 'Abobo Gare', 5.420, -4.020],
            [11, 'Abobo Nord', 5.445, -4.010],
            [12, 'Plateau', 5.322, -4.018],
            [13, 'Treichville', 5.305, -4.012],
            [14, 'Koumassi', 5.295, -3.960],
            [17, 'Riviera Palmeraie', 5.365, -3.975],
        ];
        $line = fn (int $id, string $type, ?string $ref, array $stops) => [
            'id' => $id, 'name' => "ligne {$id}", 'type' => $type, 'ref' => $ref, 'from' => "Départ {$id}", 'to' => "Arrivée {$id}",
            'category' => $type, 'operator' => null, 'stops' => $stops, 'geometry' => [],
        ];

        app(TransitImporter::class)->import([
            'stops' => array_map(fn ($s) => ['id' => $s[0], 'name' => $s[1], 'lat' => $s[2], 'lon' => $s[3]], $stops),
            'lines' => [
                $line(2701, 'sotra', '27', [1, 2, 3, 4, 5]),
                $line(2702, 'sotra', '27', [5, 4, 3, 2, 1]),
                $line(9001, 'gbaka', null, [1, 2, 3, 5]),
                $line(8101, 'sotra', '81', [6, 7, 8, 9]),
                $line(8201, 'sotra', '82', [4, 12, 7, 8]),
                // Grande gare d'Adjamé : d'autres lignes y passent
                $line(1001, 'sotra', '10', [5, 10]),
                $line(1101, 'sotra', '11', [5, 11]),
                $line(1201, 'sotra', '12', [5, 12]),
                $line(1301, 'sotra', '13', [12, 13, 14]),
                // Détour par Abobo
                $line(5001, 'sotra', '50', [1, 11]),
                $line(5101, 'sotra', '51', [11, 8]),
                // Wôrô-wôrô en boucle à la Riviera
                $line(7001, 'woro-woro', null, [8, 9, 17, 8]),
            ],
        ]);

        $this->search = app(RouteSearchService::class);
    }

    private function go(array $from, array $to, ?array $types = null): array
    {
        return $this->search->search($from[0], $from[1], $to[0], $to[1], 300, $types);
    }

    /** @return list<string> ex. ['27', '81'] */
    private function refs(array $combination): array
    {
        return array_map(fn ($leg) => $leg['line']['ref'] ?? $leg['line']['type'], $combination['legs']);
    }

    public function test_a_direct_line_means_no_combinations(): void
    {
        $result = $this->go(self::YOP, [5.3565, -4.0262]); // Adjamé Gare

        $this->assertNotEmpty($result['results']);
        $this->assertSame([], $result['combinations']);
        $this->assertSame('direct', $result['prefer']);
    }

    public function test_without_a_direct_line_it_combines_two_buses_at_the_big_station(): void
    {
        $result = $this->go(self::YOP, self::COCODY);

        $this->assertSame([], $result['results']);
        $this->assertSame('combinations', $result['prefer']);
        $best = $result['combinations'][0];

        // Comme un habitué : le 27 jusqu'à Adjamé, quelques pas, puis le 81
        $this->assertSame(['27', '81'], $this->refs($best));
        $this->assertSame(1, $best['changes']);
        $this->assertSame('Yopougon Siporex', $best['legs'][0]['board']['name']);
        $this->assertSame('Adjamé Gare', $best['legs'][0]['alight']['name']);
        $this->assertSame('Adjamé Liberté', $best['legs'][1]['board']['name']);
        $this->assertEqualsWithDelta(155, $best['legs'][1]['board']['walk'], 15); // marche pour changer
        $this->assertSame('Cocody Centre', $best['legs'][1]['alight']['name']);
        $this->assertGreaterThan(4, $best['legs'][1]['lines_here']); // une grande gare
    }

    public function test_the_bus_comes_before_the_gbaka_for_a_similar_trip(): void
    {
        $combinations = $this->go(self::YOP, self::COCODY)['combinations'];

        $first = array_map(fn ($c) => $c['legs'][0]['line']['type'], $combinations);
        $this->assertSame('sotra', $first[0]);
        $this->assertContains('gbaka', $first); // le gbaka reste proposé, mais après
        $this->assertGreaterThan(
            array_search('sotra', $first, true),
            array_search('gbaka', $first, true),
        );
    }

    public function test_long_detours_and_the_same_line_twice_are_left_out(): void
    {
        foreach ($this->go(self::YOP, self::COCODY)['combinations'] as $combination) {
            $refs = $this->refs($combination);
            $this->assertNotContains('50', $refs, 'Pas de crochet par Abobo');
            $this->assertSame(count($refs), count(array_unique(array_map(fn ($l) => $l['line']['id'], $combination['legs']))));
        }
    }

    public function test_two_changes_only_when_one_is_not_enough(): void
    {
        $result = $this->go(self::YOP, [5.2955, -3.9605]); // Koumassi

        $this->assertNotEmpty($result['combinations']);
        foreach ($result['combinations'] as $combination) {
            $this->assertSame(2, $combination['changes']);
            $this->assertSame('13', end($combination['legs'])['line']['ref']);
            $this->assertSame('Koumassi', end($combination['legs'])['alight']['name']);
        }

        // Pour Cocody, un changement suffit : jamais de proposition à deux changements
        foreach ($this->go(self::YOP, self::COCODY)['combinations'] as $combination) {
            $this->assertSame(1, $combination['changes']);
        }
    }

    public function test_a_woro_woro_loop_can_finish_the_trip(): void
    {
        $result = $this->go(self::YOP, [5.3655, -3.9750]); // Riviera Palmeraie

        $best = $result['combinations'][0];
        $last = end($best['legs']);
        $this->assertSame('woro-woro', $last['line']['type']);
        $this->assertSame('Riviera Palmeraie', $last['alight']['name']);
        // On descend du 81 à la Riviera, au plus près, plutôt que de faire le tour de la boucle
        $this->assertSame('Riviera', $last['board']['name']);
    }

    public function test_the_transport_filter_applies_to_every_leg(): void
    {
        $bus = $this->go(self::YOP, self::COCODY, ['sotra'])['combinations'];
        $this->assertNotEmpty($bus);
        foreach ($bus as $combination) {
            foreach ($combination['legs'] as $leg) {
                $this->assertSame('sotra', $leg['line']['type']);
            }
        }

        $this->assertSame([], $this->go(self::YOP, self::COCODY, ['gbaka'])['combinations']);
    }

    public function test_the_search_api_returns_combinations(): void
    {
        $this->getJson('/api/search?'.http_build_query([
            'from_lat' => self::YOP[0], 'from_lng' => self::YOP[1], 'to_lat' => self::COCODY[0], 'to_lng' => self::COCODY[1],
        ]))
            ->assertOk()
            ->assertJsonPath('prefer', 'combinations')
            ->assertJsonPath('combinations.0.changes', 1)
            ->assertJsonPath('combinations.0.legs.0.line.ref', '27')
            ->assertJsonPath('combinations.0.legs.1.line.ref', '81')
            ->assertJsonStructure(['combinations' => [['legs' => [['line', 'direction', 'board', 'alight', 'stops', 'lines_here']], 'walk', 'stops', 'changes']]]);
    }
}
