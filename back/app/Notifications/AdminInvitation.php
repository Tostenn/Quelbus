<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Invitation d'un nouvel admin : il choisit lui-même son mot de passe, rien ne circule en clair.
 */
class AdminInvitation extends Notification
{
    public function __construct(public string $token, public string $invitedBy) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = config('app.frontend_url').'/mot-de-passe/nouveau?'.http_build_query([
            'token' => $this->token,
            'email' => $notifiable->email,
            'invitation' => 1,
        ]);

        return (new MailMessage)
            ->subject('Vous avez accès au tableau de bord QuelBus')
            ->greeting("Bonjour {$notifiable->name},")
            ->line("{$this->invitedBy} vous a ajouté comme administrateur de QuelBus.")
            ->line('Choisissez votre mot de passe pour accéder au tableau de bord : statistiques, signalements, inscrits et dons.')
            ->action('Choisir mon mot de passe', $url)
            ->line('Ce lien est valable 3 jours. Passé ce délai, demandez une nouvelle invitation.')
            ->salutation('L’équipe QuelBus');
    }
}
