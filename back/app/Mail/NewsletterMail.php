<?php

namespace App\Mail;

use App\Models\Newsletter;
use App\Models\Subscriber;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Headers;
use Illuminate\Queue\SerializesModels;

/**
 * Newsletter écrite en Markdown dans le tableau de bord. « {prenom} » est remplacé par le prénom du destinataire.
 * Sans inscrit (aperçu, email de test), le prénom est fourni à part et il n'y a pas de lien de désinscription.
 */
class NewsletterMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public Newsletter $newsletter,
        public ?Subscriber $subscriber = null,
        public string $firstName = '',
    ) {
        $this->afterCommit();
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->newsletter->subject);
    }

    public function headers(): Headers
    {
        if (! $this->subscriber) {
            return new Headers;
        }

        // Désinscription en un clic depuis Gmail, Outlook, etc.
        return new Headers(text: [
            'List-Unsubscribe' => '<'.$this->subscriber->unsubscribeUrl().'>',
            'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
        ]);
    }

    public function content(): Content
    {
        $firstName = $this->subscriber->first_name ?? $this->firstName;

        return new Content(
            markdown: 'mail.newsletter',
            with: [
                'body' => str_replace('{prenom}', e($firstName), $this->newsletter->body),
                'siteUrl' => config('app.frontend_url'),
                'whatsappUrl' => config('app.whatsapp_url'),
                'unsubscribeUrl' => $this->subscriber?->unsubscribeUrl(),
            ],
        );
    }
}
