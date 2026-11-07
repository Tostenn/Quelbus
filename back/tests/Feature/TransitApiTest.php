<?php

namespace Tests\Feature;

use App\Models\Line;
use App\Models\Stop;
use App\Services\Transit\TransitImporter;
use Illuminate\Console\Scheduling\Schedule;
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

    private function importBouake(): void
    {
        app(TransitImporter::class)->import([
            'cities' => [['slug' => 'bouake', 'name' => 'Bouaké', 'bbox' => [7.60, -5.12, 7.78, -4.95]]],
            'stops' => [
                ['id' => 1, 'name' => 'Terminus Ahougnanssou', 'lat' => 7.683119, 'lon' => -5.054179, 'city' => 'bouake'],
                ['id' => 2, 'name' => 'Terminus Kennedy', 'lat' => 7.683397, 'lon' => -5.004097, 'city' => 'bouake'],
            ],
            'lines' => [[
                'id' => 'sotra-pdf:304:aller', 'name' => 'bus 304 : Ahougnanssou → Kennedy', 'type' => 'sotra', 'ref' => '304',
                'from' => 'Ahougnanssou', 'to' => 'Kennedy', 'category' => 'monbus', 'operator' => 'SOTRA',
                'city' => 'bouake', 'stops' => [1, 2], 'geometry' => null, 'partial' => true,
            ]],
        ]);
    }

    public function test_cities_are_listed_with_their_bounds(): void
    {
        $this->importBouake();

        $this->getJson('/api/cities')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.slug', 'abidjan')
            ->assertJsonPath('data.0.lines_count', 1)
            ->assertJsonPath('data.1.name', 'Bouaké')
            ->assertJsonPath('data.1.bounds', [7.6, -5.12, 7.78, -4.95]);
    }

    public function test_lines_and_suggestions_can_be_filtered_by_city(): void
    {
        $this->importBouake();

        $this->getJson('/api/lines')->assertJsonCount(2, 'data');
        $this->getJson('/api/lines?city=bouake')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.ref', '304')
            ->assertJsonPath('data.0.city', 'bouake');

        $this->getJson('/api/suggest?q=terminus')->assertJsonCount(3, 'data');
        $this->getJson('/api/suggest?q=terminus&city=abidjan')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Terminus Angré');
    }

    public function test_a_partial_line_says_so(): void
    {
        $this->importBouake();
        $slug = Line::where('ref', '304')->value('slug');

        $this->getJson("/api/lines/{$slug}")
            ->assertOk()
            ->assertJsonPath('data.city.slug', 'bouake')
            ->assertJsonPath('data.directions.0.is_partial', true);
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
        $this->assertStringContainsString('https://quelbus.ci/lignes/'.Line::firstOrFail()->slug, $xml);
        $this->assertStringContainsString('https://quelbus.ci/arrets/gare-nord', $xml);
        $this->assertSame(5 + 1 + 3, substr_count($xml, '<url>'));
        unlink($path);
    }

    public function test_the_sitemap_is_written_to_the_configured_path_and_left_alone_when_unchanged(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'sitemap');
        config(['app.sitemap_path' => $path]);

        $this->artisan('sitemap:generate')->expectsOutputToContain('adresses écrites')->assertSuccessful();
        $this->assertStringContainsString('<urlset', file_get_contents($path));
        $this->assertFileDoesNotExist($path.'.tmp');

        $this->artisan('sitemap:generate')->expectsOutputToContain('Sitemap inchangé')->assertSuccessful();
        unlink($path);
    }

    public function test_the_sitemap_is_regenerated_every_hour(): void
    {
        $event = collect(app(Schedule::class)->events())
            ->first(fn ($e) => str_contains($e->command, 'sitemap:generate'));

        $this->assertNotNull($event);
        $this->assertSame('0 * * * *', $event->expression);
    }
}
