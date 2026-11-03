<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\NewsletterMail;
use App\Models\Newsletter;
use App\Models\Subscriber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;

/**
 * Newsletter du tableau de bord : aperçu, email de test à soi-même, envoi aux inscrits et historique.
 */
class AdminNewsletterController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'audiences' => collect(Newsletter::AUDIENCES)->map(fn (string $label, string $value) => [
                'value' => $value,
                'label' => $label,
                'count' => Subscriber::subscribed()->audience($value)->count(),
            ])->values(),
            'unsubscribed' => Subscriber::whereNotNull('unsubscribed_at')->count(),
            'data' => Newsletter::with('user:id,name')->latest('id')->limit(30)->get()->map(fn (Newsletter $n) => [
                'id' => $n->id,
                'subject' => $n->subject,
                'body' => $n->body,
                'audience' => $n->audience,
                'audience_label' => Newsletter::AUDIENCES[$n->audience] ?? $n->audience,
                'recipients' => $n->recipients,
                'sent_by' => $n->user?->name,
                'created_at' => $n->created_at,
            ]),
        ]);
    }

    public function preview(Request $request): JsonResponse
    {
        $mail = new NewsletterMail(new Newsletter($this->validated($request, false)), firstName: 'Awa');

        return response()->json(['data' => ['html' => $mail->render()]]);
    }

    public function test(Request $request): JsonResponse
    {
        $newsletter = new Newsletter($this->validated($request, false));
        $admin = $request->user();

        Mail::to($admin->email, $admin->name)->sendNow(new NewsletterMail($newsletter, firstName: explode(' ', $admin->name)[0]));

        return response()->json(['message' => "Email de test envoyé à {$admin->email}."]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request, true);
        $recipients = Subscriber::subscribed()->audience($data['audience'])->orderBy('id')->get();

        if ($recipients->isEmpty()) {
            return response()->json(['message' => 'Aucun inscrit dans ce public.', 'errors' => ['audience' => ['Aucun inscrit dans ce public.']]], 422);
        }

        $newsletter = DB::transaction(function () use ($data, $recipients, $request) {
            $newsletter = Newsletter::create([...$data, 'recipients' => $recipients->count(), 'user_id' => $request->user()->id]);

            // Un email par inscrit, espacés pour rester sous les limites d'envoi de l'hébergeur.
            $delay = config('mail.newsletter_delay');
            foreach ($recipients->values() as $i => $subscriber) {
                Mail::to($subscriber->email, "{$subscriber->first_name} {$subscriber->last_name}")
                    ->later(now()->addSeconds($i * $delay), new NewsletterMail($newsletter, $subscriber));
            }

            return $newsletter;
        });

        $count = $newsletter->recipients;

        return response()->json([
            'message' => $count > 1 ? "Newsletter en cours d'envoi à {$count} inscrits." : "Newsletter en cours d'envoi à 1 inscrit.",
        ], 201);
    }

    /** @return array<string, string> */
    private function validated(Request $request, bool $withAudience): array
    {
        return $request->validate([
            'subject' => ['required', 'string', 'max:150'],
            'body' => ['required', 'string', 'max:50000'],
            'audience' => [$withAudience ? 'required' : 'nullable', Rule::in(array_keys(Newsletter::AUDIENCES))],
        ], [
            'subject.required' => 'Indiquez l’objet de l’email.',
            'subject.max' => 'L’objet est trop long (150 caractères maximum).',
            'body.required' => 'Écrivez le contenu de la newsletter.',
            'body.max' => 'Le contenu est trop long.',
            'audience.required' => 'Choisissez à qui envoyer la newsletter.',
            'audience.in' => 'Choisissez un des publics proposés.',
        ]);
    }
}
