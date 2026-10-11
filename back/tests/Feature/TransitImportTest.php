<?php

namespace Tests\Feature;

use App\Models\Line;
use App\Models\LineDirection;
use App\Models\Stop;
use App\Services\Transit\TransitImporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TransitImportTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Petit extrait au format de scraper/data/abidjan_bus.json.
     */
    private function data(): array
    {
        return [
            'counts' => ['lines' => 4, 'stops' => 4, 'missing' => 0],
            'stops' => [
                ['id' => 1, 'name' => 'Terminus PK18', 'lat' => 5.443469, 'lon' => -4.048492],
                ['id' => 2, 'name' => 'Gare Nord', 'lat' => 5.358911, 'lon' => -4.028187],
                ['id' => 3, 'name' => 'Terminus Hôtel de Ville', 'lat' => 5.322671, 'lon' => -4.020549],
                ['id' => 4, 'name' => 'Carrefour Académie', 'lat' => 5.323815, 'lon' => -4.106671],
            ],
            'lines' => [
                $this->entry(10291017, 'sotra', '201', 'Abobo PK18', 'Hôtel de Ville', [1, 2, 3], 'Express', 'SOTRA'),
                $this->entry(10246666, 'sotra', '201', 'Hôtel de Ville', 'Abobo PK18', [3, 2, 1], 'Express', 'SOTRA'),
                $this->entry(15800901, 'gbaka', null, 'Académie', 'Gare Nord', [4, 2], "Gbaka d'Adjamé"),
                $this->entry(15800902, 'gbaka', null, 'Gare Nord', 'Académie', [2, 4], "Gbaka d'Adjamé"),
            ],
        ];
    }

    private function entry(int $id, string $type, ?string $ref, string $from, string $to, array $stops, string $category, string $operator = 'divers'): array
    {
        $prefix = $type === 'sotra' ? "bus {$ref}" : $type;

        return [
            'id' => $id, 'name' => "{$prefix} : {$from} → {$to}", 'type' => $type, 'ref' => $ref,
            'from' => $from, 'to' => $to, 'category' => $category, 'operator' => $operator,
            'stops' => $stops, 'geometry' => [[[5.44, -4.04], [5.32, -4.02]]],
        ];
    }

    public function test_directions_are_grouped_into_lines(): void
    {
        app(TransitImporter::class)->import($this->data());

        $this->assertSame(2, Line::count());
        $this->assertSame(4, LineDirection::count());

        $sotra = Line::where('ref', '201')->firstOrFail();
        $this->assertSame('sotra', $sotra->type);
        $this->assertSame('201-abobo-pk18-hotel-de-ville', $sotra->slug);
        $this->assertSame(2, $sotra->directions()->count());

        $gbaka = Line::where('type', 'gbaka')->firstOrFail();
        $this->assertNull($gbaka->ref);
        $this->assertSame(2, $gbaka->directions()->count());
    }

    public function test_stops_are_kept_in_trip_order_and_shared_between_lines(): void
    {
        app(TransitImporter::class)->import($this->data());

        $direction = LineDirection::where('osm_relation_id', 10291017)->firstOrFail();
        $this->assertSame('Abobo PK18 → Hôtel de Ville', $direction->name);
        $this->assertSame(3, $direction->stops_count);
        $this->assertSame(
            ['Terminus PK18', 'Gare Nord', 'Terminus Hôtel de Ville'],
            $direction->stops->pluck('name')->all(),
        );

        // « Gare Nord » est desservie par les 4 sens, mais n'existe qu'une fois
        $this->assertSame(4, Stop::count());
        $this->assertSame(4, Stop::where('name', 'Gare Nord')->firstOrFail()->directions()->count());
    }

    public function test_import_is_idempotent(): void
    {
        $importer = app(TransitImporter::class);
        $importer->import($this->data());
        $report = $importer->import($this->data());

        $this->assertSame(0, $report->linesCreated);
        $this->assertSame(0, $report->stopsCreated);
        $this->assertSame(4, $report->directionsUpdated);
        $this->assertSame(2, Line::count());
        $this->assertSame(4, Stop::count());
        $this->assertDatabaseCount('direction_stops', 10);
    }

    public function test_prune_removes_what_is_no_longer_in_the_file(): void
    {
        app(TransitImporter::class)->import($this->data());

        $data = $this->data();
        $data['lines'] = array_slice($data['lines'], 0, 2); // le gbaka disparaît
        $report = app(TransitImporter::class)->import($data, prune: true);

        $this->assertSame(2, $report->directionsDeleted);
        $this->assertSame(1, $report->linesDeleted);
        $this->assertSame(1, $report->stopsDeleted); // Carrefour Académie n'est plus desservi
        $this->assertSame(['sotra'], Line::pluck('type')->all());
    }

    public function test_anomalies_are_reported(): void
    {
        $data = $this->data();
        $data['lines'][] = $this->entry(1, 'sotra', null, 'A', 'B', [1], 'monbus', 'SOTRA');

        $report = app(TransitImporter::class)->import($data);

        $this->assertCount(2, $report->anomalies); // moins de 2 arrêts + SOTRA sans numéro
    }

    public function test_the_command_imports_a_file(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'transit');
        file_put_contents($path, json_encode($this->data()));

        $this->artisan('transit:import', ['path' => $path])
            ->expectsOutputToContain('Import terminé.')
            ->assertSuccessful();

        $this->assertSame(4, LineDirection::count());
        unlink($path);
    }

    public function test_the_command_refuses_to_prune_with_an_incomplete_file(): void
    {
        $data = $this->data();
        $data['counts']['missing'] = 900;
        $path = tempnam(sys_get_temp_dir(), 'transit');
        file_put_contents($path, json_encode($data));

        $this->artisan('transit:import', ['path' => $path, '--prune' => true])->assertFailed();

        $this->assertSame(0, LineDirection::count());
        unlink($path);
    }
}
