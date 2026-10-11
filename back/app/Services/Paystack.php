<?php

namespace App\Services;

use App\Models\Donation;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Client minimal de l'API Paystack et confirmation des dons.
 * Montants : Paystack attend la sous-unité, soit le montant × 100, y compris en XOF.
 */
class Paystack
{
    private const API = 'https://api.paystack.co';

    public function enabled(): bool
    {
        return filled(config('services.paystack.secret_key'));
    }

    /**
     * Crée la transaction chez Paystack et renvoie l'adresse de la page de paiement.
     */
    public function initialize(Donation $donation): string
    {
        $response = $this->client()->post('/transaction/initialize', [
            'email' => $donation->email ?: config('services.paystack.fallback_email'),
            'amount' => $donation->amount * 100,
            'currency' => $donation->currency,
            'reference' => $donation->reference,
            'callback_url' => config('services.paystack.callback_url'),
            'metadata' => [
                'donation_id' => $donation->id,
                'custom_fields' => [
                    ['display_name' => 'Donateur', 'variable_name' => 'name', 'value' => $donation->name ?: 'Anonyme'],
                    ['display_name' => 'Message', 'variable_name' => 'message', 'value' => $donation->message ?: '-'],
                ],
            ],
        ]);

        $url = $response->json('data.authorization_url');
        if (! $response->successful() || ! $url) {
            throw new RuntimeException('Paystack : '.($response->json('message') ?? 'initialisation impossible'));
        }

        return $url;
    }

    /**
     * Demande à Paystack l'état réel du paiement, puis met le don à jour.
     */
    public function verify(Donation $donation): Donation
    {
        $response = $this->client()->get('/transaction/verify/'.rawurlencode($donation->reference));

        if ($response->successful() && is_array($response->json('data'))) {
            $this->apply($donation, $response->json('data'));
        }

        return $donation;
    }

    /**
     * Applique les données d'une transaction Paystack (vérification ou webhook signé).
     * Un don confirmé ne change plus ; le montant et la devise doivent correspondre.
     *
     * @param  array<string, mixed>  $data
     */
    public function apply(Donation $donation, array $data): void
    {
        if ($donation->status === 'success') {
            return;
        }

        $status = (string) ($data['status'] ?? '');
        $matches = (int) ($data['amount'] ?? 0) === $donation->amount * 100
            && strtoupper((string) ($data['currency'] ?? '')) === $donation->currency;

        if ($status === 'success' && $matches) {
            $donation->update([
                'status' => 'success',
                'channel' => $data['channel'] ?? null,
                'paid_at' => $data['paid_at'] ?? now(),
            ]);
        } elseif (in_array($status, ['failed', 'abandoned', 'reversed'], true)) {
            $donation->update(['status' => $status === 'reversed' ? 'failed' : $status]);
        }
    }

    public function validSignature(string $payload, ?string $signature): bool
    {
        $secret = (string) config('services.paystack.secret_key');

        return $secret !== '' && $signature !== null && hash_equals(hash_hmac('sha512', $payload, $secret), $signature);
    }

    private function client(): PendingRequest
    {
        return Http::baseUrl(self::API)
            ->withToken((string) config('services.paystack.secret_key'))
            ->acceptJson()
            ->timeout(20);
    }
}
