<?php

namespace Tests\Feature;

use App\Models\Report;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'page' => '/lignes/81-gare-nord-terminus-angre',
            'kind' => 'ordre_faux',
            'message' => 'Mosquée Adjamé vient après Pharmacie Banco.',
            'email' => '',
        ], $overrides);
    }

    public function test_a_visitor_can_report_an_error(): void
    {
        $this->postJson('/api/reports', $this->payload())->assertCreated()->assertJsonStructure(['message']);

        $this->assertDatabaseHas('reports', ['kind' => 'ordre_faux', 'email' => null, 'line_id' => null]);
    }

    public function test_reports_are_validated(): void
    {
        $this->postJson('/api/reports', $this->payload(['kind' => 'nimporte', 'message' => '', 'email' => 'pas-un-email', 'line_id' => 999]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['kind', 'message', 'email', 'line_id']);
    }

    public function test_bots_filling_the_honeypot_are_ignored(): void
    {
        $this->postJson('/api/reports', $this->payload(['website' => 'http://spam.example']))->assertCreated();

        $this->assertSame(0, Report::count());
    }

    public function test_reports_can_be_exported(): void
    {
        Report::create($this->payload(['email' => 'awa@example.com']));
        $path = tempnam(sys_get_temp_dir(), 'reports');

        $this->artisan('reports:export', ['path' => $path])->assertSuccessful();

        $this->assertStringContainsString('Ordre des arrêts faux', file_get_contents($path));
        unlink($path);
    }
}
