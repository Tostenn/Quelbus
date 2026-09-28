<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSubscriberRequest;
use App\Models\Subscriber;
use Illuminate\Http\JsonResponse;

class SubscriberController extends Controller
{
    public function store(StoreSubscriberRequest $request): JsonResponse
    {
        $message = 'Merci ! Vous serez prévenu(e) du lancement de QuelBus.';

        // Robot détecté via le champ piège : on répond comme si tout allait bien, sans rien enregistrer.
        if (filled($request->input('website'))) {
            return response()->json(['message' => $message], 201);
        }

        // Une même adresse ne crée qu'une inscription ; on ne révèle pas si elle existait déjà.
        $subscriber = Subscriber::firstOrCreate(
            ['email' => $request->validated('email')],
            $request->safe()->only(['first_name', 'last_name', 'profile', 'message']),
        );

        return response()->json(['message' => $message], $subscriber->wasRecentlyCreated ? 201 : 200);
    }
}
