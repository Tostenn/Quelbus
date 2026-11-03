<?php

namespace Tests\Feature;

use App\Mail\NewsletterMail;
use App\Models\Newsletter;
use App\Models\Subscriber;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class NewsletterTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::create(['name' => 'Tosten Kouya', 'email' => 'admin@example.com', 'password' => 'un-mot-de-passe-solide']);
    }

    private function subscriber(string $email, string $profile, array $extra = []): Subscriber
    {
        return Subscriber::create(['first_name' => ucfirst(strtok($email, '@')), 'last_name' => 'Test', 'email' => $email, 'profile' => $profile, ...$extra]);
    }

    private function payload(array $overrides = []): array
    {
        return ['subject' => 'Les correspondances arrivent', 'body' => "# Bonjour {prenom}\n\nDu **nouveau** sur QuelBus.", 'audience' => 'tous', ...$overrides];
    }

    public function test_newsletter_pages_need_a_token(): void
    {
        $this->getJson('/api/admin/newsletters')->assertUnauthorized();
        $this->postJson('/api/admin/newsletters', $this->payload())->assertUnauthorized();
    }

    public function test_the_audiences_are_counted_without_unsubscribed_people(): void
    {
        $this->subscriber('awa@example.com', 'utilisateur');
        $this->subscriber('koffi@example.com', 'contributeur');
        $this->subscriber('yao@example.com', 'les_deux');
        $this->subscriber('parti@example.com', 'utilisateur', ['unsubscribed_at' => now()]);
        $this->actingAs($this->admin(), 'sanctum');

        $this->getJson('/api/admin/newsletters')
            ->assertOk()
            ->assertJsonPath('audiences.0.count', 3)
            ->assertJsonPath('audiences.1.count', 1)
            ->assertJsonPath('audiences.2.count', 2)
            ->assertJsonPath('unsubscribed', 1);
    }

    public function test_the_preview_renders_markdown_with_the_first_name(): void
    {
        $this->actingAs($this->admin(), 'sanctum');

        $html = $this->postJson('/api/admin/newsletters/preview', $this->payload())->assertOk()->json('data.html');

        $this->assertMatchesRegularExpression('#<h1[^>]*>Bonjour Awa</h1>#', $html);
        $this->assertMatchesRegularExpression('#<strong[^>]*>nouveau</strong>#', $html);
        $this->assertStringContainsString('groupe WhatsApp QuelBus', $html);
    }

    public function test_a_test_email_goes_to_the_admin_only(): void
    {
        Mail::fake();
        $this->subscriber('awa@example.com', 'utilisateur');
        $this->actingAs($this->admin(), 'sanctum');

        $this->postJson('/api/admin/newsletters/test', $this->payload())->assertOk();

        Mail::assertSent(NewsletterMail::class, fn (NewsletterMail $mail) => $mail->hasTo('admin@example.com'));
        Mail::assertSentCount(1);
        Mail::assertNothingQueued();
        $this->assertSame(0, Newsletter::count());
    }

    public function test_sending_queues_one_email_per_subscriber_of_the_audience(): void
    {
        Mail::fake();
        $this->subscriber('awa@example.com', 'utilisateur');
        $this->subscriber('koffi@example.com', 'contributeur');
        $this->subscriber('yao@example.com', 'les_deux');
        $this->subscriber('parti@example.com', 'contributeur', ['unsubscribed_at' => now()]);
        $this->actingAs($this->admin(), 'sanctum');

        $this->postJson('/api/admin/newsletters', $this->payload(['audience' => 'contributeurs']))
            ->assertCreated()
            ->assertJsonPath('message', "Newsletter en cours d'envoi à 2 inscrits.");

        Mail::assertQueuedCount(2);
        Mail::assertQueued(NewsletterMail::class, fn (NewsletterMail $mail) => $mail->hasTo('koffi@example.com'));
        Mail::assertNotQueued(NewsletterMail::class, fn (NewsletterMail $mail) => $mail->hasTo('parti@example.com') || $mail->hasTo('awa@example.com'));
        $this->assertDatabaseHas('newsletters', ['subject' => 'Les correspondances arrivent', 'audience' => 'contributeurs', 'recipients' => 2]);
        $this->getJson('/api/admin/newsletters')->assertJsonPath('data.0.sent_by', 'Tosten Kouya');
    }

    public function test_each_email_is_personalised_and_has_an_unsubscribe_link(): void
    {
        $subscriber = $this->subscriber('awa@example.com', 'utilisateur');
        $newsletter = Newsletter::create([...$this->payload(), 'recipients' => 1]);

        $mail = new NewsletterMail($newsletter, $subscriber);

        $mail->assertHasSubject('Les correspondances arrivent');
        $mail->assertSeeInHtml('Bonjour Awa');
        $mail->assertSeeInHtml('/desinscription/'.$subscriber->id);
        $this->assertStringContainsString('One-Click', $mail->headers()->text['List-Unsubscribe-Post']);
    }

    public function test_an_empty_audience_or_missing_fields_are_refused(): void
    {
        $this->actingAs($this->admin(), 'sanctum');

        $this->postJson('/api/admin/newsletters', $this->payload())->assertUnprocessable()->assertJsonValidationErrors(['audience']);
        $this->postJson('/api/admin/newsletters', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['subject', 'body', 'audience'])
            ->assertJsonPath('errors.subject.0', 'Indiquez l’objet de l’email.');
    }
}
