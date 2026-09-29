<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSubscriberRequest;
use App\Mail\SubscriptionConfirmed;
use App\Models\Subscriber;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Mail;

class SubscriberController extends Controller
{
    public function store(StoreSubscriberRequest $request): JsonResponse
    {
        $message = 'Merci ! Un email de confirmation arrive dans votre boîte. On vous recontacte très bientôt.';

        // Robot détecté via le champ piège : on répond comme si tout allait bien, sans rien enregistrer.
        if (filled($request->input('website'))) {
            return response()->json(['message' => $message], 201);
        }

        // Une même adresse ne crée qu'une inscription, et ne reçoit qu'un seul email de confirmation.
        $subscriber = Subscriber::firstOrCreate(
            ['email' => $request->validated('email')],
            $request->safe()->only(['first_name', 'last_name', 'profile', 'message']),
        );

        if (! $subscriber->wasRecentlyCreated) {
            return response()->json(['message' => 'Cette adresse est déjà inscrite. On vous recontacte très bientôt.']);
        }

        // Mis en file d'attente (le mail implémente ShouldQueue).
        Mail::to($subscriber->email, "{$subscriber->first_name} {$subscriber->last_name}")
            ->send(new SubscriptionConfirmed($subscriber));

        return response()->json(['message' => $message], 201);
    }
}
