<?php

namespace Tests\Feature;

use App\Models\Subscriber;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SubscriberTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string, string>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Awa',
            'last_name' => 'Koné',
            'email' => 'awa@example.com',
            'profile' => 'contributeur',
            'message' => 'Je connais bien les lignes de Yopougon.',
        ], $overrides);
    }

    public function test_a_visitor_can_sign_up(): void
    {
        $this->postJson('/api/subscribers', $this->payload())
            ->assertCreated()
            ->assertJsonStructure(['message']);

        $this->assertDatabaseHas('subscribers', [
            'email' => 'awa@example.com',
            'first_name' => 'Awa',
            'last_name' => 'Koné',
            'profile' => 'contributeur',
        ]);
    }

    public function test_email_is_normalised_and_not_duplicated(): void
    {
        $this->postJson('/api/subscribers', $this->payload(['email' => ' Awa@Example.com ']))->assertCreated();
        $this->postJson('/api/subscribers', $this->payload(['first_name' => 'Autre']))->assertOk();

        $this->assertSame(1, Subscriber::count());
        $this->assertSame('Awa', Subscriber::first()->first_name);
    }

    public function test_required_fields_are_validated_in_french(): void
    {
        $this->postJson('/api/subscribers', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['first_name', 'last_name', 'email', 'profile'])
            ->assertJsonPath('errors.email.0', 'Indiquez votre adresse email.');
    }

    public function test_invalid_email_and_profile_are_rejected(): void
    {
        $this->postJson('/api/subscribers', $this->payload(['email' => 'pas-un-email', 'profile' => 'admin']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email', 'profile']);
    }

    public function test_honeypot_submissions_are_silently_ignored(): void
    {
        $this->postJson('/api/subscribers', $this->payload(['website' => 'http://spam.example']))
            ->assertCreated();

        $this->assertSame(0, Subscriber::count());
    }

    public function test_signups_can_be_exported_to_csv(): void
    {
        Subscriber::create($this->payload());
        $path = tempnam(sys_get_temp_dir(), 'subs');

        $this->artisan('subscribers:export', ['path' => $path])->assertSuccessful();

        $csv = file_get_contents($path);
        unlink($path);
        $this->assertStringContainsString('prenom,nom,email,profil', $csv);
        $this->assertStringContainsString('awa@example.com', $csv);
    }
}
