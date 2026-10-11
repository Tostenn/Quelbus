<?php

namespace Tests\Feature;

use App\Models\Report;
use App\Models\Subscriber;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::create(['name' => 'Tosten', 'email' => 'admin@example.com', 'password' => 'un-mot-de-passe-solide']);
    }

    public function test_an_admin_can_log_in_and_out(): void
    {
        $this->admin();

        $token = $this->postJson('/api/login', ['email' => 'Admin@Example.com', 'password' => 'un-mot-de-passe-solide'])
            ->assertOk()
            ->assertJsonPath('user.name', 'Tosten')
            ->json('token');

        $this->withToken($token)->getJson('/api/admin/me')->assertOk()->assertJsonPath('user.email', 'admin@example.com');
        $this->withToken($token)->postJson('/api/admin/logout')->assertOk();
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_a_wrong_password_is_refused(): void
    {
        $this->admin();

        $this->postJson('/api/login', ['email' => 'admin@example.com', 'password' => 'faux'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    public function test_admin_pages_need_a_token(): void
    {
        foreach (['/api/admin/stats', '/api/admin/reports', '/api/admin/subscribers'] as $url) {
            $this->getJson($url)->assertUnauthorized();
        }
    }

    public function test_visits_and_searches_are_counted(): void
    {
        $this->postJson('/api/visits')->assertNoContent();
        $this->postJson('/api/visits')->assertNoContent();
        $this->getJson('/api/search?from_lat=5.3&from_lng=-4&to_lat=5.31&to_lng=-4')->assertOk();

        $this->getJson('/api/stats')
            ->assertOk()
            ->assertJsonPath('data.visits', 2)
            ->assertJsonPath('data.searches', 1);
    }

    public function test_the_dashboard_shows_stats_reports_and_subscribers(): void
    {
        $this->postJson('/api/visits');
        Report::create(['page' => '/lignes/81', 'kind' => 'ordre_faux', 'message' => 'Ordre inversé.']);
        Subscriber::create(['first_name' => 'Awa', 'last_name' => 'Koné', 'email' => 'awa@example.com', 'profile' => 'utilisateur', 'message' => 'Merci !']);
        $this->actingAs($this->admin(), 'sanctum');

        $this->getJson('/api/admin/stats')
            ->assertOk()
            ->assertJsonPath('data.totals.visits', 1)
            ->assertJsonPath('data.totals.reports', 1)
            ->assertJsonCount(30, 'data.days')
            ->assertJsonPath('data.days.29.visits', 1);

        $this->getJson('/api/admin/reports')->assertOk()->assertJsonPath('data.0.kind_label', 'Ordre des arrêts faux');
        $this->getJson('/api/admin/subscribers')->assertOk()->assertJsonPath('data.0.message', 'Merci !');
    }

    public function test_the_command_creates_an_admin(): void
    {
        $this->artisan('admin:create', ['email' => 'Moi@Example.com', '--password' => 'un-mot-de-passe-solide'])->assertSuccessful();
        $this->artisan('admin:create', ['email' => 'moi@example.com', '--password' => 'court'])->assertFailed();

        $this->assertDatabaseHas('users', ['email' => 'moi@example.com']);
    }
}
