<?php

namespace Tests\Feature;

use App\Jobs\RecordSearch;
use App\Models\Line;
use App\Models\SearchedRoute;
use App\Models\Stop;
use App\Models\User;
use App\Services\Transit\TransitImporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class SearchIndexTest extends TestCase
{
    use RefreshDatabase;

    private const GARE_NORD = ['from_lat' => 5.358911, 'from_lng' => -4.028187, 'from_name' => 'Gare Nord'];

    // Quai voisin de Mosquée Adjamé (id 3) : doit compter comme le même arrêt
    private const MOSQUEE = ['to_lat' => 5.353600, 'to_lng' => -4.026000, 'to_name' => 'Mosquée Adjamé'];

    protected function setUp(): void
    {
        parent::setUp();

        app(TransitImporter::class)->import([
            'stops' => [
                ['id' => 1, 'name' => 'Gare Nord', 'lat' => 5.358911, 'lon' => -4.028187],
                ['id' => 2, 'name' => 'Mosquée Adjamé', 'lat' => 5.353519, 'lon' => -4.025925],
                ['id' => 3, 'name' => 'Mosquée Adjamé', 'lat' => 5.353600, 'lon' => -4.026000],
                ['id' => 4, 'name' => 'Terminus Angré', 'lat' => 5.398000, 'lon' => -3.990000],
            ],
            'lines' => [[
                'id' => 10238034, 'name' => 'bus 81 : Gare Nord → Terminus Angré', 'type' => 'sotra', 'ref' => '81',
                'from' => 'Gare Nord', 'to' => 'Terminus Angré', 'category' => 'monbus', 'operator' => 'SOTRA',
                'stops' => [1, 2, 4], 'geometry' => [],
            ], [
                'id' => 10238035, 'name' => 'bus 81 : Terminus Angré → Gare Nord', 'type' => 'sotra', 'ref' => '81',
                'from' => 'Terminus Angré', 'to' => 'Gare Nord', 'category' => 'monbus', 'operator' => 'SOTRA',
                'stops' => [4, 3, 1], 'geometry' => [],
            ]],
        ]);
    }

    private function search(array $params = []): void
    {
        $this->getJson('/api/search?'.http_build_query([...self::GARE_NORD, ...self::MOSQUEE, ...$params]))->assertOk();
    }

    public function test_a_search_is_indexed_through_the_queue(): void
    {
        Queue::fake();

        $this->search();

        Queue::assertPushed(RecordSearch::class, fn (RecordSearch $job) => $job->search['outcome'] === 'direct'
            && $job->search['from']['name'] === 'Gare Nord'
            && $job->search['direct'] === [Line::firstOrFail()->id]);
        $this->assertSame(0, DB::table('search_logs')->count());
    }

    public function test_searches_are_grouped_by_departure_and_arrival_stop(): void
    {
        $this->search();
        // Même trajet depuis le quai voisin de la mosquée, et depuis une position GPS proche de la gare
        $this->search(['to_lat' => 5.353519, 'to_lng' => -4.025925]);
        $this->search(['from_lat' => 5.358950, 'from_lng' => -4.028100, 'from_name' => 'Ma position']);

        $route = SearchedRoute::with('from', 'to')->sole();
        $this->assertSame(3, $route->searches_count);
        $this->assertSame('Gare Nord', $route->from->name);
        $this->assertSame(Stop::where('name', 'Mosquée Adjamé')->min('id'), $route->to_stop_id);
        $this->assertSame('gare-nord--mosquee-adjame', $route->slug);
        $this->assertSame('direct', $route->outcome);
        $this->assertSame('81', $route->answer['options'][0][0]['ref']);

        $this->assertSame(3, DB::table('search_logs')->count());
        $this->assertSame(1, DB::table('search_logs')->where('from_gps', true)->count());
        $this->assertSame(3, DB::table('search_log_lines')->where('kind', 'direct')->where('rank', 0)->count());
    }

    public function test_a_filtered_search_does_not_replace_the_answer(): void
    {
        $this->search();
        $this->search(['types' => ['gbaka']]);

        $route = SearchedRoute::sole();
        $this->assertSame(2, $route->searches_count);
        $this->assertSame('direct', $route->outcome);
        $this->assertSame('gbaka', DB::table('search_logs')->whereNotNull('types')->value('types'));
        $this->assertSame(1, DB::table('search_logs')->where('outcome', 'none')->count());
    }

    public function test_a_search_far_from_any_stop_is_logged_without_a_route(): void
    {
        $this->search(['to_lat' => 5.30, 'to_lng' => -4.10, 'to_name' => 'Ailleurs']);

        $this->assertSame(0, SearchedRoute::count());
        $log = DB::table('search_logs')->sole();
        $this->assertNull($log->to_stop_id);
        $this->assertSame('none', $log->outcome);
        $this->assertSame('5.30,-4.10', $log->to_area);
    }

    public function test_the_route_page_gives_the_bus_to_take(): void
    {
        $this->search();

        $this->getJson('/api/routes/gare-nord--mosquee-adjame')
            ->assertOk()
            ->assertJsonPath('data.from.name', 'Gare Nord')
            ->assertJsonPath('data.to.name', 'Mosquée Adjamé')
            ->assertJsonPath('data.search.results.0.line.ref', '81');

        $this->getJson('/api/routes/inconnu--nulle-part')->assertNotFound();
    }

    public function test_often_searched_routes_enter_the_sitemap(): void
    {
        $this->search();
        $this->search();
        $path = tempnam(sys_get_temp_dir(), 'sitemap');

        $this->artisan('sitemap:generate', ['path' => $path])->assertSuccessful();
        $this->assertStringNotContainsString('/trajets/', file_get_contents($path));

        $this->search();
        $this->artisan('sitemap:generate', ['path' => $path])->assertSuccessful();
        $this->assertStringContainsString('https://quelbus.ci/trajets/gare-nord--mosquee-adjame', file_get_contents($path));
        unlink($path);
    }

    public function test_line_pages_views_are_counted(): void
    {
        $line = Line::firstOrFail();
        $this->getJson("/api/lines/{$line->slug}")->assertOk();
        $this->getJson("/api/lines/{$line->slug}")->assertOk();

        $this->assertSame(2, (int) DB::table('line_views')->where('line_id', $line->id)->value('views'));
    }

    public function test_the_dashboard_shows_usage_insights(): void
    {
        $this->search();
        $this->search(['from_name' => 'Ma position']);
        $this->search(['to_lat' => 5.30, 'to_lng' => -4.10, 'to_name' => 'Ailleurs']);
        $this->getJson('/api/lines/'.Line::firstOrFail()->slug)->assertOk();

        $this->getJson('/api/admin/insights')->assertUnauthorized();
        $this->actingAs(User::create(['name' => 'Admin', 'email' => 'a@example.com', 'password' => 'un-mot-de-passe-solide']), 'sanctum');

        $this->getJson('/api/admin/insights?jours=7')
            ->assertOk()
            ->assertJsonPath('data.days', 7)
            ->assertJsonPath('data.summary.searches', 3)
            ->assertJsonPath('data.summary.direct', 2)
            ->assertJsonPath('data.summary.none', 1)
            ->assertJsonPath('data.summary.answered_rate', 66.7)
            ->assertJsonPath('data.summary.gps_rate', 33.3)
            ->assertJsonPath('data.summary.line_views', 1)
            ->assertJsonPath('data.routes.0.slug', 'gare-nord--mosquee-adjame')
            ->assertJsonPath('data.routes.0.count', 2)
            ->assertJsonPath('data.routes.0.options.0.0.ref', '81')
            ->assertJsonPath('data.departures.0.name', 'Gare Nord')
            ->assertJsonPath('data.departures.0.count', 3)
            ->assertJsonPath('data.lines_proposed.0.line.ref', '81')
            ->assertJsonPath('data.lines_proposed.0.count', 2)
            ->assertJsonPath('data.lines_proposed.0.first', 2)
            ->assertJsonPath('data.lines_viewed.0.count', 1)
            ->assertJsonPath('data.unanswered.0.to.area', '5.30,-4.10')
            ->assertJsonPath('data.unanswered.0.from.name', 'Gare Nord')
            ->assertJsonCount(24, 'data.hours')
            ->assertJsonCount(7, 'data.weekdays');

        $this->getJson('/api/admin/insights?jours=1000')->assertOk()->assertJsonPath('data.days', 30);
    }
}
