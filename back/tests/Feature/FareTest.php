<?php

namespace Tests\Feature;

use App\Models\Line;
use App\Models\LineDirection;
use App\Models\LineSchedule;
use App\Models\User;
use App\Services\Transit\FareImporter;
use App\Services\Transit\TransitImporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FareTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $line = fn (int $id, string $ref, string $from, string $to, array $stops) => [
            'id' => $id, 'name' => "bus {$ref} : {$from} → {$to}", 'type' => 'sotra', 'ref' => $ref, 'from' => $from, 'to' => $to,
            'category' => 'monbus', 'operator' => 'SOTRA', 'stops' => $stops, 'geometry' => [],
        ];
        app(TransitImporter::class)->import([
            'stops' => [
                ['id' => 1, 'name' => 'Gare Nord', 'lat' => 5.358911, 'lon' => -4.028187],
                ['id' => 2, 'name' => 'Koumassi Terminus Sicogi', 'lat' => 5.29, 'lon' => -3.95],
                ['id' => 3, 'name' => 'Gare Sud', 'lat' => 5.315, 'lon' => -4.018],
                ['id' => 4, 'name' => 'Niangon Sud à droite', 'lat' => 5.32, 'lon' => -4.09],
            ],
            'lines' => [
                $line(1, '50', 'Gare Nord', 'Koumassi Terminus Sicogi', [1, 2]),
                $line(2, '50', 'Koumassi Terminus Sicogi', 'Gare Nord', [2, 1]),
                $line(3, '39', 'Gare Sud', 'Niangon Sud à droite', [3, 4]),
                $line(4, '39', 'Niangon Sud à droite', 'Gare Sud', [4, 3]),
            ],
        ]);
    }

    private function data(): array
    {
        $schedule = fn (string $ref, string $direction, string $first, string $last, string $day = 'tous') => [
            'city' => 'abidjan', 'ref' => $ref, 'direction' => $direction, 'first_departure' => $first,
            'last_departure' => $last, 'day_type' => $day, 'source' => 'Linfodrome', 'source_url' => null,
        ];

        return [
            'fares' => [
                ['city' => 'abidjan', 'ref' => '50', 'fare' => 200, 'fare_type' => 'MONBUS'],
                ['city' => 'abidjan', 'ref' => '39', 'fare' => 200, 'fare_type' => 'MONBUS'],
                ['city' => 'abidjan', 'ref' => '999', 'fare' => 500, 'fare_type' => 'EXPRESS'],
            ],
            'schedules' => [
                $schedule('39', 'Gare Sud Plateau -> Niangon Sud', '05:57', '21:00'),
                $schedule('39', 'Niangon Sud -> Gare Sud Plateau', '04:45', '19:30'),
                // « Mosquée Adjamé » s'appelle « Gare Nord » dans le réseau : un seul terminus reconnu
                $schedule('50', 'Koumassi Sicogi -> Mosquée Adjamé', '04:40', '19:33', 'semaine'),
                $schedule('39', 'Gare Bassam -> Ailleurs', '06:00', '20:00'),
            ],
        ];
    }

    public function test_fares_and_schedules_are_imported(): void
    {
        $report = app(FareImporter::class)->import($this->data());

        $this->assertSame(2, $report['fares']);
        $this->assertSame(3, $report['schedules']);
        $this->assertCount(3, $report['anomalies']); // ligne 999 absente, 50 à vérifier, « Gare Bassam » introuvable
        $this->assertSame(200, Line::where('ref', '50')->value('fare'));

        $toNiangon = LineDirection::where('origin_label', 'Gare Sud')->firstOrFail();
        $this->assertSame('05:57', $toNiangon->schedules->first()->summary()['first_departure']);
        $fromKoumassi = LineDirection::where('origin_label', 'Koumassi Terminus Sicogi')->firstOrFail();
        $this->assertSame('semaine', $fromKoumassi->schedules->first()->day_type);
    }

    public function test_the_line_page_shows_fare_and_schedules(): void
    {
        app(FareImporter::class)->import($this->data());
        $slug = Line::where('ref', '39')->value('slug');

        $this->getJson("/api/lines/{$slug}")
            ->assertOk()
            ->assertJsonPath('data.fare', 200)
            ->assertJsonPath('data.fare_type', 'MONBUS')
            ->assertJsonPath('data.accepts_student_card', null)
            ->assertJsonPath('data.directions.0.schedules.0.last_departure', '21:00');
    }

    public function test_search_results_carry_the_fare(): void
    {
        app(FareImporter::class)->import($this->data());

        $this->getJson('/api/search?from_lat=5.315&from_lng=-4.018&to_lat=5.32&to_lng=-4.09')
            ->assertOk()
            ->assertJsonPath('results.0.line.fare', 200)
            ->assertJsonPath('results.0.direction.schedules.0.first_departure', '05:57');
    }

    public function test_an_admin_edits_the_fare_and_the_import_keeps_it(): void
    {
        $this->actingAs(User::factory()->create(['name' => 'Awa']), 'sanctum');
        $line = Line::where('ref', '39')->firstOrFail();

        $this->putJson("/api/admin/lines/{$line->id}/fare", ['fare' => 250, 'fare_type' => 'MONBUS', 'accepts_student_card' => true])
            ->assertOk()
            ->assertJsonPath('data.accepts_student_card', true);
        $this->putJson("/api/admin/lines/{$line->id}/fare", ['fare' => 'beaucoup'])->assertJsonValidationErrors('fare');

        $report = app(FareImporter::class)->import($this->data());
        $this->assertSame(1, $report['fares_kept']);
        $this->assertSame(250, $line->fresh()->fare);

        $this->getJson("/api/admin/lines/{$line->id}/changes")
            ->assertOk()
            ->assertJsonPath('data.0.field', 'fare')
            ->assertJsonPath('data.0.user', 'Awa')
            ->assertJsonPath('data.0.after.fare', 250);
    }

    public function test_an_admin_sets_the_schedules_of_a_direction(): void
    {
        $this->actingAs(User::factory()->create(), 'sanctum');
        $direction = LineDirection::where('origin_label', 'Gare Sud')->firstOrFail();
        $url = "/api/admin/directions/{$direction->id}/schedules";

        $this->putJson($url, ['schedules' => [
            ['day_type' => 'semaine', 'first_departure' => '05:30', 'last_departure' => '21:45', 'source' => 'Affiche du terminus'],
            ['day_type' => 'dimanche', 'first_departure' => '06:30', 'last_departure' => '20:00'],
        ]])->assertOk()->assertJsonCount(2, 'data');

        $this->putJson($url, ['schedules' => [
            ['day_type' => 'samedi', 'first_departure' => '6h', 'last_departure' => '20:00'],
            ['day_type' => 'samedi', 'first_departure' => '06:00', 'last_departure' => '20:00'],
        ]])->assertJsonValidationErrors(['schedules.0.first_departure', 'schedules.1.day_type']);

        // Saisis à la main : l'import ne les remplace pas
        app(FareImporter::class)->import($this->data());
        $this->assertSame(['semaine', 'dimanche'], LineSchedule::where('line_direction_id', $direction->id)
            ->orderBy('id')->pluck('day_type')->all());
    }

    public function test_guests_cannot_edit_fares_or_schedules(): void
    {
        $line = Line::firstOrFail();
        $this->putJson("/api/admin/lines/{$line->id}/fare", ['fare' => 0])->assertUnauthorized();
        $this->putJson("/api/admin/directions/{$line->directions()->value('id')}/schedules", ['schedules' => []])->assertUnauthorized();
    }
}
