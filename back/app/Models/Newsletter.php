<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['subject', 'body', 'audience', 'recipients', 'user_id'])]
class Newsletter extends Model
{
    public const AUDIENCES = [
        'tous' => 'Tous les inscrits',
        'utilisateurs' => 'Utilisateurs',
        'contributeurs' => 'Contributeurs et « les deux »',
    ];

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
