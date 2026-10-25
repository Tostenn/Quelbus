<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\AdminInvitation;
use App\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AdminAccountsTest extends TestCase
{
    use RefreshDatabase;

    private function admin(string $email = 'admin@example.com', string $name = 'Tosten'): User
    {
        return User::create(['name' => $name, 'email' => $email, 'password' => 'un-mot-de-passe-solide']);
    }

    public function test_a_forgotten_password_can_be_reset_from_the_emailed_link(): void
    {
        Notification::fake();
        $admin = $this->admin();
        $oldToken = $admin->createToken('admin')->plainTextToken;

        $this->postJson('/api/password/forgot', ['email' => 'Admin@Example.com'])->assertOk();

        $token = null;
        Notification::assertSentTo($admin, ResetPassword::class, function (ResetPassword $n) use (&$token, $admin) {
            $token = $n->token;

            return str_contains($n->toMail($admin)->actionUrl, '/mot-de-passe/nouveau?token=');
        });

        $this->postJson('/api/password/reset', [
            'token' => $token,
            'email' => 'admin@example.com',
            'password' => 'un-tout-nouveau-mot-de-passe',
            'password_confirmation' => 'un-tout-nouveau-mot-de-passe',
        ])->assertOk();

        // Anciennes sessions fermées, nouveau mot de passe actif
        $this->withToken($oldToken)->getJson('/api/admin/me')->assertUnauthorized();
        $this->postJson('/api/login', ['email' => 'admin@example.com', 'password' => 'un-tout-nouveau-mot-de-passe'])->assertOk();
    }

    public function test_forgot_password_does_not_reveal_unknown_emails(): void
    {
        Notification::fake();

        $this->postJson('/api/password/forgot', ['email' => 'inconnu@example.com'])
            ->assertOk()
            ->assertJsonPath('message', fn (string $m) => str_starts_with($m, 'Si un compte existe'));

        Notification::assertNothingSent();
    }

    public function test_a_bad_reset_token_is_refused(): void
    {
        $this->admin();

        $this->postJson('/api/password/reset', [
            'token' => 'faux',
            'email' => 'admin@example.com',
            'password' => 'un-tout-nouveau-mot-de-passe',
            'password_confirmation' => 'un-tout-nouveau-mot-de-passe',
        ])->assertUnprocessable()->assertJsonValidationErrors(['token']);
    }

    public function test_an_admin_invites_another_admin_who_chooses_a_password(): void
    {
        Notification::fake();
        $this->actingAs($this->admin(), 'sanctum');

        $this->postJson('/api/admin/users', ['name' => 'Awa', 'email' => 'Awa@Example.com'])
            ->assertCreated()
            ->assertJsonPath('data.email', 'awa@example.com')
            ->assertJsonPath('data.last_login_at', null);

        $awa = User::where('email', 'awa@example.com')->firstOrFail();
        $token = null;
        Notification::assertSentTo($awa, AdminInvitation::class, function (AdminInvitation $n) use (&$token, $awa) {
            $token = $n->token;

            return $n->invitedBy === 'Tosten' && str_contains($n->toMail($awa)->actionUrl, 'invitation=1');
        });

        // Le compte reste fermé tant que l'invitation n'est pas acceptée
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/password/reset', [
            'token' => $token,
            'email' => 'awa@example.com',
            'password' => 'le-mot-de-passe-d-awa',
            'password_confirmation' => 'le-mot-de-passe-d-awa',
            'invitation' => true,
        ])->assertOk();

        $this->postJson('/api/login', ['email' => 'awa@example.com', 'password' => 'le-mot-de-passe-d-awa'])->assertOk();
        $this->assertNotNull($awa->fresh()->last_login_at);
    }

    public function test_the_same_email_cannot_be_invited_twice(): void
    {
        Notification::fake();
        $this->actingAs($this->admin(), 'sanctum');

        $this->postJson('/api/admin/users', ['name' => 'Moi', 'email' => 'ADMIN@example.com'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    public function test_admins_are_listed_and_can_be_removed_but_not_yourself(): void
    {
        $me = $this->admin();
        $other = $this->admin('awa@example.com', 'Awa');
        $other->createToken('admin');
        $this->actingAs($me, 'sanctum');

        $this->getJson('/api/admin/users')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.is_me', false)
            ->assertJsonPath('data.1.is_me', true);

        $this->deleteJson("/api/admin/users/{$me->id}")->assertUnprocessable();
        $this->deleteJson("/api/admin/users/{$other->id}")->assertOk();

        $this->assertDatabaseMissing('users', ['email' => 'awa@example.com']);
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_account_routes_need_a_token(): void
    {
        $this->getJson('/api/admin/users')->assertUnauthorized();
        $this->postJson('/api/admin/users', ['name' => 'X', 'email' => 'x@example.com'])->assertUnauthorized();
    }
}
