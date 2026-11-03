<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\URL;

#[Fillable(['first_name', 'last_name', 'email', 'profile', 'message', 'unsubscribed_at'])]
class Subscriber extends Model
{
    /**
     * Profils possibles : personne qui utilisera l'app, qui veut contribuer, ou les deux.
     */
    public const PROFILES = ['utilisateur', 'contributeur', 'les_deux'];

    protected function casts(): array
    {
        return ['unsubscribed_at' => 'datetime'];
    }

    /** Inscrits qui acceptent encore de recevoir des emails. */
    public function scopeSubscribed(Builder $query): void
    {
        $query->whereNull('unsubscribed_at');
    }

    /** Public d'une newsletter (voir Newsletter::AUDIENCES). */
    public function scopeAudience(Builder $query, string $audience): void
    {
        match ($audience) {
            'utilisateurs' => $query->where('profile', 'utilisateur'),
            'contributeurs' => $query->whereIn('profile', ['contributeur', 'les_deux']),
            default => null,
        };
    }

    /** Lien de désinscription signé, sans date d'expiration. */
    public function unsubscribeUrl(): string
    {
        return URL::signedRoute('subscribers.unsubscribe', $this);
    }

    public function isContributor(): bool
    {
        return in_array($this->profile, ['contributeur', 'les_deux'], true);
    }
}
