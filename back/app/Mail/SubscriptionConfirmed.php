<?php

namespace App\Mail;

use App\Models\Subscriber;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Email envoyé après une inscription : confirme l'inscription et annonce la suite selon le profil.
 * Toujours mis en file d'attente (ShouldQueue) : un worker `php artisan queue:work` doit tourner.
 */
class SubscriptionConfirmed extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public Subscriber $subscriber)
    {
        $this->afterCommit();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: match ($this->subscriber->profile) {
                'contributeur' => 'Merci de rejoindre les contributeurs de QuelBus',
                'les_deux' => 'Bienvenue dans l’aventure QuelBus',
                default => 'Votre inscription à QuelBus est confirmée',
            },
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.subscription-confirmed',
            with: [
                'siteUrl' => config('app.frontend_url'),
                'repoUrl' => 'https://github.com/Tostenn/Quelbus',
            ],
        );
    }
}
