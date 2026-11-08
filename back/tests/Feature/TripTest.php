<?php

namespace Tests\Feature;

use App\Events\BusesUpdated;
use App\Models\Line;
use App\Models\LineDirection;
use App\Models\StopPassage;
use App\Models\Trip;
use App\Models\TripPoint;
use App\Services\Transit\TransitImporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class TripTest extends TestCase
{
    use RefreshDatabase;

    private LineDirection $direction;

    /** Arrêts sur une droite est-ouest, à ~1,1 km d'écart (0,01° de longitude près de l'équateur) */
    private const STOPS = [[5.30, -4.00], [5.30, -3.99], [5.30, -3.98], [5.30, -3.97]];

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-09 07:00:00');

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

    /** @return array{0: string, 1: string} id et jeton */
    private function start(): array
    {
        $response = $this->postJson('/api/trips', ['line_direction_id' => $this->direction->id, 'client' => 'app'])->assertCreated();

        return [$response->json('data.id'), $response->json('data.token')];
    }

    /**
     * Un point toutes les 20 s, le long de la ligne, à partir de 07:00.
     *
     * @param  list<float>  $lngs
     */
    private function points(array $lngs, int $startSecond = 0, float $lat = 5.3001): array
    {
        return array_map(fn ($lng, $i) => [
            'lat' => $lat, 'lng' => $lng, 'accuracy' => 12,
            't' => Carbon::parse('2026-11-09 07:00:00')->addSeconds($startSecond + 20 * $i)->getTimestampMs(),
        ], $lngs, array_keys($lngs));
    }

    private function send(string $id, string $token, array $points)
    {
        return $this->withHeader('X-Trip-Token', $token)->postJson("/api/trips/{$id}/positions", ['points' => $points]);
    }

    public function test_a_trip_records_stop_passages_with_interpolated_times(): void
    {
        [$id, $token] = $this->start();
        Carbon::setTestNow('2026-11-09 07:05:00');

        // Monte à l'arrêt 1, roule jusqu'à mi-chemin entre 3 et 4
        $this->send($id, $token, $this->points([-4.0, -3.997, -3.993, -3.989, -3.985, -3.981, -3.977, -3.975]))
            ->assertOk()
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.accepted', 8)
            ->assertJsonPath('data.last_sequence', 3);

        $passages = StopPassage::where('trip_id', $id)->orderBy('sequence')->get();
        $this->assertSame([1, 2, 3], $passages->pluck('sequence')->all());
        // L'arrêt 2 (-3.99) est franchi entre le point de 07:00:40 (-3.993) et celui de 07:01:00 (-3.989)
        $this->assertSame('07:00:55', $passages[1]->passed_at->format('H:i:s'));
    }

    public function test_reaching_the_terminus_ends_the_trip_and_keeps_everything(): void
    {
        [$id, $token] = $this->start();
        Carbon::setTestNow('2026-11-09 07:10:00');
        $lngs = range(-4.0, -3.97, 0.002);

        $this->send($id, $token, $this->points($lngs))->assertOk()->assertJsonPath('data.status', 'ended')->assertJsonPath('data.complete', true);

        $this->assertSame(4, StopPassage::where('trip_id', $id)->count());
        // Rien n'est effacé : les points servent aux statistiques et à la prédiction
        $this->assertSame(count($lngs), TripPoint::where('trip_id', $id)->count());
        $this->artisan('transit:trips-cleanup')->assertSuccessful();
        $this->assertSame(count($lngs), TripPoint::where('trip_id', $id)->count());
    }

    public function test_the_direction_is_detected_from_the_first_points(): void
    {
        $line = Line::firstOrFail();
        $start = fn () => $this->postJson('/api/trips', ['line_id' => $line->id])->assertCreated()->assertJsonPath('data.line_direction_id', null);
        // Les voyages démarrent à 07:00, les points arrivent ensuite
        [$east, $west, $still] = [$start(), $start(), $start()];
        Carbon::setTestNow('2026-11-09 07:05:00');

        // Vers l'est : sens Arrêt 1 → Arrêt 4
        $this->send($east->json('data.id'), $east->json('data.token'), $this->points([-4.0, -3.999]))
            ->assertJsonPath('data.line_direction_id', null); // pas encore assez de points
        $detected = $this->send($east->json('data.id'), $east->json('data.token'), $this->points([-3.997, -3.993, -3.989], 40));
        $this->assertSame(5, $detected->json('data.accepted'), $detected->getContent());
        $detected
            ->assertJsonPath('data.line_direction_id', $this->direction->id)
            ->assertJsonPath('data.last_sequence', 2);

        // Vers l'ouest : l'autre sens
        $this->send($west->json('data.id'), $west->json('data.token'), $this->points([-3.97, -3.973, -3.977, -3.981]))
            ->assertJsonPath('data.line_direction_id', LineDirection::where('osm_relation_id', 2)->value('id'));

        // Immobile à l'arrêt : on attend sans conclure
        $this->send($still->json('data.id'), $still->json('data.token'), $this->points([-3.99, -3.99, -3.99, -3.99]))
            ->assertJsonPath('data.line_direction_id', null)
            ->assertJsonPath('data.status', 'active');
    }

    public function test_all_live_buses_are_listed_and_pushed(): void
    {
        Event::fake([BusesUpdated::class]);
        [$id, $token] = $this->start();
        Carbon::setTestNow('2026-11-09 07:02:00');
        $this->send($id, $token, $this->points([-4.0, -3.997, -3.993]));

        Event::assertDispatched(BusesUpdated::class, fn ($e) => $e->lineId === Line::firstOrFail()->id
            && $e->buses[0]['line']['ref'] === '81' && $e->broadcastOn()[1]->name === 'live');

        $this->getJson('/api/live')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.line.ref', '81')
            ->assertJsonPath('data.0.direction.destination', 'Arrêt 4')
            ->assertJsonPath('data.0.next_stop.name', 'Arrêt 2');
    }

    public function test_resending_a_batch_is_harmless(): void
    {
        [$id, $token] = $this->start();
        Carbon::setTestNow('2026-11-09 07:05:00');
        $points = $this->points([-4.0, -3.995, -3.989]);

        $this->send($id, $token, $points)->assertJsonPath('data.accepted', 3);
        $this->send($id, $token, $points)->assertJsonPath('data.accepted', 0)->assertJsonPath('data.rejected', 0);
        $this->assertSame(3, TripPoint::where('trip_id', $id)->count());
    }

    public function test_a_trace_far_from_the_line_marks_the_trip_off_route(): void
    {
        [$id, $token] = $this->start();
        Carbon::setTestNow('2026-11-09 07:05:00');

        // 1 km au nord de la ligne : pas dans ce bus
        $this->send($id, $token, $this->points(array_fill(0, 8, -3.99), 0, 5.309))
            ->assertJsonPath('data.status', Trip::OFF_ROUTE)
            ->assertJsonPath('data.accepted', 0);
        $this->assertSame(0, StopPassage::count());
    }

    public function test_imprecise_and_impossible_points_are_rejected(): void
    {
        [$id, $token] = $this->start();
        Carbon::setTestNow('2026-11-09 07:05:00');
        $points = $this->points([-4.0, -3.999]);
        $points[1]['accuracy'] = 400;

        $this->send($id, $token, $points)->assertJsonPath('data.accepted', 1)->assertJsonPath('data.rejected', 1);

        // 3 km en 20 s : le bus ne peut pas être là, la recherche reste près de la dernière position
        $jump = $this->points([-3.972], 40);
        $this->send($id, $token, $jump)->assertJsonPath('data.accepted', 0);
    }

    public function test_only_the_phone_with_the_token_can_send_positions(): void
    {
        [$id] = $this->start();

        $this->send($id, 'mauvais-jeton', $this->points([-4.0]))->assertForbidden();
        $this->postJson('/api/trips/pas-un-uuid/positions', ['points' => []])->assertNotFound();
    }

    public function test_live_buses_merge_riders_of_the_same_bus(): void
    {
        [$a, $ta] = $this->start();
        [$b, $tb] = $this->start();
        [$c, $tc] = $this->start();
        Carbon::setTestNow('2026-11-09 07:02:00');

        $this->send($a, $ta, $this->points([-4.0, -3.997, -3.993]));
        $this->send($b, $tb, $this->points([-4.0, -3.997, -3.9935])); // même bus que A
        $this->send($c, $tc, $this->points([-4.0])); // un autre bus, encore au départ

        $slug = Line::firstOrFail()->slug;
        $this->getJson("/api/lines/{$slug}/live")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.reporters', 2)
            ->assertJsonPath('data.0.last_stop.name', 'Arrêt 1')
            ->assertJsonPath('data.0.next_stop.name', 'Arrêt 2')
            ->assertJsonPath('data.1.reporters', 1);

        // Trois minutes plus tard sans nouvelle : plus en direct, et le nettoyage termine les voyages
        Carbon::setTestNow('2026-11-09 07:15:00');
        $this->getJson("/api/lines/{$slug}/live")->assertJsonCount(0, 'data');
        $this->artisan('transit:trips-cleanup')->assertSuccessful();
        $this->assertSame(0, Trip::where('status', Trip::ACTIVE)->count());
    }
}
