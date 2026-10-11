<?php

namespace Tests\Feature;

use App\Services\Transit\TransitImporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SearchApiTest extends TestCase
{
    use RefreshDatabase;

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

    public function test_gare_nord_to_mosquee_adjame_takes_line_81(): void
    {
        $this->getJson('/api/search?'.http_build_query([
            'from_lat' => 5.358911, 'from_lng' => -4.028187, 'to_lat' => 5.353519, 'to_lng' => -4.025925,
        ]))
            ->assertOk()
            ->assertJsonPath('results.0.line.ref', '81')
            ->assertJsonPath('results.0.direction.name', 'Gare Nord → Terminus Angré')
            ->assertJsonPath('results.0.board.name', 'Gare Nord')
            ->assertJsonPath('results.0.alight.name', 'Mosquée Adjamé')
            ->assertJsonPath('results.0.stops', 1);
    }

    public function test_search_parameters_are_validated(): void
    {
        $this->getJson('/api/search?from_lat=5.3&radius=1000')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['from_lng', 'to_lat', 'to_lng', 'radius']);

        $this->getJson('/api/search?from_lat=5.3&from_lng=-4&to_lat=5.3&to_lng=-4&types[]=bateau')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['types.0']);
    }

    public function test_suggestions_ignore_accents_and_merge_duplicate_stops(): void
    {
        $this->getJson('/api/suggest?q=mosquee adjame')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Mosquée Adjamé')
            ->assertJsonPath('data.0.stops', 2);

        $this->getJson('/api/suggest?q=a')->assertOk()->assertJsonCount(0, 'data');
    }
}
