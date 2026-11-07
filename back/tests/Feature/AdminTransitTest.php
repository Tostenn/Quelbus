<?php

namespace Tests\Feature;

use App\Models\LineDirection;
use App\Models\Stop;
use App\Models\User;
use App\Services\Transit\TransitImporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminTransitTest extends TestCase
{
    use RefreshDatabase;

    private LineDirection $direction;

    /** Ligne 304 de Bouaké : seuls les terminus sont connus. */
    private function data(): array
    {
        $entry = fn (string $id, string $from, string $to, array $stops) => [
            'id' => $id, 'name' => "bus 304 : {$from} → {$to}", 'type' => 'sotra', 'ref' => '304',
            'from' => $from, 'to' => $to, 'category' => 'monbus', 'operator' => 'SOTRA', 'city' => 'bouake',
            'stops' => $stops, 'geometry' => null, 'partial' => true,
        ];

        return [
            'cities' => [['slug' => 'bouake', 'name' => 'Bouaké', 'bbox' => [7.60, -5.12, 7.78, -4.95]]],
            'stops' => [
                ['id' => 1, 'name' => 'Terminus Ahougnanssou', 'lat' => 7.683119, 'lon' => -5.054179, 'city' => 'bouake'],
                ['id' => 2, 'name' => 'Terminus Kennedy', 'lat' => 7.683397, 'lon' => -5.004097, 'city' => 'bouake'],
            ],
            'lines' => [
                $entry('sotra-pdf:304:aller', 'Ahougnanssou', 'Kennedy', [1, 2]),
                $entry('sotra-pdf:304:retour', 'Kennedy', 'Ahougnanssou', [2, 1]),
            ],
        ];
    }

    protected function setUp(): void
    {
        parent::setUp();
        app(TransitImporter::class)->import($this->data());
        $this->direction = LineDirection::where('external_id', 'sotra-pdf:304:aller')->firstOrFail();
    }

    private function stops(): array
    {
        $first = Stop::where('name', 'Terminus Ahougnanssou')->firstOrFail();
        $last = Stop::where('name', 'Terminus Kennedy')->firstOrFail();

        return [
            ['id' => $first->id, 'name' => $first->name, 'lat' => $first->lat, 'lng' => $first->lng],
            ['name' => 'Marché de Bouaké', 'lat' => 7.6905, 'lng' => -5.0300],
            ['id' => $last->id, 'name' => $last->name, 'lat' => 7.6840, 'lng' => -5.0045], // terminus déplacé
        ];
    }

    private function save(array $stops, bool $complete = true)
    {
        return $this->putJson("/api/admin/directions/{$this->direction->id}/stops", ['stops' => $stops, 'complete' => $complete]);
    }

    public function test_guests_cannot_edit_stops(): void
    {
        $this->save($this->stops())->assertUnauthorized();
    }

    public function test_an_admin_sets_the_stops_of_a_direction(): void
    {
        $admin = User::factory()->create();
        $this->actingAs($admin, 'sanctum');

        $this->save($this->stops())
            ->assertOk()
            ->assertJsonPath('data.stops_count', 3)
            ->assertJsonPath('data.is_partial', false);

        $direction = $this->direction->fresh();
        $this->assertSame(['Terminus Ahougnanssou', 'Marché de Bouaké', 'Terminus Kennedy'], $direction->stops->pluck('name')->all());
        $this->assertSame($admin->id, $direction->edited_by);
        $this->assertNotNull($direction->edited_at);

        $market = Stop::where('name', 'Marché de Bouaké')->firstOrFail();
        $this->assertSame('bouake', $market->city->slug);
        $this->assertSame('marche-de-bouake-bouake', $market->slug);

        // Le terminus déplacé l'est aussi pour l'autre sens
        $this->assertEqualsWithDelta(7.684, Stop::where('name', 'Terminus Kennedy')->value('lat'), 0.000001);
    }

    public function test_stops_outside_the_city_are_refused(): void
    {
        $this->actingAs(User::factory()->create(), 'sanctum');
        $stops = $this->stops();
        $stops[1] = ['name' => 'Plateau', 'lat' => 5.32, 'lng' => -4.02]; // Abidjan

        $this->save($stops)->assertUnprocessable()->assertJsonValidationErrors('stops.1.lat');
        $this->assertSame(2, $this->direction->fresh()->stops_count);
    }

    public function test_a_new_import_keeps_what_was_edited(): void
    {
        $this->actingAs(User::factory()->create(), 'sanctum');
        $this->save($this->stops())->assertOk();

        $data = $this->data();
        $data['lines'] = [$data['lines'][1]]; // l'aller n'est plus dans le fichier
        $report = app(TransitImporter::class)->import($this->data());
        app(TransitImporter::class)->import($data, prune: true);

        $this->assertSame(1, $report->directionsKept);
        $this->assertSame(3, $this->direction->fresh()->stops_count);
    }
}
