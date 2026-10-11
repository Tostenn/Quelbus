<?php

namespace Tests\Feature;

use App\Services\Transit\RouteSearchService;
use App\Services\Transit\TransitImporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Réseau fictif sur un axe nord-sud (0,001° de latitude ≈ 111 m) :
 *
 *   A (5.300) — B (5.310) — C (5.320) — D (5.330)     ligne SOTRA 81, dans les deux sens
 *   G (5.300, -4.050) → H (5.320, -4.050)              gbaka, un seul sens
 *   L1 → L2 → L3 → L1                                  woro-woro en boucle
 */
class RouteSearchTest extends TestCase
{
    use RefreshDatabase;

    private RouteSearchService $search;

    protected function setUp(): void
    {
        parent::setUp();

        $stops = [
            ['id' => 1, 'name' => 'A', 'lat' => 5.300, 'lon' => -4.000],
            ['id' => 2, 'name' => 'B', 'lat' => 5.310, 'lon' => -4.000],
            ['id' => 3, 'name' => 'C', 'lat' => 5.320, 'lon' => -4.000],
            ['id' => 4, 'name' => 'D', 'lat' => 5.330, 'lon' => -4.000],
            ['id' => 5, 'name' => 'G', 'lat' => 5.300, 'lon' => -4.050],
            ['id' => 6, 'name' => 'H', 'lat' => 5.320, 'lon' => -4.050],
            ['id' => 7, 'name' => 'L1', 'lat' => 5.400, 'lon' => -4.100],
            ['id' => 8, 'name' => 'L2', 'lat' => 5.410, 'lon' => -4.100],
            ['id' => 9, 'name' => 'L3', 'lat' => 5.420, 'lon' => -4.100],
        ];
        $line = fn (int $id, string $type, ?string $ref, string $from, string $to, array $stops) => [
            'id' => $id, 'name' => "{$from} → {$to}", 'type' => $type, 'ref' => $ref, 'from' => $from, 'to' => $to,
            'category' => $type, 'operator' => null, 'stops' => $stops, 'geometry' => [],
        ];

        app(TransitImporter::class)->import(['stops' => $stops, 'lines' => [
            $line(81001, 'sotra', '81', 'A', 'D', [1, 2, 3, 4]),
            $line(81002, 'sotra', '81', 'D', 'A', [4, 3, 2, 1]),
            $line(90001, 'gbaka', null, 'G', 'H', [5, 6]),
            $line(70001, 'woro-woro', null, 'L1', 'L1', [7, 8, 9, 7]),
        ]]);

        $this->search = app(RouteSearchService::class);
    }

    public function test_it_finds_the_direct_line_with_boarding_and_alighting_stops(): void
    {
        // ~55 m au nord de A, ~55 m au sud de C
        $result = $this->search->search(5.3005, -4.000, 5.3195, -4.000);

        $this->assertCount(1, $result['results']);
        $hit = $result['results'][0];
        $this->assertSame('81', $hit['line']['ref']);
        $this->assertSame('A → D', $hit['direction']['name']);
        $this->assertSame('A', $hit['board']['name']);
        $this->assertSame('C', $hit['alight']['name']);
        $this->assertSame(2, $hit['stops']);
        $this->assertEqualsWithDelta(111, $hit['walk'], 5);
        $this->assertFalse($result['expanded']);
    }

    public function test_the_direction_of_travel_is_respected(): void
    {
        $result = $this->search->search(5.3195, -4.000, 5.3005, -4.000);
        $this->assertSame('D → A', $result['results'][0]['direction']['name']);

        // Le gbaka ne roule que de G vers H : rien dans l'autre sens
        $this->assertSame([], $this->search->directLines(5.320, -4.050, 5.300, -4.050, 300));
        $this->assertCount(1, $this->search->directLines(5.300, -4.050, 5.320, -4.050, 300));
    }

    public function test_the_best_stop_pair_is_kept(): void
    {
        // Départ entre A (~666 m) et B (~444 m), tous deux dans le rayon : on monte à B
        $result = $this->search->directLines(5.306, -4.000, 5.330, -4.000, 800);

        $this->assertCount(1, $result);
        $this->assertSame('B', $result[0]['board']['name']);
        $this->assertSame('D', $result[0]['alight']['name']);
    }

    public function test_the_radius_is_widened_when_nothing_is_found(): void
    {
        // Destination à ~400 m de C
        $result = $this->search->search(5.300, -4.000, 5.3236, -4.000);

        $this->assertTrue($result['expanded']);
        $this->assertSame(500, $result['radius']);
        $this->assertSame('C', $result['results'][0]['alight']['name']);
    }

    public function test_no_result_at_all(): void
    {
        $result = $this->search->search(5.300, -4.000, 6.000, -5.000);

        $this->assertSame([], $result['results']);
        $this->assertSame(800, $result['radius']);
    }

    public function test_close_origin_and_destination_are_walkable(): void
    {
        $result = $this->search->search(5.300, -4.000, 5.301, -4.000);

        $this->assertTrue($result['walkable']);
        $this->assertEqualsWithDelta(111, $result['distance'], 5);
    }

    public function test_a_line_that_needs_more_walking_than_the_trip_itself_is_dropped(): void
    {
        // Départ et arrivée à ~222 m l'un de l'autre, entre A et B (~444 m de chacun) :
        // monter à A et descendre à B ferait marcher ~888 m
        $result = $this->search->search(5.304, -4.000, 5.306, -4.000);

        $this->assertSame([], $result['results']);
        $this->assertTrue($result['walkable']);
    }

    public function test_a_loop_can_be_ridden_past_its_terminus(): void
    {
        // L3 vers L2 : L3 → L1 → L2 en passant par le terminus
        $result = $this->search->directLines(5.420, -4.100, 5.410, -4.100, 300);

        $this->assertCount(1, $result);
        $this->assertSame('L3', $result[0]['board']['name']);
        $this->assertSame('L2', $result[0]['alight']['name']);
        $this->assertSame(2, $result[0]['stops']);
    }

    public function test_results_can_be_filtered_by_type(): void
    {
        $this->assertSame([], $this->search->directLines(5.300, -4.000, 5.320, -4.000, 300, ['gbaka']));
        $this->assertCount(1, $this->search->directLines(5.300, -4.000, 5.320, -4.000, 300, ['sotra']));
    }
}
