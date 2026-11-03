<?php

namespace Tests\Feature;

use App\Mail\SubscriptionConfirmed;
use App\Models\Subscriber;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
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

    public function test_a_confirmation_email_is_queued_for_new_subscribers(): void
    {
        Mail::fake();

        $this->postJson('/api/subscribers', $this->payload())->assertCreated();

        Mail::assertQueued(SubscriptionConfirmed::class, fn (SubscriptionConfirmed $mail) => $mail->hasTo('awa@example.com'));
        Mail::assertNothingSent();
    }

    public function test_confirmation_email_content_depends_on_profile(): void
    {
        $contributor = new SubscriptionConfirmed(Subscriber::create($this->payload()));
        $contributor->assertHasSubject('Merci de rejoindre les contributeurs de QuelBus');
        $contributor->assertSeeInHtml('Bonjour Awa');
        $contributor->assertSeeInHtml('Rejoindre le groupe WhatsApp');
        $contributor->assertSeeInHtml('https://chat.whatsapp.com/G37QsVVlc2EAjrhWNJ5vYY');
        $contributor->assertSeeInHtml('Vérifier une ligne');
        $contributor->assertSeeInHtml('/desinscription/');

        $user = new SubscriptionConfirmed(Subscriber::create($this->payload(['email' => 'user@example.com', 'profile' => 'utilisateur'])));
        $user->assertHasSubject('Votre inscription à QuelBus est confirmée');
        $user->assertSeeInHtml('Trouver mon bus');
        $user->assertSeeInHtml('On vous préviendra par email des nouveautés', false);
        $user->assertSeeInHtml('Rejoindre le groupe WhatsApp');
        $user->assertDontSeeInHtml('Vérifier une ligne');
    }

    public function test_a_subscriber_can_unsubscribe_from_the_email_link(): void
    {
        $subscriber = Subscriber::create($this->payload());
        $url = $subscriber->unsubscribeUrl();

        // Ouvrir le lien ne fait que demander confirmation
        $this->get($url)->assertOk()->assertSee('Me désinscrire');
        $this->assertNull($subscriber->fresh()->unsubscribed_at);

        $this->post($url)->assertOk()->assertSee('C’est fait');
        $this->assertNotNull($subscriber->fresh()->unsubscribed_at);
    }

    public function test_an_unsigned_unsubscribe_link_is_refused(): void
    {
        $subscriber = Subscriber::create($this->payload());

        $this->post("/desinscription/{$subscriber->id}")->assertForbidden();
        $this->assertNull($subscriber->fresh()->unsubscribed_at);
    }

    public function test_an_unsubscribed_person_can_sign_up_again(): void
    {
        Mail::fake();
        Subscriber::create([...$this->payload(), 'unsubscribed_at' => now()]);

        $this->postJson('/api/subscribers', $this->payload(['profile' => 'utilisateur']))->assertCreated();

        $this->assertNull(Subscriber::first()->unsubscribed_at);
        $this->assertSame('utilisateur', Subscriber::first()->profile);
        Mail::assertQueuedCount(1);
    }

    public function test_email_is_normalised_and_not_duplicated(): void
    {
        Mail::fake();

        $this->postJson('/api/subscribers', $this->payload(['email' => ' Awa@Example.com ']))->assertCreated();
        $this->postJson('/api/subscribers', $this->payload(['first_name' => 'Autre']))->assertOk();

        $this->assertSame(1, Subscriber::count());
        $this->assertSame('Awa', Subscriber::first()->first_name);
        Mail::assertQueuedCount(1);
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
        Mail::fake();

        $this->postJson('/api/subscribers', $this->payload(['website' => 'http://spam.example']))
            ->assertCreated();

        $this->assertSame(0, Subscriber::count());
        Mail::assertNothingQueued();
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
