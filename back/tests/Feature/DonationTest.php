<?php

namespace Tests\Feature;

use App\Models\Donation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class DonationTest extends TestCase
{
    use RefreshDatabase;

    private const SECRET = 'sk_test_secret';

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.paystack.secret_key' => self::SECRET, 'services.paystack.currency' => 'XOF']);
    }

    private function paystackTransaction(string $reference, string $status, int $subunits): array
    {
        return ['status' => true, 'data' => [
            'reference' => $reference, 'status' => $status, 'amount' => $subunits, 'currency' => 'XOF',
            'channel' => 'mobile_money', 'paid_at' => '2026-10-11T10:00:00.000Z',
        ]];
    }

    private function pending(int $amount = 1000): Donation
    {
        return Donation::create(['reference' => 'QB-TEST', 'amount' => $amount, 'currency' => 'XOF', 'name' => 'Awa']);
    }

    public function test_donations_are_closed_without_a_paystack_key(): void
    {
        config(['services.paystack.secret_key' => null]);

        $this->postJson('/api/donations', ['amount' => 1000])->assertStatus(503);
        $this->assertSame(0, Donation::count());
    }

    public function test_a_donation_redirects_to_paystack(): void
    {
        Http::fake(['api.paystack.co/transaction/initialize' => Http::response(['status' => true, 'data' => ['authorization_url' => 'https://checkout.paystack.com/abc']])]);

        $this->postJson('/api/donations', ['amount' => 1000, 'name' => 'Awa', 'message' => 'Merci pour l’appli !'])
            ->assertCreated()
            ->assertJsonPath('authorization_url', 'https://checkout.paystack.com/abc');

        $donation = Donation::firstOrFail();
        $this->assertSame('pending', $donation->status);
        Http::assertSent(fn (Request $request) => $request['amount'] === 100000
            && $request['currency'] === 'XOF'
            && $request['reference'] === $donation->reference
            && $request['email'] === config('services.paystack.fallback_email')
            && $request->hasHeader('Authorization', 'Bearer '.self::SECRET));
    }

    public function test_donations_are_validated(): void
    {
        $this->postJson('/api/donations', ['amount' => 50, 'email' => 'pas-un-email'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['amount', 'email']);
    }

    public function test_a_paystack_failure_is_reported_cleanly(): void
    {
        Http::fake(['api.paystack.co/*' => Http::response(['status' => false, 'message' => 'Invalid key'], 401)]);

        $this->postJson('/api/donations', ['amount' => 1000])->assertStatus(502);
        $this->assertSame('failed', Donation::firstOrFail()->status);
    }

    public function test_the_return_page_confirms_the_payment_with_paystack(): void
    {
        $this->pending();
        Http::fake(['api.paystack.co/transaction/verify/QB-TEST' => Http::response($this->paystackTransaction('QB-TEST', 'success', 100000))]);

        $this->getJson('/api/donations/QB-TEST')
            ->assertOk()
            ->assertJsonPath('data.status', 'success')
            ->assertJsonPath('data.amount', 1000)
            ->assertJsonPath('data.name', 'Awa');

        $this->assertSame('mobile_money', Donation::firstOrFail()->channel);
    }

    public function test_a_payment_with_the_wrong_amount_is_not_confirmed(): void
    {
        $this->pending();
        Http::fake(['api.paystack.co/*' => Http::response($this->paystackTransaction('QB-TEST', 'success', 100))]);

        $this->getJson('/api/donations/QB-TEST')->assertOk()->assertJsonPath('data.status', 'pending');
    }

    public function test_the_webhook_needs_a_valid_signature(): void
    {
        $this->pending();
        $payload = json_encode(['event' => 'charge.success', 'data' => $this->paystackTransaction('QB-TEST', 'success', 100000)['data']]);

        $this->call('POST', '/api/paystack/webhook', [], [], [], ['HTTP_X_PAYSTACK_SIGNATURE' => 'faux', 'CONTENT_TYPE' => 'application/json'], $payload)
            ->assertUnauthorized();
        $this->assertSame('pending', Donation::firstOrFail()->status);

        $signature = hash_hmac('sha512', $payload, self::SECRET);
        foreach ([1, 2] as $attempt) { // Paystack peut renvoyer le même événement
            $this->call('POST', '/api/paystack/webhook', [], [], [], ['HTTP_X_PAYSTACK_SIGNATURE' => $signature, 'CONTENT_TYPE' => 'application/json'], $payload)
                ->assertOk();
        }

        $donation = Donation::firstOrFail();
        $this->assertSame('success', $donation->status);
        $this->assertNotNull($donation->paid_at);
    }

    public function test_the_dashboard_lists_donations(): void
    {
        Donation::create(['reference' => 'QB-1', 'amount' => 1000, 'status' => 'success', 'name' => 'Awa']);
        Donation::create(['reference' => 'QB-2', 'amount' => 500, 'status' => 'pending']);
        $this->actingAs(User::create(['name' => 'Admin', 'email' => 'a@example.com', 'password' => 'un-mot-de-passe-solide']), 'sanctum');

        $this->getJson('/api/admin/donations')
            ->assertOk()
            ->assertJsonPath('totals.amount', 1000)
            ->assertJsonPath('totals.count', 1)
            ->assertJsonPath('totals.pending', 1)
            ->assertJsonCount(2, 'data');

        $this->getJson('/api/admin/stats')->assertJsonPath('data.totals.donations_amount', 1000);
    }
}
