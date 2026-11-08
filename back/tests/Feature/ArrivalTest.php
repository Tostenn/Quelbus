<?php

namespace Tests\Feature;

use App\Models\LineDirection;
use App\Models\StopPassage;
use App\Models\Trip;
use App\Services\Live\TripTracker;
use App\Services\Transit\TransitImporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class ArrivalTest extends TestCase
{
    use RefreshDatabase;

    private LineDirection $direction;

    /** Arrêts sur une droite est-ouest, à ~1,1 km d'écart */
    private const STOPS = [[5.30, -4.00], [5.30, -3.99], [5.30, -3.98], [5.30, -3.97]];

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-09 07:00:00'); // un lundi
        $stops = [];
        foreach (self::STOPS as $i => [$lat, $lng]) {
            $stops[] = ['id' => $i + 1, 'name' => 'Arrêt '.($i + 1), 'lat' => $lat, 'lon' => $lng];
        }
        $line = fn (int $id, string $from, string $to, array $stops) => [
            'id' => $id, 'name' => "bus 81 : {$from} → {$to}", 'type' => 'sotra', 'ref' => '81', 'from' => $from, 'to' => $to,
            'category' => 'monbus', 'operator' => 'SOTRA', 'stops' => $stops, 'geometry' => [],
        ];
        app(TransitImporter::class)->import([
            'stops' => $stops,
            'lines' => [$line(1, 'Arrêt 1', 'Arrêt 4', [1, 2, 3, 4]), $line(2, 'Arrêt 4', 'Arrêt 1', [4, 3, 2, 1])],
        ]);
        $this->direction = LineDirection::where('osm_relation_id', 1)->firstOrFail();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /** Un voyage passé à l'arrêt 3 (sequence 3) à l'heure donnée */
    private function passage(string $at, int $sequence = 3): void
    {
        $trip = app(TripTracker::class)->start($this->direction->line, $this->direction, 'web')['trip'];
        $trip->update(['status' => Trip::ENDED]);
        $stop = $this->direction->stops()->wherePivot('sequence', $sequence)->firstOrFail();
        StopPassage::create([
            'trip_id' => $trip->id, 'line_direction_id' => $this->direction->id, 'stop_id' => $stop->id,
            'sequence' => $sequence, 'passed_at' => Carbon::parse($at),
        ]);
    }

    private function arrivals(array $query = [])
    {
        // Près de l'arrêt 3
        return $this->getJson('/api/arrivals?'.http_build_query(['lat' => 5.3002, 'lng' => -3.9801, ...$query]))->assertOk();
    }

    public function test_usual_passages_of_the_same_kind_of_day_are_announced(): void
    {
        // Trois jours de semaine vers 7 h 20, un vers 9 h 30
        $this->passage('2026-11-02 07:19:00');
        $this->passage('2026-11-03 07:21:00');
        $this->passage('2026-11-06 07:22:00');
        $this->passage('2026-11-05 09:30:00');
        // Le samedi, à 7 h 05 : pas un lundi
        $this->passage('2026-11-07 07:05:00');
        // Trop tard pour la fenêtre de trois heures
        $this->passage('2026-11-04 12:00:00');

        $data = $this->arrivals()->json('data');

        $this->assertCount(1, $data);
        $this->assertSame('81', $data[0]['line']['ref']);
        $this->assertSame($this->direction->id, $data[0]['direction']['id']);
        $this->assertSame('Arrêt 3', $data[0]['stop']['name']);
        $this->assertLessThan(50, $data[0]['stop']['walk_m']);
        $this->assertSame([21, 150], array_column($data[0]['next'], 'in_minutes'));
        $this->assertSame([3, 1], array_column($data[0]['next'], 'days'));
        $this->assertSame('2026-11-09T07:21:00+00:00', $data[0]['next'][0]['at']);

        // La fiche ligne dit quels sens ont des passages relevés
        $directions = $this->getJson('/api/lines/'.$this->direction->line->slug)->json('data.directions');
        $this->assertSame([true, false], array_column($directions, 'has_history'));
    }

    public function test_a_line_with_no_saved_passage_is_not_announced(): void
    {
        $this->assertSame([], $this->arrivals()->json('data'));
    }

    public function test_a_live_bus_before_the_stop_takes_over_the_estimate(): void
    {
        $this->passage('2026-11-02 07:20:00');
        $live = app(TripTracker::class)->start($this->direction->line, $this->direction, 'web')['trip'];
        $live->update(['last_point_at' => now(), 'last_sequence' => 2]);

        $this->assertSame([], $this->arrivals()->json('data'));

        // Le bus en direct a passé l'arrêt : le prochain reste estimé
        $live->update(['last_sequence' => 3]);
        $this->assertCount(1, $this->arrivals()->json('data'));
    }

    public function test_a_direction_can_be_asked_for_alone(): void
    {
        $this->passage('2026-11-02 07:20:00');
        $other = LineDirection::where('osm_relation_id', 2)->firstOrFail();

        $this->assertCount(1, $this->arrivals(['direction' => $this->direction->id])->json('data'));
        $this->assertSame([], $this->arrivals(['direction' => $other->id])->json('data'));
        $this->getJson('/api/arrivals?lat=abc&lng=1')->assertUnprocessable();
    }
}
