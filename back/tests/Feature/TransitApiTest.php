<?php

namespace Tests\Feature;

use App\Models\Line;
use App\Models\Stop;
use App\Services\Transit\TransitImporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TransitApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $line = fn (int $id, string $from, string $to, array $stops) => [
            'id' => $id, 'name' => "bus 81 : {$from} → {$to}", 'type' => 'sotra', 'ref' => '81', 'from' => $from, 'to' => $to,
            'category' => 'monbus', 'operator' => 'SOTRA', 'stops' => $stops, 'geometry' => [],
        ];

        app(TransitImporter::class)->import([
            'stops' => [
                ['id' => 1, 'name' => 'Gare Nord', 'lat' => 5.358911, 'lon' => -4.028187],
                ['id' => 2, 'name' => 'Mosquée Adjamé', 'lat' => 5.353519, 'lon' => -4.025925],
                ['id' => 3, 'name' => 'Terminus Angré', 'lat' => 5.398, 'lon' => -3.99],
            ],
            'lines' => [
                $line(1, 'Gare Nord', 'Terminus Angré', [1, 2, 3]),
                $line(2, 'Terminus Angré', 'Gare Nord', [3, 2, 1]),
            ],
        ]);
    }

    public function test_lines_are_listed(): void
    {
        $this->getJson('/api/lines')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.ref', '81')
            ->assertJsonPath('data.0.directions_count', 2);
    }

    public function test_a_line_shows_its_directions_with_ordered_stops(): void
    {
        $slug = Line::firstOrFail()->slug;

        $this->getJson("/api/lines/{$slug}")
            ->assertOk()
            ->assertJsonPath('data.directions.0.name', 'Gare Nord → Terminus Angré')
            ->assertJsonPath('data.directions.0.stops.1.name', 'Mosquée Adjamé')
            ->assertJsonPath('data.directions.1.stops.0.name', 'Terminus Angré');

        $this->getJson('/api/lines/inconnue')->assertNotFound();
    }

    public function test_a_stop_shows_its_lines_and_nearby_stops(): void
    {
        $slug = Stop::where('name', 'Gare Nord')->firstOrFail()->slug;

        $this->getJson("/api/stops/{$slug}")
            ->assertOk()
            ->assertJsonPath('data.name', 'Gare Nord')
            ->assertJsonCount(2, 'data.lines')
            ->assertJsonPath('data.nearby', []);
    }

    public function test_the_sitemap_lists_lines_and_stops(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'sitemap');

        $this->artisan('sitemap:generate', ['path' => $path])->assertSuccessful();

        $xml = file_get_contents($path);
        $this->assertStringContainsString('https://quelbus.monradar.ci/lignes/'.Line::firstOrFail()->slug, $xml);
        $this->assertStringContainsString('https://quelbus.monradar.ci/arrets/gare-nord', $xml);
        $this->assertSame(4 + 1 + 3, substr_count($xml, '<url>'));
        unlink($path);
    }
}
