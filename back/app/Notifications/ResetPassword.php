<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Lien de réinitialisation du mot de passe d'un admin, vers la page du site (front).
 */
class ResetPassword extends Notification
{
    public function __construct(public string $token) {}

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
        ]);

        return (new MailMessage)
            ->subject('Réinitialiser votre mot de passe QuelBus')
            ->greeting("Bonjour {$notifiable->name},")
            ->line('Vous avez demandé un nouveau mot de passe pour le tableau de bord de QuelBus.')
            ->action('Choisir un nouveau mot de passe', $url)
            ->line('Ce lien est valable une heure.')
            ->line('Si vous n’êtes pas à l’origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.')
            ->salutation('L’équipe QuelBus');
    }
}
