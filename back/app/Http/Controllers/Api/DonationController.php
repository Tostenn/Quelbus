<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDonationRequest;
use App\Models\Donation;
use App\Services\Paystack;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class DonationController extends Controller
{
    public function store(StoreDonationRequest $request, Paystack $paystack): JsonResponse
    {
        if (! $paystack->enabled()) {
            return response()->json(['message' => 'Les dons ne sont pas encore ouverts.'], 503);
        }

        // Champ piège rempli : robot, on ne crée rien.
        if (filled($request->input('website'))) {
            return response()->json(['message' => 'Merci !'], 422);
        }

        $donation = Donation::create([
            ...$request->safe()->only(['amount', 'name', 'email', 'message']),
            'reference' => 'QB-'.Str::upper(Str::random(14)),
            'currency' => config('services.paystack.currency'),
        ]);

        try {
            $url = $paystack->initialize($donation);
        } catch (Throwable $e) {
            Log::warning('Don non initialisé', ['reference' => $donation->reference, 'erreur' => $e->getMessage()]);
            $donation->update(['status' => 'failed']);

            return response()->json(['message' => 'Le paiement est indisponible pour le moment. Réessayez dans un instant.'], 502);
        }

        return response()->json(['reference' => $donation->reference, 'authorization_url' => $url], 201);
    }

    /**
     * Retour de la page de paiement : l'état est toujours vérifié auprès de Paystack, jamais déduit de l'URL.
     */
    public function show(string $reference, Paystack $paystack): JsonResponse
    {
        $donation = Donation::where('reference', $reference)->firstOrFail();

        if ($donation->status === 'pending' && $paystack->enabled()) {
            rescue(fn () => $paystack->verify($donation), report: true);
        }

        return response()->json(['data' => [
            'reference' => $donation->reference,
            'status' => $donation->status,
            'amount' => $donation->amount,
            'currency' => $donation->currency,
            'name' => $donation->name,
        ]]);
    }

    public function webhook(Request $request, Paystack $paystack): JsonResponse
    {
        if (! $paystack->validSignature($request->getContent(), $request->header('x-paystack-signature'))) {
            return response()->json(['message' => 'Signature invalide.'], 401);
        }

        $data = $request->input('data', []);
        if ($request->input('event') === 'charge.success' && is_array($data) && isset($data['reference'])) {
            $donation = Donation::where('reference', $data['reference'])->first();
            if ($donation) {
                $paystack->apply($donation, $data);
            }
        }

        return response()->json(['received' => true]);
    }
}
