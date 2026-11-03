<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Subscriber;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * Désinscription depuis le lien signé des emails. L'ouverture du lien affiche une confirmation
 * (les antivirus de messagerie ouvrent les liens tout seuls) ; le bouton, ou le « un clic » de Gmail, désinscrit.
 */
class UnsubscribeController extends Controller
{
    public function show(Request $request, Subscriber $subscriber): View
    {
        return view('unsubscribe', [
            'subscriber' => $subscriber,
            'done' => $subscriber->unsubscribed_at !== null,
            'action' => $request->fullUrl(),
        ]);
    }

    public function destroy(Request $request, Subscriber $subscriber): View
    {
        if (! $subscriber->unsubscribed_at) {
            $subscriber->update(['unsubscribed_at' => now()]);
        }

        return view('unsubscribe', ['subscriber' => $subscriber, 'done' => true, 'action' => null]);
    }
}
